import { Worker, WorkerOptions } from 'bullmq'
import { KICKSTARTER_QUEUE } from '.'
import { Database } from '../db'
import { ApifyClient } from 'apify-client'
import { canonicalizeKickstarterUrl } from '../util/kickstarter'
import { UNKNOWN } from '../db/projects'

export const newProjectsWorker = (db: Database, config: WorkerOptions) => {
  const projectsWorker = new Worker(
    KICKSTARTER_QUEUE,
    async (job) => {
      if (!job.data.projectId) {
        return
      }
      const project = await db
        .updateTable('project')
        .set({ isIndexing: 1 })
        .where('project.projectId', '=', job.data.projectId)
        .where('project.isIndexing', '=', 0)
        .where('project.indexedAt', 'is', null)
        .returningAll()
        .executeTakeFirst()

      if (project == undefined) {
        console.log(
          `Could not find project suitable for indexing with ID: ${job.data.projectId}`,
        )
        return
      }

      const canonicalizedUri = await canonicalizeKickstarterUrl(project.uri)

      if (!canonicalizedUri) {
        console.log(`Could not determine project to look up`)
        await db
          .updateTable('project')
          .set({ indexedAt: new Date().toISOString(), isIndexing: 0 })
          .where('project.projectId', '=', job.data.projectId)
          .execute()

        return
      }
      console.log(`Should look up info for ${canonicalizedUri}`)

      const existingByUri = await db
        .selectFrom('project')
        .selectAll('project')
        .where('project.uri', '=', canonicalizedUri)
        .where('project.indexedAt', 'is not', null)
        .executeTakeFirst()

      if (existingByUri !== undefined) {
        console.log(`Found a matching project, no need to look it up again`)
        await db
          .updateTable('project')
          .set({
            uri: canonicalizedUri,
            category: existingByUri.category,
            title: existingByUri.title,
            indexedAt: new Date().toISOString(),
          })
          .where('project.projectId', '=', project.projectId)
          .execute()

        return
      }

      const projectUrlComponents = canonicalizedUri.split('/')
      const projectQuery =
        projectUrlComponents[projectUrlComponents.length - 1].split('-')

      if (projectQuery.length < 1) {
        console.log(
          `Very odd looking query. Skipping: ${projectQuery.join('-')}`,
        )
        await db
          .updateTable('project')
          .set({ isIndexing: 0, indexedAt: new Date().toISOString() })
          .where('project.projectId', '=', project.projectId)
          .execute()
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

      const matching = items.find((d) => d.url === canonicalizedUri)
      await db
        .updateTable('project')
        .set({
          category: (matching?.categoryName as string) ?? UNKNOWN,
          title: (matching?.name as string) ?? UNKNOWN,
          uri: canonicalizedUri,
          indexedAt: new Date().toISOString(),
          isIndexing: 0,
        })
        .where('project.projectId', '=', project.projectId)
        .execute()
    },
    config,
  )

  return projectsWorker
}
