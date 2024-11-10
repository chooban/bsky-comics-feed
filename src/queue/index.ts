import { Queue, Worker } from 'bullmq'
import { Config } from '../config'
import { Database } from '../db'
import { agent } from '../util/bsky'
import { AppBskyFeedDefs, AppBskyFeedPost } from '@atproto/api'

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

  const worker = new Worker(
    queueName,
    async (job) => {
      if (!job.data.post) {
        return
      }

      const thread = await agent.getPostThread({ uri: job.data.post.uri })
      if (!AppBskyFeedDefs.isThreadViewPost(thread.data.thread)) {
        throw new Error('Expected a thread view post')
      }
      const post = thread.data.thread.post
      if (!AppBskyFeedPost.isRecord(post.record)) {
        throw new Error('Expected a post with a record')
      }
      console.log(post.record.text)

      await db
        .insertInto('post')
        .values({ ...job.data.post })
        .onConflict((oc) => oc.doNothing())
        .execute()
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
