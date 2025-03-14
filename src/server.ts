import http from 'http'
import events from 'events'
import express from 'express'
import { DidResolver, MemoryCache } from '@atproto/identity'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import { clearOldJobs, createDb, Database, migrateToLatest } from './db'
import { AppContext, Config } from './config'
import wellKnown from './well-known'
import bullboard from './bullboard'
import { Queue } from 'bullmq'
import { createQueues } from './queue'
import { ensureLoggedIn } from 'connect-ensure-login'
import passport from 'passport'
import session from 'express-session'
import configureAtproto from './passport-atproto'
import renderFeed from './pages/feed-list'
import { RedisStore } from 'connect-redis'
import { createClient } from 'redis'
import { setupMetrics } from './metrics'
import { FirehoseSyncBase, KickstarterFirehose } from './util/subscription'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public db: Database
  public firehose: FirehoseSyncBase
  public cfg: Config
  public newPostQueue: Queue

  constructor(
    app: express.Application,
    db: Database,
    firehose: FirehoseSyncBase,
    cfg: Config,
    queue: Queue,
  ) {
    this.app = app
    this.db = db
    this.firehose = firehose
    this.cfg = cfg
    this.newPostQueue = queue
  }

  static async create(cfg: Config) {
    const app = express()
    const metricsMiddleware = setupMetrics()
    const redisClient = createClient({
      url: cfg.redisUrl,
    })

    redisClient.connect().catch(console.error)
    const redisStore = new RedisStore({
      client: redisClient,
      prefix: 'myapp:',
    })

    app.set('views', __dirname + '/views')
    app.set('view engine', 'ejs')
    app.use(
      session({
        store: redisStore,
        secret: 'keyboard cat',
        saveUninitialized: true,
        resave: false,
      }),
    )

    app.use(passport.initialize())
    app.use(passport.session())

    configureAtproto(app, cfg)

    const db = createDb(cfg.sqliteLocation)
    const queues = createQueues(cfg, db)

    const didCache = new MemoryCache()
    const didResolver = new DidResolver({
      plcUrl: 'https://plc.directory',
      didCache,
    })

    const ctx: AppContext = {
      db,
      didResolver,
      cfg,
    }
    const firehose = await KickstarterFirehose.initialize(
      db,
      cfg.subscriptionEndpoint,
    )
    // http://localhost:3000/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:plc:2n2izph6uhty5uhdx7l32p67/app.bsky.feed.generator/cfcomics
    app.use('/xrpc/app.bsky.feed.getFeedSkeleton', feedGeneration(ctx))
    app.use('/xrpc/app.bsky.feed.describeFeedGenerator', describeGenerator(ctx))

    app.use(wellKnown(ctx))

    app.use(metricsMiddleware)

    app.get('/login', (req, res) => {
      res.render('login', { invalid: req.query.invalid === 'true' })
    })
    app.get('/', ensureLoggedIn({ redirectTo: '/login' }), renderFeed())
    app.use(
      '/queues',
      ensureLoggedIn({ redirectTo: '/login' }),
      bullboard('/queues', queues),
    )

    return new FeedGenerator(app, db, firehose, cfg, queues[0])
  }

  async start(): Promise<http.Server> {
    await migrateToLatest(this.db)
    // this.firehose.run(this.cfg.subscriptionReconnectDelay)
    this.firehose.run()
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    await clearOldJobs(this.db)
    return this.server
  }
}

export default FeedGenerator
