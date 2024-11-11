import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { Queue } from 'bullmq'

const makeRouter = (path: string, queues: Queue[]) => {
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath(path)

  const adapters = queues.map((q) => new BullMQAdapter(q))

  createBullBoard({
    queues: adapters,
    serverAdapter: serverAdapter,
  })

  return serverAdapter.getRouter()
}

export default makeRouter
