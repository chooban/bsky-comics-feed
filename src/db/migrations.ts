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
      .addColumn('isIndexing', 'integer', (col) => col.defaultTo(0).notNull())
      .addColumn('indexedAt', 'varchar')
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

migrations['002'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .alterTable('post')
      .addColumn('createdAt', 'varchar', (col) =>
        col.defaultTo('foo').notNull(),
      )
      .execute()

    await sql`UPDATE post SET createdAt = indexedAt`.execute(db)
  },
  async down(db: Kysely<unknown>) {
    await db.schema.alterTable('post').dropColumn('createdAt').execute()
  },
}

migrations['003'] = {
  async up(db: Kysely<unknown>) {
    await sql`
      update project set indexedAt = null 
      where projectId IN (
          select project.projectId from project join post on (post.projectId = project.projectId) where project.title = 'Unknown' and post.createdAt > DATETIME('now', '-3 day')
        )`.execute(db)
  },
}

migrations['004'] = {
  async up(db: Kysely<unknown>) {
    await sql`update project set indexedAt = null where title = 'Unknown'`.execute(
      db,
    )
  },
}

migrations['005'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .alterTable('project')
      .addColumn('parentCategory', 'varchar')
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.alterTable('project').dropColumn('parentCategory').execute()
  },
}

migrations['006'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .alterTable('project')
      .addColumn('addedAt', 'varchar')
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.alterTable('project').dropColumn('addedAt').execute()
  },
}

migrations['007'] = {
  async up(db: Kysely<unknown>) {
    await db.schema.alterTable('post').addColumn('author', 'varchar').execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.alterTable('post').dropColumn('author').execute()
  },
}
