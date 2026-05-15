import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

admin.initializeApp();
const db = admin.firestore();

const emailUser = defineSecret("EMAIL_USER");
const emailPass = defineSecret("EMAIL_PASS");

export const cleanupOldChats = onSchedule("every day 00:00", async (event) => {
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - THREE_MONTHS_MS;
  
  const snapshot = await db.collection("chatSessions").get();
  const batch = db.batch();
  let updatedCount = 0;
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.messages) return;
    const originalLength = data.messages.length;
    const filteredMessages = data.messages.filter((m: any) => m.timestamp >= cutoff);
    if (filteredMessages.length < originalLength) {
      batch.update(doc.ref, { messages: filteredMessages });
      updatedCount++;
    }
  });

  await batch.commit();
  console.log(`Nightly chat cleanup complete! Processed and deleted old messages for ${updatedCount} patients.`);
});

// ── Per-test preparation data ─────────────────────────────────────────────────

interface PrepSection { title: string; items: string[] }
interface TestPrep {
  label: string; emoji: string; gradient: string; accent: string; dept: string
  alert?: { title: string; body: string }
  sections: PrepSection[]
}

const BT: Record<string, TestPrep> = {
  cbc: { label:'Complete Blood Count (CBC)', emoji:'🩸', gradient:'linear-gradient(135deg,#7c3aed,#a855f7)', accent:'#7c3aed', dept:'Pathology', sections:[
    { title:'🍽️ Fasting', items:['Fasting is <strong>NOT required</strong> for a standalone CBC.','If combined with other tests, follow their fasting rules.'] },
    { title:'💧 Hydration', items:['Drink plenty of <strong>plain water</strong>.','Avoid alcohol for 24 hours.'] },
    { title:'👕 Wear', items:['Short-sleeve shirt or sleeves that roll up easily.'] },
  ]},
  lipid: { label:'Lipid Profile (Cholesterol Panel)', emoji:'🩸', gradient:'linear-gradient(135deg,#7c3aed,#a855f7)', accent:'#7c3aed', dept:'Pathology',
    alert:{ title:'⚠️ Strict Fasting Required', body:'Do <strong>NOT</strong> eat or drink anything except plain water for <strong>9–12 hours</strong>. No coffee, tea, juice, gum, or smoking.' },
    sections:[{ title:'💧 Hydration', items:['Plain water is encouraged.','No alcohol for 24 hours.','Avoid strenuous exercise during fasting.'] }],
  },
  tft: { label:'Thyroid Function Test (TFT/TSH)', emoji:'🦋', gradient:'linear-gradient(135deg,#0891b2,#22d3ee)', accent:'#0891b2', dept:'Pathology',
    alert:{ title:'⚠️ Stop Biotin Supplements', body:'Stop <strong>biotin</strong> supplements at least <strong>48–72 hours</strong> before. Check multivitamins for hidden biotin.' },
    sections:[
      { title:'⏰ Best Time', items:['Test between <strong>8–10 AM</strong> for accurate TSH.','Overnight fast (water only) gives most consistent results.'] },
      { title:'💊 Medications', items:['Take thyroid medication <strong>after</strong> the blood draw.'] },
    ],
  },
  sugar: { label:'Blood Sugar (Fasting + PP)', emoji:'🍬', gradient:'linear-gradient(135deg,#b45309,#f59e0b)', accent:'#b45309', dept:'Pathology',
    alert:{ title:'⚠️ Strict Fasting — 8–12 Hours', body:'Do <strong>NOT</strong> eat, drink (except water), chew gum, or smoke for <strong>8–12 hours</strong> before the fasting sample.' },
    sections:[{ title:'📝 Two-Part Test', items:['<strong>Part 1:</strong> Blood drawn after overnight fast.','<strong>Part 2 (PP):</strong> Eat a normal meal, then blood drawn exactly <strong>2 hours</strong> after first bite.','Stay at the lab during the 2-hour wait.'] }],
  },
  lft: { label:'Liver Function Test (LFT)', emoji:'🫁', gradient:'linear-gradient(135deg,#166534,#4ade80)', accent:'#166534', dept:'Pathology',
    alert:{ title:'⚠️ Fasting + No Alcohol', body:'Fast <strong>8–12 hours</strong> (water only). No alcohol for at least <strong>48 hours</strong>.' },
    sections:[{ title:'🏋️ Activity', items:['Avoid intense exercise the day before — it elevates liver enzymes.'] }],
  },
  kft: { label:'Kidney Function Test (KFT/RFT)', emoji:'💧', gradient:'linear-gradient(135deg,#1e40af,#60a5fa)', accent:'#1e40af', dept:'Pathology',
    sections:[
      { title:'🍽️ Fasting', items:['Usually <strong>not required</strong>.','Stay well-hydrated.'] },
      { title:'🥩 Diet', items:['Avoid heavy high-protein meals for 4–6 hours before.'] },
    ],
  },
  vitamin: { label:'Vitamin D & B12 Panel', emoji:'☀️', gradient:'linear-gradient(135deg,#c2410c,#fb923c)', accent:'#c2410c', dept:'Pathology',
    alert:{ title:'⚠️ Stop Biotin Supplements', body:'Stop biotin-containing supplements at least <strong>48–72 hours</strong> before.' },
    sections:[
      { title:'🍽️ Fasting', items:['Usually <strong>not required</strong>.'] },
      { title:'💊 Supplements', items:['Inform the lab about all vitamins and supplements.'] },
    ],
  },
}

const IM: Record<string, TestPrep> = {
  chest: { label:'Chest X-Ray (PA View)', emoji:'🫁', gradient:'linear-gradient(135deg,#0369a1,#38bdf8)', accent:'#0369a1', dept:'Radiology',
    sections:[
      { title:'🍽️ Fasting', items:['<strong>No fasting required.</strong>'] },
      { title:'👕 Clothing', items:['Remove clothing from waist up; you will get a gown.','Remove necklaces, chains, metal from chest.'] },
      { title:'🫁 During Scan', items:['Hold your breath for a few seconds.','Takes under 5 minutes.'] },
    ],
  },
  spine: { label:'Spine X-Ray', emoji:'🦴', gradient:'linear-gradient(135deg,#0369a1,#38bdf8)', accent:'#0369a1', dept:'Radiology',
    sections:[
      { title:'🍽️ Fasting', items:['<strong>No fasting required.</strong>'] },
      { title:'👕 Clothing', items:['Loose clothing without metal near spine.','You may change into a gown.'] },
    ],
  },
  abdom: { label:'Abdominal X-Ray', emoji:'🩻', gradient:'linear-gradient(135deg,#0369a1,#38bdf8)', accent:'#0369a1', dept:'Radiology',
    sections:[
      { title:'👕 Clothing', items:['Remove belts, buckles, metal from abdomen/waist.'] },
    ],
  },
  extrem: { label:'Extremity X-Ray (Limbs)', emoji:'🦵', gradient:'linear-gradient(135deg,#0369a1,#38bdf8)', accent:'#0369a1', dept:'Radiology',
    sections:[{ title:'💍 Remove Accessories', items:['Remove watches, rings, bracelets from the limb being imaged.'] }],
  },
  dental: { label:'Dental X-Ray (OPG)', emoji:'🦷', gradient:'linear-gradient(135deg,#0369a1,#38bdf8)', accent:'#0369a1', dept:'Radiology',
    sections:[
      { title:'💍 Metal-Free Head & Neck', items:['Remove all earrings, nose pins, necklaces, hairpins, eyeglasses.','Remove dentures and retainers.'] },
      { title:'📋 During Scan', items:['Bite gently on plastic mouthpiece.','Keep tongue pressed to roof of mouth.'] },
    ],
  },
  ct: { label:'CT Scan', emoji:'🔬', gradient:'linear-gradient(135deg,#4338ca,#818cf8)', accent:'#4338ca', dept:'Radiology',
    alert:{ title:'⚠️ Contrast Dye May Be Used', body:'If using contrast, <strong>do not eat for 4–6 hours</strong>. Inform of allergies (especially iodine), kidney problems, or diabetes.' },
    sections:[
      { title:'👕 Clothing & Metal', items:['Remove all jewellery, watches, piercings.'] },
      { title:'🩺 Medical Info', items:['Tell technician if pregnant.','Mention any implants or pacemakers.'] },
    ],
  },
  mri: { label:'MRI Scan', emoji:'🧲', gradient:'linear-gradient(135deg,#4338ca,#818cf8)', accent:'#4338ca', dept:'Radiology',
    alert:{ title:'⚠️ Absolutely No Metal', body:'Remove <strong>ALL</strong> metal. Inform facility about <strong>any implants</strong> (pacemakers, metal plates, cochlear implants).' },
    sections:[
      { title:'🍽️ Fasting', items:['Most MRIs: <strong>no fasting</strong>.','Abdominal/contrast MRI: <strong>fast 4–6 hours</strong>.'] },
      { title:'🩺 Medical Info', items:['Tell technician if pregnant or claustrophobic.','Scan takes 30–60 minutes. Lie very still.'] },
    ],
  },
  us: { label:'Ultrasound', emoji:'📡', gradient:'linear-gradient(135deg,#0d9488,#5eead4)', accent:'#0d9488', dept:'Radiology',
    alert:{ title:'⚠️ Preparation Varies by Area', body:'<strong>Abdominal:</strong> Fast 6–8 hours. <strong>Pelvic:</strong> Drink ~1L water 1 hour before, do NOT urinate. <strong>Other:</strong> No special prep.' },
    sections:[{ title:'📋 What to Expect', items:['Gel applied to skin (may feel cold).','Painless, takes 15–30 minutes.'] }],
  },
}

function getPrep(service: string): TestPrep | null {
  const s = (service || '').toLowerCase()
  if (s.includes('cbc') || (s.includes('complete') && s.includes('blood'))) return BT.cbc
  if (s.includes('lipid') || s.includes('cholesterol')) return BT.lipid
  if (s.includes('thyroid') || s.includes('tft') || s.includes('tsh')) return BT.tft
  if (s.includes('sugar') || s.includes('glucose')) return BT.sugar
  if (s.includes('liver') || s.includes('lft')) return BT.lft
  if (s.includes('kidney') || s.includes('kft') || s.includes('rft')) return BT.kft
  if (s.includes('vitamin') || s.includes('b12')) return BT.vitamin
  if (s.includes('mri')) return IM.mri
  if (s.includes('ct ') || s.includes('ct scan')) return IM.ct
  if (s.includes('ultrasound') || s.includes('sonography')) return IM.us
  if (s.includes('dental') || s.includes('opg')) return IM.dental
  if (s.includes('chest')) return IM.chest
  if (s.includes('spine')) return IM.spine
  if (s.includes('abdom')) return IM.abdom
  if (s.includes('extrem') || s.includes('limb')) return IM.extrem
  if (s.includes('x-ray') || s.includes('xray')) return IM.chest
  if (s.includes('blood') || s.includes('panel')) return BT.cbc
  return null
}

// ── Multi-test support: split "CBC + Lipid Profile" → multiple preps ──────────

function getAllPreps(service: string): TestPrep[] {
  const parts = service.split(' + ').map(s => s.trim()).filter(Boolean)
  const preps: TestPrep[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const prep = getPrep(part)
    if (prep && !seen.has(prep.label)) {
      preps.push(prep)
      seen.add(prep.label)
    }
  }
  return preps
}

function buildHtml(apt: any): string {
  const preps = getAllPreps(apt.service || '')
  
  if (preps.length === 0) {
    const defaultPrep: TestPrep = {
      label:'General Consultation', emoji:'🏥', gradient:'linear-gradient(135deg,#1e40af,#3b82f6)',
      accent:'#1d4ed8', dept:'MediCare Hospital',
      sections:[
        { title:'🍽️ Fasting', items:['You may eat and drink normally.'] },
        { title:'👕 Wear', items:['Comfortable, loose-fitting clothing.'] },
        { title:'🚗 Arrival', items:['Arrive <strong>15 minutes early</strong>.'] },
      ],
    }
    const ts = new Date().toISOString()
    const sp = '&zwnj;&nbsp;'.repeat(20)
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
<div style="display:none!important;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Reminder ${ts} ${apt.patientName} ${defaultPrep.label} ${apt.date} ${apt.time} ${sp}</div>
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<div style="background:${defaultPrep.gradient};padding:32px 32px 24px;text-align:center;"><div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;padding:16px;margin-bottom:12px;"><span style="font-size:36px;">${defaultPrep.emoji}</span></div><h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${defaultPrep.label} — Tomorrow!</h1><p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Preparation checklist from MediCare Hospital</p></div>
<div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;"><h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">📋 Details</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:45%;">Test</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.service||defaultPrep.label}</td></tr><tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Doctor</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.doctorName}</td></tr><tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Date</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.date}</td></tr><tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Time</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.time}</td></tr><tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Patient</td><td style="padding:6px 0;color:#0f172a;font-size:14px;">${apt.patientName}</td></tr></table></div>
<div style="padding:24px 32px;"><h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">✅ Preparation Checklist</h2>${defaultPrep.sections.map(s => `<div style="margin-bottom:18px;"><h3 style="color:${defaultPrep.accent};font-size:14px;margin:0 0 8px;">${s.title}</h3><ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">${s.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`).join('')}<div style="margin-bottom:8px;"><h3 style="color:${defaultPrep.accent};font-size:14px;margin:0 0 8px;">📁 Documents to Carry</h3><ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;"><li>Government-issued photo ID</li><li>Insurance card and policy details</li><li>Doctor's prescription or referral</li><li>Previous reports (if any)</li></ul></div></div>
<div style="padding:16px 32px;text-align:center;background:#f8fafc;"><p style="color:#94a3b8;font-size:12px;margin:0;">MediCare Hospital · ${defaultPrep.dept} Department · Automated reminder — do not reply.</p></div>
</div></body></html>`
  }

  const primary = preps[0]
  const ts = new Date().toISOString()
  const sp = '&zwnj;&nbsp;'.repeat(20)
  const testList = preps.map(p => p.label).join(', ')

  const alerts = preps.filter(p => p.alert).map(p => p.alert!)
  const al = alerts.map(a => `<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:12px;"><strong style="color:#92400e;">${a.title}</strong><p style="color:#78350f;margin:6px 0 0;font-size:14px;">${a.body}</p></div>`).join('')

  const sc = preps.map(p => {
    const secHtml = p.sections.map(s => `<div style="margin-bottom:14px;"><h3 style="color:${p.accent};font-size:13px;margin:0 0 6px;">${s.title}</h3><ul style="color:#475569;font-size:13px;line-height:1.7;margin:0;padding-left:20px;">${s.items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`).join('')
    return `<div style="margin-bottom:20px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;"><h2 style="color:#0f172a;font-size:15px;margin:0 0 12px;">${p.emoji} ${p.label}</h2>${secHtml}</div>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
<div style="display:none!important;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Reminder ${ts} ${apt.patientName} ${testList} ${apt.date} ${apt.time} ${sp}</div>
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<div style="background:${primary.gradient};padding:32px 32px 24px;text-align:center;"><div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;padding:16px;margin-bottom:12px;"><span style="font-size:36px;">${preps.map(p=>p.emoji).join('')}</span></div><h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${preps.length > 1 ? preps.length + ' Tests' : preps[0].label} — Tomorrow!</h1><p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Combined preparation checklist from MediCare Hospital</p></div>
<div style="padding:24px 32px;background:#f8fafc;border-bottom:1px solid #e2e8f0;"><h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">📋 Details</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:35%;">Tests</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.service}</td></tr><tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Doctor</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.doctorName}</td></tr><tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Date</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.date}</td></tr><tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Time</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${apt.time}</td></tr><tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Patient</td><td style="padding:6px 0;color:#0f172a;font-size:14px;">${apt.patientName}</td></tr></table></div>
<div style="padding:24px 32px;"><h2 style="color:#1e293b;font-size:16px;margin:0 0 16px;">✅ Preparation Checklist</h2>${al}${sc}<div style="margin-bottom:8px;"><h3 style="color:${primary.accent};font-size:14px;margin:0 0 8px;">📁 Documents to Carry</h3><ul style="color:#475569;font-size:14px;line-height:1.8;margin:0;padding-left:20px;"><li>Government-issued photo ID</li><li>Insurance card and policy details</li><li>Doctor's prescription or referral</li><li>Previous reports (if any)</li></ul></div></div>
<div style="padding:16px 32px;text-align:center;background:#f8fafc;"><p style="color:#94a3b8;font-size:12px;margin:0;">MediCare Hospital · ${primary.dept} Department · Automated reminder — do not reply.</p></div>
</div></body></html>`
}

function getSubject(apt: any): string {
  const preps = getAllPreps(apt.service || '')
  if (preps.length === 0) return `⏰ Reminder: Appointment with ${apt.doctorName} — ${apt.date} at ${apt.time}`
  if (preps.length === 1) return `${preps[0].emoji} Reminder: ${preps[0].label} is tomorrow — ${apt.date} at ${apt.time}`
  return `🧪 Reminder: ${preps.length} tests (${preps.map(p => p.label).join(', ')}) tomorrow — ${apt.date} at ${apt.time}`
}

// ── Firebase Scheduled Function — daily at 6 PM IST (12:30 UTC) ───────────────

export const sendAppointmentReminders = onSchedule({
  schedule: "30 12 * * *",
  secrets: [emailUser, emailPass],
  timeoutSeconds: 540,
}, async (event) => {
  const user = emailUser.value();
  const pass = emailPass.value();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const tomorrow = new Date(istNow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const aptSnapshot = await db.collection('appointments')
    .where('date', '==', tomorrowStr)
    .where('status', '==', 'scheduled')
    .get();

  const remindersSnapshot = await db.collection('sentReminders').get();
  const sentIds = new Set<string>();
  remindersSnapshot.forEach(doc => sentIds.add(doc.data().appointmentId));

  let sentCount = 0;
  const errors: any[] = [];

  for (const doc of aptSnapshot.docs) {
    const apt = { id: doc.id, ...doc.data() } as any;
    if (!apt.patientEmail || sentIds.has(apt.id)) continue;

    try {
      await transporter.sendMail({
        from: `"MediCare Hospital" <${user}>`,
        to: apt.patientEmail,
        subject: getSubject(apt),
        html: buildHtml(apt),
      });

      await db.collection('sentReminders').doc(apt.id).set({
        appointmentId: apt.id,
        sentAt: new Date().toISOString()
      });
      sentCount++;
    } catch (err) {
      errors.push({ appointmentId: apt.id, error: String(err) });
    }
  }

  console.log(`Reminders for ${tomorrowStr}: sent=${sentCount}, errors=${errors.length}`);
  if (errors.length > 0) console.error("Errors:", errors);
});
