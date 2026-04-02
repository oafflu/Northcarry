import { NextRequest, NextResponse } from 'next/server'
import { getSetting } from '@/app/actions/settings'

export async function GET(request: NextRequest) {
  try {
    const { data: emailProvider } = await getSetting('email_provider')
    
    if (!emailProvider) {
      return NextResponse.json({
        error: 'Email provider not configured',
        config: null,
      })
    }

    const config = emailProvider as any
    
    // Check Mailgun configuration (default)
    const useMailgun = config.provider === 'mailgun' || !config.provider
    const mailgunApiKey = config.mailgun_api_key || process.env.MAILGUN_API_KEY || process.env.EMAIL_MAILGUN_API_KEY
    const hasMailgunApiKey = !!(mailgunApiKey && mailgunApiKey.trim().length > 0)
    
    // Check SMTP configuration (fallback)
    const useSMTP = config.provider === 'smtp'
    const smtpUser = config.smtp_user || config.smtp_username || process.env.EMAIL_SERVER_USER
    const smtpPassword = config.smtp_password || process.env.EMAIL_SERVER_PASSWORD
    const smtpConfigured = !!(smtpUser && smtpPassword)
    
    // Return diagnostic info (mask API key for security)
    return NextResponse.json({
      success: true,
      config: {
        provider: config.provider || 'mailgun',
        useMailgun,
        hasMailgunApiKeyField: !!config.mailgun_api_key,
        hasMailgunDomain: !!config.mailgun_domain,
        hasEnvMailgunKey: !!(process.env.MAILGUN_API_KEY || process.env.EMAIL_MAILGUN_API_KEY),
        mailgunApiKeyLength: mailgunApiKey ? mailgunApiKey.trim().length : 0,
        mailgunApiKeyPrefix: mailgunApiKey ? mailgunApiKey.trim().substring(0, 3) + '...' : 'none',
        hasMailgunApiKey,
        actuallyUseMailgun: useMailgun && hasMailgunApiKey,
        useSMTP,
        smtpConfigured,
      },
    })
  } catch (error: any) {
    console.error('Error getting email config:', error)
    return NextResponse.json({
      error: error.message || 'Failed to get email configuration',
    }, { status: 500 })
  }
}

