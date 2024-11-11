import { AppContext } from './config'
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { Queue } from 'bullmq'
import { RichText } from '@atproto/api'
import { getLinks } from './util/records'

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
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          links: getLinks(create.record),
          indexedAt: new Date().toISOString(),
        }
      })
      .filter((r) => {
        return r.links.length > 0
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
