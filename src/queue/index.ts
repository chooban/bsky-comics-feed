import { Queue } from 'bullmq'
import { Config } from '../config'

export const createQueue = (cfg: Config, queueName: string): Queue => {
  const queue = new Queue(queueName, {
    connection: {
      url: cfg.redisUrl,
      family: cfg.redisIpvFamily,
    },
  })


  return queue
}
