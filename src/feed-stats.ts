import { Kysely } from 'kysely'
import { DatabaseSchema } from './db/schema.js'
import { Feed } from './config.js'
import {
  setFeedUniqueUsers,
  setFeedWindowUsers,
  setFeedPostAuthors,
  setFeedPostAuthorsWindow,
} from './metrics.js'

const counts = new Map<string, Map<string, number>>()
const postCounts = new Map<string, Map<string, number>>()

const WINDOWS: Array<{ window: string; days: number }> = [
  { window: '7d', days: 7 },
  { window: '30d', days: 30 },
]

const today = (): string => new Date().toISOString().slice(0, 10)

export const feedsForProject = (
  feeds: Record<string, Feed>,
  parentCategory: string,
  category: string,
): string[] => {
  const matches: string[] = []
  for (const [key, f] of Object.entries(feeds)) {
    const parent = f.parentCategory
    const cats = f.categories ?? []
    if (parent) {
      if (parentCategory === parent || cats.includes(category)) {
        matches.push(key)
      }
    } else if (cats.includes(category)) {
      matches.push(key)
    }
  }
  return matches
}

const seedCounts = async (
  db: Kysely<DatabaseSchema>,
  table: 'feed_stats',
  gauge: typeof setFeedUniqueUsers,
  map: Map<string, Map<string, number>>,
) => {
  const day = today()
  const rows = await db
    .selectFrom(table)
    .select(['feed', 'day', 'did'])
    .where('day', '=', day)
    .execute()

  map.clear()
  for (const row of rows) {
    let byDay = map.get(row.feed)
    if (!byDay) {
      byDay = new Map()
      map.set(row.feed, byDay)
    }
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + 1)
  }

  for (const [feed, byDay] of map) {
    for (const [d, c] of byDay) {
      gauge(feed, d, c)
    }
  }
}

export const initFeedStats = async (db: Kysely<DatabaseSchema>) => {
  await seedCounts(db, 'feed_stats', setFeedUniqueUsers, counts)

  const day = today()
  const postRows = await db
    .selectFrom('feed_post_stats')
    .select(['feed', 'day', 'author'])
    .where('day', '=', day)
    .execute()

  postCounts.clear()
  for (const row of postRows) {
    let byDay = postCounts.get(row.feed)
    if (!byDay) {
      byDay = new Map()
      postCounts.set(row.feed, byDay)
    }
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + 1)
  }

  for (const [feed, byDay] of postCounts) {
    for (const [d, c] of byDay) {
      setFeedPostAuthors(feed, d, c)
    }
  }
}

export const recordFeedUser = async (
  db: Kysely<DatabaseSchema>,
  feed: string,
  did: string,
) => {
  const day = today()
  const res = await db
    .insertInto('feed_stats')
    .values({ feed, day, did })
    .onConflict((oc) => oc.columns(['feed', 'day', 'did']).doNothing())
    .executeTakeFirst()

  if (res?.numInsertedOrUpdatedRows !== 1n) {
    return
  }

  let byDay = counts.get(feed)
  if (!byDay) {
    byDay = new Map()
    counts.set(feed, byDay)
  }
  const next = (byDay.get(day) ?? 0) + 1
  byDay.set(day, next)
  setFeedUniqueUsers(feed, day, next)
}

export const recordFeedPostAuthor = async (
  db: Kysely<DatabaseSchema>,
  feed: string,
  day: string,
  author: string,
) => {
  const res = await db
    .insertInto('feed_post_stats')
    .values({ feed, day, author })
    .onConflict((oc) => oc.columns(['feed', 'day', 'author']).doNothing())
    .executeTakeFirst()

  if (res?.numInsertedOrUpdatedRows !== 1n) {
    return
  }

  let byDay = postCounts.get(feed)
  if (!byDay) {
    byDay = new Map()
    postCounts.set(feed, byDay)
  }
  const next = (byDay.get(day) ?? 0) + 1
  byDay.set(day, next)
  setFeedPostAuthors(feed, day, next)
}

const refreshWindow = async (
  db: Kysely<DatabaseSchema>,
  table: 'feed_stats' | 'feed_post_stats',
  countColumn: 'did' | 'author',
  setter: typeof setFeedWindowUsers | typeof setFeedPostAuthorsWindow,
) => {
  const now = new Date()
  for (const { window, days } of WINDOWS) {
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - days)
    const rows = await db
      .selectFrom(table)
      .select((eb) => [
        'feed',
        eb.fn.agg<number>('count', [countColumn]).distinct().as('count'),
      ])
      .where('day', '>=', cutoff.toISOString().slice(0, 10))
      .groupBy('feed')
      .execute()

    for (const row of rows) {
      setter(row.feed, window, row.count)
    }
  }
}

export const refreshRollingStats = async (db: Kysely<DatabaseSchema>) => {
  await refreshWindow(db, 'feed_stats', 'did', setFeedWindowUsers)
  await refreshWindow(db, 'feed_post_stats', 'author', setFeedPostAuthorsWindow)
}
