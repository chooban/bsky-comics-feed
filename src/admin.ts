import crypto from 'crypto'
import express, { NextFunction, Request, Response } from 'express'
import { ensureLoggedIn } from 'connect-ensure-login'
import { AppContext } from './config.js'
import { UNKNOWN } from './db/projects.js'
import { isUUID } from './types/uuid.js'

type AdminSession = { csrfToken?: string }

const fetchCardyb = async (
  url: string,
): Promise<{ title?: string; description?: string } | null> => {
  try {
    const res = await fetch(
      `https://cardyb.bsky.app/v1/extract?url=${encodeURIComponent(url)}`,
    )
    if (!res.ok) {
      console.log(`cardyb fetch failed for ${url}: ${res.status}`)
      return null
    }
    const data = await res.json()
    if (data.error || !data.title) {
      return null
    }
    return {
      title: data.title,
      description: data.description ?? '',
    }
  } catch (err) {
    console.log(`cardyb fetch errored for ${url}:`, err)
    return null
  }
}

const getCsrfToken = (req: Request): string => {
  const session = req.session as unknown as AdminSession
  if (!session.csrfToken) {
    session.csrfToken = crypto.randomBytes(32).toString('hex')
  }
  return session.csrfToken
}

const csrf = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET') {
    getCsrfToken(req)
    return next()
  }
  const session = req.session as unknown as AdminSession
  const submitted = req.body?.csrfToken as string | undefined
  if (session.csrfToken && submitted === session.csrfToken) {
    return next()
  }
  res.status(403).send('CSRF token mismatch')
}

const requireLogin = ensureLoggedIn({ redirectTo: '/login' })

const getProjectsNeedingAttention = async (ctx: AppContext, q?: string) => {
  let builder = ctx.db
    .selectFrom('project')
    .innerJoin('post', 'post.projectId', 'project.projectId')
    .select([
      'project.projectId',
      'project.uri',
      'project.title',
      'project.category',
      'project.parentCategory',
      'project.details',
      'project.indexedAt',
      'project.isManual',
    ])
    .select((eb) => [
      eb.fn.max('post.createdAt').as('lastPostAt'),
      eb.fn.count('post.postId').as('postCount'),
    ])
    .groupBy('project.projectId')

  if (q && q.length > 0) {
    const like = `%${q}%`
    builder = builder.where((eb) =>
      eb.or([eb('project.uri', 'like', like), eb('project.title', 'like', like)]),
    )
  } else {
    builder = builder.where('project.title', '=', UNKNOWN)
  }

  return builder
    .orderBy('lastPostAt', 'desc')
    .orderBy('postCount', 'desc')
    .limit(200)
    .execute()
}

export default function setupAdmin(app: express.Application, ctx: AppContext) {
  const router = express.Router()

  router.use(requireLogin)
  router.use(express.urlencoded({ extended: true }))
  router.use(csrf)

  router.get('/', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined
      const projects = await getProjectsNeedingAttention(ctx, q)
      res.render('admin', {
        projects,
        q,
        hostname: ctx.cfg.hostname,
        error: null,
      })
    } catch (err) {
      console.error('Error listing admin projects:', err)
      res.status(500).render('admin', {
        projects: [],
        q: undefined,
        hostname: ctx.cfg.hostname,
        error: 'Internal server error',
      })
    }
  })

  router.get('/project/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params
      if (!isUUID(projectId)) {
        return res.status(400).send('Invalid project ID')
      }
      const project = await ctx.db
        .selectFrom('project')
        .selectAll('project')
        .where('projectId', '=', projectId)
        .executeTakeFirst()

      if (!project) {
        return res.status(404).send('Project not found')
      }

      const needsCardyb = project.title === UNKNOWN
      const cardyb = needsCardyb ? await fetchCardyb(project.uri) : null

      const formTitle = cardyb?.title ?? project.title
      const formBlurb =
        cardyb?.description ??
        (project.details as { blurb?: string } | null)?.blurb ??
        ''

      const categoryOptions = [
        ...new Set([
          ...(project.category && project.category !== UNKNOWN
            ? [project.category]
            : []),
          ...Object.values(ctx.cfg.feeds).flatMap((f) => f.categories ?? []),
        ]),
      ].sort()
      const parentCategoryOptions = [
        ...new Set([
          ...(project.parentCategory && project.parentCategory !== UNKNOWN
            ? [project.parentCategory]
            : []),
          ...Object.values(ctx.cfg.feeds)
            .map((f) => f.parentCategory)
            .filter((c): c is string => !!c),
        ]),
      ].sort()

      res.render('admin-project', {
        project,
        formTitle,
        blurb: formBlurb,
        cardybUsed: needsCardyb && cardyb !== null,
        categoryOptions,
        parentCategoryOptions,
        saved: req.query.saved === '1',
        requeued: req.query.requeued === '1',
        csrfToken: getCsrfToken(req),
        hostname: ctx.cfg.hostname,
        error: null,
      })
    } catch (err) {
      console.error('Error fetching admin project:', err)
      res.status(500).send('Internal server error')
    }
  })

  router.post('/project/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params
      if (!isUUID(projectId)) {
        return res.status(400).send('Invalid project ID')
      }
      const title = (req.body.title as string | undefined)?.trim()
      const category = (req.body.category as string | undefined)?.trim()
      const parentCategory = (req.body.parentCategory as string | undefined)?.trim()
      const blurb = (req.body.blurb as string | undefined)?.trim()

      if (!title || !category || !parentCategory) {
        return res
          .status(400)
          .send('Title, category and parent category are required')
      }

      const existing = await ctx.db
        .selectFrom('project')
        .select(['projectId', 'details'])
        .where('projectId', '=', projectId)
        .executeTakeFirst()

      if (!existing) {
        return res.status(404).send('Project not found')
      }

      const details = {
        ...((existing.details as object | null) ?? {}),
        ...(blurb ? { blurb } : {}),
      }

      await ctx.db
        .updateTable('project')
        .set({
          title,
          category,
          parentCategory,
          details,
          isManual: 1,
          isIndexing: 0,
          indexedAt: new Date().toISOString(),
        })
        .where('projectId', '=', projectId)
        .execute()

      res.redirect(`/admin/project/${projectId}?saved=1`)
    } catch (err) {
      console.error('Error saving admin project:', err)
      res.status(500).send('Internal server error')
    }
  })

  router.post('/project/:projectId/reindex', async (req, res) => {
    try {
      const { projectId } = req.params
      if (!isUUID(projectId)) {
        return res.status(400).send('Invalid project ID')
      }

      await ctx.db
        .updateTable('project')
        .set({
          isManual: 0,
          isIndexing: 0,
          indexedAt: null,
        })
        .where('projectId', '=', projectId)
        .execute()

      res.redirect(`/admin/project/${projectId}?requeued=1`)
    } catch (err) {
      console.error('Error requeueing admin project:', err)
      res.status(500).send('Internal server error')
    }
  })

  app.use('/admin', router)
}
