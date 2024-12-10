import { Queue, Worker } from 'bullmq'
import { Config } from '../config'
import { Database } from '../db'
import { NewPost, newPostsWorker } from './new-post-worker'
// import { newProjectsWorker } from './projects-worker'
import { UUID } from '../types/uuid'

export const NEW_POST_QUEUE = 'newposts'
export const KICKSTARTER_QUEUE = 'projects'

let postsQueue: Queue | undefined = undefined
let projectsQueue: Queue | undefined = undefined

export const scheduleNewPostTask = async (post: NewPost) => {
  if (postsQueue === undefined) {
    throw new Error('Posts queue is undefined')
  }
  return postsQueue.add(NEW_POST_QUEUE, { post: post })
}

export const scheduleProjectQuery = async (projectId: UUID) => {
  if (projectsQueue === undefined) {
    throw new Error('Projects queue not confifued')
  }
  console.log(`Scheduling lookup for project ${projectId}`)
  return projectsQueue.add(
    KICKSTARTER_QUEUE,
    { projectId: projectId },
    {
      deduplication: {
        id: projectId,
      },
    },
  )
}

export const createQueues = (cfg: Config, db: Database): Queue[] => {
  const queueConfig = {
    connection: {
      url: cfg.redisUrl,
      family: cfg.redisIpvFamily,
    },
  }
  postsQueue = new Queue(NEW_POST_QUEUE, queueConfig)
  projectsQueue = new Queue(KICKSTARTER_QUEUE, queueConfig)

  const postsWorker = newPostsWorker(db, {
    ...queueConfig,
    concurrency: cfg.workerParallelism,
  })
  const projectsWorker = new Worker(
    KICKSTARTER_QUEUE,
    `${__dirname}/project-worker.js`,
    {
      ...queueConfig,
      concurrency: cfg.workerParallelism,
    },
  )

  postsWorker.on('completed', async (job) => {
    for (const projectId of job.returnvalue) {
      const project = await db
        .selectFrom('project')
        .selectAll()
        .where('project.projectId', '=', projectId)
        .executeTakeFirst()

      if (!project) {
        console.log(`Could not find project after processing a new post`)
      } else {
        if (!project.indexedAt) {
          await scheduleProjectQuery(projectId)
        }
      }
    }
  })

  postsWorker.on('failed', (job, err) => {
    console.log(`Posts job ${job!.id} has failed with ${err.message}`)
  })

  projectsWorker.on('failed', async (job, e) => {
    console.log(`Project job failed: ${job?.data.projectId}: ${e}`)

    if (job?.data.projectId) {
      await db
        .updateTable('project')
        .set({ isIndexing: 0 })
        .where('project.projectId', '=', job?.data.projectId)
        .execute()
    }
  })

  return [postsQueue, projectsQueue]
}
