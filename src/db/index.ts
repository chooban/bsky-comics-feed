import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect } from 'kysely'
import { DatabaseSchema } from './schema'
import { migrationProvider } from './migrations'

export const createDb = (location: string): Database => {
  const sqliteDatabase = new SqliteDb(location)
  return {
    kysely: new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: sqliteDatabase,
      }),
    }),
    database: sqliteDatabase,
  }
}

export const migrateToLatest = async (db: Database) => {
  const migrator = new Migrator({ db: db.kysely, provider: migrationProvider })
  const { error } = await migrator.migrateToLatest()
  if (error) throw error
}

export const clearOldJobs = async (db: Database) => {
  await db.kysely
    .updateTable('project')
    .set({
      isIndexing: 0,
    })
    .where('project.isIndexing', '=', 1)
    .execute()
}

export type KyselyDatabase = Kysely<DatabaseSchema>

export type Database = {
  kysely: KyselyDatabase
  database: SqliteDb.Database
}
