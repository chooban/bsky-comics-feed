import http from 'http'
import events from 'events'
import express from 'express'
import { DidResolver, MemoryCache } from '@atproto/identity'
import { createServer } from './lexicon'
import feedGeneration from './methods/feed-generation'
import describeGenerator from './methods/describe-generator'
import { createDb, Database, migrateToLatest } from './db'
import { FirehoseSubscription } from './subscription'
import { AppContext, Config } from './config'
import wellKnown from './well-known'
import bullboard from './bullboard'
import { Queue } from 'bullmq'
import { createQueue } from './queue'
import { ensureLoggedIn } from 'connect-ensure-login'
import passport from 'passport'
// import addPassport from './passport'
import session from 'express-session'
import configureAtproto from './passport-atproto'

export class FeedGenerator {
  public app: express.Application
  public server?: http.Server
  public db: Database
  public firehose: FirehoseSubscription
  public cfg: Config
  public queue: Queue

  constructor(
    app: express.Application,
    db: Database,
    firehose: FirehoseSubscription,
    cfg: Config,
    queue: Queue,
  ) {
    this.app = app
    this.db = db
    this.firehose = firehose
    this.cfg = cfg
    this.queue = queue
  }

  static create(cfg: Config) {
    const app = express()

    app.set('views', __dirname + '/views')
    app.set('view engine', 'ejs')
    app.use(session({ secret: 'keyboard cat', saveUninitialized: true, resave: true }));
    app.use(passport.initialize({}))
    app.use(passport.session({}))

    // addPassport(app)
    configureAtproto(app, cfg)

    app.get('/admin/login', (req, res) => {
      res.render('login', { invalid: req.query.invalid === 'true' })
    })

    const db = createDb(cfg.sqliteLocation)
    const queue = createQueue(cfg, 'newposts')

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
      db,
      didResolver,
      cfg,
      queue,
    }
    const firehose = new FirehoseSubscription(ctx, cfg.subscriptionEndpoint)
    feedGeneration(server, ctx)
    describeGenerator(server, ctx)
    app.use(server.xrpc.router)
    app.use(wellKnown(ctx))

    app.use('/admin/queues', ensureLoggedIn({ redirectTo: '/admin/login' }), bullboard(ctx, '/admin/queues'))

    return new FeedGenerator(app, db, firehose, cfg, queue)
  }

  async start(): Promise<http.Server> {
    await migrateToLatest(this.db)
    this.firehose.run(this.cfg.subscriptionReconnectDelay)
    this.server = this.app.listen(this.cfg.port, this.cfg.listenhost)
    await events.once(this.server, 'listening')
    return this.server
  }
}

export default FeedGenerator
