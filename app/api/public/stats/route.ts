export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { db } from '@/lib/firestore'

/**
 * GET /api/public/stats
 *
 * Public endpoint that returns ONLY aggregate counts — no PII, no record details.
 * This is used by the landing page stats strip to show real numbers instead of
 * hardcoded values.
 *
 * Security:
 * - Returns ONLY counts (numbers), never any patient/doctor identifiable data
 * - Uses Firestore count() aggregation which is cheaper than fetching documents
 * - No authentication required since this is purely public catalog metadata
 * - Rate limiting is handled by the hosting layer (Vercel/Firebase)
 */
export async function GET() {
  try {
    const [doctorsSnap, insuranceSnap, servicesSnap] = await Promise.all([
      db.collection('doctors').count().get(),
      db.collection('insurancePartners').count().get(),
      db.collection('services').count().get(),
    ])

    return NextResponse.json({
      doctors: doctorsSnap.data().count,
      insurers: insuranceSnap.data().count,
      services: servicesSnap.data().count,
    }, {
      headers: {
        // Cache for 5 minutes — these counts change very rarely
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    })
  } catch (error) {
    console.error('Error fetching public stats:', error)
    // Return safe fallbacks — never expose error details to the public
    return NextResponse.json({
      doctors: 0,
      insurers: 0,
      services: 0,
    })
  }
}
