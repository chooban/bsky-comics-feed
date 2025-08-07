import { JetstreamSubscription } from '@atcute/jetstream'
import { AppContext } from '../config'
import { KyselyDatabase } from '../db'
import { is } from '@atcute/lexicons'
import { AppBskyFeedPost } from '@atcute/bluesky'
import { NewPost } from '../queue/new-post-worker'
import { getKickstarterLinks } from '../util/records'
// import { scheduleNewPostTask } from '../queue'

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
      .updateTable('sub_state')
      .set({ cursor })
      .where('service', '=', this.service)
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

  async handleEvent() {}

  async start() {
    const { cursor } = await this.getCursor()

    const jetstream = new JetstreamSubscription({
      url: 'wss://jetstream2.us-east.bsky.network',
      wantedCollections: ['app.bsky.feed.post'],
      cursor,
    })
    try {
      for await (const evt of jetstream) {
        // this.handleEvent(evt).catch((err) => {
        //   console.error('repo subscription could not handle message', err)
        // })
        // if (evt.kind === 'commit' && evt.seq % 20 === 0) {
        //   await this.updateCursor(evt.seq)
        // }
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
            console.log(`${record.text}`)
			const newPostTask: NewPost = {
				links: getKickstarterLinks(record),
				indexedAt: new Date().toISOString(),
				createdAt: record.createdAt,
				cid: commit.cid,
				author: evt.did,
				uri: `at://`
			}
			console.log({ newPostTask, commit, })
			// scheduleNewPostTask(newPostTask)

          }
        }
      }
    } catch (err) {
      console.error('repo subscription errored', err)
      setTimeout(() => this.start(), 1000)
    }
  }
}
