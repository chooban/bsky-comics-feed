import { Queue, Worker } from 'bullmq'
import { Config } from '../config'
import { Database } from '../db'
import { NewPost, newPostsWorker } from './new-post-worker'
import { deletePostsWorker } from './delete-posts-worker'
import IORedis from 'ioredis'

export const NEW_POST_QUEUE = 'newposts'
export const KICKSTARTER_QUEUE = 'projects'
export const DELETE_POSTS_QUEUE = 'deleteposts'

let postsQueue: Queue | undefined = undefined
let projectsQueue: Queue | undefined = undefined
let deletePostsQueue: Queue | undefined = undefined

export const scheduleNewPostTask = async (post: NewPost) => {
  if (postsQueue === undefined) {
    throw new Error('Posts queue is undefined')
  }
  return postsQueue.add(NEW_POST_QUEUE, { post: post })
}

export const scheduleProjectQuery = async () => {
  if (projectsQueue === undefined) {
    throw new Error('Projects queue not confifued')
  }
  console.log(`Scheduling lookup for projects`)
  return projectsQueue.add(
    KICKSTARTER_QUEUE,
    {},
    {
      delay: 10 * 1000,
    },
  )
}

export const createQueues = (cfg: Config, db: Database): Queue[] => {
  const connection = new IORedis(cfg.redisUrl, {
    family: cfg.redisIpvFamily,
    maxRetriesPerRequest: null,
  })
  // const queueConfig = {
  //   connection: {
  //     url: cfg.redisUrl,
  //     family: cfg.redisIpvFamily,
  //   },
  // }
  postsQueue = new Queue(NEW_POST_QUEUE, {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
    },
  })
  projectsQueue = new Queue(KICKSTARTER_QUEUE, { connection })
  deletePostsQueue = new Queue(DELETE_POSTS_QUEUE, { connection })

  const postsWorker = newPostsWorker(db, {
    connection,
    concurrency: cfg.workerParallelism,
  })

  postsWorker.on('completed', async (job) => {
    for (const projectId of job.returnvalue) {
      const project = await db
        .selectFrom('project')
        .selectAll()
        .where('project.projectId', '=', projectId)
        .executeTakeFirst()

      if (!project) {
        console.log(`Could not find project after processing a new post`)
      }
    }
  })

  postsWorker.on('failed', (job, err) => {
    console.log(`Posts job ${job!.id} has failed with ${err.message}`)
  })

  projectsQueue.upsertJobScheduler(
    'check-every-30-mins',
    {
      pattern: '*/30 * * * *',
    },
    { name: 'project-lookup' },
  )

  const projectsWorker = new Worker(
    KICKSTARTER_QUEUE,
    `${__dirname}/project-worker.js`,
    {
      connection,
      concurrency: cfg.workerParallelism,
    },
  )

  projectsWorker.on('failed', async (job, e) => {
    console.log(`Projects job failed: ${e}`)

    await db
      .updateTable('project')
      .set({ isIndexing: 0 })
      .where('project.isIndexing', '=', 1)
      .execute()
  })

  deletePostsQueue.upsertJobScheduler(
    'delete-posts-schedule',
    {
      pattern: '*/30 * * * *',
    },
    { name: 'post-deletion' },
  )

  deletePostsWorker(db, {
    connection,
    concurrency: cfg.workerParallelism,
  })

  return [postsQueue, projectsQueue]
}
