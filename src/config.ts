import { Database } from './db'
import { DidResolver } from '@atproto/identity'
import dotenv from 'dotenv'
import * as yaml from 'js-yaml'
import * as fs from 'fs'
import * as path from 'path'

export type AppContext = {
  db: Database
  didResolver: DidResolver
  cfg: Config
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
  permittedUsers: string[]
  feeds: Record<string, Feed>
  workerParallelism: number
}

export type Feed = {
  key: string
  title: string
  description: string
  categories: string[]
  avatar: string | undefined
}

const maybeStr = (val?: string) => {
  if (!val) return undefined
  return val
}

const maybeInt = (val?: string) => {
  if (!val) return undefined
  const int = parseInt(val, 10)
  if (isNaN(int)) return undefined
  return int
}

const maybeArray = (val?: string) => {
  if (!val) return []

  const list = JSON.parse(val)

  if (!Array.isArray(list)) {
    throw Error('Not an array')
  }

  return list
}

export const buildFeedConfig = (
  records: Record<string, unknown>,
): Record<string, Feed> => {
  const feeds: Record<string, Feed> = {}

  if (records['feeds']) {
    const rawData = records['feeds']
    if (rawData instanceof Object) {
      for (const k in rawData) {
        const f: Feed = {
          key: k,
          title: rawData[k]['title'] as string,
          description: rawData[k]['description'] as string,
          categories: rawData[k]['categories'],
          avatar: rawData[k]['avatar'],
        }
        feeds[k] = f
      }
    }
  }

  return feeds
}

export const buildConfig = (): Config => {
  dotenv.config()

  const configFilePath = process.cwd() + path.sep + 'feeds.yml'
  console.log(`Attempting to read ${configFilePath}`)
  const fileContents = fs.readFileSync(configFilePath, { encoding: 'utf-8' })
  const data = yaml.load(fileContents) as Record<string, unknown>

  const feedsConfig = buildFeedConfig(data)

  const hostname = maybeStr(process.env.FEEDGEN_HOSTNAME) ?? 'example.com'
  const serviceDid =
    maybeStr(process.env.FEEDGEN_SERVICE_DID) ?? `did:web:${hostname}`

  const permittedUsers = maybeArray(process.env.PERMITTED_USERS)
  if (permittedUsers.length == 0) {
    throw new Error('Need a list of permitted users')
  }
  return {
    port: maybeInt(process.env.FEEDGEN_PORT) ?? 3000,
    listenhost: maybeStr(process.env.FEEDGEN_LISTENHOST) ?? 'localhost',
    sqliteLocation: maybeStr(process.env.FEEDGEN_SQLITE_LOCATION) ?? ':memory:',
    subscriptionEndpoint:
      maybeStr(process.env.FEEDGEN_SUBSCRIPTION_ENDPOINT) ??
      'wss://bsky.network',
    publisherDid:
      maybeStr(process.env.FEEDGEN_PUBLISHER_DID) ?? 'did:example:alice',
    subscriptionReconnectDelay:
      maybeInt(process.env.FEEDGEN_SUBSCRIPTION_RECONNECT_DELAY) ?? 3000,
    hostname,
    serviceDid,
    redisUrl: maybeStr(process.env.REDIS_URL) ?? 'redis://redis:6379',
    redisIpvFamily: maybeInt(process.env.REDIS_IPV_FAMILY) ?? 4,
    permittedUsers,
    feeds: feedsConfig,
    workerParallelism: maybeInt(process.env.WORKERS) ?? 1,
  }
}
