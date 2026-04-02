import { NextResponse } from 'next/server'

/**
 * Chat widget has been completely removed from the project.
 * This endpoint exists only to handle cached client-side requests
 * and prevent 404 errors in logs. It returns that the widget is disabled.
 * 
 * This stub can be removed after browser caches expire (typically 30-90 days).
 */
export async function GET() {
  return NextResponse.json({ 
    enabled: false,
    message: 'Chat widget has been removed from the project' 
  }, { status: 200 })
}
