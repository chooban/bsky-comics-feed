import { findOrCreateProject } from '../db/projects'
import { KyselyDatabase } from '../db'
import { createUUID, UUID } from '../types/uuid'
import { isKickstarterUrl } from '../util/kickstarter'

export type NewPost = {
  uri: string
  cid: string
  links: string[]
  indexedAt: string
  createdAt: string
}

export type NewPostTask = {
  post: NewPost
}

export const newPostProcessor =
  (db: KyselyDatabase) => async (job: { post: NewPost }, cb) => {
    if (!job.post) {
      console.log(`No post on job: ${job}`)
      return cb(null, [])
    }

    // For each link provided, check that it's a KS link,
    // create a project, and link the posts to it
    const projectIds: UUID[] = []
    for (const l of job.post.links) {
      if (!isKickstarterUrl(l)) {
        continue
      }
      const projectId = await findOrCreateProject(db, l)
      if (!projectId) {
        console.log('Could not determine a project to index')
        continue
      }

      await db
        .insertInto('post')
        .values({
          postId: createUUID(),
          projectId: projectId,
          uri: job.post.uri,
          cid: job.post.cid,
          indexedAt: job.post.indexedAt,
          createdAt: job.post.createdAt,
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
    cb(null, projectIds)
  }
