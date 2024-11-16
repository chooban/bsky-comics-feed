import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { getDefaultAutoSelectFamilyAttemptTimeout } from 'net'

export const buildFeed = (categories: string[]) => {
  return async (ctx: AppContext, params: QueryParams) => {
    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - 3)

    let builder = ctx.db
      .selectFrom('post')
      .innerJoin('project', 'project.projectId', 'post.projectId')
      .selectAll('post')
      .where('project.category', 'in', categories)
      .where('post.indexedAt', '>', dateLimit.toISOString())
      .orderBy('indexedAt', 'desc')
      .orderBy('cid', 'desc')
      .limit(params.limit)

    if (params.cursor) {
      const timeStr = new Date(parseInt(params.cursor, 10)).toISOString()
      builder = builder.where('post.indexedAt', '<', timeStr)
    }
    const res = await builder.execute()

    const feed = res.map((row) => ({
      post: row.uri,
    }))

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
