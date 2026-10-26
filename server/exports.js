import PDFDocument from 'pdfkit'
import { readFileSync } from 'node:fs'
import {
  ACCOUNT_DECLARATION,
  BANK_DISCRETION_DECLARATION,
  OVERDRAFT_DECLARATION,
  SMALL_ACCOUNT_TERMS,
} from './declaration.js'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 38
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
const FOOTER_Y = PAGE_HEIGHT - 24
const CONTENT_BOTTOM = FOOTER_Y - 24
const BODY_FONT = 8.5
const LABEL_FONT = 7.8
const PARAGRAPH_FONT = 8.2
const SECTION_HEIGHT = 15
const PAGE_MARGINS = { top: MARGIN, bottom: 14, left: MARGIN, right: MARGIN }
const BANK_TEMPLATE = readFileSync(new URL('./assets/bank_form.pdf', import.meta.url))
const UNION_BANK_LOGO = readFileSync(new URL('./assets/union-bank-logo.png', import.meta.url))
const DOCUMENT_TITLE = 'ACCOUNT APPLICATION — CUSTOM WORKING DOCUMENT'
const DOCUMENT_DISCLAIMER = 'CUSTOM DOCUMENT — NOT BANK-ISSUED OR BANK-APPROVED'
const BANK_HEADING = 'UNION BANK OF INDIA'

if (!BANK_TEMPLATE.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
  throw new Error('The supplied blank bank form template is not a valid PDF.')
}

export class PdfLayoutError extends Error {
  constructor(issues) {
    super('Some entered values do not fit safely in the two-page PDF. Shorten the identified fields and try again.')
    this.name = 'PdfLayoutError'
    this.issues = issues
  }
}

function display(value) {
  return value ? String(value) : ''
}

function applicantName(record) {
  return [record.title, record.firstName, record.middleName, record.lastName].filter(Boolean).join(' ') || 'Applicant'
}

function field(key, label, value = '') {
  return { key, label, value: display(value) }
}

function applicantFields(record) {
  return [
    {
      title: 'Applicant and personal details',
      rows: [
        [field('title', 'Title', record.title), field('gender', 'Gender', record.gender)],
        [field('firstName', 'First name', record.firstName), field('middleName', 'Middle name', record.middleName)],
        [field('lastName', 'Last name', record.lastName), field('dateOfBirth', 'Date of birth', record.dateOfBirth)],
        [field('parentName', 'Parent / spouse name', record.parentName), field('parentRelationship', 'Relationship', record.parentRelationship)],
        [field('maritalStatus', 'Marital status', record.maritalStatus), field('occupation', 'Occupation', record.occupation)],
        [field('education', 'Education', record.education), field('annualIncome', 'Annual income', record.annualIncome)],
        [field('applicantIsMinor', 'Applicant is a minor', record.applicantIsMinor ? 'Yes' : 'No')],
      ],
    },
    {
      title: 'Contact details',
      rows: [[field('mobile', 'Mobile number', record.mobile), field('email', 'Email address', record.email)]],
    },
    {
      title: 'Residential and permanent addresses',
      rows: [
        [field('residentialAddress', 'Residential address', record.residentialAddress)],
        [
          field('residentialPinCode', 'Residential PIN / postal code', record.residentialPinCode),
          field('sameAddress', 'Permanent address same as residential', record.sameAddress ? 'Yes' : 'No'),
        ],
        [field('permanentAddress', 'Permanent address', record.permanentAddress)],
        [field('permanentPinCode', 'Permanent PIN / postal code', record.permanentPinCode)],
      ],
    },
    {
      title: 'Bank and identification / KYC details',
      rows: [
        [field('bankName', 'Bank name', record.bankName), field('branch', 'Branch', record.branch)],
        [
          field('accountType', 'Account type / mode of operation', [record.accountType, 'Mode of Operation: Single'].filter(Boolean).join(' — ')),
          field('customerId', 'Customer ID', record.customerId),
        ],
        [field('accountNumber', 'Account number', record.accountNumber), field('identityDocumentType', 'Identification document type', record.identityDocumentType)],
        [field('identityDocumentNumber', 'Identification document reference', record.identityDocumentNumber)],
      ],
    },
  ]
}

function pageTwoSections(record) {
  const nominationRows = [
    [field('nominationRequired', 'Nomination required', record.nominationRequired)],
  ]
  if (record.nominationRequired === 'Yes') {
    nominationRows.push(
      [field('nomineeName', 'Nominee name', record.nomineeName), field('nomineeRelationship', 'Relationship', record.nomineeRelationship)],
      [
        field('nomineeAge', 'Nominee age', record.nomineeAge),
        field('nomineeDateOfBirth', 'Nominee date of birth', record.nomineeDateOfBirth),
      ],
      [
        field('nomineeAddress', 'Nominee address', record.nomineeAddress),
        field('nomineePinCode', 'Nominee PIN / postal code', record.nomineePinCode),
      ],
    )
    if (record.nomineeIsMinor) {
      nominationRows.push(
        [
          field('nomineeIsMinor', 'Nominee is a minor', 'Yes'),
          field('appointedPersonName', 'Person appointed for minor nominee', record.appointedPersonName),
        ],
        [
          field('appointedPersonRelationship', "Appointed person's relationship", record.appointedPersonRelationship),
          field('appointedPersonDateOfBirth', "Appointed person's date of birth", record.appointedPersonDateOfBirth),
        ],
        [field('appointedPersonAddress', "Appointed person's address", record.appointedPersonAddress)],
      )
    } else {
      nominationRows.push([field('nomineeIsMinor', 'Nominee is a minor', 'No')])
    }
  }

  if (record.applicantIsMinor) {
    nominationRows.push(
      [field('applicantGuardianName', "Applicant's guardian name", record.applicantGuardianName)],
      [
        field('applicantGuardianRelationship', "Applicant's guardian relationship", record.applicantGuardianRelationship),
        field('applicantGuardianAddress', "Applicant's guardian address", record.applicantGuardianAddress),
      ],
    )
  }

  const sections = [
    {
      title: record.applicantIsMinor
        ? 'Nomination and separate minor-applicant guardian'
        : 'Nomination',
      rows: nominationRows,
    },
  ]

  sections.push(
    {
      title: 'Witnesses and declaration date / place',
      rows: [
        [
          field('witnessOneName', 'Witness 1 name', record.witnessOneName),
          field('witnessTwoName', 'Witness 2 name', record.witnessTwoName),
        ],
        [
          field('witnessOneAddress', 'Witness 1 address', record.witnessOneAddress),
          field('witnessTwoAddress', 'Witness 2 address', record.witnessTwoAddress),
        ],
        [
          field('declarationDate', 'Date', record.declarationDate),
          field('declarationPlace', 'Place', record.declarationPlace),
        ],
      ],
    },
    {
      title: 'Introduction (optional)',
      rows: [
        [field('introducedByName', 'Introduced by name', record.introducedByName)],
        [
          field('introducedByAccountNumber', "Introducer's account number", record.introducedByAccountNumber),
          field('introducedByBranch', "Introducer's branch", record.introducedByBranch),
        ],
      ],
    },
    {
      title: `Optional overdraft request — ${record.overdraftRequested ? 'Requested' : 'Not requested'}`,
      rows: [
        ...(record.overdraftRequested
          ? [
              [field('overdraftAmount', 'Requested amount', record.overdraftAmount)],
              [field('overdraftAmountWords', 'Requested amount in words', record.overdraftAmountWords)],
              [field('incomeSource', 'Main source of income', record.incomeSource)],
              [field('loanDeclarationConfirmed', 'No-loan declaration confirmed', record.loanDeclarationConfirmed ? 'Yes' : 'No')],
              [field('overdraftPurpose', 'Purpose', record.overdraftPurpose)],
            ]
          : []),
      ],
    },
    {
      title: 'Acknowledgements and declarations',
      rows: [[field(
        'termsAcknowledged',
        'Terms and conditions acknowledgement',
        record.termsAcknowledged ? 'Applicant confirms the terms have been read, explained and understood.' : '',
      )]],
    },
  )

  return sections
}

function applicantDeclaration(record) {
  return ACCOUNT_DECLARATION.replace('[language]', record.declarationLanguage || '________________')
}

function overdraftDeclaration(record) {
  return OVERDRAFT_DECLARATION
    .replace('[amount]', record.overdraftAmount || '________________')
    .replace('[amount in words]', record.overdraftAmountWords || '________________')
    .replace('[income source]', record.incomeSource || '________________')
}

function fieldIssues(fields, page, additional = '') {
  const fieldNames = fields.length
    ? fields.map((item) => `${item.label} (${item.key})`).join(', ')
    : additional
  return `Page ${page}: ${fieldNames || additional} exceeds the available two-page PDF layout. Shorten this value or remove optional detail.`
}

function drawPageHeader(document, pageNumber, record) {
  document.font('Helvetica-Bold').fontSize(9.5).fillColor('#111111')
    .text(DOCUMENT_TITLE, MARGIN, 18, {
      width: CONTENT_WIDTH,
      align: 'center',
      lineBreak: false,
    })
  document.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
    .text(DOCUMENT_DISCLAIMER, MARGIN, 33, {
      width: CONTENT_WIDTH,
      align: 'center',
      lineBreak: false,
    })

  if (pageNumber === 1) {
    const logoWidth = 31
    const logoGap = 8
    document.font('Helvetica-Bold').fontSize(19)
    const headingWidth = document.widthOfString(BANK_HEADING)
    const groupX = (PAGE_WIDTH - logoWidth - logoGap - headingWidth) / 2
    document.image(UNION_BANK_LOGO, groupX, 52, { width: logoWidth })
    document.font('Helvetica-Bold').fontSize(19).fillColor('#111111')
      .text(BANK_HEADING, groupX + logoWidth + logoGap, 54, {
        width: headingWidth,
        lineBreak: false,
      })
    document.font('Helvetica').fontSize(8.5).fillColor('#111111')
      .text(`Applicant: ${applicantName(record)}`, MARGIN, 88, {
        width: CONTENT_WIDTH - 98,
        lineBreak: false,
      })

    const photoWidth = 78
    const photoHeight = 82
    const x = PAGE_WIDTH - MARGIN - photoWidth
    document.rect(x, 52, photoWidth, photoHeight).lineWidth(0.8).stroke('#222222')
    document.font('Helvetica').fontSize(7.5).fillColor('#111111')
      .text('PHYSICAL\nPHOTOGRAPH\nPaste photo here', x + 5, 78, {
        width: photoWidth - 10,
        align: 'center',
      })
  }
  document.y = pageNumber === 1 ? 140 : 62
}

function drawFooter(document, pageNumber) {
  document.font('Helvetica').fontSize(7.5).fillColor('#111111')
    .text(
      `Prepared through Sakshi Computer  |  Page ${pageNumber} of 2`,
      MARGIN,
      FOOTER_Y,
      { width: CONTENT_WIDTH, align: 'center', lineBreak: false },
    )
}

function measureText(document, value, font, size, width) {
  document.font(font).fontSize(size)
  return document.heightOfString(value || ' ', { width, lineGap: 0.8 })
}

function drawSectionHeading(document, title, page, fields) {
  if (document.y + SECTION_HEIGHT > CONTENT_BOTTOM) {
    throw new PdfLayoutError([fieldIssues(fields, page, title)])
  }
  document.font('Helvetica-Bold').fontSize(9.2).fillColor('#111111')
    .text(title, MARGIN, document.y + 3, { width: CONTENT_WIDTH })
  document.moveTo(MARGIN, document.y + SECTION_HEIGHT).lineTo(MARGIN + CONTENT_WIDTH, document.y + SECTION_HEIGHT)
    .lineWidth(0.55).stroke('#222222')
  document.y += SECTION_HEIGHT + 1
}

function drawFieldRow(document, fields, page) {
  const columnCount = fields.length
  const columnWidth = CONTENT_WIDTH / columnCount
  const labelRatio = columnCount === 1 ? 0.26 : 0.38
  const horizontalPadding = 5
  const labelWidth = columnWidth * labelRatio - horizontalPadding * 2
  const valueWidth = columnWidth * (1 - labelRatio) - horizontalPadding * 2
  const cellHeights = fields.map(({ label, value }) => {
    const labelHeight = measureText(document, label, 'Helvetica-Bold', LABEL_FONT, labelWidth)
    const valueHeight = measureText(document, value, 'Helvetica', BODY_FONT, valueWidth)
    return Math.max(15, labelHeight, valueHeight) + 3
  })
  const rowHeight = Math.max(...cellHeights)
  if (document.y + rowHeight > CONTENT_BOTTOM) {
    throw new PdfLayoutError([fieldIssues(fields, page)])
  }

  const rowY = document.y
  fields.forEach(({ label, value }, index) => {
    const x = MARGIN + columnWidth * index
    const baselineY = rowY + 2
    const valueX = x + columnWidth * labelRatio
    document.font('Helvetica-Bold').fontSize(LABEL_FONT).fillColor('#111111')
      .text(label, x + horizontalPadding, baselineY, {
        width: labelWidth,
        lineGap: 0.8,
      })
    if (value) {
      document.font('Helvetica').fontSize(BODY_FONT).fillColor('#111111')
        .text(value, valueX + horizontalPadding, baselineY, {
          width: valueWidth,
          lineGap: 0.8,
        })
    }
    if (index > 0) {
      document.moveTo(x, rowY).lineTo(x, rowY + rowHeight).lineWidth(0.3).stroke('#999999')
    }
  })
  document.moveTo(MARGIN, rowY + rowHeight).lineTo(MARGIN + CONTENT_WIDTH, rowY + rowHeight)
    .lineWidth(0.35).stroke('#888888')
  document.y = rowY + rowHeight
}

function drawFieldsSection(document, section, page) {
  const fields = section.rows.flat()
  drawSectionHeading(document, section.title, page, fields)
  for (const row of section.rows) drawFieldRow(document, row, page)
  document.y += 3
}

function drawParagraph(document, text, page, fieldLabel, fieldKey) {
  const width = CONTENT_WIDTH - 6
  const height = measureText(document, text, 'Helvetica', PARAGRAPH_FONT, width) + 6
  if (document.y + height > CONTENT_BOTTOM) {
    throw new PdfLayoutError([fieldIssues([field(fieldKey, fieldLabel)], page)])
  }
  document.font('Helvetica').fontSize(PARAGRAPH_FONT).fillColor('#111111')
    .text(text, MARGIN + 3, document.y + 2, {
      width,
      lineGap: 1,
    })
  document.y += height
}

function drawSignature(document, label, page, key) {
  const height = 38
  if (document.y + height > CONTENT_BOTTOM) {
    throw new PdfLayoutError([fieldIssues([field(key, label)], page)])
  }
  const lineY = document.y + 20
  document.moveTo(MARGIN + 4, lineY).lineTo(MARGIN + CONTENT_WIDTH - 4, lineY)
    .lineWidth(0.6).stroke('#222222')
  document.font('Helvetica').fontSize(7.6).fillColor('#111111')
    .text(label, MARGIN + 4, lineY + 3, { width: CONTENT_WIDTH - 8 })
  document.y += height
}

function drawSignatureRow(document, signatures, page) {
  const height = 36
  if (document.y + height > CONTENT_BOTTOM) {
    throw new PdfLayoutError([fieldIssues(signatures.map(({ label, key }) => field(key, label)), page)])
  }
  const columnWidth = CONTENT_WIDTH / signatures.length
  const lineY = document.y + 18
  signatures.forEach(({ label }, index) => {
    const x = MARGIN + columnWidth * index
    document.moveTo(x + 4, lineY).lineTo(x + columnWidth - 4, lineY)
      .lineWidth(0.6).stroke('#222222')
    document.font('Helvetica').fontSize(7.6).fillColor('#111111')
      .text(label, x + 4, lineY + 3, { width: columnWidth - 8 })
  })
  document.y += height
}

function drawBankUseSection(document) {
  drawSectionHeading(document, 'Bank use only — for authorised bank staff', 2, [])
  drawFieldRow(document, [
    field('bankUseBranchCode', 'Branch code'),
    field('bankUseAccountType', 'Account type assigned by bank'),
  ], 2)
  drawFieldRow(document, [
    field('bankUseCustomerNumber', 'Bank customer number'),
    field('bankUseReceivedOn', 'Date received by bank'),
  ], 2)
  drawSignatureRow(document, [
    { label: 'Bank remarks — authorised completion', key: 'bankUseRemarks' },
    { label: 'Admitting officer / authorised bank official signature and stamp', key: 'bankUseReceivedOn' },
  ], 2)
  document.y += 3
}

function drawPageOne(document, record) {
  drawPageHeader(document, 1, record)
  for (const section of applicantFields(record)) drawFieldsSection(document, section, 1)

  drawSectionHeading(document, 'Applicant declaration and acknowledgement', 1, [
    field('declarationLanguage', 'Declaration language', record.declarationLanguage),
    field('termsAcknowledged', 'Terms acknowledgement', record.termsAcknowledged ? 'Confirmed' : ''),
  ])
  drawParagraph(document, applicantDeclaration(record), 1, 'Applicant declaration', 'declarationLanguage')
  drawSignature(document, 'Applicant signature / thumb impression', 1, 'firstName')
}

function drawAcknowledgements(document, record) {
  if (record.accountType === 'BSBDS') {
    drawParagraph(document, SMALL_ACCOUNT_TERMS, 2, 'BSBDS small-account terms', 'accountType')
  }
  drawParagraph(document, BANK_DISCRETION_DECLARATION, 2, 'Bank discretion and accuracy acknowledgement', 'termsAcknowledged')
  if (record.overdraftRequested) {
    drawParagraph(document, overdraftDeclaration(record), 2, 'Overdraft declaration', 'overdraftAmount')
  }
}

function drawPageTwo(document, record) {
  drawPageHeader(document, 2, record)
  for (const section of pageTwoSections(record)) {
    if (section.title === 'Acknowledgements and declarations') {
      drawSectionHeading(document, section.title, 2, section.rows.flat())
      drawAcknowledgements(document, record)
      continue
    }
    drawFieldsSection(document, section, 2)
  }

  drawSignatureRow(document, [
    { label: 'Witness 1 signature', key: 'witnessOneName' },
    { label: 'Witness 2 signature', key: 'witnessTwoName' },
  ], 2)
  const minorSignatures = []
  if (record.applicantIsMinor) {
    minorSignatures.push({
      label: "Minor applicant guardian signature — branch wording to confirm",
      key: 'applicantGuardianName',
    })
  }
  if (record.nominationRequired === 'Yes' && record.nomineeIsMinor) {
    minorSignatures.push({
      label: 'Person appointed for minor nominee — signature',
      key: 'appointedPersonName',
    })
  }
  if (minorSignatures.length) drawSignatureRow(document, minorSignatures, 2)
  if (record.overdraftRequested) drawSignature(document, 'Applicant signature for overdraft request', 2, 'overdraftAmount')
  drawBankUseSection(document)
}

export function createApplicationPdf(record) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({
      autoFirstPage: false,
      size: 'A4',
      margins: PAGE_MARGINS,
      info: {
        Title: `Account application - ${applicantName(record)}`,
        Author: 'Sakshi Computer',
        Subject: 'Custom two-page document; not bank-issued or bank-approved',
      },
    })
    const chunks = []
    let completed = false
    let pageCount = 0
    document.on('pageAdded', () => { pageCount += 1 })
    const fail = (error) => {
      if (completed) return
      completed = true
      reject(error)
      document.destroy()
    }

    document.on('data', (chunk) => chunks.push(chunk))
    document.on('error', fail)
    document.on('end', () => {
      if (completed) return
      completed = true
      if (pageCount !== 2) {
        reject(new Error('PDF generation did not produce exactly two pages.'))
        return
      }
      resolve(Buffer.concat(chunks))
    })

    try {
      document.addPage({ size: 'A4', margins: PAGE_MARGINS })
      drawPageOne(document, record)
      drawFooter(document, 1)
      document.addPage({ size: 'A4', margins: PAGE_MARGINS })
      drawPageTwo(document, record)
      drawFooter(document, 2)
      if (pageCount !== 2) {
        throw new Error('PDF generation did not produce exactly two pages.')
      }
      document.end()
    } catch (error) {
      fail(error)
    }
  })
}
