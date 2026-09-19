import promBundle from 'express-prom-bundle'
import Prometheus from 'prom-client'

const feedRequestCounter = new Prometheus.Counter({
  name: 'bskyfeeds_feed_request_count',
  help: 'Count of feed requests made',
  labelNames: ['feed'],
})

const feedLengthGauge = new Prometheus.Gauge({
  name: 'bskyfeeds_feed_length',
  help: 'Length of the feed returned',
  labelNames: ['feed'],
})

const feedUniqueUsersGauge = new Prometheus.Gauge({
  name: 'bskyfeeds_feed_unique_users',
  help: 'Unique users per feed per day',
  labelNames: ['feed', 'day'],
})

const feedWindowUsersGauge = new Prometheus.Gauge({
  name: 'bskyfeeds_feed_unique_users_window',
  help: 'Unique users per feed over a rolling window',
  labelNames: ['feed', 'window'],
})

const feedPostAuthorsGauge = new Prometheus.Gauge({
  name: 'bskyfeeds_feed_post_authors',
  help: 'Distinct post authors per feed per day',
  labelNames: ['feed', 'day'],
})

const feedPostAuthorsWindowGauge = new Prometheus.Gauge({
  name: 'bskyfeeds_feed_post_authors_window',
  help: 'Distinct post authors per feed over a rolling window',
  labelNames: ['feed', 'window'],
})

export const setupMetrics = () => {
  const register = new Prometheus.Registry()
  const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    includeUp: true,
    customLabels: {
      project_name: 'bsky_feeds',
    },
    normalizePath: [
      ['^/(xrpc|feed|project|metrics|login).*', '/$1'],
      ['^/.*', '/other'],
    ],
    promClient: {
      collectDefaultMetrics: {},
    },
  })
  register.registerMetric(feedRequestCounter)
  register.registerMetric(feedUniqueUsersGauge)
  register.registerMetric(feedWindowUsersGauge)
  register.registerMetric(feedPostAuthorsGauge)
  register.registerMetric(feedPostAuthorsWindowGauge)

  return metricsMiddleware
}

export const countFeedRequest = (feedId: string): void => {
  feedRequestCounter.labels({ feed: feedId }).inc()
}

export const countFeedSize = (feedId: string, itemCount: number): void => {
  feedLengthGauge.labels({ feed: feedId }).set(itemCount)
}

export const setFeedUniqueUsers = (
  feedId: string,
  day: string,
  count: number,
): void => {
  feedUniqueUsersGauge.labels({ feed: feedId, day }).set(count)
}

export const setFeedWindowUsers = (
  feedId: string,
  window: string,
  count: number,
): void => {
  feedWindowUsersGauge.labels({ feed: feedId, window }).set(count)
}

export const setFeedPostAuthors = (
  feedId: string,
  day: string,
  count: number,
): void => {
  feedPostAuthorsGauge.labels({ feed: feedId, day }).set(count)
}

export const setFeedPostAuthorsWindow = (
  feedId: string,
  window: string,
  count: number,
): void => {
  feedPostAuthorsWindowGauge.labels({ feed: feedId, window }).set(count)
}
