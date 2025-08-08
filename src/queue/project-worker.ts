import { createDb } from '../db/index.js'
import { ApifyClient } from 'apify-client'
import { UNKNOWN } from '../db/projects.js'
import { buildConfig } from '../config.js'
import { Selectable } from 'kysely'
import { Project } from '../db/schema.js'

const asyncFilter = async <F>(arr: Array<F>, predicate) => {
  const results = await Promise.all(arr.map(predicate))

  return arr.filter((_v, index) => results[index])
}

export default async (job, cb) => {
  const appConfig = buildConfig()
  const { kysely: db } = createDb(appConfig.sqliteLocation)

  console.log(`Locking projects to query`)
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const yesterday = new Date()
  oneWeekAgo.setDate(yesterday.getDate() - 1)

  const projectToUpdate = await db
    .selectFrom('project')
    .innerJoin('post', 'post.projectId', 'project.projectId')
    .selectAll('project')
    .where((eb) =>
      eb.and([
        eb('project.isIndexing', '=', 0),
        eb('post.indexedAt', '>', yesterday.toISOString()),
      ]),
    )
    .where((eb) =>
      eb.or([
        eb('project.indexedAt', 'is', null),
        eb('project.indexedAt', 'is not', null)
          .and('project.category', '=', UNKNOWN)
          .and('project.indexedAt', '<', oneWeekAgo.toISOString()),
      ]),
    )
    .execute()

  if (projectToUpdate.length === 0) {
    console.log(`Could not find any projects to query`)
    return cb()
  }

  const lockedProjects = await db
    .updateTable('project')
    .set({ isIndexing: 1 })
    .where(
      'project.projectId',
      'in',
      projectToUpdate.map((p) => p.projectId),
    )
    .returningAll()
    .execute()

  const shouldQuery = async (p: Selectable<Project>) => {
    const existingByUri = await db
      .selectFrom('project')
      .selectAll('project')
      .where('project.uri', '=', p.uri)
      .where('project.indexedAt', 'is not', null)
      .where('project.details', 'is not', null)
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
          details: existingByUri.details,
          indexedAt: new Date().toISOString(),
          isIndexing: 0,
        })
        .where('project.projectId', '=', p.projectId)
        .execute()

      return false
    }
    return true
  }

  const urlsToQuery = (await asyncFilter(lockedProjects, shouldQuery)).map(
    (p) => p.uri,
  )

  const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
  })

  // Starts an actor and waits for it to finish.
  const limitedUrlsToQuery = urlsToQuery.map((p) => ({ url: p })).slice(0, 5)
  console.log(
    `Querying Apify for ${limitedUrlsToQuery.map((u) => u.url).join(',')}`,
  )

  const { defaultDatasetId } = await client
    .actor('chooban/apify-kickstarter-project')
    .call(
      { projectUrls: limitedUrlsToQuery },
      {
        waitSecs: 60,
        maxItems: 5,
      },
    )

  const { items } = await client.dataset(defaultDatasetId).listItems()

  if (items.length == 0) {
    console.log(
      `Apparently could not find anything for ${limitedUrlsToQuery.map((u) => u.url).join(',')}`,
    )
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
        details: matching,
        isIndexing: 0,
      })
      .where('project.uri', '=', uri)
      .execute()
  }

  // If we didn't find a match, then clear the flag and set it was indexed anyway. We can be more
  // clever with choosing which to re-index.
  await db
    .updateTable('project')
    .set({
      isIndexing: 0,
      indexedAt: new Date().toISOString(),
      category: UNKNOWN,
      title: UNKNOWN,
      parentCategory: UNKNOWN,
    })
    .where('project.isIndexing', '=', 1)
    .execute()

  cb()
}
