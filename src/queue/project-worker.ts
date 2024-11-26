import { createDb } from '../db'
import { ApifyClient } from 'apify-client'
import { canonicalizeKickstarterUrl } from '../util/kickstarter'
import { UNKNOWN } from '../db/projects'
import { buildConfig } from '../config'

export default async (job) => {
  if (!job.data.projectId) {
    return
  }
  const appConfig = buildConfig()
  const db = createDb(appConfig.sqliteLocation)

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

  if (canonicalizedUri !== project.uri) {
    await db
      .updateTable('project')
      .set({ uri: canonicalizedUri })
      .where('project.projectId', '=', project.projectId)
      .execute()
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
        parentCategory: existingByUri.parentCategory,
        indexedAt: new Date().toISOString(),
      })
      .where('project.projectId', '=', project.projectId)
      .execute()

    return
  }

  const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
  })

  // Starts an actor and waits for it to finish.
  const { defaultDatasetId } = await client
    .actor('chooban/apify-kickstarter-project')
    .call(
      { projectUrls: [{ url: canonicalizedUri }] },
      {
        waitSecs: 120,
        maxItems: 10,
      },
    )

  const { items } = await client.dataset(defaultDatasetId).listItems()

  if (items.length == 0) {
    console.log(`Apparently could not find anything for ${canonicalizedUri}`)
  }

  for (const matching of items) {
    const uri = matching?.uri as string
    if (!uri) {
      console.log(`No URI returned`)
      continue
    }

    await db
      .updateTable('project')
      .set({
        category: (matching?.category as string) ?? UNKNOWN,
        title: (matching?.title as string) ?? UNKNOWN,
        parentCategory: (matching?.parentCategory as string) ?? UNKNOWN,
        indexedAt: new Date().toISOString(),
        isIndexing: 0,
      })
      .where('project.uri', '=', uri)
      .execute()
  }
}
