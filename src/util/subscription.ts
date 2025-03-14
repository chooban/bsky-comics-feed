import { Database } from '../db'
import {
  CommitEvt,
  EventRunner,
  Firehose,
  MemoryRunner,
  Event as SyncEvent,
} from '@atproto/sync'
import { IdResolver } from '@atproto/identity'
import { getKickstarterLinks } from './records'
import { scheduleNewPostTask } from '../queue'
import { AppBskyFeedPost } from '@atproto/api'
import { hasProp } from './has-prop'

export abstract class FirehoseSyncBase {
  private firehose: Firehose

  constructor(eventRunner: EventRunner, service: string) {
    const idResolver = new IdResolver()
    this.firehose = new Firehose({
      service,
      idResolver,
      runner: eventRunner,
      onError: (err: Error) => {
        console.error(err)
      },
      handleEvent: async (evnt: SyncEvent) => {
        return this.handleEvent(evnt)
      },
      filterCollections: ['app.bsky.feed.post'],
    })
  }

  abstract handleEvent(evt: SyncEvent): Promise<void>

  async run() {
    console.log(`Starting the firehose listener`)
    return this.firehose.start()
  }

  async stop() {
    return this.firehose.destroy()
  }
}

function isCommit(v: unknown): v is CommitEvt {
  return (
    typeof v === 'object' &&
    v !== null &&
    hasProp(v, 'event') &&
    ['create', 'update', 'delete'].includes(v.event as string)
  )
}

export class KickstarterFirehose extends FirehoseSyncBase {
  private service: string
  private db: Database

  private constructor(db: Database, runner: EventRunner, service: string) {
    super(runner, service)
    this.service = service
    this.db = db
  }

  async handleEvent(evt: SyncEvent): Promise<void> {
    if (!isCommit(evt)) {
      return Promise.resolve()
    }
    const uri = evt.uri.toString()
    if (evt.event === 'create') {
      if (!evt.cid) {
        return
      }
      const { record } = evt
      if (AppBskyFeedPost.isRecord(record)) {
        const res = AppBskyFeedPost.validateRecord(record)
        if (!res.success) {
          return Promise.resolve()
        }
        const postRecord = res.value
        const links = getKickstarterLinks(postRecord)
        if (links.length == 0) {
          return undefined
        }
        const create = {
          uri,
          cid: evt.cid.toString(),
          record: evt.record,
          links,
          indexedAt: new Date().toISOString(),
          createdAt: postRecord.createdAt,
        }
        console.log(`Scheduling new task`)
        return scheduleNewPostTask(create).then(() => {})
      }
    } else if (evt.event === 'delete') {
      return this.db
        .deleteFrom('post')
        .where('uri', '=', uri)
        .execute()
        .then(() => {})
    }
    return Promise.resolve()
  }

  static async initialize(
    db: Database,
    service: string,
  ): Promise<KickstarterFirehose> {
    const res = await db
      .selectFrom('sub_state')
      .selectAll()
      .where('service', '=', service)
      .executeTakeFirst()

    const runner = new MemoryRunner({
      setCursor: async (cursor: number) => {
        return db
          .updateTable('sub_state')
          .set({ cursor })
          .where('service', '=', service)
          .execute()
          .then(() => {})
      },
      startCursor: res ? res.cursor : undefined,
    })

    return new KickstarterFirehose(db, runner, service)
  }
}
