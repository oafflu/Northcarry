/**
 * Mailgun Email Service
 * Handles all email sending via Mailgun API
 */

'use server'

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
  campaignId?: string
}

// Cache email config per request (60 second TTL)
let cachedEmailConfig: any = null
let configCacheTime: number = 0

async function getCachedEmailConfig() {
  // Check if cache is valid (exists, has content, and not expired)
  const hasValidCache = cachedEmailConfig && 
    typeof cachedEmailConfig === 'object' && 
    Object.keys(cachedEmailConfig).length > 0 &&
    (Date.now() - configCacheTime) < 60000
  
  if (hasValidCache) {
    return cachedEmailConfig
  }
  
  // Fetch fresh config from database
  try {
    const { data: emailProvider, error: settingError } = await getSetting('email_provider')
    
    if (settingError) {
      // Don't log network/database errors as errors if they're transient
      if (settingError.includes('Database connection error') || settingError.includes('500 Internal Server Error')) {
        console.warn('[Email Config] Database connection issue, will use environment variables:', settingError)
      } else {
        console.error('[Email Config] Error fetching email_provider setting:', settingError)
      }
      // Return empty object to fall back to environment variables
      return {}
    }
  
    // Parse setting_value if it's a JSON string
    let parsedConfig: any = null
    if (emailProvider) {
      if (typeof emailProvider === 'string') {
        try {
          parsedConfig = JSON.parse(emailProvider)
        } catch (e) {
          console.error('[Email Config] Failed to parse email_provider as JSON:', e)
          // If parsing fails, treat as invalid
          parsedConfig = null
        }
      } else if (typeof emailProvider === 'object') {
        parsedConfig = emailProvider
      }
    } else {
      console.warn('[Email Config] email_provider setting is null or undefined')
    }
    
    // Only cache if we got a valid config with actual data
    if (parsedConfig && typeof parsedConfig === 'object' && Object.keys(parsedConfig).length > 0) {
      cachedEmailConfig = parsedConfig
      configCacheTime = Date.now()
      console.log('[Email Config] Successfully loaded and cached email provider config')
      return cachedEmailConfig
    }
    
    // If no config found, clear cache and return empty object
    // Don't cache empty object so next call will try again
    console.warn('[Email Config] No valid email provider config found, will fallback to environment variables')
    cachedEmailConfig = null
    configCacheTime = 0
    return {}
  } catch (err: any) {
    // Handle any unexpected errors during config fetch
    console.warn('[Email Config] Unexpected error fetching config, will use environment variables:', err?.message || err)
    cachedEmailConfig = null
    configCacheTime = 0
    return {}
  }
}

/**
 * Get Mailgun API key from configuration
 */
async function getMailgunApiKey(): Promise<string> {
  const config = await getCachedEmailConfig()
  
  if (!config || typeof config !== 'object') {
    // Fallback to environment variables if config is null/undefined
    const envApiKey = process.env.MAILGUN_API_KEY || process.env.EMAIL_MAILGUN_API_KEY
    if (envApiKey && envApiKey.trim().length >= 20) {
      return envApiKey.trim()
    }
    throw new Error('Mailgun API key is missing or invalid. Please configure it in /admin/settings/email.')
  }
  
  const rawApiKey = (config && config.mailgun_api_key && String(config.mailgun_api_key).trim() !== '') 
    ? config.mailgun_api_key 
    : (process.env.MAILGUN_API_KEY || process.env.EMAIL_MAILGUN_API_KEY)
  
  const apiKey = rawApiKey ? String(rawApiKey).trim() : null
  
  if (!apiKey || apiKey.length === 0 || apiKey === 'null' || apiKey === 'undefined' || apiKey.length < 20) {
    throw new Error('Mailgun API key is missing or invalid. Please configure it in /admin/settings/email.')
  }
  
  return apiKey
}

/**
 * Get Mailgun domain from configuration
 */
async function getMailgunDomain(): Promise<string> {
  const config = await getCachedEmailConfig()
  
  if (!config || typeof config !== 'object') {
    // Fallback to environment variables if config is null/undefined
    const envDomain = process.env.MAILGUN_DOMAIN || process.env.EMAIL_MAILGUN_DOMAIN
    if (envDomain && envDomain.trim() !== '') {
      return envDomain.trim()
    }
    throw new Error('Mailgun domain is missing. Please configure it in /admin/settings/email.')
  }
  
  const domain = (config && config.mailgun_domain && String(config.mailgun_domain).trim() !== '') 
    ? config.mailgun_domain 
    : (process.env.MAILGUN_DOMAIN || process.env.EMAIL_MAILGUN_DOMAIN)
  
  if (!domain || domain.trim() === '') {
    throw new Error('Mailgun domain is missing. Please configure it in /admin/settings/email.')
  }
  
  return domain.trim()
}

/**
 * Get Mailgun base URL from configuration
 */
async function getMailgunBaseUrl(): Promise<string> {
  const config = await getCachedEmailConfig()
  
  if (!config || typeof config !== 'object') {
    // Fallback to environment variables or default if config is null/undefined
    return (process.env.MAILGUN_BASE_URL || process.env.EMAIL_MAILGUN_BASE_URL || 'https://api.mailgun.net').trim()
  }
  
  const baseUrl = (config && config.mailgun_base_url && String(config.mailgun_base_url).trim() !== '') 
    ? config.mailgun_base_url 
    : (process.env.MAILGUN_BASE_URL || process.env.EMAIL_MAILGUN_BASE_URL || 'https://api.mailgun.net')
  
  return baseUrl.trim()
}

/**
 * Send email via Mailgun
 */
export async function sendEmail(options: EmailOptions) {
  try {
    const config = await getCachedEmailConfig()
    const apiKey = await getMailgunApiKey()
    const domain = await getMailgunDomain()
    const baseUrl = await getMailgunBaseUrl()
    
    const toArray = Array.isArray(options.to) ? options.to : [options.to]
    const fromEmail = options.from || (config && config.mailgun_from_email) || (config && config.from_email) || process.env.EMAIL_FROM || 'hello@brevibrushes.com'
    const fromName = options.fromName || (config && config.mailgun_from_name) || (config && config.from_name) || 'BREVI'
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail
    
    // Build Mailgun API URL
    const mailgunUrl = `${baseUrl}/v3/${domain}/messages`
    
    // Prepare form data for Mailgun
    const formData = new FormData()
    formData.append('from', from)
    formData.append('subject', options.subject)
    formData.append('html', options.html)
    
    if (options.text) {
      formData.append('text', options.text)
    }
    
    // Add recipients
    toArray.forEach(email => {
      formData.append('to', email)
    })
    
    if (options.replyTo) {
      formData.append('h:Reply-To', options.replyTo)
    }
    
    // Add tags/categories
    if (options.categories && options.categories.length > 0) {
      options.categories.forEach(tag => {
        formData.append('o:tag', tag)
      })
    }
    
    // Add campaign ID as tag if provided
    if (options.campaignId) {
      formData.append('o:tag', `campaign_${options.campaignId}`)
      formData.append('o:tag', 'campaign')
      // Webhooks can read this header to attribute events to a campaign
      formData.append('h:X-Campaign-Id', options.campaignId)
    }
    
    // Add custom variables for tracking
    if (options.campaignId) {
      formData.append('v:campaign_id', options.campaignId)
    }
    
    // Send request to Mailgun
    const response = await fetch(mailgunUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      },
      body: formData,
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Mailgun API error: ${response.status} ${response.statusText}`
      let isRateLimit = false
      
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.message) {
          errorMessage = `Mailgun API error: ${errorData.message}`
          
          // Check for rate limit errors
          if (response.status === 429 || 
              errorData.message.toLowerCase().includes('rate limit') ||
              errorData.message.toLowerCase().includes('too many requests') ||
              errorData.message.toLowerCase().includes('quota') ||
              errorData.message.toLowerCase().includes('daily limit')) {
            isRateLimit = true
            errorMessage = `Mailgun rate limit or daily limit reached: ${errorData.message}`
          } else if (response.status === 401 || response.status === 403) {
            errorMessage = `Mailgun API key is invalid or expired. Please check your API key in /admin/settings/email. Error: ${errorData.message}`
          } else if (errorData.message.includes('domain') || errorData.message.includes('sender')) {
            errorMessage = `Mailgun domain or sender email issue. Please verify:\n\n` +
              `1. Domain: ${domain}\n` +
              `2. Sender email: ${fromEmail}\n` +
              `3. Domain verification in Mailgun dashboard\n\n` +
              `Error: ${errorData.message}`
          }
        }
      } catch (e) {
        if (errorText) {
          errorMessage = `Mailgun API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`
          // Check status code for rate limit
          if (response.status === 429) {
            isRateLimit = true
            errorMessage = `Mailgun rate limit reached (429)`
          }
        }
      }
      
      console.error('[sendEmailViaMailgun] Mailgun API error details:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
        apiKeyPrefix: apiKey ? apiKey.substring(0, 5) + '...' : 'missing',
        domain,
        fromEmail,
        fromName,
        isRateLimit,
      })
      
      // Create a custom error with rate limit flag
      const error = new Error(errorMessage) as any
      error.isRateLimit = isRateLimit
      error.statusCode = response.status
      throw error
    }
    
    const result = await response.json()
    return { success: true, messageId: result.id || `mailgun-${Date.now()}` }
  } catch (error: any) {
    console.error('Error sending email via Mailgun:', error)
    throw error
  }
}

/**
 * Send bulk emails via Mailgun with personalization
 */
export async function sendBulkEmails(
  recipients: string[],
  subject: string,
  html: string,
  options?: {
    batchSize?: number
    delayBetweenBatches?: number
    dailyLimit?: number
    onProgress?: (sent: number, total: number, remaining: number) => void
    campaignId?: string
    recipientDataMap?: Map<string, { firstName?: string; lastName?: string; name?: string; [key: string]: any }>
  }
) {
  try {
    const apiKey = await getMailgunApiKey()
    const domain = await getMailgunDomain()
    
    if (!apiKey || apiKey.length < 20) {
      throw new Error('Mailgun API key is missing or invalid. Bulk emails cannot be sent without a valid Mailgun API key.')
    }
    
    // Warmed-up sender: 5000 per batch (3000 if personalization), 10-minute intervals
    const DEFAULT_BATCH_SIZE = 5000
    const DEFAULT_DELAY_MINUTES = 10
    const DEFAULT_DELAY_MS = DEFAULT_DELAY_MINUTES * 60 * 1000
    
    const batchSize = options?.batchSize || DEFAULT_BATCH_SIZE
    const delayBetweenBatches = options?.delayBetweenBatches || DEFAULT_DELAY_MS
    const total = recipients.length
    let sent = 0
    const errors: string[] = []
    
    const batchesToProcess = Math.ceil(total / batchSize)
    const delayMinutes = Math.round(delayBetweenBatches / 60000)
    
    console.log(`[Mailgun Bulk Send] Processing ${total} recipients in ${batchesToProcess} batches of ${batchSize} with ${delayMinutes}-minute intervals`)
    
    // Check if template needs personalization (contains template variables)
    const needsPersonalization = html.includes('{{firstName') || html.includes('{{name') || subject.includes('{{firstName') || subject.includes('{{name')
    
    // Import template utilities if personalization is needed
    let templateReplaceFn: any = null
    if (needsPersonalization) {
      try {
        const templateUtils = await import('./email-template-utils')
        templateReplaceFn = templateUtils.replaceTemplateVariables
        console.log(`[Mailgun Bulk Send] Personalization enabled for ${total} recipients`)
      } catch (error) {
        console.error('[Mailgun Bulk Send] Error importing template utilities:', error)
        // Continue without personalization
      }
    }
    
    for (let i = 0; i < batchesToProcess; i++) {
      const startIdx = i * batchSize
      const endIdx = Math.min(startIdx + batchSize, total)
      const batch = recipients.slice(startIdx, endIdx)
      
      try {
        if (needsPersonalization && options?.recipientDataMap && templateReplaceFn) {
          // Personalize each email individually
          console.log(`[Mailgun Bulk Send] Personalizing ${batch.length} emails in batch ${i + 1}...`)
          
          // Process in smaller sub-batches to avoid overwhelming the system
          // For personalized emails, use smaller batches to avoid timeouts
          const subBatchSize = 100 // Send 100 personalized emails at a time (increased from 50 for better performance)
          for (let j = 0; j < batch.length; j += subBatchSize) {
            const subBatch = batch.slice(j, j + subBatchSize)
            
            const personalizedEmails = await Promise.all(
              subBatch.map(async (email) => {
                try {
                  const recipientData = options.recipientDataMap?.get(email.toLowerCase()) || { email }
                  const personalizedHtml = templateReplaceFn(html, { ...recipientData, email })
                  const personalizedSubject = templateReplaceFn(subject, { ...recipientData, email })
                  
                  const result = await sendEmail({
                    to: email,
                    subject: personalizedSubject,
                    html: personalizedHtml,
                    categories: ['campaign'],
                    campaignId: options?.campaignId,
                  })
                  
                  return { success: true, email, result }
                } catch (error: any) {
                  console.error(`[Mailgun Bulk Send] Error personalizing email to ${email}:`, error.message)
                  return { success: false, email, error: error.message }
                }
              })
            )
            
            // Count successful sends
            const successful = personalizedEmails.filter(r => r.success).length
            sent += successful
            
            // Track failures
            personalizedEmails.forEach((result) => {
              if (!result.success) {
                errors.push(`Failed to send to ${result.email}: ${result.error}`)
              }
            })
            
            console.log(`[Mailgun Bulk Send] Sub-batch ${Math.floor(j/subBatchSize) + 1}: ${successful}/${subBatch.length} sent successfully`)
          }
        } else {
          // Send batch without personalization (faster)
          console.log(`[Mailgun Bulk Send] Sending batch ${i + 1} without personalization (${batch.length} emails)...`)
          await sendEmail({
            to: batch,
            subject,
            html,
            categories: ['campaign'],
            campaignId: options?.campaignId,
          })
          sent += batch.length
          console.log(`[Mailgun Bulk Send] Batch ${i + 1} sent successfully (${sent}/${total} total)`)
        }
        
        const progressPercent = Math.round((sent/total)*100)
        console.log(`[Mailgun Bulk Send] Batch ${i + 1}/${batchesToProcess}: Sent ${sent}/${total} emails (${progressPercent}%)`)
        
        // Check for Mailgun rate limit errors (429) or daily limit
        // If we hit a limit, stop and return needsResume
        if (i < batchesToProcess - 1) {
          console.log(`[Mailgun Bulk Send] Waiting ${delayMinutes} minutes before next batch...`)
        }
      } catch (error: any) {
        console.error(`[Mailgun Bulk Send] Error sending batch ${i + 1}:`, error)
        
        // Check if it's a rate limit or daily limit error
        const errorMessage = error.message?.toLowerCase() || ''
        const statusCode = error.statusCode || 0
        const isRateLimit = error.isRateLimit || 
                          statusCode === 429 ||
                          errorMessage.includes('rate limit') || 
                          errorMessage.includes('429') ||
                          errorMessage.includes('too many requests') ||
                          errorMessage.includes('daily limit') ||
                          errorMessage.includes('quota')
        
        if (isRateLimit) {
          console.log(`[Mailgun Bulk Send] Rate limit or daily limit hit at batch ${i + 1} (sent: ${sent}). Stopping and marking for resume.`)
          errors.push(`Batch ${i + 1}: Rate limit hit - ${error.message}`)
          
          // Return with needsResume flag and remaining recipients
          const remainingRecipients = recipients.slice(sent)
          console.log(`[Mailgun Bulk Send] Marking campaign for resume. Sent: ${sent}/${total}, Remaining: ${remainingRecipients.length}`)
          
          return {
            success: false,
            sent,
            total,
            errors: errors.slice(0, 10),
            needsResume: true,
            remainingRecipients,
          }
        }
        
        errors.push(`Batch ${i + 1}: ${error.message}`)
        
        // If too many errors, stop processing
        if (errors.length > 10) {
          console.error(`[Mailgun Bulk Send] Too many errors (${errors.length}). Stopping.`)
          const remainingRecipients = recipients.slice(sent)
          return {
            success: false,
            sent,
            total,
            errors: errors.slice(0, 10),
            needsResume: true,
            remainingRecipients,
          }
        }
      }
      
      if (options?.onProgress) {
        const remaining = total - sent
        options.onProgress(sent, total, remaining)
      }
      
      if (i < batchesToProcess - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
    }
    
    return {
      success: errors.length === 0,
      sent,
      total,
      errors: errors.slice(0, 10),
      needsResume: false,
      remainingRecipients: [],
    }
  } catch (error: any) {
    console.error('Error in sendBulkEmails:', error)
    throw error
  }
}

