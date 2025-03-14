import { AppContext } from '../config'
import { AtUri } from '@atproto/syntax'
import { countFeedRequest } from '../metrics'
import { buildFeed } from '../algos/kickstarter-algo'

export default function (ctx: AppContext) {
  return async ({ query: params }, res) => {
    console.log(`Parsing ${params['feed']}`)
    const feedUri = new AtUri(params.feed)
    const algo = ctx.cfg.feeds[feedUri.rkey]

    if (
      feedUri.hostname !== ctx.cfg.publisherDid ||
      feedUri.collection !== 'app.bsky.feed.generator' ||
      !algo
    ) {
      console.log(`Bad feed request`)
      console.log(`Hostname: ${feedUri.hostname} !== ${ctx.cfg.publisherDid}`)
      console.log(
        `Collection: ${feedUri.collection} !== app.bsky.feed.generator`,
      )
      console.log(`!algo (${feedUri.rkey})? ${!algo}`)
      console.log(`${Object.keys(ctx.cfg.feeds)}`)

      res.status(404).json({ message: 'Feed not found' })

      return
    }

    console.log(`Building feed for ${algo.key}`)
    const body = await buildFeed(algo.parentCategory, algo.categories)(
      ctx,
      params,
    )

    countFeedRequest(feedUri.rkey)

    return res.json(body)
  }
}
