import { createDb } from '../db'
import { ApifyClient } from 'apify-client'
import { UNKNOWN } from '../db/projects'
import { buildConfig } from '../config'
import { Selectable } from 'kysely'
import { Project } from '../db/schema'

export default async () => {
  const appConfig = buildConfig()
  const db = createDb(appConfig.sqliteLocation)

  const projects = await db
    .updateTable('project')
    .set({ isIndexing: 1 })
    .where('project.isIndexing', '=', 0)
    .where('project.indexedAt', 'is', null)
    .returningAll()
    .execute()

  if (projects.length === 0) {
    console.log(`Could not find any projects to update`)
    return
  }

  const shouldQuery = async (p: Selectable<Project>) => {
    const existingByUri = await db
      .selectFrom('project')
      .selectAll('project')
      .where('project.uri', '=', p.uri)
      .where('project.indexedAt', 'is not', null)
      .executeTakeFirst()

    if (existingByUri !== undefined) {
      console.log(
        `Found a matching project for ${p.uri}, no need to look it up again`,
      )
      await db
        .updateTable('project')
        .set({
          category: existingByUri.category,
          title: existingByUri.title,
          parentCategory: existingByUri.parentCategory,
          indexedAt: new Date().toISOString(),
          isIndexing: 0,
        })
        .where('project.projectId', '=', p.projectId)
        .execute()

      return false
    }
    return true
  }

  const projectsToQuery = projects.filter(shouldQuery)
  const urlsToQuery = projectsToQuery.map((p) => p.uri)

  const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
  })

  // Starts an actor and waits for it to finish.
  console.log(`Querying Apify for ${urlsToQuery}`)
  const { defaultDatasetId } = await client
    .actor('chooban/apify-kickstarter-project')
    .call(
      { projectUrls: urlsToQuery.map((p) => ({ url: p })) },
      {
        waitSecs: 120,
        maxItems: 10,
      },
    )

  const { items } = await client.dataset(defaultDatasetId).listItems()

  if (items.length == 0) {
    console.log(`Apparently could not find anything for ${projectsToQuery}`)
  }

  for (const matching of items) {
    const uri = matching?.url as string
    if (!uri) {
      console.log(`No URI returned`)
      continue
    }

    console.log(`Updating where uri is ${uri}`)
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

  // If we didn't find a match, then clear the flag. We'll leave it as unindexed in case this was
  // just an actor issue.
  await db
    .updateTable('project')
    .set({ isIndexing: 0 })
    .where('project.isIndexing', '=', 1)
    .execute()
}
