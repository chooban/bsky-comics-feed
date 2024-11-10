import { AppContext } from './config'
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { Queue } from 'bullmq'
import { RichText } from '@atproto/api'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  public queue: Queue
  constructor(
    public ctx: AppContext,
    public service: string,
  ) {
    super(ctx.db, service)
    this.queue = ctx.queue
  }

  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        const rt = new RichText({
          text: create.record.text,
          facets: create.record.facets,
        })
        for (const segment of rt.segments()) {
          if (segment.isLink()) {
            console.log(segment.link?.uri)
            if (segment.link?.uri.includes('kickstarter.com')) {
              console.log(`Got one! ${segment.link?.uri}`)
              return true
            }
          }
        }
        return false
      })
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      postsToCreate.forEach((element) => {
        if (this.queue) {
          this.queue.add('newpost', { post: element })
        } else {
          console.log('No queue')
        }
      })
    }
  }
}
