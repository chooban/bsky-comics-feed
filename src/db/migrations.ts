import { Kysely, Migration, MigrationProvider, sql } from 'kysely'

const migrations: Record<string, Migration> = {}

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}

migrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('project')
      .addColumn('projectId', 'varchar', (col) => col.primaryKey())
      .addColumn('uri', 'varchar', (col) => col.notNull())
      .addColumn('title', 'varchar', (col) => col.notNull())
      .addColumn('category', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('post')
      .addColumn('postId', 'varchar', (col) => col.primaryKey())
      .addColumn('uri', 'varchar', (col) => col.notNull())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('projectId', 'integer', (col) => {
        return col.references('project.projectId').notNull()
      })
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('sub_state')
      .addColumn('service', 'varchar', (col) => col.primaryKey())
      .addColumn('cursor', 'integer', (col) => col.notNull())
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('post').execute()
    await db.schema.dropTable('sub_state').execute()
    await db.schema.dropTable('project').execute()
  },
}
