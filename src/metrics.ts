import promBundle from 'express-prom-bundle'
import Prometheus from 'prom-client'

const feedRequestCounter = new Prometheus.Counter({
  name: 'bskyfeeds_feed_request_count',
  help: 'Count of feed requests made',
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
    promRegistry: register,
  })
  register.registerMetric(feedRequestCounter)

  return metricsMiddleware
}

export const countFeedRequest = (feedId: string): void => {
  console.log(`Counting request for ${feedId}`)
  feedRequestCounter.labels({ feed: feedId })
}
