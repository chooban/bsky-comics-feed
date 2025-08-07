import SqliteDb from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect } from 'kysely'
import { DatabaseSchema } from './schema.js'
import { migrationProvider } from './migrations.js'
import { SerializePlugin } from 'kysely-plugin-serialize'
export { findOrCreateProject } from './projects.js'

export const createDb = (location: string): Database => {
  const sqliteDatabase = new SqliteDb(location)
  return {
    kysely: new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: sqliteDatabase,
      }),
      plugins: [new SerializePlugin()],
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
