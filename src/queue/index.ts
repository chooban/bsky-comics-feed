import { Config } from '../config'
import { KyselyDatabase } from '../db'
import { NewPost, newPostProcessor } from './new-post-worker'
import { deletePostsWorker } from './delete-posts-worker'
import { default as BetterQueue } from 'better-queue'
import projectsWorker from './project-worker'
import cron from 'node-cron'

export const NEW_POST_QUEUE = 'newposts'
export const KICKSTARTER_QUEUE = 'projects'
export const DELETE_POSTS_QUEUE = 'deleteposts'

let postsQueue: BetterQueue | undefined = undefined
let projectsQueue: BetterQueue | undefined = undefined
let deletePostsQueue: BetterQueue | undefined = undefined

export const scheduleNewPostTask = async (post: NewPost) => {
  if (postsQueue === undefined) {
    throw new Error('Posts queue is undefined')
  }
  console.log(`Adding a new post job`)
  return postsQueue.push({ post: post })
}

export const scheduleProjectQuery = async () => {
  if (projectsQueue === undefined) {
    throw new Error('Projects queue not confifued')
  }
  console.log(`Scheduling lookup for projects`)
  return projectsQueue.push({})
}

export const createQueues = (
  cfg: Config,
  db: KyselyDatabase,
): BetterQueue[] => {
  postsQueue = new BetterQueue(newPostProcessor(db))
  projectsQueue = new BetterQueue(projectsWorker)
  deletePostsQueue = new BetterQueue(deletePostsWorker(db))

  postsQueue.on('task_failed', (job, err) => {
    console.log(`Posts job ${job!.id} has failed with ${err}`)
  })

  cron.schedule('*/30 * * * *', () => {
    scheduleProjectQuery()
    deletePostsQueue?.push({})
  })

  projectsQueue.on('task_failed', async (job, e) => {
    console.log(`Projects job failed: ${e}`)

    await db
      .updateTable('project')
      .set({ isIndexing: 0 })
      .where('project.isIndexing', '=', 1)
      .execute()
  })

  return [postsQueue]
}
