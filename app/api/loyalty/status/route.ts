import { NextResponse } from 'next/server'
import { isLoyaltyProgramEnabled } from '@/app/actions/loyalty'

export async function GET() {
  try {
    const status = await isLoyaltyProgramEnabled()
    return NextResponse.json(status)
  } catch (error: any) {
    console.error('Error checking loyalty status:', error)
    return NextResponse.json({ enabled: false, showInAccount: false })
  }
}
