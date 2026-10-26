export const STATUSES = ['Draft', 'Form ready', 'Submitted', 'Account opened']

export const STRING_FIELDS = [
  'title',
  'firstName',
  'middleName',
  'lastName',
  'parentName',
  'parentRelationship',
  'dateOfBirth',
  'gender',
  'maritalStatus',
  'occupation',
  'education',
  'annualIncome',
  'incomeSource',
  'accountType',
  'declarationLanguage',
  'nominationRequired',
  'nomineeAge',
  'declarationDate',
  'declarationPlace',
  'mobile',
  'email',
  'residentialAddress',
  'residentialPinCode',
  'permanentAddress',
  'permanentPinCode',
  'bankName',
  'branch',
  'customerId',
  'accountNumber',
  'identityDocumentType',
  'identityDocumentNumber',
  'nomineeName',
  'nomineeRelationship',
  'nominationChoice',
  'nomineeDateOfBirth',
  'nomineeAddress',
  'nomineePinCode',
  'appointedPersonName',
  'appointedPersonRelationship',
  'appointedPersonDateOfBirth',
  'appointedPersonAddress',
  'applicantGuardianName',
  'applicantGuardianRelationship',
  'applicantGuardianAddress',
  'witnessOneName',
  'witnessOneAddress',
  'witnessTwoName',
  'witnessTwoAddress',
  'introducedByName',
  'introducedByAccountNumber',
  'introducedByBranch',
  'overdraftAmount',
  'overdraftAmountWords',
  'overdraftPurpose',
  'bankUseBranchCode',
  'bankUseAccountType',
  'bankUseCustomerNumber',
  'bankUseReceivedOn',
  'bankUseRemarks',
]

export const BOOLEAN_FIELDS = [
  'sameAddress',
  'applicantIsMinor',
  'nomineeIsMinor',
  'overdraftRequested',
  'termsAcknowledged',
  'loanDeclarationConfirmed',
]

const DATE_FIELDS = ['dateOfBirth', 'nomineeDateOfBirth', 'appointedPersonDateOfBirth', 'declarationDate']

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function normalizeRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Application details must be a JSON object.')
  }

  const record = {}
  for (const key of STRING_FIELDS) {
    const value = input[key] ?? ''
    if (typeof value !== 'string') throw new TypeError(`${key} must be a string.`)
    const limit = key.toLowerCase().includes('address') || key === 'bankUseRemarks' ? 5000 : 500
    if (value.length > limit) throw new TypeError(`${key} exceeds the ${limit}-character limit.`)
    record[key] = value
  }
  for (const key of BOOLEAN_FIELDS) {
    const value = input[key] ?? false
    if (typeof value !== 'boolean') throw new TypeError(`${key} must be true or false.`)
    record[key] = value
  }

  for (const key of DATE_FIELDS) {
    if (record[key] && !validDate(record[key])) {
      throw new TypeError(`Enter a valid date for ${key}.`)
    }
  }

  if (record.sameAddress) {
    record.permanentAddress = record.residentialAddress
    record.permanentPinCode = record.residentialPinCode
  }

  const mobile = record.mobile.trim()
  if (mobile) {
    const normalizedMobile = mobile.replace(/[\s()-]/g, '').replace(/^\+91/, '').replace(/^0/, '')
    if (!/^[6-9]\d{9}$/.test(normalizedMobile)) {
      throw new TypeError('Enter a valid 10-digit mobile number, optionally with the +91 country code.')
    }
  }
  if (record.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email.trim())) {
    throw new TypeError('Enter a valid email address or leave it blank.')
  }
  return record
}

export function validateApplicationRecord(record) {
  const issues = []
  const required = [
    ['dateOfBirth', 'Enter the applicant’s date of birth.'],
    ['gender', 'Select the applicant’s gender.'],
    ['occupation', 'Enter the applicant’s occupation.'],
    ['mobile', 'Enter the applicant’s mobile number.'],
    ['residentialAddress', 'Enter the residential address.'],
    ['residentialPinCode', 'Enter the residential PIN / postal code.'],
    ['bankName', 'Enter the bank name.'],
    ['branch', 'Enter the branch.'],
    ['identityDocumentType', 'Select an identification document type.'],
    ['identityDocumentNumber', 'Enter the identification document reference.'],
    ['declarationLanguage', 'Enter the language used to explain the terms and conditions.'],
    ['declarationDate', 'Enter the declaration date.'],
    ['declarationPlace', 'Enter the declaration place.'],
  ]

  if (![record.firstName, record.middleName, record.lastName].some((value) => value.trim())) {
    issues.push('Enter at least one applicant name field.')
  }
  for (const [key, message] of required) {
    if (!record[key]?.trim()) issues.push(message)
  }
  if (!record.sameAddress && !record.permanentAddress.trim()) {
    issues.push('Enter the permanent address or mark it as the same as the residential address.')
  }
  if (!['BSBDA', 'BSBDS'].includes(record.accountType)) issues.push('Select BSBDA or BSBDS account type.')
  if (!['Yes', 'No'].includes(record.nominationRequired)) issues.push('Choose whether nomination is required.')
  if (record.nominationRequired === 'Yes') {
    if (!record.nomineeAge?.trim() && !record.nomineeDateOfBirth?.trim()) {
      issues.push('Enter the nominee’s age or date of birth.')
    }
    for (const [key, message] of [
      ['nomineeName', 'Enter the nominee’s name.'],
      ['nomineeRelationship', 'Enter the nominee’s relationship.'],
      ['nomineeAddress', 'Enter the nominee’s address.'],
    ]) {
      if (!record[key]?.trim()) issues.push(message)
    }
    if (record.nomineeIsMinor) {
      for (const [key, message] of [
        ['appointedPersonName', 'Enter the person appointed for the minor nominee.'],
        ['appointedPersonRelationship', 'Enter the appointed person’s relationship.'],
        ['appointedPersonAddress', 'Enter the appointed person’s address.'],
      ]) {
        if (!record[key]?.trim()) issues.push(message)
      }
    }
  }
  if (record.applicantIsMinor) {
    for (const [key, message] of [
      ['applicantGuardianName', 'Enter the minor applicant’s guardian name.'],
      ['applicantGuardianRelationship', 'Enter the minor applicant’s guardian relationship.'],
      ['applicantGuardianAddress', 'Enter the minor applicant’s guardian address.'],
    ]) {
      if (!record[key]?.trim()) issues.push(message)
    }
  }
  if (!record.termsAcknowledged) {
    issues.push('Confirm that the applicant has read and understood the applicable terms and conditions.')
  }
  if (record.overdraftRequested && !record.loanDeclarationConfirmed) {
    issues.push('Confirm the applicant’s no-loan declaration or check the wording with the branch.')
  }
  if (record.overdraftRequested) {
    if (!record.overdraftAmount.trim()) issues.push('Enter the requested overdraft amount.')
    if (!record.overdraftAmountWords.trim()) issues.push('Enter the requested overdraft amount in words.')
    if (!record.incomeSource.trim()) issues.push('Enter the main source of income for the overdraft request.')
  }
  if (record.mobile.trim()) {
    const normalizedMobile = record.mobile.replace(/[\s()-]/g, '').replace(/^\+91/, '').replace(/^0/, '')
    if (!/^[6-9]\d{9}$/.test(normalizedMobile)) {
      issues.push('Enter a valid 10-digit mobile number, optionally with the +91 country code.')
    }
  }
  return issues
}
