import { Worker, WorkerOptions } from 'bullmq'
import { KICKSTARTER_QUEUE } from '.'
import { Database } from '../db'

export const newProjectsWorker = (db: Database, config: WorkerOptions) => {
  const projectsWorker = new Worker(
    KICKSTARTER_QUEUE,
    async (job) => {
      console.log({ data: job.data })
      if (!job.data.projectId) {
        return
      }
      const existingProject = await db
        .selectFrom('project')
        .selectAll('project')
        .where('project.projectId', '=', job.data.projectId)
        .executeTakeFirst()

      if (existingProject == undefined) {
        console.log(`Could not find project with ID: ${job.data.projectId}`)
        return
      } else if (existingProject.isIndexing) {
        console.log(`Project already indexed, or duplicate job`)
        return
      }

      console.log(`Should look up info for ${existingProject.uri}`)
    },
    config,
  )

  return projectsWorker
}
