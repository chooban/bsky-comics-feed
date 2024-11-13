import { AppContext } from './config'
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { Queue } from 'bullmq'
import { getKickstarterLinks } from './util/records'
import { NEW_POST_QUEUE, scheduleNewPostTask } from './queue'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  constructor(
    public ctx: AppContext,
    public service: string,
  ) {
    super(ctx.db, service)
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
          links: getKickstarterLinks(create.record),
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
      postsToCreate.forEach(async (element) => {
        await scheduleNewPostTask(element)
      })
    }
  }
}
