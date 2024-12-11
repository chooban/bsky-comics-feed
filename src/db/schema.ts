import { UUID } from '../types/uuid'

export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  project: Project
}

export type Post = {
  postId: UUID
  projectId: UUID
  uri: string
  cid: string
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
  indexedAt: string | null
  isIndexing: number
  addedAt: string
}
