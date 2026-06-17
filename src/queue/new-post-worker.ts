import { buildConfig } from '../config.js'
import { createDb, findOrCreateProject } from '../db/index.js'
import { createUUID, UUID } from '../types/uuid.js'
import { isCrowdfundingUrl } from '../util/crowdfunding.js'

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
    if (!isCrowdfundingUrl(l)) {
      console.log(`Ignoring ${l}`)
      continue
    }
    const project = await findOrCreateProject(db, l)
    if (!project) {
      console.log('Could not determine a project to index')
      continue
    }

    console.log(`Inserting new post for project ${project.title}`)
    await db
      .insertInto('post')
      .values({
        postId: createUUID(),
        projectId: project.projectId,
        uri: job.post.uri,
        cid: job.post.cid,
        author: job.post.author,
        indexedAt: job.post.indexedAt,
        createdAt: job.post.createdAt,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()

    projectIds.push(project.projectId)
  }

  cb(null, projectIds)
}
