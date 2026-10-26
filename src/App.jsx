import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ACCOUNT_DECLARATION,
  BANK_DISCRETION_DECLARATION,
  GUARDIAN_CONFIRMATION_NOTE,
  SMALL_ACCOUNT_TERMS,
} from '../server/declaration.js'
import { validateApplicationRecord } from '../server/record-fields.js'
import './App.css'

const makeEmptyRecord = () => ({
  title: '',
  firstName: '',
  middleName: '',
  lastName: '',
  parentName: '',
  parentRelationship: '',
  dateOfBirth: '',
  applicantIsMinor: false,
  applicantGuardianName: '',
  applicantGuardianRelationship: '',
  applicantGuardianAddress: '',
  gender: '',
  maritalStatus: '',
  occupation: '',
  education: '',
  annualIncome: '',
  incomeSource: '',
  accountType: '',
  declarationLanguage: '',
  declarationDate: '',
  declarationPlace: '',
  mobile: '',
  email: '',
  residentialAddress: '',
  residentialPinCode: '',
  permanentAddress: '',
  permanentPinCode: '',
  sameAddress: false,
  bankName: 'Union Bank of India',
  branch: '',
  customerId: '',
  accountNumber: '',
  identityDocumentType: '',
  identityDocumentNumber: '',
  nominationRequired: '',
  nomineeName: '',
  nomineeRelationship: '',
  nomineeAge: '',
  nomineeDateOfBirth: '',
  nomineeAddress: '',
  nomineePinCode: '',
  nomineeIsMinor: false,
  appointedPersonName: '',
  appointedPersonRelationship: '',
  appointedPersonDateOfBirth: '',
  appointedPersonAddress: '',
  witnessOneName: '',
  witnessOneAddress: '',
  witnessTwoName: '',
  witnessTwoAddress: '',
  introducedByName: '',
  introducedByAccountNumber: '',
  introducedByBranch: '',
  overdraftRequested: false,
  overdraftAmount: '',
  overdraftAmountWords: '',
  overdraftPurpose: '',
  termsAcknowledged: false,
  loanDeclarationConfirmed: false,
  bankUseBranchCode: '',
  bankUseAccountType: '',
  bankUseCustomerNumber: '',
  bankUseReceivedOn: '',
  bankUseRemarks: '',
})

async function apiRequest(url, options = {}) {
  const headers = { 'X-Requested-With': 'SakshiComputerUI', ...options.headers }
  if (options.body) headers['Content-Type'] = 'application/json'
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status}).`)
    error.status = response.status
    error.issues = payload.issues || []
    throw error
  }
  return payload
}

async function downloadPdf(recordId) {
  const response = await fetch(`/api/customers/${recordId}/export/pdf`, {
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'SakshiComputerUI' },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const error = new Error(payload.error || `PDF generation failed (${response.status}).`)
    error.issues = payload.issues || []
    throw error
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `sakshi-application-${recordId}.pdf`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function localDateValue() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function getReviewIssues(record) {
  return validateApplicationRecord({ ...makeEmptyRecord(), ...record })
}

function Icon({ name, size = 20 }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    form: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    records: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    back: <><path d="M19 12H5M11 18l-6-6 6-6" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11" /><path d="m9 12 2 2 4-4" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function Sidebar({ activeView, onNavigate, username, onLogout }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'form', label: 'New Account Form' },
    { id: 'records', label: 'Customer Records' },
  ]

  return (
    <aside className="sidebar">
      <a className="brand" href="#dashboard" onClick={(event) => { event.preventDefault(); onNavigate('dashboard') }}>
        <span className="brand-mark">S</span>
        <span className="brand-copy">
          <strong>Sakshi Computer</strong>
          <span>Owner workspace</span>
        </span>
      </a>

      <div className="sidebar-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-link ${activeView === item.id ? 'active' : ''}`}
            aria-current={activeView === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.id === 'form' ? 'form' : item.id === 'records' ? 'records' : 'dashboard'} />
            <span>{item.label}</span>
            {activeView === item.id && <span className="nav-indicator" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="workspace-note">
          <span className="workspace-note-icon"><Icon name="shield" size={18} /></span>
          <div>
            <strong>{username}</strong>
            <span>Owner account</span>
          </div>
        </div>
        <button className="logout-button" type="button" onClick={onLogout}>Sign out</button>
        <span className="sidebar-version">SAKSHI COMPUTER · OWNER WORKSPACE</span>
      </div>
    </aside>
  )
}

function PageHeader({ title, subtitle, action }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">SAKSHI COMPUTER <span>/</span> OWNER WORKSPACE</p>
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

function Notice() {
  return (
    <div className="prototype-notice" id="app-notice" role="note">
      <span className="notice-dot" />
      <span><strong>Private owner workspace</strong> — custom documents are not bank-issued or bank-approved.</span>
    </div>
  )
}

function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name="records" size={24} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

function StatusBadge({ status }) {
  const statusClass = status.toLowerCase().replaceAll(' ', '-')
  return <span className={`status-badge status-${statusClass}`}><span />{status}</span>
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function applicantName(record) {
  return [record.title, record.firstName, record.middleName, record.lastName].filter(Boolean).join(' ') || 'Unnamed applicant'
}

function maskedAccount(accountNumber) {
  if (!accountNumber) return 'Not added'
  if (accountNumber.length <= 4) return '••••'
  return `•••• ${accountNumber.slice(-4)}`
}

function Dashboard({ records, onAdd, onViewRecords, onSelectRecord }) {
  const counts = [
    { label: 'Total customers', value: records.length, detail: 'All saved records', icon: 'records', tone: 'teal' },
    { label: 'Drafts', value: records.filter((record) => record.status === 'Draft').length, detail: 'In progress', icon: 'form', tone: 'amber' },
    { label: 'Form ready', value: records.filter((record) => record.status === 'Form ready').length, detail: 'Reviewed and validated', icon: 'form', tone: 'teal' },
    { label: 'Submitted forms', value: records.filter((record) => record.status === 'Submitted').length, detail: 'Physical submission recorded', icon: 'arrow', tone: 'blue' },
    { label: 'Accounts opened', value: records.filter((record) => record.status === 'Account opened').length, detail: 'Successfully opened', icon: 'shield', tone: 'green' },
  ]
  const recentRecords = [...records].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5)

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="A clear overview of your saved customer account applications."
        action={<button className="button button-primary" type="button" onClick={onAdd}><Icon name="plus" />Add customer</button>}
      />

      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="welcome-kicker">YOUR OWNER WORKSPACE</span>
          <h2>Good to have you here.</h2>
          <p>Manage account application forms and keep customer records organised in one place.</p>
          <button type="button" className="button button-light" onClick={onAdd}>Start a new form <Icon name="arrow" /></button>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="art-ring art-ring-one" />
          <div className="art-ring art-ring-two" />
          <div className="art-card">
            <span className="art-card-mark">S</span>
            <span className="art-card-line art-card-line-long" />
            <span className="art-card-line" />
            <span className="art-card-chip" />
          </div>
          <span className="art-spark art-spark-one">✳</span>
          <span className="art-spark art-spark-two">✦</span>
        </div>
      </section>

      <section className="stats-grid" aria-label="Customer overview">
        {counts.map((item) => (
          <article className="stat-card" key={item.label}>
            <div className={`stat-icon stat-${item.tone}`}><Icon name={item.icon} /></div>
            <p className="stat-label">{item.label}</p>
            <div className="stat-value">{item.value}</div>
            <p className="stat-detail">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">YOUR ACTIVITY</p>
            <h2>Recent customer records</h2>
          </div>
          {records.length > 0 && (
            <button className="text-button" type="button" onClick={onViewRecords}>View all records <Icon name="arrow" size={17} /></button>
          )}
        </div>
        {recentRecords.length === 0 ? (
          <EmptyState
            title="No customer records yet"
            description="Your saved account applications will appear here. Start with a new form whenever you’re ready."
            action={<button type="button" className="button button-secondary" onClick={onAdd}><Icon name="plus" />Add your first customer</button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="records-table">
              <thead><tr><th>Customer</th><th>Mobile</th><th>Account number</th><th>Status</th><th><span className="sr-only">Open record</span></th></tr></thead>
              <tbody>
                {recentRecords.map((record) => (
                  <tr key={record.id} onClick={() => onSelectRecord(record.id)}>
                    <td><span className="customer-avatar">{applicantName(record).charAt(0).toUpperCase()}</span><strong>{applicantName(record)}</strong></td>
                    <td>{record.mobile || '—'}</td>
                    <td className="account-cell">{maskedAccount(record.accountNumber)}</td>
                    <td><StatusBadge status={record.status} /></td>
                    <td><button className="icon-button" type="button" aria-label={`View ${applicantName(record)}`} onClick={(event) => { event.stopPropagation(); onSelectRecord(record.id) }}><Icon name="chevron" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Field({ label, name, value, onChange, type = 'text', options, error, placeholder, ...props }) {
  const id = `field-${name}`
  const commonProps = {
    id,
    name,
    value,
    onChange,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    placeholder,
    ...props,
  }

  return (
    <div className={`form-field ${props.className || ''}`}>
      <label htmlFor={id}>{label}</label>
      {options ? (
        <select {...commonProps}>
          <option value="">Select {label.toLowerCase()}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea {...commonProps} rows={3} />
      ) : (
        <input {...commonProps} type={type} />
      )}
      {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    </div>
  )
}

function FormSection({ number, title, description, children }) {
  return (
    <section className="form-section">
      <div className="form-section-heading">
        <span className="section-number">{number}</span>
        <div><h2>{title}</h2><p>{description}</p></div>
      </div>
      <div className="form-grid">{children}</div>
    </section>
  )
}

function CheckField({ name, checked, onChange, label }) {
  return (
    <div className="form-field form-field-full address-check">
      <label className="checkbox-label">
        <input type="checkbox" name={name} checked={checked} onChange={onChange} />
        <span className="custom-checkbox" aria-hidden="true" />
        {label}
      </label>
    </div>
  )
}

function AccountForm({ record, draft, onSave, onCancel, onDirtyChange }) {
  const [initialSnapshot] = useState(() => JSON.stringify({ ...makeEmptyRecord(), ...(record || {}), ...(draft || {}) }))
  const [form, setForm] = useState(() => ({ ...makeEmptyRecord(), ...(record || {}), ...(draft || {}) }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const isDirty = JSON.stringify(form) !== initialSnapshot

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (!isDirty) return undefined
    const warnBeforeLeave = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeave)
    return () => window.removeEventListener('beforeunload', warnBeforeLeave)
  }, [isDirty])

  function updateField(event) {
    const { name, value, checked, type } = event.target
    const nextValue = type === 'checkbox' ? checked : value
    setForm((current) => {
      const next = { ...current, [name]: nextValue }
      if (name === 'sameAddress' && checked) {
        next.permanentAddress = current.residentialAddress
        next.permanentPinCode = current.residentialPinCode
      } else if (current.sameAddress && name === 'residentialAddress') {
        next.permanentAddress = value
      } else if (current.sameAddress && name === 'residentialPinCode') {
        next.permanentPinCode = value
      }
      return next
    })
    if (name === 'firstName' || name === 'middleName' || name === 'lastName') {
      if (nextValue.trim()) setErrors((current) => ({ ...current, firstName: '', save: '' }))
    } else if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: '', save: '' }))
    }
  }

  async function saveDraft(destination = 'details') {
    const nextErrors = {}
    if (![form.firstName, form.middleName, form.lastName].some((value) => value.trim())) {
      nextErrors.firstName = 'Enter at least one applicant name field to save this draft.'
    }
    if (form.mobile.trim()) {
      const normalizedMobile = form.mobile.replace(/[\s()-]/g, '').replace(/^\+91/, '').replace(/^0/, '')
      if (!/^[6-9]\d{9}$/.test(normalizedMobile)) {
        nextErrors.mobile = 'Enter a valid 10-digit mobile number, optionally with the +91 country code.'
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      document.getElementById(Object.keys(nextErrors)[0] === 'firstName' ? 'field-firstName' : 'field-mobile')?.focus()
      return
    }
    setSaving(true)
    try {
      await onSave(form, destination)
    } catch (error) {
      setErrors({ save: error.message })
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title={record ? 'Edit account form' : 'New account form'}
        subtitle="Capture details for review. Saving or exporting does not submit anything to the bank."
        action={<button className="button button-quiet" type="button" onClick={onCancel}><Icon name="back" />Back</button>}
      />
      <div className="form-intro">
        <span className="form-intro-icon"><Icon name="form" size={20} /></span>
        <p>You can save an incomplete draft. Fields follow the supplied two-page reference; the branch may require additional items.</p>
        <span className="draft-label"><span />{record?.status || 'New draft'}</span>
      </div>
      {errors.save && <p className="save-error" role="alert">{errors.save}</p>}
      <div className="account-form">
        <FormSection number="01" title="Applicant" description="Applicant and parent/spouse details.">
          <Field label="Title" name="title" value={form.title} onChange={updateField} options={['Mr', 'Mrs', 'Ms', 'Miss', 'Dr']} />
          <Field label="First name" name="firstName" value={form.firstName} onChange={updateField} error={errors.firstName} autoComplete="given-name" placeholder="Enter first name" />
          <Field label="Middle name" name="middleName" value={form.middleName} onChange={updateField} autoComplete="additional-name" placeholder="Enter middle name" />
          <Field label="Last name" name="lastName" value={form.lastName} onChange={updateField} autoComplete="family-name" placeholder="Enter last name" />
          <Field label="Parent / spouse name" name="parentName" value={form.parentName} onChange={updateField} placeholder="Enter parent or spouse name" />
          <Field label="Parent / spouse relationship" name="parentRelationship" value={form.parentRelationship} onChange={updateField} placeholder="Enter relationship" />
          <Field label="Date of birth" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={updateField} />
          <Field label="Gender" name="gender" value={form.gender} onChange={updateField} options={['Female', 'Male', 'Non-binary', 'Prefer not to say']} />
          <Field label="Marital status" name="maritalStatus" value={form.maritalStatus} onChange={updateField} options={['Single', 'Married', 'Widowed', 'Divorced', 'Prefer not to say']} />
          <Field label="Occupation" name="occupation" value={form.occupation} onChange={updateField} placeholder="Enter occupation" />
          <Field label="Education" name="education" value={form.education} onChange={updateField} placeholder="Enter education" />
          <Field label="Annual income" name="annualIncome" value={form.annualIncome} onChange={updateField} inputMode="decimal" placeholder="Enter annual income" />
          <CheckField name="applicantIsMinor" checked={form.applicantIsMinor} onChange={updateField} label="Applicant is a minor" />
          {form.applicantIsMinor && (
            <>
              <Field label="Applicant's guardian name" name="applicantGuardianName" value={form.applicantGuardianName} onChange={updateField} placeholder="Enter guardian name" />
              <Field label="Applicant's guardian relationship" name="applicantGuardianRelationship" value={form.applicantGuardianRelationship} onChange={updateField} placeholder="Enter relationship" />
              <div className="form-field form-field-full"><Field label="Applicant's guardian address" name="applicantGuardianAddress" type="textarea" value={form.applicantGuardianAddress} onChange={updateField} placeholder="Enter guardian address" /></div>
              <p className="form-help form-field-full">This is the applicant’s guardian, separate from the person appointed for a minor nominee.</p>
            </>
          )}
        </FormSection>

        <FormSection number="02" title="Contact" description="Reach the applicant and record both addresses.">
          <Field label="Mobile number" name="mobile" type="tel" value={form.mobile} onChange={updateField} error={errors.mobile} autoComplete="tel" inputMode="tel" placeholder="Enter mobile number" />
          <Field label="Email address (optional)" name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" placeholder="Enter email address" />
          <div className="form-field form-field-full">
            <Field label="Residential address" name="residentialAddress" type="textarea" value={form.residentialAddress} onChange={updateField} autoComplete="street-address" placeholder="Enter residential address" />
          </div>
          <Field label="Residential PIN code" name="residentialPinCode" value={form.residentialPinCode} onChange={updateField} inputMode="numeric" maxLength={6} placeholder="Enter PIN code" />
          <div className="form-field form-field-full address-check">
            <label className="checkbox-label">
              <input type="checkbox" name="sameAddress" checked={form.sameAddress} onChange={updateField} />
              <span className="custom-checkbox" aria-hidden="true" />
              Permanent address is the same as residential address
            </label>
          </div>
          <div className="form-field form-field-full">
            <Field label="Permanent address" name="permanentAddress" type="textarea" value={form.permanentAddress} onChange={updateField} placeholder="Enter permanent address" disabled={form.sameAddress} />
          </div>
          <Field label="Permanent PIN code" name="permanentPinCode" value={form.permanentPinCode} onChange={updateField} inputMode="numeric" maxLength={6} placeholder="Enter PIN code" disabled={form.sameAddress} />
        </FormSection>

        <FormSection number="03" title="Bank & identification" description="Account type, branch and identification / KYC reference details.">
          <Field label="Bank name" name="bankName" value={form.bankName} onChange={updateField} placeholder="Enter bank name" />
          <Field label="Branch" name="branch" value={form.branch} onChange={updateField} placeholder="Enter branch" />
          <Field label="Account type" name="accountType" value={form.accountType} onChange={updateField} options={['BSBDA', 'BSBDS']} />
          <Field label="Customer ID" name="customerId" value={form.customerId} onChange={updateField} inputMode="numeric" placeholder="Enter customer ID" />
          <Field label="Account number" name="accountNumber" value={form.accountNumber} onChange={updateField} inputMode="numeric" placeholder="Enter account number" />
          <Field label="Identification document type" name="identityDocumentType" value={form.identityDocumentType} onChange={updateField} options={['PAN', 'Passport', 'Voter ID', 'Driving licence', 'Other']} />
          <Field label="Identification document reference" name="identityDocumentNumber" value={form.identityDocumentNumber} onChange={updateField} placeholder="Enter document reference" />
        </FormSection>

        <FormSection number="04" title="Nomination" description="Record whether nomination is required; an appointed person for a minor nominee is not the applicant's guardian.">
          <Field label="Nomination required" name="nominationRequired" value={form.nominationRequired} onChange={updateField} options={['Yes', 'No']} />
          {form.nominationRequired === 'Yes' && <>
          <Field label="Nominee name" name="nomineeName" value={form.nomineeName} onChange={updateField} placeholder="Enter nominee name" />
          <Field label="Nominee relationship" name="nomineeRelationship" value={form.nomineeRelationship} onChange={updateField} placeholder="Enter relationship" />
          <Field label="Nominee age (if applicable)" name="nomineeAge" value={form.nomineeAge} onChange={updateField} inputMode="numeric" placeholder="Enter nominee age" />
          <Field label="Nominee date of birth" name="nomineeDateOfBirth" type="date" value={form.nomineeDateOfBirth} onChange={updateField} />
          <div className="form-field form-field-full">
            <Field label="Nominee address" name="nomineeAddress" type="textarea" value={form.nomineeAddress} onChange={updateField} placeholder="Enter nominee address" />
          </div>
          <Field label="Nominee PIN code" name="nomineePinCode" value={form.nomineePinCode} onChange={updateField} inputMode="numeric" maxLength={6} placeholder="Enter PIN code" />
          <CheckField name="nomineeIsMinor" checked={form.nomineeIsMinor} onChange={updateField} label="Nominee is a minor" />
          {form.nomineeIsMinor && (
            <>
              <Field label="Person appointed for the minor nominee" name="appointedPersonName" value={form.appointedPersonName} onChange={updateField} placeholder="Enter appointed person's name" />
              <Field label="Appointed person's relationship" name="appointedPersonRelationship" value={form.appointedPersonRelationship} onChange={updateField} placeholder="Enter relationship" />
              <Field label="Appointed person's date of birth" name="appointedPersonDateOfBirth" type="date" value={form.appointedPersonDateOfBirth} onChange={updateField} />
              <div className="form-field form-field-full"><Field label="Appointed person's address" name="appointedPersonAddress" type="textarea" value={form.appointedPersonAddress} onChange={updateField} placeholder="Enter appointed person's address" /></div>
              <p className="form-help form-field-full">This person is distinct from a minor applicant’s guardian.</p>
            </>
          )}
          </>}
        </FormSection>

        <FormSection number="05" title="Witnesses" description="Witness details; signature spaces remain blank for the printed form.">
          <Field label="Witness 1 name" name="witnessOneName" value={form.witnessOneName} onChange={updateField} placeholder="Enter witness name" />
          <div className="form-field form-field-full"><Field label="Witness 1 address" name="witnessOneAddress" type="textarea" value={form.witnessOneAddress} onChange={updateField} placeholder="Enter witness address" /></div>
          <Field label="Witness 2 name" name="witnessTwoName" value={form.witnessTwoName} onChange={updateField} placeholder="Enter witness name" />
          <div className="form-field form-field-full"><Field label="Witness 2 address" name="witnessTwoAddress" type="textarea" value={form.witnessTwoAddress} onChange={updateField} placeholder="Enter witness address" /></div>
          <Field label="Declaration date" name="declarationDate" type="date" value={form.declarationDate} onChange={updateField} />
          <Field label="Declaration place" name="declarationPlace" value={form.declarationPlace} onChange={updateField} placeholder="Enter place" />
        </FormSection>

        <FormSection number="06" title="Introduction" description="Optional introduction details.">
          <Field label="Introduced by name" name="introducedByName" value={form.introducedByName} onChange={updateField} placeholder="Enter introducer's name" />
          <Field label="Introducer's account number" name="introducedByAccountNumber" value={form.introducedByAccountNumber} onChange={updateField} inputMode="numeric" placeholder="Enter account number" />
          <Field label="Introducer's branch" name="introducedByBranch" value={form.introducedByBranch} onChange={updateField} placeholder="Enter branch" />
        </FormSection>

        <FormSection number="07" title="Optional overdraft request" description="Optional request details; official terms are not verified.">
          <CheckField name="overdraftRequested" checked={form.overdraftRequested} onChange={updateField} label="Include an overdraft request for discussion" />
          {form.overdraftRequested && (
            <>
              <Field label="Requested amount" name="overdraftAmount" value={form.overdraftAmount} onChange={updateField} inputMode="decimal" placeholder="Enter requested amount" />
              <Field label="Requested amount in words" name="overdraftAmountWords" value={form.overdraftAmountWords} onChange={updateField} placeholder="Enter amount in words" />
              <Field label="Main source of income" name="incomeSource" value={form.incomeSource} onChange={updateField} placeholder="Enter main source of income" />
              <Field label="Purpose" name="overdraftPurpose" value={form.overdraftPurpose} onChange={updateField} placeholder="Enter purpose" />
              <CheckField name="loanDeclarationConfirmed" checked={form.loanDeclarationConfirmed} onChange={updateField} label="Applicant has confirmed the no-loan declaration printed for the overdraft request" />
            </>
          )}
        </FormSection>

        <FormSection number="08" title="Declaration & acknowledgements" description="The following English wording was extracted from the supplied two-page Union Bank reference.">
          <p className="form-help form-field-full">{ACCOUNT_DECLARATION}</p>
          <p className="form-help form-field-full">{SMALL_ACCOUNT_TERMS}</p>
          <p className="form-help form-field-full">{BANK_DISCRETION_DECLARATION}</p>
          <Field label="Language into which the terms were read over and translated" name="declarationLanguage" value={form.declarationLanguage} onChange={updateField} placeholder="Enter language" />
          <CheckField name="termsAcknowledged" checked={form.termsAcknowledged} onChange={updateField} label="Applicant confirms they read, understood and agree to the applicable terms and conditions" />
          <p className="form-help form-field-full">{GUARDIAN_CONFIRMATION_NOTE}</p>
        </FormSection>

        <FormSection number="09" title="Bank use only" description="These spaces are reserved for authorised bank staff and remain blank in exports.">
          <p className="form-help form-field-full">Branch code, account type assigned by the bank, customer number, receipt date, remarks and admitting-officer signature are intentionally not entered here.</p>
        </FormSection>

        <div className="form-footer">
          <p>Photo and signature spaces remain blank in print preview.</p>
          <div className="form-actions form-actions-wrap">
            <button className="button button-quiet" type="button" onClick={onCancel}>Cancel</button>
            <button className="button button-secondary" type="button" onClick={() => saveDraft('review')} disabled={saving}>Save & Review</button>
            <button className="button button-secondary" type="button" onClick={() => saveDraft('print')} disabled={saving}>Save & Preview PDF</button>
            <button className="button button-primary" type="button" onClick={saveDraft} disabled={saving}><Icon name="form" />{saving ? 'Saving…' : 'Save Draft'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

function ReviewScreen({ record, onBackToEdit, onPrint, onMarkReady, statusSaving }) {
  const issues = getReviewIssues(record)
  return (
    <>
      <PageHeader
        title="Review application"
        subtitle="Check entered information before printing. This is not a bank submission."
        action={<button className="button button-quiet screen-controls" type="button" onClick={onBackToEdit}><Icon name="edit" />Back to edit</button>}
      />
      <div className={`review-result ${issues.length ? 'review-result-incomplete' : 'review-result-ready'}`}>
        <h2>{issues.length ? 'Items to resolve before Form ready' : 'Required-field review passed'}</h2>
        {issues.length ? <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <p>Required and applicable fields passed the review checks.</p>}
        <p className="review-warning">Fields are checked against the supplied two-page reference and the recorded conditional details. Confirm any additional branch requirements before submission.</p>
      </div>
      <div className="screen-controls review-actions">
        <button className="button button-quiet" type="button" onClick={onBackToEdit}>Back to edit</button>
        {record.status !== 'Form ready' && !issues.length && <button className="button button-secondary" type="button" onClick={onMarkReady} disabled={statusSaving}>Mark Form ready</button>}
        <button className="button button-primary" type="button" onClick={onPrint}>Preview PDF</button>
      </div>
    </>
  )
}

function PrintPreview({ record, onBack, onDownload }) {
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [pdfIssues, setPdfIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const frame = useRef(null)

  useEffect(() => {
    let active = true
    let objectUrl = ''
    fetch(`/api/customers/${record.id}/export/pdf`, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'SakshiComputerUI' },
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          const error = new Error(payload.error || `PDF generation failed (${response.status}).`)
          error.issues = payload.issues || []
          throw error
        }
        return response.blob()
      })
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
      })
      .catch((error) => {
        if (active) {
          setPdfError(error.message)
          setPdfIssues(error.issues || [])
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [record.id])

  return (
    <>
      <PageHeader
        title="Print preview"
        subtitle="Preview the custom A4 PDF generated from this saved application."
      />
      <div className="print-preview-warning screen-controls" role="note">Custom working document — not bank-issued or bank-approved. Verify any additional requirements with the branch.</div>
      {pdfError && <div className="save-error" role="alert"><p>{pdfError}</p>{pdfIssues.length > 0 && <ul>{pdfIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}</div>}
      <div className="screen-controls print-preview-actions">
        <button className="button button-quiet" type="button" onClick={onBack}>Back</button>
        <button className="button button-primary" type="button" onClick={() => frame.current?.contentWindow?.print()} disabled={!pdfUrl}>Print</button>
        <button className="button button-secondary" type="button" onClick={onDownload}>Download PDF</button>
      </div>
      {loading && <p className="form-help" role="status">Generating print preview…</p>}
      {pdfUrl && <iframe ref={frame} className="pdf-preview-frame" src={pdfUrl} title={`PDF print preview for ${applicantName(record)}`} />}
    </>
  )
}

function RecordDetails({ record, onBack, onEdit, onReview, onPrint, onMarkSubmitted, onMarkOpened, onStatusChange, statusSaving }) {
  const [accountOpenedOn, setAccountOpenedOn] = useState(localDateValue())
  const sections = [
    {
      title: 'Applicant',
      values: [
        ['Full name', applicantName(record)],
        ['Title', record.title],
        ['Parent / spouse name', record.parentName],
        ['Parent / spouse relationship', record.parentRelationship],
        ['Date of birth', formatDate(record.dateOfBirth)],
        ['Applicant is a minor', record.applicantIsMinor ? 'Yes' : 'No'],
        ...(record.applicantIsMinor ? [
          ["Applicant's guardian name", record.applicantGuardianName],
          ["Applicant's guardian relationship", record.applicantGuardianRelationship],
          ["Applicant's guardian address", record.applicantGuardianAddress],
        ] : []),
        ['Gender', record.gender],
        ['Marital status', record.maritalStatus],
        ['Occupation', record.occupation],
        ['Education', record.education],
        ['Annual income', record.annualIncome],
      ],
    },
    {
      title: 'Contact',
      values: [
        ['Mobile number', record.mobile],
        ['Email address', record.email],
        ['Residential address', record.residentialAddress],
        ['Residential PIN code', record.residentialPinCode],
        ['Permanent address', record.permanentAddress],
        ['Permanent PIN code', record.permanentPinCode],
      ],
    },
    {
      title: 'Bank',
      values: [
        ['Bank name', record.bankName],
        ['Branch', record.branch],
        ['Account type', record.accountType],
        ['Customer ID', record.customerId],
        ['Account number', record.accountNumber],
        ['Identification document type', record.identityDocumentType],
        ['Identification document reference', record.identityDocumentNumber],
      ],
    },
    {
      title: 'Nominee',
      values: [
        ['Nomination required', record.nominationRequired],
        ...(record.nominationRequired === 'Yes' ? [
          ['Name', record.nomineeName],
          ['Relationship', record.nomineeRelationship],
          ['Age', record.nomineeAge],
          ['Date of birth', formatDate(record.nomineeDateOfBirth)],
          ['Address', record.nomineeAddress],
          ['PIN code', record.nomineePinCode],
          ['Nominee is a minor', record.nomineeIsMinor ? 'Yes' : 'No'],
          ...(record.nomineeIsMinor ? [
          ['Person appointed for minor nominee', record.appointedPersonName],
          ["Appointed person's relationship", record.appointedPersonRelationship],
          ["Appointed person's date of birth", formatDate(record.appointedPersonDateOfBirth)],
          ["Appointed person's address", record.appointedPersonAddress],
          ] : []),
        ] : []),
      ],
    },
    {
      title: 'Witnesses, introduction & overdraft',
      values: [
        ['Witness 1 name', record.witnessOneName],
        ['Witness 1 address', record.witnessOneAddress],
        ['Witness 2 name', record.witnessTwoName],
        ['Witness 2 address', record.witnessTwoAddress],
        ['Introduced by name', record.introducedByName],
        ['Introducer account number', record.introducedByAccountNumber],
        ['Introducer branch', record.introducedByBranch],
        ['Overdraft requested', record.overdraftRequested ? 'Yes' : 'No'],
        ...(record.overdraftRequested ? [
          ['Overdraft amount', record.overdraftAmount],
          ['Overdraft amount in words', record.overdraftAmountWords],
          ['Main source of income', record.incomeSource],
          ['Overdraft purpose', record.overdraftPurpose],
        ] : []),
      ],
    },
    { title: 'Declaration and witness details', values: [
      ['Declaration language', record.declarationLanguage],
      ['Declaration date', formatDate(record.declarationDate)],
      ['Declaration place', record.declarationPlace],
      ['Witness 1 name', record.witnessOneName],
      ['Witness 1 address', record.witnessOneAddress],
      ['Witness 2 name', record.witnessTwoName],
      ['Witness 2 address', record.witnessTwoAddress],
    ] },
  ]

  return (
    <>
      <PageHeader
        title="Customer details"
        subtitle="Review the record, prepare a print draft, or record physical submission."
        action={<button className="button button-primary" type="button" onClick={onEdit}><Icon name="edit" />Edit record</button>}
      />
      <button className="back-link" type="button" onClick={onBack}><Icon name="back" size={18} />Back to customer records</button>
      <section className="detail-summary">
        <span className="detail-avatar">{applicantName(record).charAt(0).toUpperCase()}</span>
        <div className="detail-identity"><h2>{applicantName(record)}</h2><p>{record.mobile || 'No mobile number added'}</p></div>
        <div className="detail-status">
          <label htmlFor="record-status">Application status</label>
          {record.status === 'Account opened'
            ? <StatusBadge status={record.status} />
            : <select id="record-status" value={record.status} onChange={(event) => onStatusChange(record.id, event.target.value)} disabled={statusSaving}>
              {(record.submittedOn ? ['Submitted'] : ['Draft', 'Form ready']).map((status) => <option key={status}>{status}</option>)}
            </select>}
        </div>
      </section>
      {record.submittedOn && <p className="submission-date">Physical submission date: <strong>{formatDate(record.submittedOn)}</strong></p>}
      {record.accountOpenedOn && <p className="submission-date">Account-opening date: <strong>{formatDate(record.accountOpenedOn)}</strong></p>}
      <div className="detail-actions">
        <button className="button button-secondary" type="button" onClick={onReview}>Review Application</button>
        <button className="button button-primary" type="button" onClick={onPrint}>Preview PDF</button>
        {record.status === 'Form ready' && <button className="button button-primary" type="button" onClick={onMarkSubmitted}>Mark as Submitted</button>}
        {record.status === 'Submitted' && (
          <div className="account-opened-action">
            <label htmlFor="account-opened-date">Account-opening date</label>
            <input id="account-opened-date" type="date" value={accountOpenedOn} onChange={(event) => setAccountOpenedOn(event.target.value)} />
            <button className="button button-primary" type="button" onClick={() => onMarkOpened(record.id, accountOpenedOn)} disabled={statusSaving}>Mark Account opened</button>
          </div>
        )}
      </div>
      <div className="detail-grid">
        {sections.map((section) => (
          <section className="panel detail-panel" key={section.title}>
            <div className="panel-heading"><h2>{section.title}</h2></div>
            <dl className="detail-list">
              {section.values.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </>
  )
}

function CustomerRecords({ records, selectedRecord, onSelect, onBack, onEdit, onAdd, onStatusChange, onReview, onPrint, onMarkSubmitted, onMarkOpened, onSearch, statusSaving }) {
  const [query, setQuery] = useState('')
  const filteredRecords = records

  useEffect(() => {
    const timer = setTimeout(() => onSearch(query), 250)
    return () => clearTimeout(timer)
  }, [onSearch, query])

  if (selectedRecord) {
    return <RecordDetails record={selectedRecord} onBack={onBack} onEdit={onEdit} onStatusChange={onStatusChange} onReview={onReview} onPrint={onPrint} onMarkSubmitted={onMarkSubmitted} onMarkOpened={onMarkOpened} statusSaving={statusSaving} />
  }

  return (
    <>
      <PageHeader
        title="Customer records"
        subtitle="Search and manage your saved account applications."
        action={<button className="button button-primary" type="button" onClick={onAdd}><Icon name="plus" />Add customer</button>}
      />
      <section className="panel records-panel">
        <div className="records-toolbar">
          <div><h2>All customers</h2><p>{records.length} {records.length === 1 ? 'record' : 'records'}</p></div>
          <label className="search-box">
            <Icon name="search" size={19} />
            <span className="sr-only">Search by name, mobile or account number</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers..." />
            {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" size={16} /></button>}
          </label>
        </div>
        {records.length === 0 && !query.trim() ? (
          <EmptyState
            title="No customer records yet"
            description="Create your first account form to start building your customer records."
            action={<button type="button" className="button button-secondary" onClick={onAdd}><Icon name="plus" />Add customer</button>}
          />
        ) : filteredRecords.length === 0 ? (
          <EmptyState title="No matching records" description="Try a different name, mobile number or account number." />
        ) : (
          <div className="table-wrap">
            <table className="records-table">
              <thead><tr><th>Customer</th><th>Mobile</th><th>Account number</th><th>Status</th><th><span className="sr-only">Open record</span></th></tr></thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id} onClick={() => onSelect(record.id)}>
                    <td><span className="customer-avatar">{applicantName(record).charAt(0).toUpperCase()}</span><strong>{applicantName(record)}</strong></td>
                    <td>{record.mobile || '—'}</td>
                    <td className="account-cell">{maskedAccount(record.accountNumber)}</td>
                    <td><StatusBadge status={record.status} /></td>
                    <td><button className="icon-button" type="button" aria-label={`View ${applicantName(record)}`} onClick={() => onSelect(record.id)}><Icon name="chevron" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function LoginScreen({ error, starting, onSignIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setLocalError('')
    try {
      await onSignIn(username, password)
    } catch (signInError) {
      setLocalError(signInError.message)
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark">S</span>
          <div><strong>Sakshi Computer</strong><span>Owner workspace</span></div>
        </div>
        <p className="eyebrow">PRIVATE OWNER ACCESS</p>
        <h1>Sign in</h1>
        <p className="login-description">Use the owner account created on this computer. There is no public registration.</p>
        {(error || localError) && <p className="save-error" role="alert">{localError || error}</p>}
        <form className="login-form" onSubmit={submit}>
          <Field label="Owner username" name="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          <Field label="Password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          <button className="button button-primary" type="submit" disabled={starting || submitting}>{starting || submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="login-setup">First time? Create an owner account in the frontend folder with <code>npm run owner:create</code>.</p>
        <Notice />
      </section>
    </main>
  )
}

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const [records, setRecords] = useState([])
  const [recordResults, setRecordResults] = useState([])
  const [owner, setOwner] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [globalError, setGlobalError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [selectedRecordId, setSelectedRecordId] = useState(null)
  const [formReturnView, setFormReturnView] = useState('dashboard')
  const [formDraft, setFormDraft] = useState(null)
  const [workflowRecord, setWorkflowRecord] = useState(null)
  const [printReturnView, setPrintReturnView] = useState('records')
  const [statusSaving, setStatusSaving] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)

  const selectedRecord = records.find((record) => record.id === selectedRecordId)
  const editingRecord = records.find((record) => record.id === editingRecordId)
  const reportDirtyChanges = useCallback((dirty) => setUnsavedChanges(dirty), [])

  const loadRecords = useCallback(async (query = '') => {
    const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
    const response = await apiRequest(`/api/customers${suffix}`)
    setRecordResults(response.items)
    if (!query.trim()) setRecords(response.items)
  }, [])

  useEffect(() => {
    let active = true
    apiRequest('/api/auth/session')
      .then(async (session) => {
        if (!active) return
        if (session.authenticated) {
          setOwner({ username: session.username })
          try {
            await loadRecords()
          } catch (error) {
            if (active) setGlobalError(error.message)
          }
        }
      })
      .catch((error) => {
        if (active) setAuthError(`Could not connect to the local application server: ${error.message}`)
      })
      .finally(() => {
        if (active) setAuthLoading(false)
      })
    return () => { active = false }
  }, [loadRecords])

  async function signIn(username, password) {
    setAuthError('')
    const response = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setOwner({ username: response.username })
    try {
      await loadRecords()
    } catch (error) {
      setGlobalError(error.message)
    }
  }

  async function signOut() {
    if (activeView === 'form' && unsavedChanges && !window.confirm('Discard unsaved changes and sign out?')) return
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      setGlobalError(error.message)
      return
    }
    setOwner(null)
    setRecords([])
    setRecordResults([])
    setSelectedRecordId(null)
    setEditingRecordId(null)
    setWorkflowRecord(null)
    setActiveView('dashboard')
    setUnsavedChanges(false)
  }

  function openForm(recordId = null) {
    if (activeView === 'form' && unsavedChanges && !window.confirm('Discard unsaved changes and open another form?')) return
    setFormReturnView(activeView === 'review' || activeView === 'print' ? 'records' : activeView)
    setEditingRecordId(recordId)
    setFormDraft(recordId ? null : workflowRecord)
    setActiveView('form')
    setFeedback('')
    setGlobalError('')
  }

  function cancelForm() {
    if (unsavedChanges && !window.confirm('Discard unsaved changes to this application?')) return
    setEditingRecordId(null)
    setFormDraft(null)
    setActiveView(formReturnView)
    setUnsavedChanges(false)
    if (formReturnView !== 'records') setSelectedRecordId(null)
  }

  function openRecord(recordId) {
    setSelectedRecordId(recordId)
    setWorkflowRecord(null)
    setActiveView('records')
  }

  async function saveRecord(formData, destination = 'details') {
    setGlobalError('')
    setFeedback('')
    const recordId = editingRecordId || formData.id
    const saved = await apiRequest(
      recordId ? `/api/customers/${recordId}` : '/api/customers',
      {
        method: recordId ? 'PUT' : 'POST',
        body: JSON.stringify({ data: formData }),
      },
    )
    const item = saved.item
    setRecords((current) => {
      const exists = current.some((record) => record.id === item.id)
      return exists
        ? current.map((record) => record.id === item.id ? item : record)
        : [item, ...current]
    })
    setRecordResults((current) => {
      const exists = current.some((record) => record.id === item.id)
      return exists
        ? current.map((record) => record.id === item.id ? item : record)
        : [item, ...current]
    })
    setEditingRecordId(null)
    setFormDraft(null)
    setUnsavedChanges(false)
    if (destination === 'review' || destination === 'print') {
      setWorkflowRecord(item)
      setEditingRecordId(item.id)
      if (destination === 'print') setPrintReturnView('records')
      setActiveView(destination)
    } else {
      setSelectedRecordId(item.id)
      setWorkflowRecord(null)
      setActiveView('records')
    }
    setFeedback('Saved successfully.')
  }

  async function updateStatus(recordId, status) {
    setStatusSaving(true)
    setGlobalError('')
    try {
      const response = await apiRequest(`/api/customers/${recordId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setRecords((current) => current.map((record) => record.id === recordId ? response.item : record))
      setRecordResults((current) => current.map((record) => record.id === recordId ? response.item : record))
      setWorkflowRecord((current) => current?.id === recordId ? response.item : current)
      setFeedback('Status updated successfully.')
    } catch (error) {
      setGlobalError([error.message, ...error.issues].join(' '))
    } finally {
      setStatusSaving(false)
    }
  }

  async function markSubmitted(recordId) {
    const confirmed = window.confirm('Confirm that the physical application has already been handed to the bank. This does not submit anything to the bank.')
    if (!confirmed) return
    setStatusSaving(true)
    setGlobalError('')
    try {
      const response = await apiRequest(`/api/customers/${recordId}/mark-submitted`, {
        method: 'POST',
        body: JSON.stringify({ submittedOn: localDateValue() }),
      })
      setRecords((current) => current.map((record) => record.id === recordId ? response.item : record))
      setRecordResults((current) => current.map((record) => record.id === recordId ? response.item : record))
      setFeedback('Physical submission date recorded.')
    } catch (error) {
      setGlobalError(error.message)
    } finally {
      setStatusSaving(false)
    }
  }

  async function markAccountOpened(recordId, accountOpenedOn) {
    setStatusSaving(true)
    setGlobalError('')
    try {
      const response = await apiRequest(`/api/customers/${recordId}/mark-opened`, {
        method: 'POST',
        body: JSON.stringify({ accountOpenedOn }),
      })
      setRecords((current) => current.map((record) => record.id === recordId ? response.item : record))
      setRecordResults((current) => current.map((record) => record.id === recordId ? response.item : record))
      setWorkflowRecord((current) => current?.id === recordId ? response.item : current)
      setFeedback('Account-opening date recorded.')
    } catch (error) {
      setGlobalError(error.message)
    } finally {
      setStatusSaving(false)
    }
  }

  async function downloadApplicationPdf(recordId) {
    try {
      await downloadPdf(recordId)
    } catch (error) {
      setGlobalError([error.message, ...(error.issues || [])].join(' '))
    }
  }

  function reviewApplication(record) {
    setWorkflowRecord(record)
    setEditingRecordId(record.id || null)
    setActiveView('review')
    setFeedback('')
    setGlobalError('')
  }

  function showPrintPreview(record) {
    setPrintReturnView(activeView)
    setWorkflowRecord(record)
    setActiveView('print')
    setFeedback('')
  }

  function returnToEdit() {
    setFormDraft(workflowRecord)
    setEditingRecordId(workflowRecord?.id || null)
    setActiveView('form')
  }

  function navigate(view) {
    if (activeView === 'form' && unsavedChanges && !window.confirm('Discard unsaved changes and leave this form?')) return
    setActiveView(view)
    setEditingRecordId(null)
    setSelectedRecordId(null)
    setFormDraft(null)
    setWorkflowRecord(null)
    setFeedback('')
    setGlobalError('')
    setUnsavedChanges(false)
  }

  if (authLoading) {
    return <main className="auth-loading" aria-live="polite">Loading owner workspace…</main>
  }
  if (!owner) return <LoginScreen error={authError} starting={false} onSignIn={signIn} />

  return (
    <div className={`app-shell ${activeView === 'print' ? 'is-print-preview' : ''}`}>
      <Sidebar activeView={activeView} onNavigate={navigate} username={owner.username} onLogout={signOut} />
      <main className="main-content">
        <div className="mobile-brand"><span className="brand-mark">S</span><strong>Sakshi Computer</strong><span>Owner workspace</span><button type="button" onClick={signOut}>Sign out</button></div>
        <Notice />
        {feedback && <p className="feedback-banner" role="status">{feedback}<button type="button" aria-label="Dismiss message" onClick={() => setFeedback('')}>×</button></p>}
        {globalError && <p className="save-error global-error" role="alert">{globalError}<button type="button" aria-label="Dismiss error" onClick={() => setGlobalError('')}>×</button></p>}
        <div className="page-content">
          {activeView === 'dashboard' && (
            <Dashboard
              records={records}
              onAdd={() => openForm()}
              onViewRecords={() => navigate('records')}
              onSelectRecord={openRecord}
            />
          )}
          {activeView === 'form' && (
            <AccountForm
              key={editingRecord?.id || formDraft?.id || 'new-form'}
              record={editingRecord}
              draft={formDraft}
              onSave={saveRecord}
              onCancel={cancelForm}
              onDirtyChange={reportDirtyChanges}
            />
          )}
          {activeView === 'records' && (
            <CustomerRecords
              records={recordResults}
              selectedRecord={selectedRecord}
              onSelect={openRecord}
              onBack={() => setSelectedRecordId(null)}
              onEdit={() => openForm(selectedRecordId)}
              onAdd={() => openForm()}
              onStatusChange={updateStatus}
              onReview={() => reviewApplication(selectedRecord)}
              onPrint={() => showPrintPreview(selectedRecord)}
              onMarkSubmitted={() => markSubmitted(selectedRecordId)}
              onMarkOpened={markAccountOpened}
              onSearch={loadRecords}
              statusSaving={statusSaving}
            />
          )}
          {activeView === 'review' && workflowRecord && (
            <ReviewScreen
              record={workflowRecord}
              onBackToEdit={returnToEdit}
              onPrint={() => showPrintPreview(workflowRecord)}
              onMarkReady={() => updateStatus(workflowRecord.id, 'Form ready')}
              statusSaving={statusSaving}
            />
          )}
          {activeView === 'print' && workflowRecord && (
            <PrintPreview
              record={workflowRecord}
              onBack={() => setActiveView(printReturnView)}
              onDownload={() => downloadApplicationPdf(workflowRecord.id)}
            />
          )}
        </div>
        <footer className="app-footer"><span>© Sakshi Computer</span><span>Private owner workspace <span className="footer-divider">·</span> Local SQLite records</span></footer>
      </main>
    </div>
  )
}

export default App
