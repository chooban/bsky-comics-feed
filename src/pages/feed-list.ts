const renderFeed = () => {
  return async (req, res) => {
    res.render('index', { feeds: [{ displayName: 'foo' }] })
  }
}

export default renderFeed
