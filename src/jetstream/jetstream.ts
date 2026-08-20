import { JetstreamSubscription } from '@atcute/jetstream'
import { AppContext } from '../config.js'
import { KyselyDatabase } from '../db/index.js'
import { is } from '@atcute/lexicons'
import { AppBskyFeedPost } from '@atcute/bluesky'
import { NewPost } from '../queue/new-post-worker.js'
import { getCrowdfundingLinks } from '../util/records.js'
import { scheduleNewPostTask } from '../queue/index.js'

export class Jetstream {
  private db: KyselyDatabase
  constructor(
    public ctx: AppContext,
    public service: string,
  ) {
    this.db = ctx.db
  }

  async updateCursor(cursor: number) {
    await this.db
      .insertInto('sub_state')
      .values({ service: this.service, cursor })
      .onConflict((oc) => oc.column('service').doUpdateSet({ cursor }))
      .execute()
  }

  async getCursor(): Promise<{ cursor?: number }> {
    const res = await this.db
      .selectFrom('sub_state')
      .selectAll()
      .where('service', '=', this.service)
      .executeTakeFirst()
    return res ? { cursor: res.cursor } : {}
  }

  async start() {
    const { cursor } = await this.getCursor()

    const jetstream = new JetstreamSubscription({
      url: 'wss://jetstream2.us-east.bsky.network',
      wantedCollections: ['app.bsky.feed.post'],
      cursor: cursor ?? (Date.now() - 6 * 60 * 60 * 1000) * 1_000,
    })
    let eventCount = 0
    try {
      for await (const evt of jetstream) {
        eventCount += 1

        if (eventCount % 20 === 0) {
          await this.updateCursor(evt.time_us)
        }

        if (evt.kind === 'commit') {
          const commit = evt.commit

          if (commit.collection !== 'app.bsky.feed.post') {
            continue
          }

          if (commit.operation === 'create') {
            const record = commit.record
            if (!is(AppBskyFeedPost.mainSchema, record)) {
              continue
            }
            const links = getCrowdfundingLinks(record)
            if (links.length == 0) {
              continue
            }
            const newPostTask: NewPost = {
              links,
              indexedAt: new Date().toISOString(),
              createdAt: record.createdAt,
              cid: commit.cid,
              author: evt.did,
              uri: `at://${evt.did}/app.bsky.feed.post/${commit.rkey}`,
            }
            // console.log({ newPostTask, evt, record, commit })
            // console.log({ newPostTask, commit })
            scheduleNewPostTask(newPostTask)
          }
        }
      }
    } catch (err) {
      console.error('repo subscription errored', err)
      setTimeout(() => this.start(), 1000)
    }
  }
}
