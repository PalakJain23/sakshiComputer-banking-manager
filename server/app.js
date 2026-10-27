import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import rateLimit from 'express-rate-limit'
import {
  createSession,
  deleteSession,
  findSession,
  SESSION_COOKIE_NAME,
  authenticateOwner,
  readOwnerCredentials,
} from './database.js'
import { normalizeRecord, STATUSES, validDate, validateApplicationRecord } from './record-fields.js'
import { createApplicationPdf, PdfLayoutError } from './exports.js'

const MAX_BODY_SIZE = '256kb'
const COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60
const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:3001',
  'http://localhost:3001',
]
const PRODUCTION_ALLOWED_ORIGINS = [
  'https://sakshicomputer-banking-manager.onrender.com',
]

function readSessionToken(request) {
  const cookieHeader = request.headers.cookie || ''
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
  return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE_NAME.length + 1)) : ''
}

function sendSessionCookie(response, token, secure) {
  const secureAttribute = secure ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secureAttribute}`,
  )
}

function clearSessionCookie(response, secure) {
  const secureAttribute = secure ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${secureAttribute}`,
  )
}

function toApplication(row) {
  return {
    ...JSON.parse(row.data),
    id: row.id,
    status: row.status,
    submittedOn: row.submitted_on,
    accountOpenedOn: row.account_opened_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function buildRecord(database, id) {
  const result = await database.execute('SELECT * FROM applications WHERE id = ?', [id])
  const row = result.rows[0]
  return row ? toApplication(row) : null
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function createApp({
  database,
  secureCookies = process.env.SESSION_COOKIE_SECURE === 'true',
  allowedOrigins,
  ownerCredentials = readOwnerCredentials(),
} = {}) {
  if (!database) throw new Error('A database connection is required.')
  const app = express()
  const configuredOrigins = allowedOrigins
    || process.env.APP_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean)
    || []
  const originSet = new Set([
    ...(process.env.NODE_ENV === 'production' ? [] : DEFAULT_ALLOWED_ORIGINS),
    ...PRODUCTION_ALLOWED_ORIGINS,
    ...configuredOrigins,
  ])

  app.disable('x-powered-by')
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'same-origin')
    response.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use(express.json({ limit: MAX_BODY_SIZE, strict: true }))

  app.use('/api', (request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next()
    const origin = request.get('origin')
    if (!origin || !originSet.has(origin)) {
      return response.status(403).json({ error: 'Request origin is not allowed.' })
    }
    if (request.get('x-requested-with') !== 'SakshiComputerUI') {
      return response.status(403).json({ error: 'Request verification failed.' })
    }
    next()
  })

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))

  app.get('/api/auth/session', async (request, response) => {
    const session = await findSession(database, readSessionToken(request))
    if (!session) return response.json({ authenticated: false })
    response.json({ authenticated: true, username: session.username })
  })

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Too many sign-in attempts. Wait 15 minutes and try again.' },
  })

  app.post('/api/auth/login', loginLimiter, async (request, response) => {
    const requestId = randomUUID()
    response.set('X-Request-ID', requestId)
    const logAuthFailure = (stage) => {
      if (process.env.AUTH_DEBUG === 'true') {
        console.warn(`AUTH_DIAGNOSTIC requestId=${requestId} stage=${stage}`)
      }
    }
    const username = typeof request.body?.username === 'string' ? request.body.username : ''
    const password = typeof request.body?.password === 'string' ? request.body.password : ''
    if (username.length > 64 || password.length > 256) {
      return response.status(400).json({ error: 'Enter a valid username and password.' })
    }
    let authentication
    try {
      authentication = await authenticateOwner(database, username, password, ownerCredentials)
    } catch (error) {
      logAuthFailure('DATABASE_ERROR')
      throw error
    }
    if (!authentication.owner) {
      logAuthFailure(authentication.failureStage)
      return response.status(401).json({ error: 'Username or password is incorrect.' })
    }
    let session
    try {
      session = await createSession(database, authentication.owner.id)
    } catch (error) {
      logAuthFailure('SESSION_ERROR')
      throw error
    }
    sendSessionCookie(response, session.token, secureCookies)
    response.json({ authenticated: true, username: authentication.owner.username })
  })

  app.post('/api/auth/logout', async (request, response) => {
    await deleteSession(database, readSessionToken(request))
    clearSessionCookie(response, secureCookies)
    response.json({ authenticated: false })
  })

  async function requireOwner(request, response, next) {
    const session = await findSession(database, readSessionToken(request))
    if (!session) return response.status(401).json({ error: 'Owner sign-in is required.' })
    request.owner = session
    next()
  }

  app.get('/api/customers', requireOwner, async (request, response) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim().toLocaleLowerCase() : ''
    const result = await database.execute('SELECT * FROM applications ORDER BY updated_at DESC')
    const rows = result.rows
    const items = rows.map(toApplication).filter((record) => {
      if (!query) return true
      const fullName = [record.title, record.firstName, record.middleName, record.lastName].filter(Boolean).join(' ')
      return [fullName, record.mobile, record.accountNumber].some((value) => value.toLocaleLowerCase().includes(query))
    })
    response.json({ items })
  })

  app.post('/api/customers', requireOwner, async (request, response) => {
    let data
    try {
      data = normalizeRecord(request.body?.data)
    } catch (error) {
      return response.status(400).json({ error: error.message })
    }
    if (![data.firstName, data.middleName, data.lastName].some((value) => value.trim())) {
      return response.status(400).json({ error: 'Enter at least one applicant name field to save this draft.' })
    }
    const id = randomUUID()
    const now = new Date().toISOString()
    await database.execute(
      'INSERT INTO applications (id, data, status, submitted_on, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?)',
      [id, JSON.stringify(data), 'Draft', now, now],
    )
    response.status(201).json({ item: await buildRecord(database, id) })
  })

  app.get('/api/customers/:id', requireOwner, async (request, response) => {
    if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Invalid application ID.' })
    const item = await buildRecord(database, request.params.id)
    if (!item) return response.status(404).json({ error: 'Application not found.' })
    response.json({ item })
  })

  app.put('/api/customers/:id', requireOwner, async (request, response) => {
    if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Invalid application ID.' })
    const existing = await buildRecord(database, request.params.id)
    if (!existing) return response.status(404).json({ error: 'Application not found.' })
    let data
    try {
      data = normalizeRecord(request.body?.data)
    } catch (error) {
      return response.status(400).json({ error: error.message })
    }
    if (![data.firstName, data.middleName, data.lastName].some((value) => value.trim())) {
      return response.status(400).json({ error: 'Enter at least one applicant name field to save this draft.' })
    }
    const updatedAt = new Date().toISOString()
    const status = existing.status === 'Form ready' && validateApplicationRecord(data).length
      ? 'Draft'
      : existing.status
    await database.execute('UPDATE applications SET data = ?, status = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(data),
      status,
      updatedAt,
      request.params.id,
    ])
    response.json({ item: await buildRecord(database, request.params.id) })
  })

  app.patch('/api/customers/:id/status', requireOwner, async (request, response) => {
    if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Invalid application ID.' })
    const status = request.body?.status
    if (!['Draft', 'Form ready', 'Submitted', 'Account opened'].includes(status)) {
      return response.status(400).json({ error: 'Choose a valid application status.' })
    }
    const existing = await buildRecord(database, request.params.id)
    if (!existing) return response.status(404).json({ error: 'Application not found.' })
    if (status === 'Submitted' || status === 'Account opened') {
      return response.status(409).json({ error: 'Use the physical submission or account-opening action to record its date.' })
    }
    if (existing.submittedOn && ['Draft', 'Form ready'].includes(status)) {
      return response.status(409).json({ error: 'A physically submitted application cannot return to a pre-submission status.' })
    }
    if (status === 'Form ready') {
      const issues = validateApplicationRecord(existing)
      if (issues.length) {
        return response.status(400).json({
          error: 'Complete the required and applicable fields before marking this form ready.',
          issues,
        })
      }
    }
    await database.execute('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      new Date().toISOString(),
      request.params.id,
    ])
    response.json({ item: await buildRecord(database, request.params.id) })
  })

  app.post('/api/customers/:id/mark-submitted', requireOwner, async (request, response) => {
    if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Invalid application ID.' })
    const existing = await buildRecord(database, request.params.id)
    if (!existing) return response.status(404).json({ error: 'Application not found.' })
    if (existing.status !== 'Form ready') {
      return response.status(409).json({ error: 'Mark the application Form ready before recording its physical submission.' })
    }
    if (existing.submittedOn) return response.status(409).json({ error: 'This application is already marked as physically submitted.' })
    const submittedOn = request.body?.submittedOn
    if (!validDate(submittedOn)) return response.status(400).json({ error: 'Provide a valid physical submission date.' })
    const now = new Date().toISOString()
    await database.execute('UPDATE applications SET status = ?, submitted_on = ?, updated_at = ? WHERE id = ?', [
      'Submitted',
      submittedOn,
      now,
      request.params.id,
    ])
    response.json({ item: await buildRecord(database, request.params.id) })
  })

  app.post('/api/customers/:id/mark-opened', requireOwner, async (request, response) => {
    if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Invalid application ID.' })
    const existing = await buildRecord(database, request.params.id)
    if (!existing) return response.status(404).json({ error: 'Application not found.' })
    if (existing.status !== 'Submitted') {
      return response.status(409).json({ error: 'Record physical submission before recording the account-opening date.' })
    }
    if (!validDate(request.body?.accountOpenedOn)) {
      return response.status(400).json({ error: 'Provide a valid account-opening date.' })
    }
    await database.execute(
      'UPDATE applications SET status = ?, account_opened_on = ?, updated_at = ? WHERE id = ?',
      ['Account opened', request.body.accountOpenedOn, new Date().toISOString(), request.params.id],
    )
    response.json({ item: await buildRecord(database, request.params.id) })
  })

  app.use('/api/customers/:id/export', requireOwner)

  app.get('/api/customers/:id/export/pdf', async (request, response) => {
    if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Invalid application ID.' })
    const record = await buildRecord(database, request.params.id)
    if (!record) return response.status(404).json({ error: 'Application not found.' })

    try {
      const file = await createApplicationPdf(record)
      response
        .status(200)
        .set('Content-Type', 'application/pdf')
        .set('Content-Disposition', `inline; filename="sakshi-application-${record.id}.pdf"`)
        .set('Content-Length', String(file.length))
        .send(file)
    } catch (error) {
      if (error instanceof PdfLayoutError) {
        return response.status(422).json({ error: error.message, issues: error.issues })
      }
      return response.status(500).json({
        error: 'Could not generate the two-page PDF. No file was created; try again or check the server setup.',
      })
    }
  })

  const distPath = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
  if (process.env.NODE_ENV === 'production' && !existsSync(distPath)) {
    throw new Error('Production frontend build not found. Run `npm run build` before starting the server.')
  }
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(distPath, { index: false }))
    app.use((request, response, next) => {
      if (request.method === 'GET' && request.accepts('html') && !request.path.startsWith('/api/')) {
        return response.sendFile(resolve(distPath, 'index.html'))
      }
      next()
    })
  }

  app.use((request, response) => {
    response.status(404).json({ error: 'Route not found.' })
  })

  app.use((error, request, response, _next) => {
    console.error('Request failed.')
    if (response.headersSent) return
    if (error instanceof SyntaxError && 'body' in error) {
      return response.status(400).json({ error: 'Request body must be valid JSON.' })
    }
    response.status(500).json({ error: 'The server could not complete the request.' })
  })

  return app
}

export { STATUSES }
