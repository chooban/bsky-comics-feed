import { Queue, Worker } from 'bullmq'
import { Config } from '../config'
import { Database } from '../db'
import { agent } from '../util/bsky'
import { AppBskyFeedDefs, AppBskyFeedPost } from '@atproto/api'
import { createUUID, UUID } from '../types/uuid'
import { getProjectDetails } from '../util/kickstarter'

export const createQueue = (
  cfg: Config,
  db: Database,
  queueName: string,
): Queue => {
  const queue = new Queue(queueName, {
    connection: {
      url: cfg.redisUrl,
      family: cfg.redisIpvFamily,
    },
  })

  const findOrCreateProject = async (uri: string): Promise<UUID> => {
    console.log(`Looking for ${uri}`)
    const existingProject = await db
      .selectFrom('project')
      .selectAll('project')
      .where('project.uri', '=', uri)
      .executeTakeFirst()

    if (existingProject == undefined) {
      console.log(`Project not found, so creating a new one`)

      const project = await db
        .insertInto('project')
        .values({
          projectId: createUUID(),
          uri,
          title: 'Unknown',
          category: 'Unknown',
        })
        .returningAll()
        .executeTakeFirst()

      if (project !== undefined) {
        return project.projectId
      } else {
        throw new Error('Failed to write project')
      }
    } else {
      console.log(`Found an existing project`)
      return existingProject.projectId
    }
  }
  const worker = new Worker(
    queueName,
    async (job) => {
      if (!job.data.post) {
        return
      }

      // For each link provided, check that it's a KS link,
      // create a project, and link the posts to it
      for (const l of job.data.post.links) {
        const projectId = await findOrCreateProject(l)
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
      }

      // const thread = await agent.getPostThread({ uri: job.data.post.uri })
      // if (!AppBskyFeedDefs.isThreadViewPost(thread.data.thread)) {
      //   throw new Error('Expected a thread view post')
      // }
      // const post = thread.data.thread.post
      // if (!AppBskyFeedPost.isRecord(post.record)) {
      //   throw new Error('Expected a post with a record')
      // }
    },
    {
      connection: {
        url: cfg.redisUrl,
        family: cfg.redisIpvFamily,
      },
    },
  )

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`)
  })

  worker.on('failed', (job, err) => {
    console.log(`Job ${job!.id} has failed with ${err.message}`)
  })

  return queue
}
