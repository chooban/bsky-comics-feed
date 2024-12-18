import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import { validateAuth } from '../auth'
import { AtUri } from '@atproto/syntax'
import { countFeedRequest } from '../metrics'
import { buildFeed } from '../algos/kickstarter-algo'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req }) => {
    const feedUri = new AtUri(params.feed)
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

      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }
    /**
     * Example of how to check auth if giving user-specific results:
     *
     */

    const body = await buildFeed(algo.parentCategory, algo.categories)(
      ctx,
      params,
    )

    try {
      const requesterDid = await validateAuth(
        req,
        ctx.cfg.serviceDid,
        ctx.didResolver,
      )
      if (!ctx.cfg.permittedUsers.includes(requesterDid)) {
        countFeedRequest(feedUri.rkey)
      }
    } catch (e) {
      console.log(`Error authenticating user: ${e}`)
    }

    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
