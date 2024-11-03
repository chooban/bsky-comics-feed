import { Queue } from 'bullmq'
import { Config } from '../config'

export const createQueue = (cfg: Config, name: string): Queue => {
  const queue = new Queue('projects', {
    connection: {
      url: cfg.redisUrl,
      family: cfg.redisIpvFamily,
    },
  })


  return queue
}
