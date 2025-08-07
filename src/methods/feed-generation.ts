import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../config.js'
import { AtUri } from '@atproto/syntax'
import { countFeedRequest, countFeedSize } from '../metrics.js'
import { buildFeed } from '../algos/kickstarter-algo.js'
import { Express, Request, Response } from 'express'
export interface QueryParams {
  feed: string
  limit: number
  cursor?: string
}

export default function (server: Express, ctx: AppContext) {
  server.get(
    '/xrpc/app.bsky.feed.getFeedSkeleton',
    async (req: Request, res: Response, next) => {
      console.log(`Received feed request`)
      const { query } = req
      const feed = query.feed as string
      const cursor = query.cursor ? (query.cursor as string) : undefined
      const limit = query.limit ? parseInt(query.limit as string) : 0
      const props: QueryParams = {
        feed,
        limit,
        cursor,
      }

      const feedUri = new AtUri(feed)
      const algo = ctx.cfg.feeds[feedUri.rkey]

      if (
        feedUri.hostname !== ctx.cfg.publisherDid ||
        feedUri.collection !== 'app.bsky.feed.generator' ||
        !algo
      ) {
        console.log(`Bad feed request`)
        console.log(`${feedUri.hostname} !== ${ctx.cfg.publisherDid}?`)
        console.log(`${feedUri.collection} !== app.bsky.feed.generator?`)
        console.log(`!algo (${feedUri.rkey})? ${!algo}`)
        console.log(`${Object.keys(ctx.cfg.feeds)}`)

        next(
          new InvalidRequestError(
            'Unsupported algorithm',
            'UnsupportedAlgorithm',
          ),
        )
        return
      }

      const body = await buildFeed(algo.parentCategory, algo.categories)(
        ctx,
        props,
      )

      countFeedRequest(feedUri.rkey)
      if (!cursor) {
        countFeedSize(feedUri.rkey, body.feed.length)
      }

      res.json(body)
    },
  )
}
