import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { AppContext } from './config'

const makeRouter = (ctx: AppContext, path: string) => {
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath(path)

  const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues: [
      new BullMQAdapter(ctx.queue),
    ],
    serverAdapter: serverAdapter,
  })


  return serverAdapter.getRouter()
}


export default makeRouter
