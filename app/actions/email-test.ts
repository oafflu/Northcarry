'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { 
  sendWelcomeEmail, 
  sendOrderConfirmationEmail, 
  sendShippingNotificationEmail,
  sendEmail 
} from '@/lib/email'
import { sendMarketingEmail } from '@/lib/email-marketing'

// Test email templates
export async function testEmailTemplate(
  templateType: 'welcome' | 'order_confirmation' | 'shipping_notification',
  testEmail: string
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is admin
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized. Admin access required.' }
  }

  // Validate email
  if (!testEmail || !testEmail.includes('@')) {
    return { success: false, error: 'Please provide a valid email address' }
  }

  try {
    switch (templateType) {
      case 'welcome':
        await sendWelcomeEmail(testEmail, 'Test User')
        return { success: true, message: 'Welcome email sent successfully!' }
      
      case 'order_confirmation':
        await sendOrderConfirmationEmail(
          testEmail,
          'Test User',
          'TEST-ORDER-12345',
          {
            total: '99.99',
            paymentStatus: 'Paid',
          }
        )
        return { success: true, message: 'Order confirmation email sent successfully!' }
      
      case 'shipping_notification':
        await sendShippingNotificationEmail(
          testEmail,
          'Test User',
          'TEST-ORDER-12345',
          '1Z999AA10123456784',
          'UPS'
        )
        return { success: true, message: 'Shipping notification email sent successfully!' }
      
      default:
        return { success: false, error: 'Invalid template type' }
    }
  } catch (error: any) {
    console.error('Error sending test email:', error)
    
    // Provide helpful error messages for common Microsoft 365 issues
    let errorMessage = error.message || 'Failed to send test email. Please check your email configuration.'
    
    if (error.message?.includes('EAUTH') || error.message?.includes('535') || error.message?.includes('Authentication') || error.message?.includes('Invalid login')) {
      errorMessage = `Microsoft 365 SMTP Authentication Failed.\n\n` +
        `🔴 MOST COMMON ISSUES (in order of likelihood):\n\n` +
        `1. SMTP AUTH Not Enabled (CRITICAL):\n` +
        `   - Go to Microsoft 365 Admin Center: https://admin.microsoft.com\n` +
        `   - Navigate to: Settings → Mail → POP and IMAP\n` +
        `   - Enable "SMTP AUTH" for your organization or specific mailbox\n` +
        `   - Wait 5-10 minutes for changes to propagate\n` +
        `   - This is the #1 cause of authentication failures\n\n` +
        `2. App Password Required (If MFA is enabled):\n` +
        `   - If you see MFA prompts when logging in, you MUST use an App Password\n` +
        `   - Create app password: https://mysignins.microsoft.com/security-info\n` +
        `   - Or: https://account.microsoft.com/security → App passwords\n` +
        `   - Use the app password (NOT your regular password) in SMTP settings\n\n` +
        `3. Password Incorrect:\n` +
        `   - Verify the password matches your current Microsoft 365 password\n` +
        `   - Try re-entering the password in /admin/settings/email\n` +
        `   - Check for trailing/leading spaces\n` +
        `   - If MFA is enabled, use app password instead\n\n` +
        `4. Account Status:\n` +
        `   - Ensure account is not locked (check Microsoft 365 Admin Center)\n` +
        `   - Verify account has proper licenses\n` +
        `   - Check for conditional access policies blocking SMTP\n\n` +
        `💡 Quick Fix: Enable SMTP AUTH first, then use app password if MFA is enabled.`
    }
    
    return { 
      success: false, 
      error: errorMessage
    }
  }
}

// Test Microsoft 365 SMTP connection
export async function testSMTPConnection(testEmail: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is admin
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized. Admin access required.' }
  }

  // Validate email
  if (!testEmail || !testEmail.includes('@')) {
    return { success: false, error: 'Please provide a valid email address' }
  }

  try {
    await sendEmail({
      to: testEmail,
      subject: 'BREVI Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #14b8a6;">SMTP Email Configuration Test</h2>
          <p>This is a test email to verify your SMTP configuration is working correctly.</p>
          <p>If you received this email, your SMTP settings are configured properly!</p>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            Sent from BREVI Platform at ${new Date().toLocaleString()}
          </p>
          <p style="margin-top: 20px;">Best regards,<br>The BREVI™ Team</p>
        </div>
      `,
    })
    
    return { 
      success: true, 
      message: 'SendGrid test email sent successfully! Please check your inbox (and spam folder).' 
    }
  } catch (error: any) {
    console.error('Error sending SendGrid test email:', error)
    
    // Provide helpful error messages for common SendGrid issues
    let errorMessage = error.message || 'Failed to send SendGrid test email. Please check your SendGrid configuration.'
    
    // Check for sender verification issues FIRST (most common when API key has full access)
    if (error.message?.includes('sender') || 
        error.message?.includes('verified') || 
        error.message?.includes('from') ||
        error.message?.includes('authentication') ||
        error.message?.includes('domain') ||
        error.message?.includes('unverified')) {
      errorMessage = `SendGrid sender email issue.\n\n` +
        `The email address being used may not match your verified sender in SendGrid.\n\n` +
        `Please check:\n` +
        `1. Go to SendGrid: https://app.sendgrid.com/settings/sender_auth\n` +
        `2. Verify the sender email matches EXACTLY (case-sensitive) what's configured in /admin/settings/email\n` +
        `3. If using domain authentication, ensure the domain is fully authenticated\n\n` +
        `This is required even if your API key has Full Access.`
    } 
    // Check for permission errors - but note: "not authorized" often means sender mismatch
    else if (error.message?.includes('not authorized to send mail') || 
             error.message?.includes('Mail Send') ||
             error.message?.includes('does not have permission') ||
             error.message?.includes('not authorized')) {
      errorMessage = `SendGrid "not authorized to send mail" error.\n\n` +
        `Since your API key has Full Access, this is likely a sender email mismatch:\n\n` +
        `1. Check the "From Email Address" in /admin/settings/email\n` +
        `2. Go to SendGrid: https://app.sendgrid.com/settings/sender_auth\n` +
        `3. Ensure the email in your settings EXACTLY matches a verified sender (case-sensitive)\n` +
        `4. If the sender is verified but still failing, try:\n` +
        `   - Regenerating the API key\n` +
        `   - Checking domain authentication status\n` +
        `   - Ensuring the email matches exactly (no typos, correct case)\n\n` +
        `Note: Even with Full Access API key and verified sender, the email must match exactly.`
    } 
    else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      errorMessage = `SendGrid API key is invalid or expired. Please check your API key in /admin/settings/email.`
    } 
    else if (error.message?.includes('API key is missing')) {
      errorMessage = `SendGrid API key is missing. Please configure it in /admin/settings/email.`
    }
    
    return { 
      success: false, 
      error: errorMessage
    }
  }
}


// Test Mailgun connection
export async function testMailgunConnection(testEmail: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized. Admin access required.' }
  }

  if (!testEmail || !testEmail.includes('@')) {
    return { success: false, error: 'Please provide a valid email address' }
  }

  try {
    const { sendEmail } = await import('@/lib/email-mailgun')
    await sendEmail({
      to: testEmail,
      subject: 'BREVI Mailgun Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #14b8a6;">Mailgun Email Configuration Test</h2>
          <p>This is a test email to verify your Mailgun configuration is working correctly.</p>
          <p>If you received this email, your Mailgun API settings are configured properly!</p>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            Sent from BREVI Platform at ${new Date().toLocaleString()}
          </p>
          <p style="margin-top: 20px;">Best regards,<br>The BREVI™ Team</p>
        </div>
      `,
      categories: ['test'],
    })
    
    return { 
      success: true, 
      message: 'Mailgun test email sent successfully! Please check your inbox (and spam folder).' 
    }
  } catch (error: any) {
    console.error('Error sending Mailgun test email:', error)
    
    let errorMessage = error.message || 'Failed to send Mailgun test email. Please check your Mailgun configuration.'
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      errorMessage = `Mailgun API key is invalid or expired. Please check your API key in /admin/settings/email.`
    } else if (error.message?.includes('domain') || error.message?.includes('sender')) {
      errorMessage = `Mailgun domain or sender email issue.\n\n` +
        `Please verify:\n` +
        `1. Domain is correctly configured in /admin/settings/email\n` +
        `2. Domain is verified in Mailgun dashboard\n` +
        `3. Sender email matches your domain\n\n` +
        `Error: ${error.message}`
    } else if (error.message?.includes('API key is missing')) {
      errorMessage = `Mailgun API key is missing. Please configure it in /admin/settings/email.`
    }
    
    return { 
      success: false, 
      error: errorMessage
    }
  }
}

// Diagnostic function to check email provider and configuration status
export async function diagnoseEmailConfiguration() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized. Admin access required.' }
  }

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    provider: null,
    providerStatus: 'unknown',
    mailgun: {
      configured: false,
      apiKey: { present: false, valid: false, length: 0 },
      domain: { present: false, value: '' },
      baseUrl: { present: false, value: '' },
      fromEmail: { present: false, value: '' },
      fromName: { present: false, value: '' },
      issues: [] as string[],
    },
    smtp: {
      configured: false,
      host: { present: false, value: '' },
      port: { present: false, value: '' },
      user: { present: false, value: '' },
      password: { present: false },
      fromEmail: { present: false, value: '' },
      fromName: { present: false, value: '' },
      issues: [] as string[],
    },
    recommendations: [] as string[],
  }

  try {
    // Get email provider setting
    const { getSetting } = await import('@/app/actions/settings')
    const providerResult = await getSetting('email_provider')
    
    const emailConfig = providerResult.data as any
    const provider = emailConfig?.provider || 'mailgun'
    diagnostics.provider = provider
    diagnostics.providerStatus = provider === 'smtp' ? 'Microsoft 365 SMTP' : 'Mailgun (Default)'

    // Check Mailgun configuration
    const mailgunApiKey = emailConfig?.mailgun_api_key || process.env.MAILGUN_API_KEY || process.env.EMAIL_MAILGUN_API_KEY
    const mailgunDomain = emailConfig?.mailgun_domain || process.env.MAILGUN_DOMAIN || process.env.EMAIL_MAILGUN_DOMAIN
    const mailgunBaseUrl = emailConfig?.mailgun_base_url || process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net'
    const mailgunFromEmail = emailConfig?.mailgun_from_email || emailConfig?.from_email || 'hello@brevibrushes.com'
    const mailgunFromName = emailConfig?.mailgun_from_name || emailConfig?.from_name || 'BREVI'

    diagnostics.mailgun.apiKey.present = !!mailgunApiKey && String(mailgunApiKey).trim() !== ''
    diagnostics.mailgun.apiKey.length = mailgunApiKey ? String(mailgunApiKey).trim().length : 0
    diagnostics.mailgun.apiKey.valid = diagnostics.mailgun.apiKey.length >= 20 && 
                                        mailgunApiKey !== 'null' && 
                                        mailgunApiKey !== 'undefined'

    diagnostics.mailgun.domain.present = !!mailgunDomain && String(mailgunDomain).trim() !== ''
    diagnostics.mailgun.domain.value = mailgunDomain ? String(mailgunDomain).trim() : ''

    diagnostics.mailgun.baseUrl.present = !!mailgunBaseUrl
    diagnostics.mailgun.baseUrl.value = mailgunBaseUrl ? String(mailgunBaseUrl).trim() : ''

    diagnostics.mailgun.fromEmail.present = !!mailgunFromEmail && mailgunFromEmail.includes('@')
    diagnostics.mailgun.fromEmail.value = mailgunFromEmail || ''

    diagnostics.mailgun.fromName.present = !!mailgunFromName
    diagnostics.mailgun.fromName.value = mailgunFromName || ''

    diagnostics.mailgun.configured = diagnostics.mailgun.apiKey.valid && 
                                     diagnostics.mailgun.domain.present && 
                                     diagnostics.mailgun.fromEmail.present

    // Identify Mailgun issues
    if (!diagnostics.mailgun.apiKey.present) {
      diagnostics.mailgun.issues.push('Mailgun API key is missing')
    } else if (!diagnostics.mailgun.apiKey.valid) {
      diagnostics.mailgun.issues.push('Mailgun API key appears to be invalid (too short or placeholder value)')
    }

    if (!diagnostics.mailgun.domain.present) {
      diagnostics.mailgun.issues.push('Mailgun domain is missing')
    }

    if (!diagnostics.mailgun.fromEmail.present) {
      diagnostics.mailgun.issues.push('Mailgun sender email is missing or invalid')
    }

    // Check SMTP configuration
    const smtpHost = emailConfig?.smtp_host || emailConfig?.smtp_server_host || process.env.EMAIL_SERVER_HOST || 'smtp.office365.com'
    const smtpPort = emailConfig?.smtp_port || process.env.EMAIL_SERVER_PORT || '587'
    const smtpUser = emailConfig?.smtp_user || emailConfig?.smtp_username || emailConfig?.smtp_email || process.env.EMAIL_SERVER_USER || ''
    const smtpPassword = emailConfig?.smtp_password || process.env.EMAIL_SERVER_PASSWORD || ''
    const smtpFromEmail = emailConfig?.smtp_from_email || emailConfig?.from_email || process.env.EMAIL_FROM || smtpUser || 'hello@brevibrushes.com'
    const smtpFromName = emailConfig?.smtp_from_name || emailConfig?.from_name || 'BREVI'

    diagnostics.smtp.host.present = !!smtpHost
    diagnostics.smtp.host.value = smtpHost || ''

    diagnostics.smtp.port.present = !!smtpPort
    diagnostics.smtp.port.value = smtpPort || ''

    diagnostics.smtp.user.present = !!smtpUser && smtpUser.includes('@')
    diagnostics.smtp.user.value = smtpUser || ''

    diagnostics.smtp.password.present = !!smtpPassword && String(smtpPassword).trim() !== ''

    diagnostics.smtp.fromEmail.present = !!smtpFromEmail && smtpFromEmail.includes('@')
    diagnostics.smtp.fromEmail.value = smtpFromEmail || ''

    diagnostics.smtp.fromName.present = !!smtpFromName
    diagnostics.smtp.fromName.value = smtpFromName || ''

    diagnostics.smtp.configured = diagnostics.smtp.user.present && 
                                  diagnostics.smtp.password.present && 
                                  diagnostics.smtp.fromEmail.present

    // Identify SMTP issues
    if (!diagnostics.smtp.user.present) {
      diagnostics.smtp.issues.push('SMTP username/email is missing or invalid')
    }

    if (!diagnostics.smtp.password.present) {
      diagnostics.smtp.issues.push('SMTP password is missing')
    }

    if (!diagnostics.smtp.fromEmail.present) {
      diagnostics.smtp.issues.push('SMTP sender email is missing or invalid')
    }

    // Generate recommendations
    if (provider === 'mailgun') {
      if (!diagnostics.mailgun.configured) {
        diagnostics.recommendations.push('Mailgun is selected but configuration is incomplete. Please check Mailgun settings.')
      } else {
        diagnostics.recommendations.push('Mailgun configuration appears complete. Test sending an email to verify connectivity.')
      }
    } else if (provider === 'smtp') {
      if (!diagnostics.smtp.configured) {
        diagnostics.recommendations.push('Microsoft 365 SMTP is selected but configuration is incomplete. Please check SMTP settings.')
      } else {
        diagnostics.recommendations.push('SMTP configuration appears complete. Test sending an email to verify connectivity.')
        diagnostics.recommendations.push('Ensure SMTP AUTH is enabled in Microsoft 365 Admin Center.')
        diagnostics.recommendations.push('If MFA is enabled, use an App Password instead of your regular password.')
      }
    }

    // Overall status
    if (provider === 'mailgun' && diagnostics.mailgun.configured) {
      diagnostics.providerStatus = 'Mailgun - Configured ✓'
    } else if (provider === 'mailgun' && !diagnostics.mailgun.configured) {
      diagnostics.providerStatus = 'Mailgun - Configuration Incomplete ✗'
    } else if (provider === 'smtp' && diagnostics.smtp.configured) {
      diagnostics.providerStatus = 'Microsoft 365 SMTP - Configured ✓'
    } else if (provider === 'smtp' && !diagnostics.smtp.configured) {
      diagnostics.providerStatus = 'Microsoft 365 SMTP - Configuration Incomplete ✗'
    }

    return {
      success: true,
      diagnostics,
    }
  } catch (error: any) {
    console.error('Error diagnosing email configuration:', error)
    return {
      success: false,
      error: error.message || 'Failed to diagnose email configuration',
      diagnostics,
    }
  }
}
