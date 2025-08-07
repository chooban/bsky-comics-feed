import { AppContext } from '../config'
import { AtUri } from '@atproto/syntax'
import { Express, Request, Response } from 'express'

export default function (server: Express, ctx: AppContext) {
  const algos = ctx.cfg.feeds

  server.get(
    '/xrpc/app.bsky.feed.describeFeedGenerator',
    async (req: Request, res: Response) => {
      console.log(`Getting the feeds for the describer`)
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
    },
  )
}
