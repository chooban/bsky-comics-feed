import { Database } from './db'
import { DidResolver } from '@atproto/identity'
import { Queue } from 'bullmq'

export type AppContext = {
  db: Database
  didResolver: DidResolver
  cfg: Config
  queue: Queue
}

export type Config = {
  port: number
  listenhost: string
  hostname: string
  sqliteLocation: string
  subscriptionEndpoint: string
  serviceDid: string
  publisherDid: string
  subscriptionReconnectDelay: number
  redisUrl: string
  redisIpvFamily: number
}
