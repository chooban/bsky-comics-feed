import http from 'http'
import events from 'events'
import express from 'express'
// import { DidResolver, MemoryCache } from '@atproto/identity'
import feedGeneration from './methods/feed-generation.js'
import describeGenerator from './methods/describe-generator.js'
import {
  clearOldJobs,
  createDb,
  Database,
  migrateToLatest,
} from './db/index.js'
import { AppContext, Config } from './config.js'
import wellKnown from './well-known.js'
import { createQueues } from './queue/index.js'
import { ensureLoggedIn } from 'connect-ensure-login'
import passport from 'passport'
import session from 'express-session'
import configureAtproto from './passport-atproto.js'
import { setupMetrics } from './metrics.js'
import expressListEndpoints from 'express-list-endpoints'
import renderFeed from './pages/feed-list.js'
import SqliteStore from 'better-sqlite3-session-store'
import { Jetstream } from './jetstream/jetstream.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public db: Database
  public jetstream: Jetstream
  public cfg: Config

  constructor(
    app: express.Application,
    db: Database,
    jetstream: Jetstream,
    cfg: Config,
  ) {
    this.app = app
    this.db = db
    this.jetstream = jetstream
    this.cfg = cfg
  }

  static create(cfg: Config) {
    const app = express()
    const metricsMiddleware = setupMetrics()
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    app.set('views', __dirname + '/views')
    app.set('view engine', 'ejs')
    configureAtproto(app, cfg)

    const db = createDb(cfg.sqliteLocation)
    createQueues(cfg, db.kysely)

    // const didCache = new MemoryCache()
    // const didResolver = new DidResolver({
    //   plcUrl: 'https://plc.directory',
    //   didCache,
    // })

    const ctx: AppContext = {
      db: db.kysely,
      cfg,
    }
    feedGeneration(app, ctx)
    describeGenerator(app, ctx)

    app.use(wellKnown(ctx))

    app.use(metricsMiddleware)
    // app.use(server.xrpc.router)
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
    console.log(expressListEndpoints(app))

    return new FeedGenerator(
      app,
      db,
      new Jetstream(ctx, cfg.subscriptionEndpoint),
      cfg,
    )
  }

  async start(): Promise<http.Server> {
    await migrateToLatest(this.db)
    this.jetstream.start()
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    await clearOldJobs(this.db)
    return this.server
  }
}

export default FeedGenerator
