import FeedGenerator from './server.js'
import { buildConfig } from './config.js'
import { createQueues, scheduleProjectQuery } from './queue/index.js'
import { createDb } from './db/index.js'

const run = async () => {
  const config = buildConfig()

  const db = createDb(config.sqliteLocation)
  createQueues(config, db.kysely)

  const server = FeedGenerator.create(config, db)

  await server.start()

  scheduleProjectQuery()

  console.log(
    `🤖 running feed generator at http://${server.cfg.listenhost}:${server.cfg.port}`,
  )
}

run()
