import { Worker, WorkerOptions } from 'bullmq'
import { KICKSTARTER_QUEUE } from '.'
import { Database } from '../db'
import { ApifyClient } from 'apify-client'

export const newProjectsWorker = (db: Database, config: WorkerOptions) => {
  const projectsWorker = new Worker(
    KICKSTARTER_QUEUE,
    async (job) => {
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

      await db
        .updateTable('project')
        .set({ isIndexing: 1 })
        .where('project.projectId', '=', existingProject.projectId)
        .executeTakeFirst()

      const projectUrlComponents = existingProject.uri.split('/')
      const projectQuery = projectUrlComponents[
        projectUrlComponents.length - 1
      ].replaceAll('-', ' ')

      console.log(`Kicking off search for ${projectQuery}`)
      const client = new ApifyClient({
        token: process.env.APIFY_TOKEN,
      })

      // Starts an actor and waits for it to finish.
      const { defaultDatasetId } = await client
        .actor('qbie/kickstarter-scraper')
        .call(
          { query: projectQuery },
          {
            waitSecs: 120,
          },
        )

      const { items } = await client.dataset(defaultDatasetId).listItems()
      const data = items[0]

      await db
        .updateTable('project')
        .set({
          isIndexing: 0,
          category: data.categoryName as string,
          title: data.name as string,
          indexedAt: new Date().toISOString(),
        })
        .where('project.projectId', '=', existingProject.projectId)
        .execute()
    },
    config,
  )

  return projectsWorker
}
