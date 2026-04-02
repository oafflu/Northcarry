/**
 * Microsoft 365 SMTP Email Service
 * Fallback option for sending emails via SMTP
 */

'use server'

import nodemailer from 'nodemailer'
import { getSetting } from '@/app/actions/settings'

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  fromName?: string
  replyTo?: string
  categories?: string[]
}

// Cache email config per request
let cachedEmailConfig: any = null
let configCacheTime: number = 0

async function getCachedEmailConfig() {
  if (cachedEmailConfig && (Date.now() - configCacheTime) < 60000) {
    return cachedEmailConfig
  }
  
  const { data: emailProvider } = await getSetting('email_provider')
  cachedEmailConfig = emailProvider
  configCacheTime = Date.now()
  return cachedEmailConfig
}

/**
 * Get SMTP configuration
 */
async function getSMTPConfig() {
  const config = await getCachedEmailConfig()
  
  const host = config.smtp_host || config.smtp_server_host || process.env.EMAIL_SERVER_HOST || 'smtp.office365.com'
  const port = parseInt(config.smtp_port || process.env.EMAIL_SERVER_PORT || '587')
  const user = config.smtp_user || config.smtp_username || config.smtp_email || process.env.EMAIL_SERVER_USER || ''
  const password = config.smtp_password || process.env.EMAIL_SERVER_PASSWORD || ''
  const fromEmail = config.from_email || config.smtp_from_email || process.env.EMAIL_FROM || user || 'hello@brevibrushes.com'
  const fromName = config.from_name || config.smtp_from_name || 'BREVI'
  
  if (!user || !password) {
    throw new Error('SMTP configuration is incomplete. Please configure SMTP settings in /admin/settings/email')
  }
  
  return {
    host,
    port,
    user,
    password,
    fromEmail,
    fromName,
  }
}

/**
 * Send email via Microsoft 365 SMTP
 */
export async function sendEmailViaSMTP(options: EmailOptions) {
  try {
    const smtpConfig = await getSMTPConfig()
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465, // true for 465, false for other ports
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      },
    })
    
    // Verify connection
    await transporter.verify()
    
    const toArray = Array.isArray(options.to) ? options.to : [options.to]
    const from = options.from || `${smtpConfig.fromName} <${smtpConfig.fromEmail}>`
    
    // Send email
    const result = await transporter.sendMail({
      from,
      to: toArray.join(', '),
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
      replyTo: options.replyTo,
    })
    
    return { success: true, messageId: result.messageId }
  } catch (error: any) {
    console.error('Error sending email via SMTP:', error)
    
    // Provide helpful error messages
    if (error.code === 'EAUTH' || error.message?.includes('535') || error.message?.includes('Authentication')) {
      throw new Error('SMTP Authentication Failed. Please check:\n\n1. SMTP AUTH is enabled in Microsoft 365 Admin Center\n2. Password is correct (use app password if MFA is enabled)\n3. Username matches your email address exactly')
    }
    
    throw error
  }
}

