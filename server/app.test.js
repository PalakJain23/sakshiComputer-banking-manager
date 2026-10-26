import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createApp } from './app.js'
import { createOwner, openDatabase } from './database.js'
import { validateApplicationRecord } from './record-fields.js'

const ownerUsername = 'owner-test'
const ownerPassword = 'correct horse battery staple 614'
const origin = 'http://127.0.0.1:5173'
const requestHeaders = {
  Origin: origin,
  'X-Requested-With': 'SakshiComputerUI',
}
const longResidentialAddress =
  `${'88 Fictional Avenue, Long Address District, Example Region, India. '.repeat(3)}END-ADDRESS-MARKER`
const completeApplication = {
  firstName: 'Fictional LongApplicant',
  middleName: 'Sample',
  lastName: 'Customer',
  dateOfBirth: '1990-02-03',
  gender: 'Female',
  occupation: 'Teacher',
  mobile: '9876543210',
  residentialAddress: longResidentialAddress,
  residentialPinCode: '001234',
  sameAddress: true,
  bankName: 'Union Bank of India',
  branch: 'Example Branch',
  accountType: 'BSBDA',
  customerId: '0000456',
  accountNumber: '00001234',
  identityDocumentType: 'PAN',
  identityDocumentNumber: '0000FIC01',
  nominationRequired: 'No',
  declarationLanguage: 'English',
  declarationDate: '2026-10-24',
  declarationPlace: 'Example City',
  termsAcknowledged: true,
  witnessOneName: 'Witness One',
  witnessOneAddress: '1 Fictional Street',
  witnessTwoName: 'Witness Two',
  witnessTwoAddress: '2 Fictional Street',
}

let directory
let databasePath
let database
let server
let baseUrl
let cookie
let recordId

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options)
}

before(async () => {
  directory = mkdtempSync(join(tmpdir(), 'sakshi-computer-test-'))
  databasePath = join(directory, 'applications.sqlite')
  database = openDatabase(databasePath)
  createOwner(database, ownerUsername, ownerPassword)
  server = createApp({ database }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  if (database?.isOpen) database.close()
  rmSync(directory, { recursive: true, force: true })
})

test('customer and export endpoints require a valid owner session', async () => {
  const unauthenticated = await Promise.all([
    request('/api/customers'),
    request('/api/customers/7d7a2bc8-ae6d-4c0e-9d64-61a52b3cc011'),
    request('/api/customers/7d7a2bc8-ae6d-4c0e-9d64-61a52b3cc011/export/pdf'),
    request('/api/customers/7d7a2bc8-ae6d-4c0e-9d64-61a52b3cc011/export/docx'),
    request('/api/customers/7d7a2bc8-ae6d-4c0e-9d64-61a52b3cc011/export/xlsx'),
  ])
  assert.deepEqual(unauthenticated.map((response) => response.status), [401, 401, 401, 401, 401])
})

test('draft saves, validation, search, editing, statuses, exports and restart persistence work', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { ...requestHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ownerUsername, password: ownerPassword }),
  })
  assert.equal(login.status, 200)
  cookie = login.headers.get('set-cookie').split(';')[0]

  const created = await request('/api/customers', {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        firstName: 'Fictional',
        customerId: '0000456',
        residentialPinCode: '001234',
      },
    }),
  })
  assert.equal(created.status, 201)
  const draft = (await created.json()).item
  recordId = draft.id
  assert.equal(draft.status, 'Draft')
  assert.equal(draft.accountNumber, '')
  assert.equal(draft.customerId, '0000456')
  assert.equal(draft.residentialPinCode, '001234')

  const missingRequired = await request(`/api/customers/${recordId}/status`, {
    method: 'PATCH',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Form ready' }),
  })
  assert.equal(missingRequired.status, 400)
  assert.match((await missingRequired.json()).issues.join(' '), /date of birth/i)

  const prematureSubmission = await request(`/api/customers/${recordId}/mark-submitted`, {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ submittedOn: '2026-10-24' }),
  })
  assert.equal(prematureSubmission.status, 409)

  const completed = await request(`/api/customers/${recordId}`, {
    method: 'PUT',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: completeApplication }),
  })
  const completedResponse = await completed.json()
  assert.equal(completed.status, 200, JSON.stringify(completedResponse))
  const updated = completedResponse.item
  assert.equal(updated.id, recordId)
  assert.equal(updated.accountNumber, '00001234')

  const ready = await request(`/api/customers/${recordId}/status`, {
    method: 'PATCH',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Form ready' }),
  })
  const readyResponse = await ready.json()
  assert.equal(ready.status, 200, JSON.stringify(readyResponse))
  assert.equal(readyResponse.item.status, 'Form ready')

  const nameSearch = await request('/api/customers?q=fictional', { headers: { Cookie: cookie } })
  assert.deepEqual((await nameSearch.json()).items.map((item) => item.id), [recordId])
  const mobileSearch = await request('/api/customers?q=9876543210', { headers: { Cookie: cookie } })
  assert.deepEqual((await mobileSearch.json()).items.map((item) => item.id), [recordId])
  const accountSearch = await request('/api/customers?q=00001234', { headers: { Cookie: cookie } })
  assert.deepEqual((await accountSearch.json()).items.map((item) => item.id), [recordId])

  const duplicateCheck = await request('/api/customers', { headers: { Cookie: cookie } })
  assert.equal((await duplicateCheck.json()).items.length, 1)

  const removedExports = await Promise.all([
    request(`/api/customers/${recordId}/export/docx`, { headers: { Cookie: cookie } }),
    request(`/api/customers/${recordId}/export/xlsx`, { headers: { Cookie: cookie } }),
  ])
  assert.deepEqual(removedExports.map((response) => response.status), [404, 404])

  const pdfResponse = await request(`/api/customers/${recordId}/export/pdf`, { headers: { Cookie: cookie } })
  assert.equal(pdfResponse.status, 200)
  assert.match(pdfResponse.headers.get('content-type'), /application\/pdf/)
  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer())
  assert.equal(Buffer.from(pdfBytes).toString('ascii', 0, 5), '%PDF-')
  const parsedPdf = await pdfjs.getDocument({ data: pdfBytes, verbosity: 0 }).promise
  assert.equal(parsedPdf.numPages, 2)
  const pageTexts = []
  for (let pageNumber = 1; pageNumber <= parsedPdf.numPages; pageNumber += 1) {
    const page = await parsedPdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items.map((item) => item.str).join(' ')
    pageTexts.push(text)
    assert.match(text, new RegExp(`Page ${pageNumber} of 2`))
  }
  const allPdfText = pageTexts.join(' ')
  const titleIndex = pageTexts[0].indexOf('ACCOUNT APPLICATION — CUSTOM WORKING DOCUMENT')
  const disclaimerIndex = pageTexts[0].indexOf('CUSTOM DOCUMENT — NOT BANK-ISSUED OR BANK-APPROVED')
  const bankHeadingIndex = pageTexts[0].indexOf('UNION BANK OF INDIA')
  assert.ok(titleIndex >= 0 && titleIndex < disclaimerIndex && disclaimerIndex < bankHeadingIndex)
  assert.equal((allPdfText.match(/UNION BANK OF INDIA/g) || []).length, 1)
  const firstPageOperators = await (await parsedPdf.getPage(1)).getOperatorList()
  const secondPageOperators = await (await parsedPdf.getPage(2)).getOperatorList()
  assert.ok(firstPageOperators.fnArray.includes(pdfjs.OPS.paintImageXObject))
  assert.ok(!secondPageOperators.fnArray.includes(pdfjs.OPS.paintImageXObject))
  assert.match(allPdfText, /I hereby apply for opening of a Basic Saving Bank Deposit Account/)
  assert.match(allPdfText, /Applicant signature \/ thumb impression/)
  assert.match(allPdfText, /Admitting officer \/ authorised bank official signature and stamp/)
  assert.match(allPdfText, /PHOTOGRAPH/)
  assert.match(allPdfText, /not bank-issued or bank-approved/i)
  assert.match(allPdfText, /LongApplicant/)
  assert.match(allPdfText, /END-ADDRESS-MARKER/)
  assert.doesNotMatch(allPdfText, /aggregate of all credits in a financial year/i)
  assert.doesNotMatch(allPdfText, /Minor applicant's guardian signature/)
  assert.doesNotMatch(allPdfText, /Person appointed for minor nominee/)

  const longNameCreated = await request('/api/customers', {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...completeApplication,
        firstName: `${'Fictional Applicant With Several Name Parts '.repeat(3)}END-NAME-MARKER`,
        residentialAddress: '17 Fictional Road, Example City',
        permanentAddress: '17 Fictional Road, Example City',
        sameAddress: false,
      },
    }),
  })
  assert.equal(longNameCreated.status, 201)
  const longNameRecord = (await longNameCreated.json()).item
  const longNamePdf = await request(`/api/customers/${longNameRecord.id}/export/pdf`, { headers: { Cookie: cookie } })
  assert.equal(longNamePdf.status, 200)
  const longNameDocument = await pdfjs.getDocument({
    data: new Uint8Array(await longNamePdf.arrayBuffer()),
    verbosity: 0,
  }).promise
  assert.equal(longNameDocument.numPages, 2)
  let longNameText = ''
  for (let pageNumber = 1; pageNumber <= longNameDocument.numPages; pageNumber += 1) {
    const page = await longNameDocument.getPage(pageNumber)
    longNameText += (await page.getTextContent()).items.map((item) => item.str).join(' ')
  }
  assert.ok(longNameText.replace(/\s/g, '').includes('END-NAME-MARKER'))

  const minorApplication = {
    ...completeApplication,
    firstName: 'Fictional Minor',
    applicantIsMinor: true,
    applicantGuardianName: 'Applicant Guardian',
    applicantGuardianRelationship: 'Parent',
    applicantGuardianAddress: '3 Fictional Road',
    nominationRequired: 'Yes',
    nomineeName: 'Minor Nominee',
    nomineeRelationship: 'Sibling',
    nomineeAge: '12',
    nomineeIsMinor: true,
    nomineeAddress: '4 Fictional Road',
    appointedPersonName: 'Nominee Appointed Person',
    appointedPersonRelationship: 'Parent',
    appointedPersonDateOfBirth: '1970-01-02',
    appointedPersonAddress: '5 Fictional Road',
  }
  const minorCreated = await request('/api/customers', {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: minorApplication }),
  })
  assert.equal(minorCreated.status, 201)
  const minorRecord = (await minorCreated.json()).item
  const minorPdf = await request(`/api/customers/${minorRecord.id}/export/pdf`, { headers: { Cookie: cookie } })
  assert.equal(minorPdf.status, 200)
  const minorPdfDocument = await pdfjs.getDocument({
    data: new Uint8Array(await minorPdf.arrayBuffer()),
    verbosity: 0,
  }).promise
  assert.equal(minorPdfDocument.numPages, 2)
  let minorPdfText = ''
  for (let pageNumber = 1; pageNumber <= minorPdfDocument.numPages; pageNumber += 1) {
    const page = await minorPdfDocument.getPage(pageNumber)
    minorPdfText += (await page.getTextContent()).items.map((item) => item.str).join(' ')
  }
  assert.match(minorPdfText, /Applicant's guardian name/)
  assert.match(minorPdfText, /Person appointed for minor nominee/)
  assert.match(minorPdfText, /Minor applicant guardian signature/)
  assert.match(minorPdfText, /Person appointed for minor nominee — signature/)

  const smallAccountCreated = await request('/api/customers', {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { ...completeApplication, firstName: 'Fictional Small Account', accountType: 'BSBDS' } }),
  })
  assert.equal(smallAccountCreated.status, 201)
  const smallAccountRecord = (await smallAccountCreated.json()).item
  const smallAccountPdf = await request(`/api/customers/${smallAccountRecord.id}/export/pdf`, { headers: { Cookie: cookie } })
  assert.equal(smallAccountPdf.status, 200)
  const smallAccountDocument = await pdfjs.getDocument({
    data: new Uint8Array(await smallAccountPdf.arrayBuffer()),
    verbosity: 0,
  }).promise
  assert.equal(smallAccountDocument.numPages, 2)
  let smallAccountText = ''
  for (let pageNumber = 1; pageNumber <= smallAccountDocument.numPages; pageNumber += 1) {
    const page = await smallAccountDocument.getPage(pageNumber)
    smallAccountText += (await page.getTextContent()).items.map((item) => item.str).join(' ')
  }
  assert.match(smallAccountText, /aggregate of all credits in a financial year/i)

  const overdraftCreated = await request('/api/customers', {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        ...completeApplication,
        overdraftRequested: true,
        overdraftAmount: '10000',
        overdraftAmountWords: 'Ten thousand rupees',
        incomeSource: 'Fictional salary',
        overdraftPurpose: 'Emergency family needs',
        loanDeclarationConfirmed: true,
      },
    }),
  })
  assert.equal(overdraftCreated.status, 201)
  const overdraftRecord = (await overdraftCreated.json()).item
  const overdraftPdf = await request(`/api/customers/${overdraftRecord.id}/export/pdf`, { headers: { Cookie: cookie } })
  assert.equal(overdraftPdf.status, 200)
  const overdraftDocument = await pdfjs.getDocument({
    data: new Uint8Array(await overdraftPdf.arrayBuffer()),
    verbosity: 0,
  }).promise
  assert.equal(overdraftDocument.numPages, 2)
  let overdraftText = ''
  for (let pageNumber = 1; pageNumber <= overdraftDocument.numPages; pageNumber += 1) {
    const page = await overdraftDocument.getPage(pageNumber)
    overdraftText += (await page.getTextContent()).items.map((item) => item.str).join(' ')
  }
  assert.match(overdraftText, /I also request you to sanction me an overdraft limit of 10000/)

  const overflowingAddress = `${'99 Very Long Fictional Residential Address, Example District, Example Region, India. '.repeat(45)}END-ADDRESS-MARKER`
  const overflowingCreated = await request('/api/customers', {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { ...completeApplication, residentialAddress: overflowingAddress } }),
  })
  assert.equal(overflowingCreated.status, 201)
  const overflowingRecord = (await overflowingCreated.json()).item
  const overflowingPdf = await request(`/api/customers/${overflowingRecord.id}/export/pdf`, { headers: { Cookie: cookie } })
  assert.equal(overflowingPdf.status, 422)
  const overflowResponse = await overflowingPdf.json()
  assert.match(overflowResponse.issues.join(' '), /residential address/i)

  const submission = await request(`/api/customers/${recordId}/mark-submitted`, {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ submittedOn: '2026-10-24' }),
  })
  assert.equal(submission.status, 200)
  const submitted = (await submission.json()).item
  assert.equal(submitted.status, 'Submitted')
  assert.equal(submitted.submittedOn, '2026-10-24')
  assert.equal(submitted.accountOpenedOn, null)

  const opened = await request(`/api/customers/${recordId}/mark-opened`, {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountOpenedOn: '2026-10-26' }),
  })
  assert.equal(opened.status, 200)
  const accountOpened = (await opened.json()).item
  assert.equal(accountOpened.status, 'Account opened')
  assert.equal(accountOpened.submittedOn, '2026-10-24')
  assert.equal(accountOpened.accountOpenedOn, '2026-10-26')

  await new Promise((resolve) => server.close(resolve))
  database.close()
  database = openDatabase(databasePath)
  server = createApp({ database }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`

  const afterRestart = await request(`/api/customers/${recordId}`, { headers: { Cookie: cookie } })
  assert.equal(afterRestart.status, 200)
  const persisted = (await afterRestart.json()).item
  assert.equal(persisted.status, 'Account opened')
  assert.equal(persisted.accountNumber, '00001234')
  assert.equal(persisted.submittedOn, '2026-10-24')
  assert.equal(persisted.accountOpenedOn, '2026-10-26')

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    headers: { ...requestHeaders, Cookie: cookie },
  })
  assert.equal(logout.status, 200)
  const invalidated = await request(`/api/customers/${recordId}`, { headers: { Cookie: cookie } })
  assert.equal(invalidated.status, 401)
  const invalidatedExport = await request(`/api/customers/${recordId}/export/pdf`, { headers: { Cookie: cookie } })
  assert.equal(invalidatedExport.status, 401)
})

test('conditional nominee and minor-applicant details remain separate and validate independently', () => {
  const record = {
    ...completeApplication,
    applicantIsMinor: true,
    nomineeIsMinor: true,
    nominationRequired: 'Yes',
    appointedPersonName: '',
    applicantGuardianName: '',
  }
  const issues = validateApplicationRecord(record)
  assert.ok(issues.includes('Enter the minor applicant’s guardian name.'))
  assert.ok(issues.includes('Enter the person appointed for the minor nominee.'))
})

test('HTTPS session cookies remain usable and are cleared with the Secure attribute', async () => {
  const secureServer = createApp({ database, secureCookies: true, allowedOrigins: [origin] })
    .listen(0, '127.0.0.1')
  await new Promise((resolve) => secureServer.once('listening', resolve))
  const secureBaseUrl = `http://127.0.0.1:${secureServer.address().port}`
  const postHeaders = {
    ...requestHeaders,
    'Content-Type': 'application/json',
  }

  try {
    const login = await fetch(`${secureBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: postHeaders,
      body: JSON.stringify({ username: ownerUsername, password: ownerPassword }),
    })
    assert.equal(login.status, 200)
    const setCookie = login.headers.get('set-cookie')
    assert.match(setCookie, /;\s*Secure(?:;|$)/i)
    const cookieHeader = setCookie.split(';')[0]

    const session = await fetch(`${secureBaseUrl}/api/auth/session`, {
      headers: { Cookie: cookieHeader },
    })
    assert.deepEqual(await session.json(), { authenticated: true, username: ownerUsername })

    const logout = await fetch(`${secureBaseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { ...postHeaders, Cookie: cookieHeader },
    })
    assert.equal(logout.status, 200)
    assert.match(logout.headers.get('set-cookie'), /;\s*Secure(?:;|$)/i)
    assert.deepEqual(await logout.json(), { authenticated: false })
  } finally {
    await new Promise((resolve) => secureServer.close(resolve))
  }
})

test('PDF generator loads the exact-case blank template and authentic logo assets', async () => {
  const templateBytes = readFileSync(new URL('./assets/bank_form.pdf', import.meta.url))
  const logoBytes = readFileSync(new URL('./assets/union-bank-logo.png', import.meta.url))
  assert.equal(templateBytes.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.deepEqual([...logoBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  if (process.platform === 'linux') {
    assert.throws(() => readFileSync(new URL('./assets/Bank_Form.pdf', import.meta.url)), { code: 'ENOENT' })
    assert.throws(() => readFileSync(new URL('./assets/Union-Bank-Logo.png', import.meta.url)), { code: 'ENOENT' })
  }

  const template = await pdfjs.getDocument({ data: new Uint8Array(templateBytes), verbosity: 0 }).promise
  assert.equal(template.numPages, 2)
})
