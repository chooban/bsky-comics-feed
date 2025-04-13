import { KyselyDatabase } from '../db'
import { sql } from 'kysely'

export const deletePostsWorker = (db: KyselyDatabase) => async (job, cb) => {
  console.log(`Deleting old posts`)
  const dateLimit = new Date()
  dateLimit.setDate(dateLimit.getDate() - 7)

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('post')
      .where('post.createdAt', '<', dateLimit.toISOString())
      .returningAll()
      .execute()

    const rowsDeleted = await trx.executeQuery(
      sql`select changes()`.compile(db),
    )

    // @ts-expect-error We'll be fine
    const deleted = rowsDeleted.rows[0]['changes()']
    console.log(`Deleted ${deleted} rows`)
  })

  cb()
}
