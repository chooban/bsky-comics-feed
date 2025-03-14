import { AppContext } from '../config'
import { AtUri } from '@atproto/syntax'

export default function (ctx: AppContext) {
  const algos = ctx.cfg.feeds

  return (req, res) => {
    const feeds = Object.keys(algos).map((shortname) => ({
      uri: AtUri.make(
        ctx.cfg.publisherDid,
        'app.bsky.feed.generator',
        shortname,
      ).toString(),
    }))
    res.json({
      did: ctx.cfg.serviceDid,
      feeds,
    })
  }
}
