import { Worker, WorkerOptions } from 'bullmq'
import { KICKSTARTER_QUEUE } from '.'
import { Database } from '../db'
import { ApifyClient } from 'apify-client'
import { UUID } from '../types/uuid'
import { canonicalizeKickstarterUrl } from '../util/kickstarter'
import { UNKNOWN } from '../db/projects'

export const newProjectsWorker = (db: Database, config: WorkerOptions) => {
  const setIndexing = async (projectId: UUID, isIndexing: number) =>
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
      } else if (
        existingProject.isIndexing ||
        existingProject.indexedAt !== null
      ) {
        console.log(`Project already indexed, or duplicate job`)
        return
      }

      const uri = canonicalizeKickstarterUrl(existingProject.uri)

      if (!uri) {
        console.log(`Could not determine project to look up`)
        return
      }
      console.log(`Should look up info for ${uri}`)

      const existingByUri = await db
        .selectFrom('project')
        .selectAll('project')
        .where('project.uri', '=', uri)
        .where('project.indexedAt', 'is not', null)
        .executeTakeFirst()

      if (existingByUri !== undefined) {
        console.log(`Found a matching project`)
        await db
          .updateTable('project')
          .set({
            uri,
            category: existingByUri.category,
            title: existingByUri.title,
            indexedAt: new Date().toISOString(),
          })
          .where('project.projectId', '=', existingProject.projectId)
          .execute()

        return
      }

      await setIndexing(existingProject.projectId, 1)

      const projectUrlComponents = uri.split('/')
      const projectQuery =
        projectUrlComponents[projectUrlComponents.length - 1].split('-')

      if (projectQuery.length < 1) {
        console.log(
          `Very odd looking query. Skipping: ${projectQuery.join('-')}`,
        )
        await setIndexing(existingProject.projectId, 0)
        return
      }

      console.log(`Kicking off search for ${projectQuery.join(' ')}`)
      const client = new ApifyClient({
        token: process.env.APIFY_TOKEN,
      })

      // Starts an actor and waits for it to finish.
      const { defaultDatasetId } = await client
        .actor('chooban/kickstarter-search-apify')
        .call(
          { query: projectQuery.join(' ') },
          {
            waitSecs: 120,
            maxItems: 10,
          },
        )

      const { items } = await client.dataset(defaultDatasetId).listItems()

      const matching = items.find((d) => d.url === uri)
      console.log(`Found matching result?: ${!!matching}`)
      await db
        .updateTable('project')
        .set({
          category: (matching?.categoryName as string) ?? UNKNOWN,
          title: (matching?.name as string) ?? UNKNOWN,
          uri,
          indexedAt: new Date().toISOString(),
          isIndexing: 0,
        })
        .where('project.projectId', '=', existingProject.projectId)
        .execute()
    },
    config,
  )

  return projectsWorker
}
