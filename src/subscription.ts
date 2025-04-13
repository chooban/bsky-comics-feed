import { AppContext } from './config'
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { getKickstarterLinks } from './util/records'
import { scheduleNewPostTask } from './queue'
import { NewPost } from './queue/new-post-worker'

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
    const postsToCreate: Array<NewPost> = ops.posts.creates
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          author: create.author,
          links: getKickstarterLinks(create.record),
          indexedAt: new Date().toISOString(),
          createdAt: create.record.createdAt,
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
        scheduleNewPostTask(element)
      })
    }
  }
}
