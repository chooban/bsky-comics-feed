import { Worker, WorkerOptions } from 'bullmq'
import { DELETE_POSTS_QUEUE } from '.'
import { KyselyDatabase } from '../db'
import { sql } from 'kysely'

export type NewPost = {
  uri: string
  cid: string
  links: string[]
  indexedAt: string
  createdAt: string
}

export const deletePostsWorker = (
  db: KyselyDatabase,
  config: WorkerOptions,
) => {
  const tidyWorker = new Worker<undefined, undefined>(
    DELETE_POSTS_QUEUE,
    async () => {
      console.log(`Deleting old posts`)
      const dateLimit = new Date()
      dateLimit.setDate(dateLimit.getDate() - 7)

      await db.transaction().execute(async (trx) => {
        console.log(`Deleting posts`)
        await trx
          .deleteFrom('post')
          .where('post.createdAt', '<', dateLimit.toISOString())
          .returningAll()
          .execute()

        console.log(`Getting count of deleted rows`)
        const rowsDeleted = await trx.executeQuery(
          sql`select changes()`.compile(db),
        )

        // @ts-expect-error We'll be fine
        const deleted = rowsDeleted.rows[0]['changes()']
        console.log(`Deleted ${deleted} rows`)
      })
    },
    config,
  )

  return tidyWorker
}
