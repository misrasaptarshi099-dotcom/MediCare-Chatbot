import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase credentials in .env.local')
  process.exit(1)
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    })
  })
}

const db = getFirestore()

async function seedDiagnostics() {
  console.log('🌱 Seeding Diagnostics Departments, Services, and Doctors...')
  try {
    const batch = db.batch()

    // 1. Departments
    const bloodTestingId = 'dept-blood-testing'
    const xrayId = 'dept-xray'

    batch.set(db.collection('departments').doc(bloodTestingId), {
      name: 'Blood Testing',
      description: 'Comprehensive blood pathology and diagnostic tests.',
      location: 'Ground Floor, Pathology Wing',
      phone: '1-800-MEDICARE-BLD'
    })

    batch.set(db.collection('departments').doc(xrayId), {
      name: 'X-Ray & Imaging',
      description: 'Advanced radiography and diagnostic imaging services.',
      location: 'Basement, Radiology Wing',
      phone: '1-800-MEDICARE-XRY'
    })

    // 2. Services (Blood Testing)
    const bloodTests = [
      { id: 'srv-bt-cbc', name: 'Complete Blood Count (CBC)', basePrice: 400, duration: 30, departmentId: bloodTestingId },
      { id: 'srv-bt-lipid', name: 'Lipid Profile (Cholesterol Panel)', basePrice: 600, duration: 30, departmentId: bloodTestingId },
      { id: 'srv-bt-tft', name: 'Thyroid Function Test (TFT/TSH)', basePrice: 500, duration: 30, departmentId: bloodTestingId },
      { id: 'srv-bt-sugar', name: 'Blood Sugar (Fasting + PP)', basePrice: 300, duration: 45, departmentId: bloodTestingId },
      { id: 'srv-bt-lft', name: 'Liver Function Test (LFT)', basePrice: 700, duration: 30, departmentId: bloodTestingId },
      { id: 'srv-bt-kft', name: 'Kidney Function Test (KFT/RFT)', basePrice: 650, duration: 30, departmentId: bloodTestingId },
      { id: 'srv-bt-vit', name: 'Vitamin D & B12 Panel', basePrice: 900, duration: 30, departmentId: bloodTestingId },
    ]

    for (const srv of bloodTests) {
      batch.set(db.collection('services').doc(srv.id), {
        ...srv,
        department: 'Blood Testing',
        description: `Standard diagnostic test for ${srv.name}`
      })
    }

    // 3. Services (X-Ray)
    const xrayTests = [
      { id: 'srv-xr-chest', name: 'Chest X-Ray (PA View)', basePrice: 500, duration: 15, departmentId: xrayId },
      { id: 'srv-xr-spine', name: 'Spine X-Ray', basePrice: 700, duration: 20, departmentId: xrayId },
      { id: 'srv-xr-abdom', name: 'Abdominal X-Ray', basePrice: 600, duration: 15, departmentId: xrayId },
      { id: 'srv-xr-extrm', name: 'Extremity X-Ray (Limbs)', basePrice: 500, duration: 15, departmentId: xrayId },
      { id: 'srv-xr-dental', name: 'Dental X-Ray (OPG)', basePrice: 800, duration: 20, departmentId: xrayId },
    ]

    for (const srv of xrayTests) {
      batch.set(db.collection('services').doc(srv.id), {
        ...srv,
        department: 'X-Ray & Imaging',
        description: `Standard imaging for ${srv.name}`
      })
    }

    // 4. Doctors / Technicians
    const doctor1Id = 'doc-priya-nair'
    batch.set(db.collection('doctors').doc(doctor1Id), {
      name: 'Dr. Priya Nair',
      specialty: 'Pathologist',
      department: 'Blood Testing',
      departmentId: bloodTestingId,
      consultationFee: 0, // tests are charged per service
      roomNumber: 'G-101',
      availability: {
        'Monday': ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM'],
        'Tuesday': ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM'],
        'Wednesday': ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM'],
        'Thursday': ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM'],
        'Friday': ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM']
      }
    })

    const doctor2Id = 'doc-amit-verma'
    batch.set(db.collection('doctors').doc(doctor2Id), {
      name: 'Dr. Amit Verma',
      specialty: 'Radiologist',
      department: 'X-Ray & Imaging',
      departmentId: xrayId,
      consultationFee: 0,
      roomNumber: 'B-05',
      availability: {
        'Monday': ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM'],
        'Wednesday': ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM'],
        'Friday': ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM'],
      }
    })

    await batch.commit()
    console.log('✅ Successfully seeded Diagnostics!')
  } catch (error) {
    console.error('❌ Error seeding diagnostics:', error)
  }
}

seedDiagnostics().then(() => process.exit(0))
