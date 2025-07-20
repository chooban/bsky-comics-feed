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
    promClient: {
      collectDefaultMetrics: {},
    },
  })
  register.registerMetric(feedRequestCounter)

  return metricsMiddleware
}

export const countFeedRequest = (feedId: string): void => {
  feedRequestCounter.labels({ feed: feedId }).inc()
}

export const countFeedSize = (feedId: string, itemCount: number): void => {
  feedLengthGauge.labels({ feed: feedId }).set(itemCount)
}
