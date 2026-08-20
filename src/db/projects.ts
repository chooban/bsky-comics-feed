import { KyselyDatabase } from '.'
import { createUUID } from '../types/uuid.js'
import { canonicalizeCrowdfundingUrl } from '../util/crowdfunding.js'
import { Project } from './schema.js'

export const UNKNOWN = 'Unknown'

export const findOrCreateProject = async (
  db: KyselyDatabase,
  rawUri: string,
): Promise<Project | null> => {
  const uri = await canonicalizeCrowdfundingUrl(rawUri)

  if (!uri) {
    return null
  }
  const existingProject = await db
    .selectFrom('project')
    .selectAll('project')
    .where('project.uri', '=', uri)
    .executeTakeFirst()

  if (existingProject != undefined) {
    console.log(`Found existing project for ${uri}`)
    return existingProject
  }

  const project = await db
    .insertInto('project')
    .values({
      projectId: createUUID(),
      uri,
      title: UNKNOWN,
      category: UNKNOWN,
      parentCategory: UNKNOWN,
      isIndexing: 0,
      isManual: 0,
      addedAt: new Date().toISOString(),
      details: {},
    })
    .returningAll()
    .executeTakeFirst()

  if (project !== undefined) {
    return project
  } else {
    throw new Error('Failed to write project')
  }
}
