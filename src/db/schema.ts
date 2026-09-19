import { UUID } from '../types/uuid'

export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  project: Project
  feed_stats: FeedStats
  feed_post_stats: FeedPostStats
}

export type FeedStats = {
  feed: string
  day: string
  did: string
}

export type FeedPostStats = {
  feed: string
  day: string
  author: string
}

export type Post = {
  postId: UUID
  projectId: UUID
  uri: string
  cid: string
  author: string
  indexedAt: string
  createdAt: string
}

export type SubState = {
  service: string
  cursor: number
}

export type Project = {
  projectId: UUID
  uri: string
  title: string
  category: string
  parentCategory: string
  details: object | null
  indexedAt: string | null
  isIndexing: number
  isManual: number
  addedAt: string
}
