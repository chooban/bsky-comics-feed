import { AppContext } from '../config.js'
import { atUriToBskyUrl } from '../util/uri-helpers.js'
import { getProfileByDid, ProfileData } from '../util/bluesky-profile.js'
import { UUID } from '../types/uuid.js'

const getProjectPosts = async (ctx: AppContext, projectId: UUID) => {
  // Fetch project details
  const project = await ctx.db
    .selectFrom('project')
    .where('projectId', '=', projectId as UUID)
    .selectAll()
    .executeTakeFirst()

  if (!project) {
    return null
  }

  // Fetch all posts for this project, ordered by createdAt DESC
  const posts = await ctx.db
    .selectFrom('post')
    .where('projectId', '=', projectId as UUID)
    .select(['postId', 'uri', 'author', 'createdAt'])
    .orderBy('createdAt', 'desc')
    .execute()

  // Format posts for display
  const formattedPosts = posts.map((p) => {
    const bskyUrl = atUriToBskyUrl(p.uri, p.author)
    return {
      postId: p.postId,
      uri: p.uri,
      author: p.author,
      createdAt: p.createdAt,
      bskyUrl: bskyUrl || `https://bsky.app/profile/${p.author}`,
      atUri: p.uri,
    }
  })

  // Fetch top 5 posters for this project
  const topPosters = await ctx.db
    .selectFrom('post')
    .where('projectId', '=', projectId as UUID)
    .select(['author'])
    .groupBy('author')
    .select((eb) => [eb.fn.count('author').as('postCount')])
    .orderBy('postCount', 'desc')
    .limit(5)
    .execute()

  // Fetch profile data for each top poster in parallel
  const posterProfilePromises = topPosters.map(async (p) => {
    const profile = await getProfileByDid(p.author)
    return {
      did: p.author,
      postCount: Number(p.postCount),
      profile,
    }
  })

  const posterResults = await Promise.all(posterProfilePromises)

  // Filter out posters where we couldn't resolve the DID to a profile
  const formattedTopPosters = posterResults
    .filter((p) => p.profile !== null)
    .map((p) => ({
      did: p.did,
      postCount: p.postCount,
      profile: p.profile as ProfileData,
    }))

  return {
    projectId,
    title: project.title,
    description: project.details?.['blurb'] || '',
    category: project.category,
    parentCategory: project.parentCategory,
    projectUri: project.uri,
    posts: formattedPosts,
    postCount: formattedPosts.length,
    topPosters: formattedTopPosters,
    hostname: ctx.cfg.hostname,
    error: null,
  }
}

export default (ctx: AppContext) => {
  return async (req, res) => {
    try {
      const projectId = req.params.projectId
      if (!projectId) {
        return res.status(400).send('Project ID is required')
      }

      const data = await getProjectPosts(ctx, projectId)
      if (!data) {
        return res.status(404).render('project-posts', {
          error: 'Project not found',
          projectId,
          hostname: ctx.cfg.hostname,
        })
      }

      res.render('project-posts', data)
    } catch (error) {
      console.error('Error fetching project posts:', error)
      res.status(500).send('Internal server error')
    }
  }
}
