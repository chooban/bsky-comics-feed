import FeedGenerator from './server'
import { buildConfig } from './config'

const run = async () => {
  const config = buildConfig()
  const server = FeedGenerator.create(config)

  await server.start()
  console.log(
    `🤖 running feed generator at http://${server.cfg.listenhost}:${server.cfg.port}`,
  )
}

run()
