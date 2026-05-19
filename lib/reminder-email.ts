import nodemailer from 'nodemailer'
import type { Appointment } from './db'

// ── Per-test preparation data (sourced from medical guidelines) ───────────────

interface PrepSection { title: string; icon: string; items: string[] }
interface TestPrep {
  label: string
  emoji: string
  headerGradient: string
  accentColor: string
  department: string
  alert?: { title: string; body: string }
  sections: PrepSection[]
}

const BLOOD_TESTS: Record<string, TestPrep> = {
  cbc: {
    label: 'Complete Blood Count (CBC)', emoji: '🩸',
    headerGradient: 'linear-gradient(135deg,#7c3aed,#a855f7)', accentColor: '#7c3aed',
    department: 'Pathology Department',
    sections: [
      { title: '🍽️ Fasting', icon: '', items: [
        'Fasting is <strong>NOT required</strong> for a standalone CBC.',
        'If combined with other tests (lipid/glucose), follow their fasting rules.',
        'You may eat and drink normally.',
      ]},
      { title: '💧 Hydration', icon: '', items: [
        'Drink plenty of <strong>plain water</strong> — it makes veins easier to find.',
        'Avoid alcohol for 24 hours before the test.',
      ]},
      { title: '💊 Medications', icon: '', items: [
        'Continue all prescribed medications unless your doctor says otherwise.',
        'Inform the lab about any supplements you take.',
      ]},
      { title: '👕 What to Wear', icon: '', items: [
        'Wear a <strong>short-sleeve shirt</strong> or sleeves that roll up easily.',
      ]},
    ],
  },
  lipid: {
    label: 'Lipid Profile (Cholesterol Panel)', emoji: '🩸',
    headerGradient: 'linear-gradient(135deg,#7c3aed,#a855f7)', accentColor: '#7c3aed',
    department: 'Pathology Department',
    alert: { title: '⚠️ Strict Fasting Required', body: 'Do <strong>NOT</strong> eat or drink anything except plain water for <strong>9–12 hours</strong> before your blood draw. No coffee, tea, juice, gum, or smoking.' },
    sections: [
      { title: '💧 Hydration', icon: '', items: [
        'Drink plenty of <strong>plain water</strong> — it is encouraged during fasting.',
        'No alcohol for <strong>24 hours</strong> before the test.',
        'Avoid strenuous exercise during the fasting period.',
      ]},
      { title: '💊 Medications', icon: '', items: [
        'Continue prescribed medications unless your doctor instructs otherwise.',
        'Inform the lab about statins, blood-pressure meds, or supplements.',
      ]},
    ],
  },
  tft: {
    label: 'Thyroid Function Test (TFT/TSH)', emoji: '🦋',
    headerGradient: 'linear-gradient(135deg,#0891b2,#22d3ee)', accentColor: '#0891b2',
    department: 'Pathology Department',
    alert: { title: '⚠️ Stop Biotin Supplements', body: 'Stop all <strong>biotin (Vitamin B7)</strong> supplements at least <strong>48–72 hours</strong> before the test. Biotin causes falsely high/low thyroid results. Check multivitamins and hair-skin-nail supplements for hidden biotin.' },
    sections: [
      { title: '⏰ Best Time', icon: '', items: [
        'TSH peaks in early morning. Test between <strong>8–10 AM</strong> for the most accurate reading.',
        'An overnight fast (water only) gives the most consistent TSH results.',
      ]},
      { title: '💊 Medications', icon: '', items: [
        'If you take thyroid medication (levothyroxine), take it <strong>after</strong> the blood draw.',
        'Continue all other medications unless instructed otherwise.',
      ]},
    ],
  },
  sugar: {
    label: 'Blood Sugar (Fasting + PP)', emoji: '🍬',
    headerGradient: 'linear-gradient(135deg,#b45309,#f59e0b)', accentColor: '#b45309',
    department: 'Pathology Department',
    alert: { title: '⚠️ Strict Fasting — 8–12 Hours', body: 'Do <strong>NOT</strong> eat, drink (except water), chew gum, or smoke for <strong>8–12 hours</strong> before the fasting sample. Avoid strenuous exercise on the morning of the test.' },
    sections: [
      { title: '📝 Two-Part Test', icon: '', items: [
        '<strong>Part 1 (Fasting):</strong> Blood drawn after the overnight fast.',
        '<strong>Part 2 (PP):</strong> Eat a normal meal, then blood is drawn exactly <strong>2 hours</strong> after your first bite.',
        'You must stay at the lab during the 2-hour wait. Do NOT eat again, smoke, or exercise.',
      ]},
      { title: '💊 Diabetes Medications', icon: '', items: [
        'Ask your doctor if you should take your diabetes medicine before the fasting draw.',
        'Bring your medication and a snack — you can take them after Part 1.',
      ]},
    ],
  },
  lft: {
    label: 'Liver Function Test (LFT)', emoji: '🫁',
    headerGradient: 'linear-gradient(135deg,#166534,#4ade80)', accentColor: '#166534',
    department: 'Pathology Department',
    alert: { title: '⚠️ Fasting 8–12 Hours + No Alcohol', body: 'Fast for <strong>8–12 hours</strong> (water only). Abstain from alcohol for at least <strong>48 hours</strong> before the test — alcohol temporarily spikes liver enzymes and can produce misleading results.' },
    sections: [
      { title: '🏋️ Activity', icon: '', items: [
        'Avoid <strong>intense exercise</strong> the day before — vigorous activity can temporarily elevate liver enzymes.',
      ]},
      { title: '💊 Medications', icon: '', items: [
        'Continue prescribed medications unless your doctor says otherwise.',
        'Inform the lab about all supplements, herbal remedies, and OTC drugs — many affect liver enzymes.',
      ]},
    ],
  },
  kft: {
    label: 'Kidney Function Test (KFT/RFT)', emoji: '💧',
    headerGradient: 'linear-gradient(135deg,#1e40af,#60a5fa)', accentColor: '#1e40af',
    department: 'Pathology Department',
    sections: [
      { title: '🍽️ Fasting', icon: '', items: [
        'Fasting is usually <strong>not required</strong> for a standalone KFT.',
        'If combined with a lipid/glucose panel, follow their fasting rules.',
        'Stay well-hydrated — dehydration can artificially alter creatinine and urea levels.',
      ]},
      { title: '🥩 Diet', icon: '', items: [
        'Avoid a <strong>heavy high-protein meal</strong> (e.g., large steak) for 4–6 hours before the test — it temporarily increases creatinine.',
      ]},
      { title: '🏋️ Activity', icon: '', items: [
        'Avoid strenuous exercise for 24 hours before the test — heavy exertion raises creatinine.',
      ]},
    ],
  },
  vitamin: {
    label: 'Vitamin D & B12 Panel', emoji: '☀️',
    headerGradient: 'linear-gradient(135deg,#c2410c,#fb923c)', accentColor: '#c2410c',
    department: 'Pathology Department',
    alert: { title: '⚠️ Stop Biotin Supplements', body: 'Stop <strong>biotin-containing supplements</strong> (multivitamins, hair/skin/nail pills) at least <strong>48–72 hours</strong> before the test. Biotin interferes with the immunoassay and causes falsely high or low results.' },
    sections: [
      { title: '🍽️ Fasting', icon: '', items: [
        'Fasting is usually <strong>not required</strong> for Vitamin D and B12 tests.',
        'If combined with other panels, follow their fasting rules.',
      ]},
      { title: '💊 Supplements', icon: '', items: [
        'Inform the lab about <strong>all</strong> vitamins and supplements you take.',
        'Your doctor may ask you to pause Vitamin D/B12 supplements before the test for a true baseline reading.',
      ]},
    ],
  },
}

const IMAGING_TESTS: Record<string, TestPrep> = {
  chest_xray: {
    label: 'Chest X-Ray (PA View)', emoji: '🫁',
    headerGradient: 'linear-gradient(135deg,#0369a1,#38bdf8)', accentColor: '#0369a1',
    department: 'Radiology Department',
    sections: [
      { title: '🍽️ Fasting', icon: '', items: ['<strong>No fasting required.</strong> Eat and drink normally.'] },
      { title: '👕 Clothing', icon: '', items: [
        'Remove clothing from the waist up; you will be given a gown.',
        'Remove all necklaces, chains, and metal objects from the chest area.',
      ]},
      { title: '🫁 During the Scan', icon: '', items: [
        'You will be asked to <strong>hold your breath</strong> for a few seconds while the image is taken.',
        'The entire procedure takes under 5 minutes.',
      ]},
    ],
  },
  spine_xray: {
    label: 'Spine X-Ray', emoji: '🦴',
    headerGradient: 'linear-gradient(135deg,#0369a1,#38bdf8)', accentColor: '#0369a1',
    department: 'Radiology Department',
    sections: [
      { title: '🍽️ Fasting', icon: '', items: ['<strong>No fasting required.</strong>'] },
      { title: '👕 Clothing', icon: '', items: [
        'Wear loose clothing without metal zippers/buttons near the spine.',
        'You may be asked to change into a gown. Remove jewellery from the area.',
      ]},
      { title: '📋 What to Expect', icon: '', items: [
        'You may be positioned lying down or standing depending on the view.',
        'Stay completely still during the exposure — any movement blurs the image.',
      ]},
    ],
  },
  abdominal_xray: {
    label: 'Abdominal X-Ray', emoji: '🩻',
    headerGradient: 'linear-gradient(135deg,#0369a1,#38bdf8)', accentColor: '#0369a1',
    department: 'Radiology Department',
    sections: [
      { title: '🍽️ Fasting', icon: '', items: ['<strong>No fasting required</strong> for a standard abdominal X-Ray.'] },
      { title: '👕 Clothing', icon: '', items: [
        'Remove belts, buckles, and metal objects from the abdomen/waist area.',
        'You may be given a gown to wear.',
      ]},
    ],
  },
  extremity_xray: {
    label: 'Extremity X-Ray (Limbs)', emoji: '🦵',
    headerGradient: 'linear-gradient(135deg,#0369a1,#38bdf8)', accentColor: '#0369a1',
    department: 'Radiology Department',
    sections: [
      { title: '🍽️ Fasting', icon: '', items: ['<strong>No fasting required.</strong>'] },
      { title: '💍 Remove Accessories', icon: '', items: [
        'Remove watches, rings, bracelets, or anklets from the limb being imaged.',
        'Wear loose clothing that exposes the area or can be rolled up easily.',
      ]},
    ],
  },
  dental_xray: {
    label: 'Dental X-Ray (OPG)', emoji: '🦷',
    headerGradient: 'linear-gradient(135deg,#0369a1,#38bdf8)', accentColor: '#0369a1',
    department: 'Radiology Department',
    sections: [
      { title: '🍽️ Fasting', icon: '', items: ['<strong>No fasting required.</strong>'] },
      { title: '💍 Metal-Free Head & Neck', icon: '', items: [
        'Remove <strong>all</strong> earrings, nose pins, necklaces, hairpins, and eyeglasses.',
        'Remove removable dental work (dentures, retainers).',
      ]},
      { title: '📋 During the Scan', icon: '', items: [
        'You will bite gently on a plastic mouthpiece while the machine rotates.',
        'Keep your tongue pressed to the roof of your mouth and stay completely still.',
      ]},
    ],
  },
  ct_scan: {
    label: 'CT Scan', emoji: '🔬',
    headerGradient: 'linear-gradient(135deg,#4338ca,#818cf8)', accentColor: '#4338ca',
    department: 'Radiology Department',
    alert: { title: '⚠️ Contrast Dye May Be Used', body: 'If your scan uses contrast, <strong>do not eat solid food for 4–6 hours</strong> before the exam. Water is fine. Inform the technician of any <strong>allergies (especially to iodine)</strong>, kidney problems, or diabetes (metformin).' },
    sections: [
      { title: '👕 Clothing & Metal', icon: '', items: [
        'Wear loose clothing without metal. Remove all jewellery, watches, and piercings.',
        'You may be given a gown.',
      ]},
      { title: '🩺 Medical Info', icon: '', items: [
        'Tell the technician if you are or might be <strong>pregnant</strong>.',
        'Mention any implants, pacemakers, or metal in your body.',
        'You may feel brief warmth or a metallic taste from IV contrast — this is normal.',
      ]},
    ],
  },
  mri_scan: {
    label: 'MRI Scan', emoji: '🧲',
    headerGradient: 'linear-gradient(135deg,#4338ca,#818cf8)', accentColor: '#4338ca',
    department: 'Radiology Department',
    alert: { title: '⚠️ Absolutely No Metal', body: 'MRI uses a powerful magnet. Remove <strong>ALL</strong> metal — jewellery, watches, hairpins, piercings, hearing aids, dentures with metal. Inform the facility about <strong>any implants</strong> (pacemakers, metal plates, cochlear implants).' },
    sections: [
      { title: '🍽️ Fasting', icon: '', items: [
        'Most MRIs do <strong>not</strong> require fasting.',
        'For abdominal/pelvic MRI or contrast MRI: <strong>fast for 4–6 hours</strong>. Water is fine.',
      ]},
      { title: '👕 Clothing', icon: '', items: [
        'Wear comfortable clothes without metal zippers, buttons, or underwire.',
        'You will likely change into a hospital gown.',
      ]},
      { title: '🩺 Medical Info', icon: '', items: [
        'Tell the technician if you are or might be <strong>pregnant</strong>.',
        'Inform about <strong>claustrophobia</strong> — a sedative can be arranged.',
        'The scan takes 30–60 minutes. You must lie very still.',
      ]},
    ],
  },
  ultrasound: {
    label: 'Ultrasound', emoji: '📡',
    headerGradient: 'linear-gradient(135deg,#0d9488,#5eead4)', accentColor: '#0d9488',
    department: 'Radiology Department',
    alert: { title: '⚠️ Preparation Varies by Area', body: '<strong>Abdominal:</strong> Fast for 6–8 hours (no food/drink). <strong>Pelvic:</strong> Drink ~1 litre of water 1 hour before and <strong>do NOT urinate</strong> — a full bladder is essential. <strong>Other areas:</strong> No special prep.' },
    sections: [
      { title: '👕 Clothing', icon: '', items: [
        'Wear loose, comfortable clothing. You may need to expose the scan area.',
      ]},
      { title: '📋 What to Expect', icon: '', items: [
        'A gel is applied to the skin — it may feel cold.',
        'The procedure is painless and takes 15–30 minutes.',
      ]},
    ],
  },
}

// ── Service → Prep Data Matcher ───────────────────────────────────────────────

function getTestPrep(service: string): TestPrep | null {
  const s = service.toLowerCase()
  // Blood tests
  if (s.includes('cbc') || (s.includes('complete') && s.includes('blood'))) return BLOOD_TESTS.cbc
  if (s.includes('lipid') || s.includes('cholesterol')) return BLOOD_TESTS.lipid
  if (s.includes('thyroid') || s.includes('tft') || s.includes('tsh')) return BLOOD_TESTS.tft
  if (s.includes('sugar') || s.includes('glucose') || s.includes('hba1c')) return BLOOD_TESTS.sugar
  if (s.includes('liver') || s.includes('lft')) return BLOOD_TESTS.lft
  if (s.includes('kidney') || s.includes('kft') || s.includes('rft')) return BLOOD_TESTS.kft
  if (s.includes('vitamin') || s.includes('b12') || s.includes('d3')) return BLOOD_TESTS.vitamin
  // Imaging
  if (s.includes('mri')) return IMAGING_TESTS.mri_scan
  if (s.includes('ct ') || s.includes('ct scan') || s.includes('ctscan')) return IMAGING_TESTS.ct_scan
  if (s.includes('ultrasound') || s.includes('sonography')) return IMAGING_TESTS.ultrasound
  if (s.includes('dental') || s.includes('opg')) return IMAGING_TESTS.dental_xray
  if (s.includes('chest')) return IMAGING_TESTS.chest_xray
  if (s.includes('spine') || s.includes('spinal')) return IMAGING_TESTS.spine_xray
  if (s.includes('abdom')) return IMAGING_TESTS.abdominal_xray
  if (s.includes('extrem') || s.includes('limb')) return IMAGING_TESTS.extremity_xray
  // Generic fallbacks
  if (s.includes('x-ray') || s.includes('xray')) return IMAGING_TESTS.chest_xray
  if (s.includes('blood') || s.includes('panel')) return BLOOD_TESTS.cbc
  return null
}

// ── Single HTML Template (data-driven) ────────────────────────────────────────

function buildTestSpecificHtml(apt: Appointment, prep: TestPrep): string {
  const sentAt = new Date().toISOString()
  const spacer = '&zwnj;&nbsp;'.repeat(30)

  const alertHtml = prep.alert ? `
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
        <strong style="color:#92400e;">${prep.alert.title}</strong>
        <p style="color:#78350f;margin:6px 0 0;font-size:14px;">${prep.alert.body}</p>
      </div>` : ''

  const sectionsHtml = prep.sections.map(sec => `
      <div style="margin-bottom:20px;">
        <h3 style="color:${prep.accentColor};font-size:14px;margin:0 0 8px;">${sec.title}</h3>
        <ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          ${sec.items.map(i => `<li>${i}</li>`).join('\n          ')}
        </ul>
      </div>`).join('')

  // Common sections added to all emails
  const commonDocs = `
      <div style="margin-bottom:20px;">
        <h3 style="color:${prep.accentColor};font-size:14px;margin:0 0 8px;">📁 Documents to Carry</h3>
        <ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          <li>Government-issued photo ID (Aadhaar / Passport / DL)</li>
          <li>Insurance card and policy details</li>
          <li>Doctor's prescription or referral letter</li>
          <li>Previous reports (if any)</li>
        </ul>
      </div>
      <div style="margin-bottom:8px;">
        <h3 style="color:${prep.accentColor};font-size:14px;margin:0 0 8px;">🚗 Arrival</h3>
        <ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
          <li>Arrive <strong>15–20 minutes early</strong> to complete registration.</li>
        </ul>
      </div>`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="display:none!important;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Reminder sent ${sentAt} for ${apt.patientName} — ${prep.label} on ${apt.date} at ${apt.time} ${spacer}</div>
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="${prep.headerGradient};padding:32px 32px 24px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:36px;">${prep.emoji}</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${prep.label} — Tomorrow!</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Your preparation checklist from MediCare Hospital</p>
    </div>
    <div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">📋 Appointment Details</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:45%;">Test / Procedure</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.service || prep.label}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Doctor</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.doctorName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Date</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.date}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Time</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.time}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Patient</td><td style="padding:6px 0;color:#0f172a;font-size:14px;">${apt.patientName}</td></tr>
      </table>
    </div>
    <div style="padding:24px 32px;">
      <h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">✅ Preparation Checklist</h2>
      ${alertHtml}
      ${sectionsHtml}
      ${commonDocs}
    </div>
    <div style="padding:20px 32px;background:#f0f9ff;border-top:1px solid #bae6fd;">
      <p style="color:#0369a1;font-size:13px;margin:0;text-align:center;">
        Need to cancel or reschedule? Log in to the
        <a href="https://medi-care-chatbot.vercel.app/patient/login" style="color:#0284c7;font-weight:600;">Patient Portal</a>
      </p>
    </div>
    <div style="padding:16px 32px;text-align:center;background:#f8fafc;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">MediCare Hospital · ${prep.department} · Automated reminder — do not reply.</p>
    </div>
  </div>
</body></html>`
}

// ── Fallback general consultation template ────────────────────────────────────

function buildGeneralHtml(apt: Appointment): string {
  const fallback: TestPrep = {
    label: 'General Consultation', emoji: '🏥',
    headerGradient: 'linear-gradient(135deg,#1e40af,#3b82f6)', accentColor: '#1d4ed8',
    department: 'MediCare Hospital',
    sections: [
      { title: '🍽️ Fasting', icon: '', items: ['You may eat and drink normally before this consultation.', 'Avoid alcohol 24 hours before your visit.'] },
      { title: '👕 What to Wear', icon: '', items: ['Comfortable, loose-fitting clothing.', 'Avoid heavy jewellery or accessories.'] },
      { title: '🚗 Parking & Arrival', icon: '', items: ['Arrive <strong>15 minutes early</strong> to complete registration.', 'Parking available in Basement B1 & B2 (validated 3 hours).', 'Wheelchair assistance: inform reception on arrival.'] },
    ],
  }
  return buildTestSpecificHtml(apt, fallback)
}

// ── Multi-test support: split "CBC + Lipid Profile" → multiple preps ──────────

function getAllTestPreps(service: string): TestPrep[] {
  const parts = service.split(' + ').map(s => s.trim()).filter(Boolean)
  const preps: TestPrep[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const prep = getTestPrep(part)
    if (prep && !seen.has(prep.label)) {
      preps.push(prep)
      seen.add(prep.label)
    }
  }
  return preps
}

function buildReminderHtml(apt: Appointment): string {
  const preps = getAllTestPreps(apt.service || '')
  if (preps.length === 0) return buildGeneralHtml(apt)
  if (preps.length === 1) return buildTestSpecificHtml(apt, preps[0])

  // Multi-test: merge all preps into a combined email
  const primary = preps[0]
  const sentAt = new Date().toISOString()
  const spacer = '&zwnj;&nbsp;'.repeat(30)
  const testList = preps.map(p => p.label).join(', ')

  // Collect all unique alerts
  const alerts = preps.filter(p => p.alert).map(p => p.alert!)
  const alertsHtml = alerts.map(a =>
    `<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:12px;">
       <strong style="color:#92400e;">${a.title}</strong>
       <p style="color:#78350f;margin:6px 0 0;font-size:14px;">${a.body}</p>
     </div>`
  ).join('')

  // Collect all sections grouped by test name
  const testsHtml = preps.map(p => {
    const secHtml = p.sections.map(sec =>
      `<div style="margin-bottom:14px;"><h3 style="color:${p.accentColor};font-size:13px;margin:0 0 6px;">${sec.title}</h3><ul style="color:#475569;font-size:13px;line-height:1.7;margin:0;padding-left:20px;">${sec.items.map(i => `<li>${i}</li>`).join('')}</ul></div>`
    ).join('')
    return `<div style="margin-bottom:20px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;">
      <h2 style="color:#0f172a;font-size:15px;margin:0 0 12px;">${p.emoji} ${p.label}</h2>
      ${secHtml}
    </div>`
  }).join('')

  const commonDocs = `<div style="margin-bottom:8px;">
    <h3 style="color:${primary.accentColor};font-size:14px;margin:0 0 8px;">📁 Documents to Carry</h3>
    <ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
      <li>Government-issued photo ID (Aadhaar / Passport / DL)</li>
      <li>Insurance card and policy details</li>
      <li>Doctor's prescription or referral letter</li>
      <li>Previous reports (if any)</li>
    </ul>
  </div>
  <div style="margin-bottom:8px;">
    <h3 style="color:${primary.accentColor};font-size:14px;margin:0 0 8px;">🚗 Arrival</h3>
    <ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
      <li>Arrive <strong>15–20 minutes early</strong> to complete registration.</li>
    </ul>
  </div>`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="display:none!important;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Reminder sent ${sentAt} for ${apt.patientName} — ${testList} on ${apt.date} at ${apt.time} ${spacer}</div>
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:${primary.headerGradient};padding:32px 32px 24px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;padding:16px;margin-bottom:12px;">
        <span style="font-size:36px;">${preps.map(p => p.emoji).join('')}</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${preps.length} Tests Tomorrow!</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Combined preparation checklist from MediCare Hospital</p>
    </div>
    <div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">📋 Appointment Details</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:35%;">Tests</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.service}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Doctor</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.doctorName}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Date</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.date}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Time</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.time}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Patient</td><td style="padding:6px 0;color:#0f172a;font-size:14px;">${apt.patientName}</td></tr>
      </table>
    </div>
    <div style="padding:24px 32px;">
      <h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">✅ Preparation Checklist</h2>
      ${alertsHtml}
      ${testsHtml}
      ${commonDocs}
    </div>
    <div style="padding:20px 32px;background:#f0f9ff;border-top:1px solid #bae6fd;">
      <p style="color:#0369a1;font-size:13px;margin:0;text-align:center;">
        Need to cancel or reschedule? Log in to the
        <a href="https://medi-care-chatbot.vercel.app/patient/login" style="color:#0284c7;font-weight:600;">Patient Portal</a>
      </p>
    </div>
    <div style="padding:16px 32px;text-align:center;background:#f8fafc;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">MediCare Hospital · ${primary.department} · Automated reminder — do not reply.</p>
    </div>
  </div>
</body></html>`
}

function getSubjectLine(apt: Appointment): string {
  const preps = getAllTestPreps(apt.service || '')
  if (preps.length === 0) return `⏰ Reminder: Your appointment with ${apt.doctorName} is tomorrow — ${apt.date} at ${apt.time}`
  if (preps.length === 1) return `${preps[0].emoji} Reminder: ${preps[0].label} is tomorrow — ${apt.date} at ${apt.time}`
  return `🧪 Reminder: ${preps.length} tests (${preps.map(p => p.label).join(', ')}) tomorrow — ${apt.date} at ${apt.time}`
}

export async function sendAppointmentReminder(apt: Appointment): Promise<void> {
  const to = apt.patientEmail
  if (!to) throw new Error('No patient email on appointment')

  await sendEmail(to, getSubjectLine(apt), '', buildReminderHtml(apt))
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  })

  await transporter.sendMail({
    from: `"MediCare Hospital" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    ...(html ? { html } : {})
  })
}

export { buildReminderHtml, getSubjectLine, getTestPrep, getAllTestPreps, BLOOD_TESTS, IMAGING_TESTS }



