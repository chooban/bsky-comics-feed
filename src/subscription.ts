import { AppContext } from './config'
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { Queue } from 'bullmq'

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

    // This logs the text of every post off the firehose.
    // Just for fun :)
    // Delete before actually using
    // for (const post of ops.posts.creates) {
    //   if (post.record.text.includes('https')) {
    //     console.log(post.record.text)
    //   }
    // }

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        // only alf-related posts
        return create.record.text.toLowerCase().includes('alf')
      })
      .map((create) => {
        // map alf-related posts to a db row
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
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()

      postsToCreate.forEach((element) => {
        if (this.queue) {
          console.log('Queueing a job')
          this.queue.add('newpost', { uri: element.uri, cid: element.cid })
        } else {
          console.log('No queue')
        }
      })
    }
  }
}
