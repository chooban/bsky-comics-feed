import { agent } from '../util/bsky'

const renderFeed = () => {
  return async (req, res) => {
    const feeds = await agent.app.bsky.unspecced.getPopularFeedGenerators({
      limit: 10,
    })
    res.render('index', { feeds: feeds.data.feeds })
  }
}

export default renderFeed
