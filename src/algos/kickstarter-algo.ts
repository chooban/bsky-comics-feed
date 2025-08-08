import { AppContext } from '../config'
import { QueryParams } from '../methods/feed-generation.js'

export const buildFeed = (
  parentCategory: string | undefined,
  categories: string[] | undefined,
) => {
  return async (ctx: AppContext, params: QueryParams) => {
    if (!parentCategory && categories?.length == 0) {
      throw new Error('Cannot create feed')
    }
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - 3)

    let builder = ctx.db
      .selectFrom('post')
      .innerJoin('project', 'project.projectId', 'post.projectId')
      .selectAll('post')
      .where('post.createdAt', '>', dateLimit.toISOString())
      .orderBy('indexedAt', 'desc')
      .orderBy('cid', 'desc')
      .limit(params.limit)

    if (parentCategory) {
      if (!!categories && categories.length > 0) {
        builder = builder.where((eb) =>
          eb('project.parentCategory', '=', parentCategory).or(
            eb('project.category', 'in', categories),
          ),
        )
      } else {
        builder = builder.where('project.parentCategory', '=', parentCategory)
      }
    } else {
      if (!categories || categories.length < 1) {
        throw new Error('Poorly configured feed')
      }
      builder = builder.where('project.category', 'in', categories)
    }

    if (params.cursor) {
      const timeStr = new Date(parseInt(params.cursor, 10)).toISOString()
      builder = builder.where('post.indexedAt', '<', timeStr)
    }
    const res = await builder.execute()

    const feed = res
      .map((row) => ({
        post: row.uri,
      }))
      .filter((p) => p.post !== 'at://') // We had some bad data

    let cursor: string | undefined
    const last = res.at(-1)
    if (last) {
      cursor = new Date(last.indexedAt).getTime().toString(10)
    }

    return {
      cursor,
      feed,
    }
  }
}
