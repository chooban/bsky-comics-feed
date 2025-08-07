import { buildConfig } from '../config'
import { createDb } from '../db'
import { findOrCreateProject } from '../db/projects'
import { createUUID, UUID } from '../types/uuid'
import { isKickstarterUrl } from '../util/kickstarter'

export type NewPost = {
  uri: string
  cid: string
  links: string[]
  author: string
  indexedAt: string
  createdAt: string
}

export type NewPostTask = {
  post: NewPost
}

export const newPostProcessor = async (job: { post: NewPost }, cb) => {
  if (!job.post) {
    console.log(`No post on job: ${job}`)
    return cb(null, [])
  }

  const appConfig = buildConfig()
  const { kysely: db } = createDb(appConfig.sqliteLocation)

  // For each link provided, check that it's a KS link,
  // create a project, and link the posts to it
  const projectIds: UUID[] = []
  for (const l of job.post.links) {
    if (!isKickstarterUrl(l)) {
      console.log(`Ignoring ${l}`)
      continue
    }
    const projectId = await findOrCreateProject(db, l)
    if (!projectId) {
      console.log('Could not determine a project to index')
      continue
    }

    console.log(`Inserting new post for project ${projectId}`)
    await db
      .insertInto('post')
      .values({
        postId: createUUID(),
        projectId: projectId,
        uri: job.post.uri,
        cid: job.post.cid,
        author: job.post.author,
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
