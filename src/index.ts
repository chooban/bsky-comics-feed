import FeedGenerator from './server.js'
import { buildConfig } from './config.js'
import { createQueues, scheduleProjectQuery } from './queue/index.js'
import { createDb } from './db/index.js'
import { refreshRollingStats } from './feed-stats.js'

const run = async () => {
  const config = buildConfig()

  const db = createDb(config.sqliteLocation)
  createQueues(config, db.kysely)

  const server = FeedGenerator.create(config, db)

  await server.start()

  scheduleProjectQuery()

  refreshRollingStats(db.kysely).catch((err) => {
    console.error('Error refreshing rolling stats:', err)
  })
  setInterval(() => {
    refreshRollingStats(db.kysely).catch((err) => {
      console.error('Error refreshing rolling stats:', err)
    })
  }, 15 * 60 * 1000)

  console.log(
    `🤖 running feed generator at http://${server.cfg.listenhost}:${server.cfg.port}`,
  )
}

run()
