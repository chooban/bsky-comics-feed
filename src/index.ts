import FeedGenerator from './server.js'
import { buildConfig } from './config.js'

const run = async () => {
  const config = buildConfig()
  const server = FeedGenerator.create(config)

  await server.start()
  console.log(
    `🤖 running feed generator at http://${server.cfg.listenhost}:${server.cfg.port}`,
  )
}

run()
