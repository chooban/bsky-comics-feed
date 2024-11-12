import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect } from 'kysely'
import { DatabaseSchema } from './schema'
import { migrationProvider } from './migrations'
import { scheduleProjectQuery } from '../queue'
import { isUUID } from '../types/uuid'

export const createDb = (location: string): Database => {
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: new SqliteDb(location),
    }),
  })
}

export const migrateToLatest = async (db: Database) => {
  const migrator = new Migrator({ db, provider: migrationProvider })
  const { error } = await migrator.migrateToLatest()
  if (error) throw error
}

export const clearOldJobs = async (db: Database) => {
  await db
    .updateTable('project')
    .set({
      isIndexing: 0,
    })
    .where('project.isIndexing', '=', 1)
    .execute()
}

export const scheduleMissedJobs = async (db: Database) => {
  const projects = await db
    .selectFrom('project')
    .select('project.projectId')
    .where('project.indexedAt', 'is', null)
    .execute()

  console.log(`Found ${projects.length} projects to query`)
  for (const p of projects) {
    if (isUUID(p.projectId)) {
      await scheduleProjectQuery(p.projectId)
    } else {
      console.log(`ID was not a UUID: ${p.projectId}`)
    }
  }
}
export type Database = Kysely<DatabaseSchema>
