import PDFDocument from 'pdfkit'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 42
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = PAGE_HEIGHT - 29
const BODY_BOTTOM = FOOTER_Y - 18

function applicantName(record) {
  return [record.firstName, record.middleName, record.lastName].filter(Boolean).join(' ') || 'Unnamed applicant'
}

function field(label, value, fullWidth = false) {
  return { label, value: value || '', fullWidth }
}

function yesNo(value) {
  return value ? 'Yes' : 'No'
}

function getSections(record) {
  const applicant = [
    field('First name', record.firstName),
    field('Middle name', record.middleName),
    field('Last name', record.lastName),
    field('Parent / spouse name', record.parentName),
    field('Parent / spouse relationship', record.parentRelationship),
    field('Date of birth', record.dateOfBirth),
    field('Gender', record.gender),
    field('Marital status', record.maritalStatus),
    field('Occupation', record.occupation),
    field('Education', record.education),
    field('Annual income', record.annualIncome),
    field('Applicant is a minor', yesNo(record.applicantIsMinor)),
  ]
  if (record.applicantIsMinor) {
    applicant.push(
      field("Applicant's guardian name", record.applicantGuardianName),
      field("Applicant's guardian relationship", record.applicantGuardianRelationship),
      field("Applicant's guardian address", record.applicantGuardianAddress, true),
    )
  }

  const nomination = [
    field('Nomination choice', record.nominationChoice),
    field('Nominee name', record.nomineeName),
    field('Nominee relationship', record.nomineeRelationship),
    field('Nominee date of birth', record.nomineeDateOfBirth),
    field('Nominee address', record.nomineeAddress, true),
    field('Nominee PIN / postal code', record.nomineePinCode),
    field('Nominee is a minor', yesNo(record.nomineeIsMinor)),
  ]
  if (record.nomineeIsMinor) {
    nomination.push(
      field('Person appointed for minor nominee', record.appointedPersonName),
      field("Appointed person's relationship", record.appointedPersonRelationship),
      field("Appointed person's date of birth", record.appointedPersonDateOfBirth),
      field("Appointed person's address", record.appointedPersonAddress, true),
    )
  }

  const sections = [
    {
      title: 'Applicant and personal details',
      fields: applicant,
    },
    {
      title: 'Contact and addresses',
      fields: [
        field('Mobile number', record.mobile),
        field('Residential PIN / postal code', record.residentialPinCode),
        field('Residential address', record.residentialAddress, true),
        field('Permanent address same as residential', yesNo(record.sameAddress)),
        field('Permanent PIN / postal code', record.permanentPinCode),
        field('Permanent address', record.permanentAddress, true),
      ],
    },
    {
      title: 'Bank and identification / KYC details',
      fields: [
        field('Bank name', record.bankName),
        field('Branch', record.branch),
        field('Customer ID', record.customerId),
        field('Account number', record.accountNumber),
        field('Identification document type', record.identityDocumentType),
        field('Identification document reference', record.identityDocumentNumber),
      ],
    },
    { title: 'Nomination', fields: nomination },
    {
      title: 'Witnesses',
      fields: [
        field('Witness 1 name', record.witnessOneName),
        field('Witness 2 name', record.witnessTwoName),
        field('Witness 1 address', record.witnessOneAddress, true),
        field('Witness 2 address', record.witnessTwoAddress, true),
      ],
    },
    {
      title: 'Introduction (optional)',
      fields: [
        field('Introduced by name', record.introducedByName),
        field("Introducer's account number", record.introducedByAccountNumber),
        field("Introducer's branch", record.introducedByBranch),
      ],
    },
    {
      title: 'Optional overdraft request',
      fields: [
        field('Overdraft requested', yesNo(record.overdraftRequested)),
        ...(record.overdraftRequested
          ? [
              field('Requested amount', record.overdraftAmount),
              field('Purpose', record.overdraftPurpose, true),
            ]
          : []),
      ],
    },
    {
      title: 'Declaration and acknowledgements',
      declaration: 'Official declaration and acknowledgement wording has not been supplied or verified. No bank declaration text is reproduced in this draft.',
    },
    {
      title: 'Bank use only',
      fields: [
        field('Branch code', record.bankUseBranchCode),
        field('Account type', record.bankUseAccountType),
        field('Bank customer number', record.bankUseCustomerNumber),
        field('Date received by bank', record.bankUseReceivedOn),
        field('Bank remarks', record.bankUseRemarks, true),
      ],
    },
    {
      title: 'Application tracking (shop record)',
      fields: [
        field('Current status', record.status),
        field('Physical submission date', record.submittedOn),
        field('Account-opening date', record.accountOpenedOn),
      ],
    },
  ]
  return sections
}

function drawFooter(document) {
  const currentY = document.y
  document.save()
  document
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#222222')
    .text('Prepared through Sakshi Computer', MARGIN, FOOTER_Y, {
      width: CONTENT_WIDTH,
      align: 'center',
      lineBreak: false,
    })
  document.restore()
  document.y = currentY
}

function drawRunningHeader(document, record, firstPage) {
  const top = 34
  document
    .font('Helvetica-Bold')
    .fontSize(firstPage ? 16 : 11)
    .fillColor('#111111')
    .text(firstPage ? 'Account application — custom draft' : 'Account application — continued', MARGIN, top, {
      width: firstPage ? CONTENT_WIDTH - 108 : CONTENT_WIDTH,
      lineBreak: false,
    })
  const titleHeight = firstPage ? 21 : 15
  document
    .font('Helvetica')
    .fontSize(firstPage ? 9 : 8)
    .text(`${record.bankName || 'Bank name not provided'}  |  Applicant: ${applicantName(record)}`, MARGIN, top + titleHeight, {
      width: firstPage ? CONTENT_WIDTH - 108 : CONTENT_WIDTH,
    })

  if (firstPage) {
    const x = PAGE_WIDTH - MARGIN - 91
    const y = top
    document.rect(x, y, 91, 105).lineWidth(0.8).stroke('#222222')
    document
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#222222')
      .text('PHOTOGRAPH\\nPaste physical photo here', x + 6, y + 38, {
        width: 79,
        align: 'center',
      })
  }

  document
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#111111')
    .text('DRAFT — NOT BANK-ISSUED OR BANK-APPROVED — VERIFY WITH THE BRANCH', MARGIN, firstPage ? 157 : top + titleHeight + 21, {
      width: CONTENT_WIDTH,
    })
  document.y = firstPage ? 176 : top + titleHeight + 39
}

function addPage(document, record, firstPage = false) {
  document.addPage({ size: 'A4', margin: MARGIN })
  drawRunningHeader(document, record, firstPage)
}

function measureText(document, text, font, fontSize, width) {
  document.font(font).fontSize(fontSize)
  return document.heightOfString(text || '—', { width, lineGap: 1 }) + 8
}

function drawFieldRow(document, fields) {
  if (fields.length === 1 && fields[0].fullWidth && fields[0].value.length > 1200) {
    const { label, value } = fields[0]
    for (let offset = 0; offset < value.length; offset += 1200) {
      const continuedLabel = offset === 0 ? label : `${label} (continued)`
      drawFieldRow(document, [field(continuedLabel, value.slice(offset, offset + 1200), true)])
    }
    return
  }

  const rowY = document.y
  const columns = fields.length
  const columnWidth = CONTENT_WIDTH / columns
  const fontSize = 8.5
  const labelFont = 'Helvetica-Bold'
  const valueFont = 'Helvetica'
  const labelRatio = columns === 1 ? 0.27 : 0.37
  const heights = fields.map((item) => {
    const labelWidth = columnWidth * labelRatio - 12
    const valueWidth = columnWidth * (1 - labelRatio) - 16
    return Math.max(
      25,
      measureText(document, item.label, labelFont, fontSize, labelWidth),
      measureText(document, item.value, valueFont, fontSize, valueWidth),
    )
  })
  const rowHeight = Math.max(...heights)

  if (rowY + rowHeight > BODY_BOTTOM) {
    addPage(document, document.applicationRecord)
    return drawFieldRow(document, fields)
  }

  fields.forEach((item, index) => {
    const x = MARGIN + columnWidth * index
    if (index > 0) {
      document.moveTo(x, rowY).lineTo(x, rowY + rowHeight).lineWidth(0.35).stroke('#888888')
    }
    const labelWidth = columnWidth * labelRatio - 12
    const valueX = x + columnWidth * labelRatio
    const valueWidth = columnWidth * (1 - labelRatio) - 16
    document
      .font(labelFont)
      .fontSize(fontSize)
      .fillColor('#111111')
      .text(item.label, x + 6, rowY + 6, { width: labelWidth })
    document
      .font(valueFont)
      .fontSize(fontSize)
      .fillColor('#111111')
      .text(item.value || '—', valueX, rowY + 6, { width: valueWidth, lineGap: 1 })
  })
  document
    .moveTo(MARGIN, rowY + rowHeight)
    .lineTo(MARGIN + CONTENT_WIDTH, rowY + rowHeight)
    .lineWidth(0.4)
    .stroke('#777777')
  document.y = rowY + rowHeight
}

function drawSection(document, section, record) {
  const titleHeight = 24
  if (document.y + titleHeight > BODY_BOTTOM) addPage(document, record)
  document
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#111111')
    .text(section.title, MARGIN, document.y + 6, { width: CONTENT_WIDTH })
  document
    .moveTo(MARGIN, document.y + titleHeight)
    .lineTo(MARGIN + CONTENT_WIDTH, document.y + titleHeight)
    .lineWidth(0.8)
    .stroke('#222222')
  document.y += titleHeight

  if (section.declaration) {
    const height = measureText(document, section.declaration, 'Helvetica', 9, CONTENT_WIDTH - 12) + 12
    if (document.y + height > BODY_BOTTOM) addPage(document, record)
    document
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#111111')
      .text(section.declaration, MARGIN + 6, document.y + 6, {
        width: CONTENT_WIDTH - 12,
        lineGap: 2,
      })
    document.y += height
    const signatureLabels = [
      'Applicant signature / thumb impression',
      ...(record.applicantIsMinor ? ["Applicant's guardian signature"] : []),
      ...(record.nomineeIsMinor ? ['Person appointed for minor nominee — signature'] : []),
      'Witness 1 signature',
      'Witness 2 signature',
    ]
    signatureLabels.forEach((label) => drawSignatureSpace(document, label, record))
  } else {
    let pending = []
    for (const item of section.fields) {
      if (item.fullWidth) {
        if (pending.length) drawFieldRow(document, pending)
        pending = []
        drawFieldRow(document, [item])
        continue
      }
      pending.push(item)
      if (pending.length === 2) {
        drawFieldRow(document, pending)
        pending = []
      }
    }
    if (pending.length) drawFieldRow(document, pending)
  }
  document.y += 5
}

function drawSignatureSpace(document, label, record) {
  const height = 42
  if (document.y + height > BODY_BOTTOM) addPage(document, record)
  const y = document.y + 20
  document
    .moveTo(MARGIN + 6, y)
    .lineTo(MARGIN + CONTENT_WIDTH - 6, y)
    .lineWidth(0.6)
    .stroke('#222222')
  document
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#111111')
    .text(label, MARGIN + 6, y + 4, { width: CONTENT_WIDTH - 12 })
  document.y += height
}

export function createApplicationPdf(record) {
  const document = new PDFDocument({
    autoFirstPage: false,
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: `Account application draft - ${applicantName(record)}`,
      Author: 'Sakshi Computer',
      Subject: 'Custom unverified account application draft',
    },
  })
  document.applicationRecord = record
  document.on('pageAdded', () => drawFooter(document))
  addPage(document, record, true)

  for (const section of getSections(record)) {
    drawSection(document, section, record)
  }
  document.end()
  return document
}
