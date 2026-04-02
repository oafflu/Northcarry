import { NextRequest, NextResponse } from 'next/server'
import { processOneBatch } from '@/lib/email-campaigns-process-batch'

/**
 * Process ONE batch for a campaign and update sent_count.
 * Called by: client after "Send" / "Resume", and by cron every run to advance sending.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const campaignId = body.campaignId || (request.nextUrl && new URL(request.url).searchParams.get('campaignId'))
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })
    }

    const result = await processOneBatch(campaignId)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Process batch failed' },
        { status: result.error === 'Campaign not found' ? 404 : 400 }
      )
    }
    return NextResponse.json({
      success: true,
      sent: result.sent,
      total: result.total,
      done: result.done,
    })
  } catch (error: any) {
    console.error('[process-batch] Error:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Process batch failed' },
      { status: 500 }
    )
  }
}
