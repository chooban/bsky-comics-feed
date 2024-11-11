import { Queue } from 'bullmq'
import { Config } from '../config'
import { Database } from '../db'
import { newPostsWorker } from './new-post-worker'
import { newProjectsWorker } from './projects-worker'

export const NEW_POST_QUEUE = 'newposts'
export const KICKSTARTER_QUEUE = 'projects'

export const createQueues = (cfg: Config, db: Database): Queue[] => {
  const queueConfig = {
    connection: {
      url: cfg.redisUrl,
      family: cfg.redisIpvFamily,
    },
  }
  const postsQueue = new Queue(NEW_POST_QUEUE, queueConfig)
  const projectsQueue = new Queue(KICKSTARTER_QUEUE, queueConfig)

  const postsWorker = newPostsWorker(db, queueConfig)
  const projectsWorker = newProjectsWorker(db, queueConfig)

  postsWorker.on('completed', async (job) => {
    console.log(`Job ${job.id} has completed! Returning ${job.returnvalue}`)
    for (const projectId of job.returnvalue) {
      await projectsQueue.add(
        KICKSTARTER_QUEUE,
        { projectId: projectId },
        {
          deduplication: {
            id: projectId,
          },
        },
      )
    }
  })

  postsWorker.on('failed', (job, err) => {
    console.log(`Job ${job!.id} has failed with ${err.message}`)
  })

  projectsWorker.on('completed', (job) => {
    console.log(`Projects job finished: ${job.data.projectId}`)
  })

  return [postsQueue, projectsQueue]
}
