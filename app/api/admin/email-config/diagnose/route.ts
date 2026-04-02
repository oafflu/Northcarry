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
    
    // SMTP Configuration
    const smtpUser = config.smtp_user || config.smtp_username || process.env.EMAIL_SERVER_USER
    const smtpPassword = config.smtp_password || process.env.EMAIL_SERVER_PASSWORD
    const smtpConfigured = !!(smtpUser && smtpPassword)
    
    // Mailgun Configuration (default for all emails)
    const useMailgun = config.provider === 'mailgun' || !config.provider
    const mailgunApiKey = config.mailgun_api_key || process.env.MAILGUN_API_KEY || process.env.EMAIL_MAILGUN_API_KEY
    const hasMailgunApiKey = !!(mailgunApiKey && mailgunApiKey.trim().length > 0)
    const mailgunFromEmail = config.mailgun_from_email || config.from_email || 'hello@brevibrushes.com'
    
    return NextResponse.json({
      success: true,
      clarification: {
        mailgunVs365: "Mailgun and Microsoft 365 are SEPARATE systems. Mailgun emails don't count against Microsoft 365's 10,000/day limit.",
        mailgunInfrastructure: "Mailgun uses its own email servers, not Microsoft 365's infrastructure.",
        senderEmailPurpose: "The sender email (hello@brevibrushes.com) is only used as the 'From' address in Mailgun - it doesn't use Microsoft 365 to send.",
      },
      mailgun: {
        enabled: useMailgun,
        apiKeySet: hasMailgunApiKey,
        apiKeyLength: mailgunApiKey ? mailgunApiKey.trim().length : 0,
        domain: config.mailgun_domain || 'not set',
        fromEmail: mailgunFromEmail,
        fromName: config.mailgun_from_name || config.from_name || 'BREVI',
        configured: useMailgun && hasMailgunApiKey,
        dailyLimit: "100,000+ emails/day (Mailgun plan)",
        usage: "All emails (system, transactional, marketing, automations)",
        infrastructure: "Mailgun's own email servers (NOT Microsoft 365)",
      },
      smtp: {
        enabled: config.provider === 'smtp',
        configured: smtpConfigured,
        user: smtpUser || 'not set',
        passwordSet: !!smtpPassword,
        host: config.smtp_host || config.smtp_server_host || 'smtp.office365.com',
        port: config.smtp_port || '587',
        fromEmail: config.smtp_from_email || config.from_email || 'not set',
        dailyLimit: "10,000 emails/day (Microsoft 365 standard plan)",
        usage: "Fallback option for all emails (if Mailgun is not configured)",
      },
      recommendations: {
        mailgun: !hasMailgunApiKey ? 'Configure Mailgun API key in /admin/settings/email (recommended)' : null,
        smtp: config.provider === 'smtp' && !smtpConfigured ? 'Configure SMTP settings in /admin/settings/email' : null,
        mailgunDomain: hasMailgunApiKey && !config.mailgun_domain ? 'Configure Mailgun domain in /admin/settings/email' : null,
        troubleshooting: "Mailgun is the default provider. SMTP is available as a fallback option.",
      },
    })
  } catch (error: any) {
    console.error('Error diagnosing email config:', error)
    return NextResponse.json({
      error: error.message || 'Failed to diagnose email configuration',
    }, { status: 500 })
  }
}

