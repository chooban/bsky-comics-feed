import http from 'http'
import events from 'events'
import express from 'express'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import { clearOldJobs, createDb, Database, migrateToLatest } from './db'
import { FirehoseSubscription } from './subscription'
import { AppContext, Config } from './config'
import wellKnown from './well-known'
import { createQueues } from './queue'
import { ensureLoggedIn } from 'connect-ensure-login'
import passport from 'passport'
import session from 'express-session'
import configureAtproto from './passport-atproto'
import { createClient } from 'redis'
import { setupMetrics } from './metrics'
import expressListEndpoints from 'express-list-endpoints'
import renderFeed from './pages/feed-list'
import SqliteStore from 'better-sqlite3-session-store'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public db: Database
  public firehose: FirehoseSubscription
  public cfg: Config
  // public newPostQueue: BetterQueue

  constructor(
    app: express.Application,
    db: Database,
    firehose: FirehoseSubscription,
    cfg: Config,
    // queue: BetterQueue,
  ) {
    this.app = app
    this.db = db
    this.firehose = firehose
    this.cfg = cfg
    // this.newPostQueue = queue
  }

  static create(cfg: Config) {
    const app = express()
    const metricsMiddleware = setupMetrics()
    const redisClient = createClient({
      url: cfg.redisUrl,
    })

    redisClient.connect().catch(console.error)

    app.set('views', __dirname + '/views')
    app.set('view engine', 'ejs')
    configureAtproto(app, cfg)

    const db = createDb(cfg.sqliteLocation)
    createQueues(cfg, db.kysely)

    const didCache = new MemoryCache()
    const didResolver = new DidResolver({
      plcUrl: 'https://plc.directory',
      didCache,
    })

    const server = createServer({
      validateResponse: true,
      payload: {
        jsonLimit: 100 * 1024, // 100kb
        textLimit: 100 * 1024, // 100kb
        blobLimit: 5 * 1024 * 1024, // 5mb
      },
    })
    const ctx: AppContext = {
      db: db.kysely,
      didResolver,
      cfg,
    }
    feedGeneration(server, ctx)
    describeGenerator(server, ctx)

    app.use(wellKnown(ctx))

    app.use(metricsMiddleware)
    app.use(server.xrpc.router)
    const sqliteSessionStore = SqliteStore(session)
    app.use(
      /\/((?!metrics).)*/,
      session({
        store: new sqliteSessionStore({
          client: db.database,
          expired: {
            clear: true,
            intervalMs: 900000, //ms = 15min
          },
        }),
        secret: process.env.SESSION_SECRET ?? 'default secret key',
        resave: false,
        saveUninitialized: false,
      }),
    )

    app.use(/\/((?!metrics).)*/, passport.initialize())
    app.use(/\/((?!metrics).)*/, passport.session())

    app.get('/login', (req, res) => {
      res.render('login', { invalid: req.query.invalid === 'true' })
    })
    app.get('/', ensureLoggedIn({ redirectTo: '/login' }), renderFeed())
    // app.use(
    //   '/queues',
    //   ensureLoggedIn({ redirectTo: '/login' }),
    //   bullboard('/queues', queues),
    // )

    console.log(expressListEndpoints(app))

    return new FeedGenerator(
      app,
      db,
      new FirehoseSubscription(ctx, cfg.subscriptionEndpoint),
      cfg,
      // queues[0],
    )
  }

  async start(): Promise<http.Server> {
    await migrateToLatest(this.db)
    this.firehose.run(this.cfg.subscriptionReconnectDelay)
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    await clearOldJobs(this.db)
    return this.server
  }
}

export default FeedGenerator
