import { AppContext } from '../config.js'

type PopularProject = {
  projectId: string
  title: string
  uri: string
  details: object | null
  postCount: number
}

type PopularFeed = {
  feedKey: string
  title: string
  postCount: number
  topProjects: PopularProject[]
}

const getPopularContent = async (ctx: AppContext) => {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const oneWeekAgoStr = oneWeekAgo.toISOString()

  const feedsWithProjects: PopularFeed[] = []

  for (const [feedKey, feedConfig] of Object.entries(ctx.cfg.feeds)) {
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
        continue
      }
      builder = builder.where('project.category', 'in', categories)
    }

    const topProjects = await builder
      .groupBy('project.projectId')
      .orderBy('postCount', 'desc')
      .execute()

    const totalPosts = await ctx.db
      .selectFrom('post')
      .innerJoin('project', 'project.projectId', 'post.projectId')
      .select((eb) => [eb.fn.count('post.postId').as('postCount')])
      .where('post.createdAt', '>', oneWeekAgoStr)
      .where((eb) => {
        if (parentCategory && parentCategory.length > 0) {
          if (categories.length > 0) {
            return eb
              .eb('project.parentCategory', '=', parentCategory)
              .or(eb('project.category', 'in', categories))
          }
          return eb('project.parentCategory', '=', parentCategory)
        }
        return eb('project.category', 'in', feedConfig.categories || [])
      })
      .executeTakeFirst()

    feedsWithProjects.push({
      feedKey,
      title: feedConfig.title,
      postCount: Number(totalPosts?.postCount || 0),
      topProjects: topProjects
        .map((p) => ({
          projectId: p.projectId,
          title: p.title,
          uri: p.uri,
          details: p.details,
          postCount: Number(p.postCount),
          category: p.category,
          parentCategory: p.parentCategory,
        }))
        .slice(0, 5),
    })
  }

  // feedsWithProjects.sort((a, b) => b.postCount - a.postCount)

  return {
    categories: feedsWithProjects,
    fromDate: oneWeekAgo.toDateString(),
    hostname: ctx.cfg.blueskyHandle,
  }
}

export default (ctx: AppContext) => {
  return async (req, res) => {
    try {
      const data = await getPopularContent(ctx)
      res.render('popular', data)
    } catch (error) {
      console.error('Error fetching popular content:', error)
      res.status(500).send('Internal server error')
    }
  }
}
