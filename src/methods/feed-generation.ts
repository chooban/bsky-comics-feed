import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { validateAuth } from '../auth'
import { AtUri } from '@atproto/syntax'
import { countFeedRequest } from '../metrics'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req }) => {
    const feedUri = new AtUri(params.feed)
    const algo = algos[feedUri.rkey]

    if (
      feedUri.hostname !== ctx.cfg.publisherDid ||
      feedUri.collection !== 'app.bsky.feed.generator' ||
      !algo
    ) {
      console.log(`Bad feed request`)
      console.log(`${feedUri.hostname} !== ${ctx.cfg.publisherDid}?`)
      console.log(`${feedUri.collection} !== app.bsky.feed.generator?`)
      console.log(`!algo (${feedUri.rkey})? ${!algo}`)
      console.log(`${Object.keys(algos)}`)

      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }
    /**
     * Example of how to check auth if giving user-specific results:
     *
     */

    const body = await algo(ctx, params)
    const requesterDid = await validateAuth(
      req,
      ctx.cfg.serviceDid,
      ctx.didResolver,
    )
    if (!ctx.cfg.permittedUsers.includes(requesterDid)) {
      countFeedRequest(feedUri.rkey)
    } else {
      console.log('Not counting feed request')
    }

    return {
      encoding: 'application/json',
      body: body,
    }
  })
}
