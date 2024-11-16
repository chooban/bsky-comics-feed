import { Worker, WorkerOptions } from 'bullmq'
import { NEW_POST_QUEUE } from '.'
import { findOrCreateProject } from '../db/projects'
import { Database } from '../db'
import { createUUID, UUID } from '../types/uuid'
import { isKickstarterUrl } from '../util/kickstarter'

export const newPostsWorker = (db: Database, config: WorkerOptions) => {
  const postsWorker = new Worker<any, UUID[]>(
    NEW_POST_QUEUE,
    async (job) => {
      if (!job.data.post) {
        return []
      }

      // For each link provided, check that it's a KS link,
      // create a project, and link the posts to it
      const projectIds: UUID[] = []
      for (const l of job.data.post.links) {
        if (!isKickstarterUrl(l)) {
          continue
        }
        const projectId = await findOrCreateProject(db, l)
        if (!projectId) {
          console.log('Could not determine a project to index')
          continue
        }

        console.log(`Found project with ID of ${projectId}`)

        await db
          .insertInto('post')
          .values({
            postId: createUUID(),
            projectId: projectId,
            uri: job.data.post.uri,
            cid: job.data.post.cid,
            indexedAt: job.data.post.indexedAt,
          })
          .onConflict((oc) => oc.doNothing())
          .execute()

        projectIds.push(projectId)
      }

      // const thread = await agent.getPostThread({ uri: job.data.post.uri })
      // if (!AppBskyFeedDefs.isThreadViewPost(thread.data.thread)) {
      //   throw new Error('Expected a thread view post')
      // }
      // const post = thread.data.thread.post
      // if (!AppBskyFeedPost.isRecord(post.record)) {
      //   throw new Error('Expected a post with a record')
      // }
      return projectIds
    },
    config,
  )

  return postsWorker
}
