import { Queue } from 'bullmq'
import { Config } from '../config'
import { Database } from '../db'
import { NewPost, newPostsWorker } from './new-post-worker'
import { newProjectsWorker } from './projects-worker'
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

  const postsWorker = newPostsWorker(db, queueConfig)
  const projectsWorker = newProjectsWorker(db, queueConfig)

  postsWorker.on('completed', async (job) => {
    console.log(
      `Posts job ${job.id} has completed! Returning ${job.returnvalue}`,
    )
    for (const projectId of job.returnvalue) {
      await scheduleProjectQuery(projectId)
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
