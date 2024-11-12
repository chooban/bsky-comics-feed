import { Worker, WorkerOptions } from 'bullmq'
import { KICKSTARTER_QUEUE } from '.'
import { Database } from '../db'
import { ApifyClient } from 'apify-client'
import { UUID } from '../types/uuid'

export const newProjectsWorker = (db: Database, config: WorkerOptions) => {
  const setIndexing = (projectId: UUID, isIndexing: number) =>
    db
      .updateTable('project')
      .set({ isIndexing: isIndexing })
      .where('project.projectId', '=', projectId)
      .executeTakeFirst()

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

      await setIndexing(existingProject.projectId, 1)

      const projectUrlComponents = existingProject.uri.split('/')
      const projectQuery =
        projectUrlComponents[projectUrlComponents.length - 1].split('-')

      if (projectQuery.length <= 1) {
        console.log(
          `Very odd looking query. Skipping: ${projectQuery.join('-')}`,
        )
        await setIndexing(existingProject.projectId, 0)
        return
      }

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
            maxItems: 1,
          },
        )

      const { items } = await client.dataset(defaultDatasetId).listItems()
      const data = items[0]

      if (items[0].url !== existingProject.uri) {
        console.log(`Found project doesn't seem to match`)
        await setIndexing(existingProject.projectId, 0)
      } else {
        console.log(
          `Setting project category and title: ${data.categoryName}, ${data.title}`,
        )
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
      }
    },
    config,
  )

  return projectsWorker
}
