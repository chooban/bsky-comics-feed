import { AppContext } from '../config.js'

const getFeedProjects = async (ctx: AppContext, feedKey: string) => {
  const feedConfig = ctx.cfg.feeds[feedKey]
  if (!feedConfig) {
    return null
  }

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const oneWeekAgoStr = oneWeekAgo.toISOString()

  let builder = ctx.db
    .selectFrom('post')
    .innerJoin('project', 'project.projectId', 'post.projectId')
    .select([
      'project.projectId',
      'project.title',
      'project.uri',
      'project.details',
      'project.category',
      'project.parentCategory',
      'project.addedAt',
    ])
    .select((eb) => [eb.fn.count('post.postId').as('postCount')])
    .where('post.createdAt', '>', oneWeekAgoStr)

  const parentCategory = feedConfig.parentCategory
  const categories = feedConfig.categories ? feedConfig.categories : []

  if (parentCategory && parentCategory.length > 0) {
    if (categories.length > 0) {
      builder = builder.where((eb) =>
        eb('project.parentCategory', '=', parentCategory).or(
          eb('project.category', 'in', categories),
        ),
      )
    } else {
      builder = builder.where('project.parentCategory', '=', parentCategory)
    }
  } else {
    if (categories.length === 0) {
      console.warn(`Skipping poorly configured feed: ${feedKey}`)
      return null
    }
    builder = builder.where('project.category', 'in', categories)
  }

  const projects = await builder
    .groupBy('project.projectId')
    .orderBy('postCount', 'desc')
    .execute()

  const formattedProjects = projects.map((p) => ({
    projectId: p.projectId,
    title: p.title,
    uri: p.uri,
    details: p.details,
    postCount: Number(p.postCount),
    category: p.category,
    parentCategory: p.parentCategory,
    createdAt: p.addedAt,
  }))

  return {
    feedKey,
    title: feedConfig.title,
    description: feedConfig.description,
    projects: formattedProjects,
    fromDate: oneWeekAgo.toDateString(),
    hostname: ctx.cfg.blueskyHandle,
    error: null,
  }
}

export default (ctx: AppContext) => {
  return async (req, res) => {
    try {
      const feedKey = req.params.feedKey
      if (!feedKey) {
        return res.status(400).send('Feed key is required')
      }

      const data = await getFeedProjects(ctx, feedKey)
      if (!data) {
        return res.status(404).render('feed-projects', {
          error: 'Feed not found',
          feedKey,
          hostname: ctx.cfg.blueskyHandle,
        })
      }

      res.render('feed-projects', data)
    } catch (error) {
      console.error('Error fetching feed projects:', error)
      res.status(500).send('Internal server error')
    }
  }
}
