'use server'

// Unified Email Service - Uses Mailgun (default) or Microsoft 365 SMTP (fallback)
import { sendEmail as sendEmailViaMailgun } from './email-mailgun'
import { getSetting } from '@/app/actions/settings'

// Utility function to ensure URLs use production domain, not localhost
function normalizeUrl(url: string): string {
  if (!url) return url
  
  const productionUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  
  // Replace localhost URLs with production URL - handle full URLs and query parameters
  const localhostPatterns = [
    /https?:\/\/localhost:\d+/gi,
    /https?:\/\/127\.0\.0\.1:\d+/gi,
    /https?:\/\/0\.0\.0\.0:\d+/gi,
  ]
  
  let normalizedUrl = url
  
  // First, check if the main URL contains localhost
  for (const pattern of localhostPatterns) {
    if (pattern.test(normalizedUrl)) {
      try {
        // Parse the URL to extract path and query
        const urlObj = new URL(normalizedUrl)
        const pathAndQuery = urlObj.pathname + urlObj.search + urlObj.hash
        // Reconstruct with production URL
        normalizedUrl = productionUrl + pathAndQuery
      } catch (e) {
        // If URL parsing fails, do simple string replacement
        normalizedUrl = normalizedUrl.replace(pattern, productionUrl)
      }
      break
    }
  }
  
  // Also check and replace localhost URLs in query parameters (e.g., redirect_to=http://localhost:3000)
  // This handles both URL-encoded and plain localhost URLs in query params
  try {
    const urlObj = new URL(normalizedUrl)
    const searchParams = new URLSearchParams(urlObj.search)
    let needsUpdate = false
    
    // Check all query parameters for localhost URLs
    for (const [key, value] of searchParams.entries()) {
      // Decode the value to check for localhost (handles URL-encoded values)
      const decodedValue = decodeURIComponent(value)
      let updatedValue = value
      
      for (const pattern of localhostPatterns) {
        if (pattern.test(decodedValue)) {
          // Replace localhost in the query parameter value
          updatedValue = decodedValue.replace(pattern, productionUrl)
          // Re-encode if needed
          searchParams.set(key, updatedValue)
          needsUpdate = true
          break
        }
      }
    }
    
    if (needsUpdate) {
      urlObj.search = searchParams.toString()
      normalizedUrl = urlObj.toString()
    }
  } catch (e) {
    // If URL parsing fails, try regex replacement on the entire string for query params
    // This handles cases where localhost appears in query parameter values
    for (const pattern of localhostPatterns) {
      // Replace localhost in query parameter values (handles both encoded and plain)
      // Pattern: (?&)param=value where value contains localhost
      normalizedUrl = normalizedUrl.replace(
        new RegExp(`([?&][^=]*=)([^&]*)${pattern.source.replace(/\\/g, '')}([^&]*)`, 'gi'),
        (match, param, before, after) => {
          return param + before + productionUrl + after
        }
      )
    }
  }
  
  return normalizedUrl
}

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  fromName?: string
  replyTo?: string
}

// Unified Email Service - Supports both SendGrid and Mailgun
// Routes to the appropriate provider based on configuration

// Cache provider config
let cachedProvider: string | null = null
let providerCacheTime: number = 0

// FORCE ALL EMAILS TO USE MAILGUN - No SMTP fallback
// All emails in the system must use Mailgun configuration
export async function sendEmail(options: EmailOptions) {
  // Always use Mailgun - no provider selection, no SMTP fallback
  try {
    return await sendEmailViaMailgun({
      ...options,
      categories: ['system', ...(options.categories || [])],
    })
  } catch (error: any) {
    // Log detailed error information for debugging
    console.error('[sendEmail] Failed to send email via Mailgun:', {
      error: error?.message || error,
      stack: error?.stack,
      to: options.to,
      subject: options.subject,
      timestamp: new Date().toISOString(),
    })
    // Re-throw the error so callers can handle it
    throw error
  }
}

// Send welcome email (for customers)
export async function sendWelcomeEmail(to: string, name: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to BREVI</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Welcome to BREVI!</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Thank you for joining BREVI! We're excited to have you as part of our community.</p>
        <p>Start exploring our premium toothbrushes and discover why thousands of customers trust BREVI for their oral care.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Shop Now</a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: 'Welcome to BREVI!',
    html,
  })
}

// Send admin account creation email
export async function sendAdminWelcomeEmail(to: string, name: string, password: string, loginUrl: string) {
  // Normalize login URL to use production domain
  const normalizedLoginUrl = normalizeUrl(loginUrl)
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your BREVI Admin Account</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Your BREVI Admin Account Has Been Created</h1>
        </div>
        <p>Hi ${name},</p>
        <p>An admin account has been created for you on the BREVI platform. You can now access the admin dashboard to manage products, orders, customers, and more.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Login Credentials</h3>
          <p><strong>Email:</strong> ${to}</p>
          <p><strong>Temporary Password:</strong> ${password}</p>
          <p style="color: #d32f2f; font-size: 14px;"><strong>⚠️ Please change your password after first login for security.</strong></p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${normalizedLoginUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Access Admin Dashboard</a>
        </div>
        <p>If you have any questions or need assistance, please contact the BREVI support team.</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: 'Your BREVI Admin Account',
    html,
  })
}

// Send supplier account creation email
export async function sendSupplierWelcomeEmail(to: string, name: string, companyName: string | null, password: string, loginUrl: string) {
  // Normalize login URL to use production domain
  const normalizedLoginUrl = normalizeUrl(loginUrl)
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your BREVI Supplier Account</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Your BREVI Supplier Account Has Been Created</h1>
        </div>
        <p>Hi ${name}${companyName ? ` (${companyName})` : ''},</p>
        <p>A supplier account has been created for you on the BREVI platform. You can now access the supplier portal to manage your inventory, fulfill orders, process returns, and track your performance.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Your Login Credentials</h3>
          <p><strong>Email:</strong> ${to}</p>
          <p><strong>Temporary Password:</strong> ${password}</p>
          <p style="color: #d32f2f; font-size: 14px;"><strong>⚠️ Please change your password after first login for security.</strong></p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${normalizedLoginUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Access Supplier Portal</a>
        </div>
        <p><strong>What you can do in the Supplier Portal:</strong></p>
        <ul>
          <li>Manage your product inventory and stock levels</li>
          <li>View and fulfill customer orders assigned to you</li>
          <li>Process returns and manage refunds</li>
          <li>Track your performance metrics</li>
          <li>Contact our support team via email</li>
        </ul>
        <p>If you have any questions or need assistance, please contact the BREVI support team.</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: 'Your BREVI Supplier Account',
    html,
  })
}

// Send order confirmation email
export async function sendOrderConfirmationEmail(
  to: string,
  name: string,
  orderNumber: string,
  orderDetails: any
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation - ${orderNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Order Confirmation</h1>
          <p style="font-size: 18px; font-weight: bold;">Order #${orderNumber}</p>
        </div>
        <p>Thank you for your purchase!</p>
        <p>Hi ${name}, we're getting your order ready to be shipped. We will notify you when it has been sent. Use the discount code <strong>Back-Again</strong> for 10% off your next order with us!</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p style="margin-top: 0; font-weight: bold;">Please note:</p>
          <p style="margin: 12px 0 0 0;"><strong>1. Shipping:</strong> Order processing will take 1-3 business days (Monday-Friday). Once shipped, your order will take 2-4 weeks to be delivered.</p>
          <p style="margin: 12px 0 0 0;"><strong>2. Weekend orders:</strong> Any orders made on Saturday or Sunday will be processed within the following next 3 business days.</p>
        </div>
        
        ${orderDetails.items && orderDetails.items.length > 0 ? `
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${orderDetails.items.map((item: any) => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px 0;">
                  <strong>${item.product_title || 'Product'}</strong>
                  ${item.variant_color ? `<br><span style="color: #666; font-size: 14px;">Color: ${item.variant_color}</span>` : ''}
                  ${item.sku ? `<br><span style="color: #666; font-size: 14px;">SKU: ${item.sku}</span>` : ''}
                  ${item.purchase_type && item.purchase_type !== 'one-time' ? `
                    <br><span style="background-color: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-block; margin-top: 4px;">
                      ${item.purchase_type === 'subscription' ? 'Ongoing Subscription' : item.purchase_type === 'prepaid' ? 'Prepaid Subscription' : item.purchase_type}
                    </span>
                  ` : ''}
                </td>
                <td style="padding: 10px 0; text-align: right; vertical-align: top;">
                  <div>Qty: ${item.quantity}</div>
                  <div style="font-weight: bold; margin-top: 4px;">$${parseFloat(item.line_total || '0').toFixed(2)}</div>
                </td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Summary</h3>
          ${orderDetails.subtotal ? `<p><strong>Subtotal:</strong> $${orderDetails.subtotal}</p>` : ''}
          ${parseFloat(orderDetails.discountAmount || '0') > 0 ? `<p><strong>Discount:</strong> -$${orderDetails.discountAmount}</p>` : ''}
          ${parseFloat(orderDetails.shippingCost || '0') > 0 ? `<p><strong>Shipping:</strong> $${orderDetails.shippingCost}</p>` : ''}
          ${parseFloat(orderDetails.taxAmount || '0') > 0 ? `<p><strong>Tax:</strong> $${orderDetails.taxAmount}</p>` : ''}
          <p style="font-size: 18px; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 2px solid #ddd;"><strong>Total:</strong> $${orderDetails.total}</p>
          <p style="margin-top: 10px;"><strong>Payment Status:</strong> ${orderDetails.paymentStatus || 'pending'}</p>
        </div>
        
        ${orderDetails.shippingAddress ? `
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Shipping Address</h3>
          <p style="margin: 5px 0;">${orderDetails.shippingAddress.address_line1 || ''}</p>
          ${orderDetails.shippingAddress.address_line2 ? `<p style="margin: 5px 0;">${orderDetails.shippingAddress.address_line2}</p>` : ''}
          <p style="margin: 5px 0;">
            ${orderDetails.shippingAddress.city || ''}, ${orderDetails.shippingAddress.state || ''} ${orderDetails.shippingAddress.postal_code || ''}
          </p>
          <p style="margin: 5px 0;">${orderDetails.shippingAddress.country || ''}</p>
        </div>
        ` : ''}
        
        ${orderDetails.tracking && orderDetails.tracking.trackingNumber ? `
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">📦 Your Order Has Shipped!</h3>
          <div style="margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${orderDetails.tracking.trackingNumber}</p>
            ${orderDetails.tracking.carrier ? `<p style="margin: 5px 0;"><strong>Carrier:</strong> ${orderDetails.tracking.carrier}</p>` : ''}
          </div>
          ${orderDetails.tracking.trackingUrl ? `
            <div style="text-align: center; margin: 20px 0;">
              <a href="${orderDetails.tracking.trackingUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Track Your Package
              </a>
            </div>
          ` : ''}
        </div>
        ` : ''}
        <p>Again, we will notify you when your order has been shipped. Thank you!</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Order Confirmation - ${orderNumber}`,
    html,
  })
}

// Send order confirmation with magic link for NEW customers
export async function sendOrderConfirmationWithMagicLink(
  to: string,
  name: string,
  orderNumber: string,
  magicLink: string,
  orderDetails: any
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const accountUrl = `${siteUrl}/account`
  
  // Normalize magic link to use production URL
  const normalizedMagicLink = normalizeUrl(magicLink)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation - ${orderNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Order Confirmation</h1>
          <p style="font-size: 18px; font-weight: bold;">Order #${orderNumber}</p>
        </div>
        
        <p>Thank you for your purchase!</p>
        <p>Hi ${name}, we're getting your order ready to be shipped. We will notify you when it has been sent. Use the discount code <strong>Back-Again</strong> for 10% off your next order with us!</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p style="margin-top: 0; font-weight: bold;">Please note:</p>
          <p style="margin: 12px 0 0 0;"><strong>1. Shipping:</strong> Order processing will take 1-3 business days (Monday-Friday). Once shipped, your order will take 2-4 weeks to be delivered.</p>
          <p style="margin: 12px 0 0 0;"><strong>2. Weekend orders:</strong> Any orders made on Saturday or Sunday will be processed within the following next 3 business days.</p>
        </div>
        
        ${orderDetails.items && orderDetails.items.length > 0 ? `
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${orderDetails.items.map((item: any) => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px 0;">
                  <strong>${item.product_title || 'Product'}</strong>
                  ${item.variant_color ? `<br><span style="color: #666; font-size: 14px;">Color: ${item.variant_color}</span>` : ''}
                  ${item.sku ? `<br><span style="color: #666; font-size: 14px;">SKU: ${item.sku}</span>` : ''}
                  ${item.purchase_type && item.purchase_type !== 'one-time' ? `
                    <br><span style="background-color: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-block; margin-top: 4px;">
                      ${item.purchase_type === 'subscription' ? 'Ongoing Subscription' : item.purchase_type === 'prepaid' ? 'Prepaid Subscription' : item.purchase_type}
                    </span>
                  ` : ''}
                </td>
                <td style="padding: 10px 0; text-align: right; vertical-align: top;">
                  <div>Qty: ${item.quantity}</div>
                  <div style="font-weight: bold; margin-top: 4px;">$${parseFloat(item.line_total || '0').toFixed(2)}</div>
                </td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Summary</h3>
          ${orderDetails.subtotal ? `<p><strong>Subtotal:</strong> $${orderDetails.subtotal}</p>` : ''}
          ${parseFloat(orderDetails.discountAmount || '0') > 0 ? `<p><strong>Discount:</strong> -$${orderDetails.discountAmount}</p>` : ''}
          ${parseFloat(orderDetails.shippingCost || '0') > 0 ? `<p><strong>Shipping:</strong> $${orderDetails.shippingCost}</p>` : ''}
          ${parseFloat(orderDetails.taxAmount || '0') > 0 ? `<p><strong>Tax:</strong> $${orderDetails.taxAmount}</p>` : ''}
          <p style="font-size: 18px; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 2px solid #ddd;"><strong>Total:</strong> $${orderDetails.total}</p>
          <p style="margin-top: 10px;"><strong>Payment Status:</strong> ${orderDetails.paymentStatus || 'pending'}</p>
        </div>
        
        ${orderDetails.shippingAddress ? `
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Shipping Address</h3>
          <p style="margin: 5px 0;">${orderDetails.shippingAddress.address_line1 || ''}</p>
          ${orderDetails.shippingAddress.address_line2 ? `<p style="margin: 5px 0;">${orderDetails.shippingAddress.address_line2}</p>` : ''}
          <p style="margin: 5px 0;">
            ${orderDetails.shippingAddress.city || ''}, ${orderDetails.shippingAddress.state || ''} ${orderDetails.shippingAddress.postal_code || ''}
          </p>
          <p style="margin: 5px 0;">${orderDetails.shippingAddress.country || ''}</p>
        </div>
        ` : ''}
        
        ${orderDetails.tracking && orderDetails.tracking.trackingNumber ? `
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">📦 Your Order Has Shipped!</h3>
          <div style="margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${orderDetails.tracking.trackingNumber}</p>
            ${orderDetails.tracking.carrier ? `<p style="margin: 5px 0;"><strong>Carrier:</strong> ${orderDetails.tracking.carrier}</p>` : ''}
          </div>
          ${orderDetails.tracking.trackingUrl ? `
            <div style="text-align: center; margin: 20px 0;">
              <a href="${orderDetails.tracking.trackingUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Track Your Package
              </a>
            </div>
          ` : ''}
        </div>
        ` : ''}
        
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">Your Account Has Been Created!</h3>
          <p>We've created an account for you to manage your orders, subscriptions, and track your shipments.</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${normalizedMagicLink}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Access Your Account
            </a>
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 10px; text-align: center;">
            This secure link will expire in 24 hours. You can set a password after logging in.
          </p>
        </div>
        
        <div style="margin: 20px 0;">
          <h3 style="color: #14b8a6;">What You Can Do:</h3>
          <ul style="line-height: 2;">
            <li>Track your orders and shipments</li>
            <li>Manage your subscriptions</li>
            <li>Update delivery preferences</li>
            <li>View your complete order history</li>
            <li>Save payment methods for faster checkout</li>
            <li>Update your account information</li>
          </ul>
        </div>
        
        <p>Again, we will notify you when your order has been shipped. Thank you!</p>
        <p>Best regards,<br>The BREVI™ Team</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #666;">
          <p>Having trouble with the link? <a href="${accountUrl}" style="color: #14b8a6;">Visit your account</a> and use "Forgot Password" to set up access.</p>
        </div>
      </body>
    </html>
  `

  try {
    const result = await sendEmail({
      to,
      subject: `Order Confirmation - ${orderNumber}`,
      html,
    })
    console.log('[sendOrderConfirmationEmail] Email sent successfully:', {
      to,
      orderNumber,
      timestamp: new Date().toISOString(),
    })
    return result
  } catch (error: any) {
    console.error('[sendOrderConfirmationEmail] Failed to send order confirmation email:', {
      error: error?.message || error,
      stack: error?.stack,
      to,
      orderNumber,
      timestamp: new Date().toISOString(),
    })
    throw error
  }
}

// Send order confirmation with magic link for EXISTING customers (return buyers)
export async function sendOrderConfirmationForExistingAccount(
  to: string,
  name: string,
  orderNumber: string,
  magicLink: string,
  orderDetails: any
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const accountUrl = `${siteUrl}/account`
  
  // Normalize magic link to use production URL
  const normalizedMagicLink = normalizeUrl(magicLink)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation - ${orderNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Order Confirmation</h1>
          <p style="font-size: 18px; font-weight: bold;">Order #${orderNumber}</p>
        </div>
        
        <p>Thank you for your purchase!</p>
        <p>Hi ${name}, we're getting your order ready to be shipped. We will notify you when it has been sent. Use the discount code <strong>Back-Again</strong> for 10% off your next order with us!</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <p style="margin-top: 0; font-weight: bold;">Please note:</p>
          <p style="margin: 12px 0 0 0;"><strong>1. Shipping:</strong> Order processing will take 1-3 business days (Monday-Friday). Once shipped, your order will take 2-4 weeks to be delivered.</p>
          <p style="margin: 12px 0 0 0;"><strong>2. Weekend orders:</strong> Any orders made on Saturday or Sunday will be processed within the following next 3 business days.</p>
        </div>
        
        ${orderDetails.items && orderDetails.items.length > 0 ? `
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${orderDetails.items.map((item: any) => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px 0;">
                  <strong>${item.product_title || 'Product'}</strong>
                  ${item.variant_color ? `<br><span style="color: #666; font-size: 14px;">Color: ${item.variant_color}</span>` : ''}
                  ${item.sku ? `<br><span style="color: #666; font-size: 14px;">SKU: ${item.sku}</span>` : ''}
                  ${item.purchase_type && item.purchase_type !== 'one-time' ? `
                    <br><span style="background-color: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 4px; font-size: 12px; display: inline-block; margin-top: 4px;">
                      ${item.purchase_type === 'subscription' ? 'Ongoing Subscription' : item.purchase_type === 'prepaid' ? 'Prepaid Subscription' : item.purchase_type}
                    </span>
                  ` : ''}
                </td>
                <td style="padding: 10px 0; text-align: right; vertical-align: top;">
                  <div>Qty: ${item.quantity}</div>
                  <div style="font-weight: bold; margin-top: 4px;">$${parseFloat(item.line_total || '0').toFixed(2)}</div>
                </td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Summary</h3>
          ${orderDetails.subtotal ? `<p><strong>Subtotal:</strong> $${orderDetails.subtotal}</p>` : ''}
          ${parseFloat(orderDetails.discountAmount || '0') > 0 ? `<p><strong>Discount:</strong> -$${orderDetails.discountAmount}</p>` : ''}
          ${parseFloat(orderDetails.shippingCost || '0') > 0 ? `<p><strong>Shipping:</strong> $${orderDetails.shippingCost}</p>` : ''}
          ${parseFloat(orderDetails.taxAmount || '0') > 0 ? `<p><strong>Tax:</strong> $${orderDetails.taxAmount}</p>` : ''}
          <p style="font-size: 18px; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 2px solid #ddd;"><strong>Total:</strong> $${orderDetails.total}</p>
          <p style="margin-top: 10px;"><strong>Payment Status:</strong> ${orderDetails.paymentStatus || 'pending'}</p>
        </div>
        
        ${orderDetails.shippingAddress ? `
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Shipping Address</h3>
          <p style="margin: 5px 0;">${orderDetails.shippingAddress.address_line1 || ''}</p>
          ${orderDetails.shippingAddress.address_line2 ? `<p style="margin: 5px 0;">${orderDetails.shippingAddress.address_line2}</p>` : ''}
          <p style="margin: 5px 0;">
            ${orderDetails.shippingAddress.city || ''}, ${orderDetails.shippingAddress.state || ''} ${orderDetails.shippingAddress.postal_code || ''}
          </p>
          <p style="margin: 5px 0;">${orderDetails.shippingAddress.country || ''}</p>
        </div>
        ` : ''}
        
        ${orderDetails.tracking && orderDetails.tracking.trackingNumber ? `
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">📦 Your Order Has Shipped!</h3>
          <div style="margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${orderDetails.tracking.trackingNumber}</p>
            ${orderDetails.tracking.carrier ? `<p style="margin: 5px 0;"><strong>Carrier:</strong> ${orderDetails.tracking.carrier}</p>` : ''}
          </div>
          ${orderDetails.tracking.trackingUrl ? `
            <div style="text-align: center; margin: 20px 0;">
              <a href="${orderDetails.tracking.trackingUrl}" target="_blank" rel="noopener noreferrer" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Track Your Package
              </a>
            </div>
          ` : ''}
        </div>
        ` : ''}
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">Quick Access to Your Account</h3>
          <p>Your order has been added to your account. Click below to access your account and track this order:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${normalizedMagicLink}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Access Your Account
            </a>
          </div>
          <p style="font-size: 12px; color: #666; margin-top: 10px; text-align: center;">
            This secure link will expire in 24 hours. You can also log in normally at <a href="${accountUrl}" style="color: #14b8a6;">${accountUrl}</a>
          </p>
        </div>
        
        <p>Again, we will notify you when your order has been shipped. Thank you!</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  try {
    const result = await sendEmail({
      to,
      subject: `Order Confirmation - ${orderNumber}`,
      html,
    })
    console.log('[sendOrderConfirmationForExistingAccount] Email sent successfully with magic link:', {
      to,
      orderNumber,
      timestamp: new Date().toISOString(),
    })
    return result
  } catch (error: any) {
    console.error('[sendOrderConfirmationForExistingAccount] Failed to send order confirmation email with magic link:', {
      error: error?.message || error,
      stack: error?.stack,
      to,
      orderNumber,
      timestamp: new Date().toISOString(),
    })
    throw error
  }
}

// Send shipping notification email
export async function sendShippingNotificationEmail(
  to: string,
  name: string,
  orderNumber: string,
  trackingNumber?: string,
  carrier?: string
) {
  // Generate tracking URL if tracking number and carrier are provided
  let trackingUrl: string | null = null
  if (trackingNumber && carrier) {
    const { getTrackingUrl } = await import('@/lib/tracking-urls')
    trackingUrl = getTrackingUrl(carrier, trackingNumber)
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Order Has Shipped - ${orderNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Your Order Has Shipped!</h1>
          <p style="font-size: 18px; font-weight: bold;">Order #${orderNumber}</p>
        </div>
        <p>Hi ${name},</p>
        <p>Great news! Your order has been shipped and is on its way to you.</p>
        ${trackingNumber ? `
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Tracking Information</h3>
            <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
            ${carrier ? `<p><strong>Carrier:</strong> ${carrier}</p>` : ''}
            ${trackingUrl ? `
              <div style="text-align: center; margin-top: 15px;">
                <a href="${trackingUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Track Your Package</a>
              </div>
            ` : ''}
          </div>
        ` : ''}
        <p>You can track your order in your account dashboard.</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Your Order Has Shipped - ${orderNumber}`,
    html,
  })
}

// Send payment link email for unpaid manual orders
export async function sendOrderPaymentLinkEmail(
  to: string,
  name: string,
  orderNumber: string,
  paymentLink: string
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Payment - ${orderNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Complete Your Order Payment</h1>
          <p style="font-size: 18px; font-weight: bold;">Order #${orderNumber}</p>
        </div>
        <p>Hi ${name},</p>
        <p>Your order is ready. Please use the secure payment link below to complete payment.</p>
        <div style="text-align: center; margin: 26px 0;">
          <a href="${paymentLink}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Pay for Order</a>
        </div>
        <p style="font-size: 14px; color: #666;">If the button does not work, copy and paste this URL into your browser:</p>
        <p style="font-size: 13px; word-break: break-all; color: #444;">${paymentLink}</p>
        <p>Thank you,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Payment Link for Order ${orderNumber}`,
    html,
  })
}

// Send invoice email (invoice-only, no order confirmation text)
export async function sendInvoiceEmail(
  to: string,
  name: string,
  orderNumber: string,
  orderDetails: any
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const origin = siteUrl

  const orderDate = orderDetails.createdAt 
    ? new Date(orderDetails.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${orderNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .invoice-container {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #14b8a6;
          }
          .invoice-header h1 {
            color: #14b8a6;
            font-size: 32px;
            font-weight: bold;
          }
          .invoice-info {
            text-align: right;
          }
          .invoice-info p {
            margin: 4px 0;
            font-size: 14px;
          }
          .company-info {
            margin-bottom: 30px;
          }
          .company-info img {
            height: 50px;
            width: auto;
            margin-bottom: 10px;
          }
          .billing-shipping {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
          }
          .address-box {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
          }
          .address-box h3 {
            color: #14b8a6;
            font-size: 16px;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          .address-box p {
            margin: 4px 0;
            font-size: 14px;
            line-height: 1.6;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .items-table thead {
            background: #14b8a6;
            color: white;
          }
          .items-table th {
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 14px;
          }
          .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
          }
          .items-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          .items-table .text-right {
            text-align: right;
          }
          .items-table .text-center {
            text-align: center;
          }
          .totals {
            margin-left: auto;
            width: 300px;
            margin-top: 20px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
          }
          .totals-row.total {
            font-size: 18px;
            font-weight: bold;
            padding-top: 12px;
            border-top: 2px solid #14b8a6;
            margin-top: 8px;
          }
          .totals-row.label {
            color: #666;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
          }
          .status-paid {
            background: #d1fae5;
            color: #065f46;
          }
          .status-pending {
            background: #fef3c7;
            color: #92400e;
          }
          .status-fulfilled {
            background: #dbeafe;
            color: #1e40af;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="invoice-header">
            <div>
              <h1>INVOICE</h1>
              <p style="margin-top: 8px; color: #666;">Order #${orderNumber}</p>
            </div>
            <div class="invoice-info">
              <p><strong>Invoice Date:</strong> ${orderDate}</p>
              <p><strong>Order Date:</strong> ${orderDate}</p>
              <p><strong>Payment Status:</strong> 
                <span class="status-badge ${orderDetails.paymentStatus === 'paid' ? 'status-paid' : 'status-pending'}">
                  ${orderDetails.paymentStatus === 'paid' ? 'Paid' : orderDetails.paymentStatus || 'Pending'}
                </span>
              </p>
              <p><strong>Fulfillment Status:</strong> 
                <span class="status-badge ${orderDetails.fulfillmentStatus === 'fulfilled' ? 'status-fulfilled' : 'status-pending'}">
                  ${orderDetails.fulfillmentStatus === 'fulfilled' ? 'Fulfilled' : orderDetails.fulfillmentStatus || 'Pending'}
                </span>
              </p>
            </div>
          </div>

          <div class="company-info">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
              <img src="${origin}/brevi-logo.png" alt="BREVI Logo" />
            </div>
            <p style="color: #666; font-size: 14px;">Premium Oral Care Products</p>
          </div>

          <div class="billing-shipping">
            <div class="address-box">
              <h3>Bill To</h3>
              <p><strong>${name}</strong></p>
              <p>${to}</p>
              ${orderDetails.billingAddress ? `
                ${orderDetails.billingAddress.address_line1 ? `<p>${orderDetails.billingAddress.address_line1}</p>` : ''}
                ${orderDetails.billingAddress.address_line2 ? `<p>${orderDetails.billingAddress.address_line2}</p>` : ''}
                ${orderDetails.billingAddress.city || orderDetails.billingAddress.state || orderDetails.billingAddress.postal_code
                  ? `<p>${[orderDetails.billingAddress.city, orderDetails.billingAddress.state, orderDetails.billingAddress.postal_code].filter(Boolean).join(', ')}</p>`
                  : ''}
                ${orderDetails.billingAddress.country ? `<p>${orderDetails.billingAddress.country}</p>` : ''}
              ` : ''}
            </div>
            <div class="address-box">
              <h3>Ship To</h3>
              <p><strong>${name}</strong></p>
              ${orderDetails.shippingAddress ? `
                ${orderDetails.shippingAddress.address_line1 ? `<p>${orderDetails.shippingAddress.address_line1}</p>` : ''}
                ${orderDetails.shippingAddress.address_line2 ? `<p>${orderDetails.shippingAddress.address_line2}</p>` : ''}
                ${orderDetails.shippingAddress.city || orderDetails.shippingAddress.state || orderDetails.shippingAddress.postal_code
                  ? `<p>${[orderDetails.shippingAddress.city, orderDetails.shippingAddress.state, orderDetails.shippingAddress.postal_code].filter(Boolean).join(', ')}</p>`
                  : ''}
                ${orderDetails.shippingAddress.country ? `<p>${orderDetails.shippingAddress.country}</p>` : ''}
              ` : ''}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-center">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(orderDetails.items || []).map((item: any) => `
                <tr>
                  <td>
                    <strong>${item.product_title || 'Product'}</strong>
                    ${item.variant_color ? `<br><span style="color: #666; font-size: 12px;">Color: ${item.variant_color}</span>` : ''}
                    ${item.sku ? `<br><span style="color: #666; font-size: 12px;">SKU: ${item.sku}</span>` : ''}
                    ${item.purchase_type && item.purchase_type !== 'one-time' 
                      ? `<br><span style="color: #14b8a6; font-size: 12px;">${item.purchase_type === 'ongoing' ? 'Ongoing Subscription' : 'Prepaid Subscription'}</span>` 
                      : ''}
                  </td>
                  <td class="text-center">${item.quantity || 1}</td>
                  <td class="text-right">$${parseFloat(item.unit_price || '0').toFixed(2)}</td>
                  <td class="text-right">$${parseFloat(item.line_total || '0').toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span class="label">Subtotal:</span>
              <span>$${parseFloat(orderDetails.subtotal || '0').toFixed(2)}</span>
            </div>
            ${parseFloat(orderDetails.discountAmount || '0') > 0 ? `
              <div class="totals-row">
                <span class="label">Discount:</span>
                <span>-$${parseFloat(orderDetails.discountAmount || '0').toFixed(2)}</span>
              </div>
            ` : ''}
            ${parseFloat(orderDetails.shippingCost || '0') > 0 ? `
              <div class="totals-row">
                <span class="label">Shipping:</span>
                <span>$${parseFloat(orderDetails.shippingCost || '0').toFixed(2)}</span>
              </div>
            ` : ''}
            ${parseFloat(orderDetails.taxAmount || '0') > 0 ? `
              <div class="totals-row">
                <span class="label">Tax:</span>
                <span>$${parseFloat(orderDetails.taxAmount || '0').toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="totals-row total">
              <span>Total:</span>
              <span>$${parseFloat(orderDetails.total || '0').toFixed(2)}</span>
            </div>
          </div>

          ${orderDetails.trackingNumber ? `
            <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px;">
              <h3 style="color: #14b8a6; font-size: 16px; margin-bottom: 8px;">Tracking Information</h3>
              <p><strong>Carrier:</strong> ${orderDetails.shippingCarrier || 'N/A'}</p>
              <p><strong>Tracking Number:</strong> ${orderDetails.trackingNumber}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your business!</p>
            <p style="margin-top: 8px;">This is an official invoice for order ${orderNumber}</p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
              <p style="color: #666; font-size: 12px; margin: 0;">BREVI™ is a product of</p>
              <img src="${origin}/oafflu-icon.svg" alt="OAFFLU LLC" style="height: 24px; width: auto;" />
              <p style="color: #666; font-size: 12px; margin: 0;">OAFFLU LLC</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Invoice - ${orderNumber}`,
    html,
  })
}

// Send supplier order assignment notification email
export async function sendSupplierOrderAssignmentEmail(
  to: string,
  supplierName: string,
  orderNumbers: string[],
  orderCount: number
) {
  const orderList = orderNumbers.length <= 5 
    ? orderNumbers.map(num => `#${num}`).join(', ')
    : `${orderNumbers.slice(0, 5).map(num => `#${num}`).join(', ')} and ${orderCount - 5} more`
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Order${orderCount > 1 ? 's' : ''} Assigned - ${orderNumbers[0]}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">New Order${orderCount > 1 ? 's' : ''} Assigned</h1>
          <p style="font-size: 18px; font-weight: bold;">${orderCount} order${orderCount > 1 ? 's' : ''} ${orderCount > 1 ? 'have' : 'has'} been assigned to you</p>
        </div>
        <p>Hi ${supplierName},</p>
        <p>You ${orderCount > 1 ? 'have' : 'have'} been assigned ${orderCount} new order${orderCount > 1 ? 's' : ''} to fulfill:</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order${orderCount > 1 ? 's' : ''}:</h3>
          <p style="font-size: 16px; font-weight: bold;">${orderList}</p>
        </div>
        <p><strong>Action Required:</strong> Please log in to your supplier dashboard to acknowledge and process ${orderCount > 1 ? 'these orders' : 'this order'}.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}/supplier/orders" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Orders</a>
        </div>
        <p><strong>Next Steps:</strong></p>
        <ol style="padding-left: 20px;">
          <li>Log in to your supplier dashboard</li>
          <li>Review the order${orderCount > 1 ? 's' : ''} details</li>
          <li>Click "Acknowledge" to confirm you've received ${orderCount > 1 ? 'them' : 'it'}</li>
          <li>Update the order status as you process ${orderCount > 1 ? 'them' : 'it'}</li>
        </ol>
        <p>If you have any questions, please contact the admin team.</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `New Order${orderCount > 1 ? 's' : ''} Assigned - ${orderNumbers[0]}${orderCount > 1 ? ` and ${orderCount - 1} more` : ''}`,
    html,
  })
}

// Send newsletter welcome email
export async function sendNewsletterWelcomeEmail(email: string, firstName?: string) {
  const name = firstName || 'there'
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to BREVI Newsletter</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Welcome to BREVI Newsletter!</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Thank you for subscribing to our newsletter! You're now part of our exclusive community and will be the first to know about:</p>
        <ul style="list-style: none; padding: 0;">
          <li style="margin: 10px 0;">✨ New product launches</li>
          <li style="margin: 10px 0;">🎁 Exclusive discounts and offers</li>
          <li style="margin: 10px 0;">💡 Oral care tips and insights</li>
          <li style="margin: 10px 0;">📰 Latest news and updates</li>
        </ul>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <h2 style="margin-top: 0; color: #14b8a6;">🎉 Special Offer: 10% Off Your First Order!</h2>
          <p style="font-size: 18px; font-weight: bold;">Use code: <span style="color: #14b8a6;">NEWSLETTER10</span></p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Shop Now</a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: 'Welcome to BREVI Newsletter - 10% Off Your First Order!',
    html,
  })
}

// Send contact form email to admin
export async function sendContactFormEmail(data: {
  to: string
  from: string
  name: string
  subject: string
  message: string
}) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Contact Form Submission - ${data.subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #14b8a6; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">New Contact Form Submission</h1>
        </div>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
          <p><strong>From:</strong> ${data.name} (${data.from})</p>
          <p><strong>Subject:</strong> ${data.subject}</p>
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin-top: 15px;">
            <p style="margin: 0; white-space: pre-wrap;">${data.message}</p>
          </div>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="margin: 0; font-size: 12px; color: #666;">You can reply directly to this email to respond to ${data.name}.</p>
          </div>
        </div>
      </body>
    </html>
  `

  // Use default sender (verified domain); Mailgun rejects "from" that is not a verified address.
  return sendEmail({
    to: data.to,
    replyTo: data.from?.trim() || undefined,
    subject: `Contact Form: ${data.subject}`,
    html,
  })
}

// Send admin notification email for new order
// Sends to all admin and partner users (similar to Shopify store owner notifications)
export async function sendAdminNewOrderEmail(
  orderNumber: string,
  customerName: string,
  customerEmail: string,
  orderTotal: string,
  orderItems: Array<{
    product_title: string
    variant_color?: string
    quantity: number
    unit_price: string
    line_total: string
  }>
) {
  // Get all admin and partner email addresses
  const adminAndPartnerEmails = await getAdminAndPartnerEmails()
  
  // Fallback to ADMIN_EMAIL if no admin/partner emails found
  const fallbackEmail = process.env.ADMIN_EMAIL || 'hello@brevibrushes.com'
  const recipientEmails = adminAndPartnerEmails.length > 0 
    ? adminAndPartnerEmails 
    : [fallbackEmail]
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const adminOrderUrl = `${siteUrl}/admin/orders`

  const itemsHtml = orderItems.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product_title}${item.variant_color ? ` (${item.variant_color})` : ''}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.unit_price}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.line_total}</td>
    </tr>
  `).join('')

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Order - ${orderNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #14b8a6; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">New Order Received</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px; font-weight: bold;">Order #${orderNumber}</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 0 0 5px 5px;">
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <h3 style="margin-top: 0; color: #14b8a6;">Customer Information</h3>
            <p><strong>Name:</strong> ${customerName}</p>
            <p><strong>Email:</strong> ${customerEmail}</p>
          </div>
          
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
            <h3 style="margin-top: 0; color: #14b8a6;">Order Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f9f9f9;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #14b8a6;">Product</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #14b8a6;">Qty</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #14b8a6;">Price</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #14b8a6;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; border-top: 2px solid #14b8a6;">Order Total:</td>
                  <td style="padding: 10px; text-align: right; font-weight: bold; border-top: 2px solid #14b8a6;">$${orderTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div style="text-align: center; margin-top: 20px;">
            <a href="${adminOrderUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              View Order in Admin Panel
            </a>
          </div>
          
          <p style="margin-top: 20px; font-size: 12px; color: #666; text-align: center;">
            This is an automated notification. Please process this order in the admin panel.
          </p>
        </div>
      </body>
    </html>
  `

  // Send to all admin and partner emails
  try {
    const result = await sendEmail({
      to: recipientEmails,
      subject: `New Order - ${orderNumber}`,
      html,
    })
    
    console.log(`[Order Notification] Sent new order email to ${recipientEmails.length} recipient(s): ${recipientEmails.join(', ')}`)
    return result
  } catch (error) {
    console.error(`[Order Notification] Error sending email to admin/partners:`, error)
    // Try fallback to single email if bulk send fails
    if (recipientEmails.length > 1) {
      console.log(`[Order Notification] Attempting fallback to single email: ${fallbackEmail}`)
      return sendEmail({
        to: fallbackEmail,
        subject: `New Order - ${orderNumber}`,
        html,
      })
    }
    throw error
  }
}

// Get all admin email addresses
async function getAdminEmails(): Promise<string[]> {
  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminSupabaseClient()
    
    const { data: admins, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .not('email', 'is', null)
    
    if (error) {
      console.error('Error fetching admin emails:', error)
      return []
    }
    
    return admins?.map(admin => admin.email).filter(Boolean) || []
  } catch (error) {
    console.error('Error in getAdminEmails:', error)
    return []
  }
}

// Get all admin and partner email addresses
// Exported for use in other modules
export async function getAdminAndPartnerEmails(): Promise<string[]> {
  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminSupabaseClient()
    
    const { data: users, error } = await supabase
      .from('profiles')
      .select('email')
      .in('role', ['admin', 'partner'])
      .not('email', 'is', null)
      .like('email', '%@%') // Ensure valid email format
    
    if (error) {
      console.error('Error fetching admin and partner emails:', error)
      return []
    }
    
    const emails = users?.map(user => user.email).filter(Boolean) || []
    
    // Remove duplicates
    const uniqueEmails = [...new Set(emails)]
    
    if (uniqueEmails.length > 0) {
      console.log(`[Email Notification] Found ${uniqueEmails.length} admin/partner email(s) to notify`)
    } else {
      console.warn('[Email Notification] No admin or partner emails found in database')
    }
    
    return uniqueEmails
  } catch (error) {
    console.error('Error in getAdminAndPartnerEmails:', error)
    return []
  }
}

// Send sample request notification email to supplier
export async function sendSampleRequestNotificationEmail(
  to: string,
  supplierName: string,
  requestId: string,
  requestType: 'existing_product' | 'custom_product',
  productName?: string,
  adminName?: string,
  allProducts?: Array<{
    type: 'inventory' | 'product'
    name: string
    sku?: string
    quantity: number
    variant?: {
      color?: string
      sku?: string
    }
  }>
) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  
  // Build products list HTML
  let productsListHtml = ''
  if (allProducts && allProducts.length > 0) {
    productsListHtml = '<div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 5px; padding: 15px; margin: 15px 0;"><h4 style="margin-top: 0; color: #14b8a6;">Products Requested:</h4><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f9fafb;"><th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: 600;">Product</th><th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: 600;">SKU</th><th style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: 600;">Qty</th></tr></thead><tbody>'
    for (const product of allProducts) {
      const skuText = product.sku || (product.variant?.sku) || 'N/A'
      const variantText = product.variant?.color ? ` (${product.variant.color})` : ''
      productsListHtml += `<tr><td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${product.name}${variantText}</td><td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #6b7280;">${skuText}</td><td style="padding: 8px; border-bottom: 1px solid #f3f4f6; text-align: center; font-size: 13px; font-weight: 600;">${product.quantity}</td></tr>`
    }
    productsListHtml += '</tbody></table></div>'
  } else if (productName) {
    productsListHtml = `<p style="margin: 5px 0;"><strong>Product:</strong> ${productName}</p>`
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Sample Request - BREVI</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">New Sample Request</h1>
        </div>
        <p>Hi ${supplierName},</p>
        <p>A new sample request has been created and assigned to you.</p>
        <div style="background-color: #f9fafb; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Request ID:</strong> ${requestId.substring(0, 8)}...</p>
          <p style="margin: 5px 0;"><strong>Request Type:</strong> ${requestType === 'custom_product' ? 'Custom Product' : 'Existing Product'}</p>
          ${adminName ? `<p style="margin: 5px 0;"><strong>Requested By:</strong> ${adminName}</p>` : ''}
        </div>
        ${productsListHtml}
        <p>Please review the request and set pricing details. You can approve, reject, or request more information.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${origin}/supplier/sample-requests/${requestId}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Sample Request</a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  try {
    await sendEmail({
      to,
      subject: 'New Sample Request - Action Required',
      html,
      categories: ['sample_request', 'notification'],
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error sending sample request notification email:', error)
    throw error
  }
}

/** Escape minimal HTML for email bodies */
function escapeEmailText(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

/** Admin/partner → supplier thread (matches push “Message from BREVI”). */
export async function sendAdminToSupplierChatEmail(
  to: string,
  supplierName: string,
  adminDisplayName: string,
  messageText: string
) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #14b8a6;">New message from BREVI</h2>
        <p>Hi ${escapeEmailText(supplierName)},</p>
        <p><strong>${escapeEmailText(adminDisplayName)}</strong> sent you a message:</p>
        <div style="background: #f9fafb; border-left: 4px solid #14b8a6; padding: 16px; margin: 20px 0;">
          ${escapeEmailText(messageText)}
        </div>
        <p><a href="${origin}/supplier/messages" style="color: #14b8a6;">Open Messages</a> in your supplier portal to reply.</p>
        <p>— BREVI™</p>
      </body>
    </html>
  `
  await sendEmail({
    to,
    subject: `Message from BREVI — ${adminDisplayName}`,
    html,
    categories: ['supplier_chat', 'notification'],
  })
}

/** Supplier → admin/partner thread */
export async function sendSupplierToAdminChatEmail(
  to: string,
  recipientName: string,
  supplierDisplayName: string,
  messageText: string
) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #14b8a6;">Supplier message</h2>
        <p>Hi ${escapeEmailText(recipientName || 'there')},</p>
        <p><strong>${escapeEmailText(supplierDisplayName)}</strong> replied:</p>
        <div style="background: #f9fafb; border-left: 4px solid #14b8a6; padding: 16px; margin: 20px 0;">
          ${escapeEmailText(messageText)}
        </div>
        <p><a href="${origin}/admin/suppliers" style="color: #14b8a6;">Open Suppliers</a> in admin to continue the conversation.</p>
        <p>— BREVI™</p>
      </body>
    </html>
  `
  await sendEmail({
    to,
    subject: `Supplier message — ${supplierDisplayName}`,
    html,
    categories: ['supplier_chat', 'notification'],
  })
}

/** Email admins/partners when a sample request status changes (any major status). */
export async function sendSampleRequestStatusBroadcastEmail(
  to: string,
  recipientName: string,
  requestId: string,
  status: string,
  supplierLabel: string,
  requestTypeLabel: string,
  productSummary?: string
) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #14b8a6;">Sample request updated</h2>
        <p>Hi ${escapeEmailText(recipientName)},</p>
        <p>A supplier has updated a sample request.</p>
        <div style="background: #f9fafb; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Status:</strong> ${escapeEmailText(status)}</p>
          <p style="margin: 4px 0;"><strong>Supplier:</strong> ${escapeEmailText(supplierLabel)}</p>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${escapeEmailText(requestTypeLabel)}</p>
          ${productSummary ? `<p style="margin: 4px 0;"><strong>Product:</strong> ${escapeEmailText(productSummary)}</p>` : ''}
        </div>
        <p><a href="${origin}/admin/sample-requests/${requestId}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View request</a></p>
        <p>— BREVI™</p>
      </body>
    </html>
  `
  await sendEmail({
    to,
    subject: `Sample request ${status} — ${requestId.slice(0, 8)}…`,
    html,
    categories: ['sample_request', 'notification'],
  })
}

// Send sample request status update email to admin and partner
export async function sendSampleRequestStatusUpdateEmail(
  to: string,
  recipientName: string,
  requestId: string,
  status: 'shipped' | 'delivered',
  productName?: string,
  trackingNumber?: string,
  shippingCarrier?: string,
  allProducts?: Array<{
    type: 'inventory' | 'product'
    name: string
    sku?: string
    quantity: number
    variant?: {
      color?: string
      sku?: string
    }
  }>
) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  
  const statusText = status === 'shipped' ? 'Shipped' : 'Delivered'
  const statusMessage = status === 'shipped' 
    ? 'The sample request has been shipped and is on its way.'
    : 'The sample request has been delivered successfully.'
  
  // Build products list HTML
  let productsListHtml = ''
  if (allProducts && allProducts.length > 0) {
    productsListHtml = '<div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 5px; padding: 15px; margin: 15px 0;"><h4 style="margin-top: 0; color: #14b8a6;">Products Shipped:</h4><table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f9fafb;"><th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: 600;">Product</th><th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: 600;">SKU</th><th style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-size: 12px; font-weight: 600;">Qty</th></tr></thead><tbody>'
    for (const product of allProducts) {
      const skuText = product.sku || (product.variant?.sku) || 'N/A'
      const variantText = product.variant?.color ? ` (${product.variant.color})` : ''
      productsListHtml += `<tr><td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 13px;">${product.name}${variantText}</td><td style="padding: 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #6b7280;">${skuText}</td><td style="padding: 8px; border-bottom: 1px solid #f3f4f6; text-align: center; font-size: 13px; font-weight: 600;">${product.quantity}</td></tr>`
    }
    productsListHtml += '</tbody></table></div>'
  } else if (productName) {
    productsListHtml = `<p style="margin: 5px 0;"><strong>Product:</strong> ${productName}</p>`
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sample Request ${statusText} - BREVI</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Sample Request ${statusText}</h1>
        </div>
        <p>Hi ${recipientName},</p>
        <p>${statusMessage}</p>
        <div style="background-color: #f9fafb; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Request ID:</strong> ${requestId.substring(0, 8)}...</p>
          ${trackingNumber ? `<p style="margin: 5px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>` : ''}
          ${shippingCarrier ? `<p style="margin: 5px 0;"><strong>Carrier:</strong> ${shippingCarrier}</p>` : ''}
        </div>
        ${productsListHtml}
        <div style="text-align: center; margin: 30px 0;">
          <a href="${origin}/admin/sample-requests/${requestId}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Sample Request</a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  try {
    await sendEmail({
      to,
      subject: `Sample Request ${statusText} - ${requestId.substring(0, 8)}...`,
      html,
      categories: ['sample_request', 'notification'],
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error sending sample request status update email:', error)
    throw error
  }
}

// Send ticket creation email to customer
function ticketSubjectTag(ticketNumber: string) {
  return `[${String(ticketNumber || "").trim().toUpperCase()}]`
}

export async function sendTicketEmail(
  to: string,
  customerName: string,
  ticketNumber: string,
  subject: string,
  message: string,
  ticketId: string
) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const tag = ticketSubjectTag(ticketNumber)

  const replyLocalPart = process.env.TICKET_REPLY_LOCAL_PART || 'hello' // must exist as a mailbox (O365 plus-addressing)
  const replyDomain =
    process.env.TICKET_REPLY_DOMAIN ||
    origin.replace('https://', '').replace('http://', '')
  const replyEmail = `${replyLocalPart}+${ticketId}@${replyDomain}`
  
  // Get all admin emails
  const adminEmails = await getAdminEmails()
  const systemEmail = 'hello@brevibrushes.com'
  
  // Combine all recipients: customer, all admins, and system email
  const allRecipients = [
    to, // Customer
    systemEmail, // System email
    ...adminEmails.filter(email => email !== to && email !== systemEmail) // All admins (excluding duplicates)
  ]
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Support Ticket Created - ${ticketNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Support Ticket Created</h1>
        </div>
        <p>Hi ${customerName},</p>
        <p>A support ticket has been created for you. We'll respond to your inquiry as soon as possible.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #14b8a6;">Ticket Details</h3>
          <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
          <p><strong>Subject:</strong> ${subject}</p>
        </div>
        <div style="background-color: #ffffff; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #14b8a6;">Initial Message:</h4>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${origin}/account/support/${ticketId}" style="background-color: #111827; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">View &amp; reply in your account</a>
        </div>
        <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>💡 Tip:</strong> You can reply to this email to add a message to your ticket. Your reply will be automatically added to the ticket.</p>
        </div>
        <p>Best regards,<br>The BREVI™ Support Team</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          This is an automated email. Please do not reply directly to this address.<br>
          To reply to this ticket, use the button above, reply to this email, or open Support in your BREVI™ account.
        </p>
      </body>
    </html>
  `

  // Send to customer
  try {
    await sendEmail({
      to,
      subject: `Support Ticket ${tag} ${subject}`,
      html,
      replyTo: replyEmail,
    })
    console.log(`Ticket email sent to customer: ${to}`)
  } catch (error: any) {
    console.error(`Error sending ticket email to customer ${to}:`, error)
    // Continue to send admin emails even if customer email fails
  }

  // Send notification email to all admins and system email
  const adminHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Support Ticket - ${ticketNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">New Support Ticket Created</h1>
        </div>
        <p>A new support ticket has been created and requires your attention.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #14b8a6;">Ticket Details</h3>
          <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Customer Email:</strong> ${to}</p>
          <p><strong>Subject:</strong> ${subject}</p>
        </div>
        <div style="background-color: #ffffff; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #14b8a6;">Initial Message:</h4>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${origin}/admin/support/${ticketId}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a>
        </div>
        <p>Best regards,<br>The BREVI Support System</p>
      </body>
    </html>
  `

  // Send to all admins and system email (BCC to avoid exposing all emails)
  const adminRecipients = [systemEmail, ...adminEmails.filter(email => email !== systemEmail)]
  
  if (adminRecipients.length > 0) {
    // Send to system email
    try {
      await sendEmail({
        to: systemEmail,
        subject: `New Support Ticket ${tag} ${subject}`,
        html: adminHtml,
      })
      console.log(`Ticket notification sent to system email: ${systemEmail}`)
    } catch (error: any) {
      console.error(`Error sending ticket email to system email ${systemEmail}:`, error)
    }
    
    // Send to other admins individually to ensure they all receive it
    for (const adminEmail of adminEmails.filter(email => email !== systemEmail)) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `New Support Ticket ${tag} ${subject}`,
          html: adminHtml,
        })
        console.log(`Ticket notification sent to admin: ${adminEmail}`)
      } catch (error: any) {
        console.error(`Error sending ticket email to admin ${adminEmail}:`, error)
      }
    }
  } else {
    console.warn('No admin recipients found for ticket notification')
  }

  return { success: true }
}

// Send ticket reply email to customer
// Send invoice paid notification email
export async function sendInvoicePaidEmail(
  to: string,
  recipientName: string,
  invoiceNumber: string,
  amount: number,
  recipientType: 'supplier' | 'admin'
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const origin = siteUrl

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)

  const isSupplier = recipientType === 'supplier'
  const subject = isSupplier 
    ? `Invoice ${invoiceNumber} Payment Confirmation`
    : `Invoice ${invoiceNumber} Marked as Paid`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">${isSupplier ? 'Payment Received' : 'Invoice Payment Confirmed'}</h1>
        </div>
        <p>Hi ${recipientName},</p>
        <p>${isSupplier 
          ? `We're pleased to inform you that your invoice has been marked as paid.`
          : `An invoice has been marked as paid.`}</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #14b8a6;">Invoice Details</h3>
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Amount Paid:</strong> ${formattedAmount}</p>
          <p><strong>Payment Date:</strong> ${new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</p>
        </div>
        ${isSupplier 
          ? `<p>Your payment has been processed and recorded. Thank you for your service!</p>`
          : `<p>This invoice has been successfully marked as paid in the system.</p>`}
        <p>Best regards,<br>The BREVI™ Team</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          This is an automated email. Please do not reply directly to this address.
        </p>
      </body>
    </html>
  `

  try {
    await sendEmail({
      to,
      subject,
      html,
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error in sendInvoicePaidEmail:', error)
    // Re-throw the error so it can be caught by the caller
    throw error
  }
}

// Send supplier invoice creation notification email
export async function sendSupplierInvoiceCreatedEmail(
  invoiceNumber: string,
  supplierName: string,
  supplierEmail: string,
  totalAmount: number,
  orderNumbers: string[]
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(totalAmount)

  const subject = `New Supplier Invoice: ${invoiceNumber}`
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">New Supplier Invoice Received</h1>
        </div>
        <p>Hello BREVI™ Team,</p>
        <p>A new supplier invoice has been created and requires your attention.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #14b8a6;">Invoice Details</h3>
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Supplier:</strong> ${supplierName} (${supplierEmail})</p>
          <p><strong>Total Amount:</strong> ${formattedAmount}</p>
          <p><strong>Order Numbers:</strong> ${orderNumbers.join(', ')}</p>
          <p><strong>Date Created:</strong> ${new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</p>
        </div>
        <p>Please review and process this invoice in the admin panel.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${siteUrl}/admin/payments" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Invoice</a>
        </div>
        <p>Best regards,<br>The BREVI System</p>
      </body>
    </html>
  `

  try {
    // Send to system email using system email config (not SendGrid)
    await sendEmail({
      to: 'hello@brevibrushes.com',
      subject,
      html,
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error in sendSupplierInvoiceCreatedEmail:', error)
    throw error
  }
}

/** Notify staff when a customer adds a message from the account support portal. */
export async function sendAdminNotificationCustomerPortalReply(params: {
  ticketId: string
  ticketNumber: string
  subject: string
  customerName: string
  customerEmail: string
  message: string
}) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const adminEmails = await getAdminEmails()
  const systemEmail = 'hello@brevibrushes.com'
  const safe = params.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const safeSubject = params.subject
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Customer reply — ${params.ticketNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #14b8a6;">Customer replied (account)</h1>
        <p><strong>${params.customerName}</strong> (${params.customerEmail}) sent a message on ticket <strong>${params.ticketNumber}</strong>.</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <div style="background-color: #f5f5f5; padding: 16px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; white-space: pre-wrap;">${safe}</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${origin}/admin/support/${params.ticketId}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">Open in admin</a>
        </div>
      </body>
    </html>
  `

  const subject = `Customer reply: ${ticketSubjectTag(params.ticketNumber)} ${params.subject}`

  try {
    await sendEmail({ to: systemEmail, subject, html })
  } catch (e) {
    console.error('sendAdminNotificationCustomerPortalReply system:', e)
  }

  for (const adminEmail of adminEmails.filter((e) => e && e !== systemEmail)) {
    try {
      await sendEmail({ to: adminEmail, subject, html })
    } catch (e) {
      console.error('sendAdminNotificationCustomerPortalReply admin:', adminEmail, e)
    }
  }

  return { success: true }
}

export async function sendTicketReplyEmail(
  to: string,
  customerName: string,
  ticketNumber: string,
  subject: string,
  message: string,
  ticketId: string
) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const replyLocalPart = process.env.TICKET_REPLY_LOCAL_PART || 'hello' // must exist as a mailbox (O365 plus-addressing)
  const replyDomain =
    process.env.TICKET_REPLY_DOMAIN ||
    origin.replace('https://', '').replace('http://', '')
  const replyEmail = `${replyLocalPart}+${ticketId}@${replyDomain}`
  
  const tag = ticketSubjectTag(ticketNumber)

  // Get all admin emails
  const adminEmails = await getAdminEmails()
  const systemEmail = 'hello@brevibrushes.com'
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Re: ${tag} ${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">New Reply to Your Ticket</h1>
        </div>
        <p>Hi ${customerName},</p>
        <p>You have received a new reply to your support ticket <strong>${ticketNumber}</strong>.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #14b8a6;">Ticket: ${subject}</h3>
          <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
        </div>
        <div style="background-color: #ffffff; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #14b8a6;">Reply:</h4>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${origin}/account/support/${ticketId}" style="background-color: #111827; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 600;">Reply in your account</a>
        </div>
        <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;"><strong>💡 Tip:</strong> You can reply to this email to add a message to your ticket. Your reply will be automatically added to the ticket.</p>
        </div>
        <p>Best regards,<br>The BREVI™ Support Team</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          This is an automated email. Please do not reply directly to this address.<br>
          To reply to this ticket, use the button above, reply to this email, or open Support in your BREVI™ account.
        </p>
      </body>
    </html>
  `

  // Send to customer
  await sendEmail({
    to,
    subject: `Re: ${tag} ${subject}`,
    html,
    replyTo: replyEmail,
  })

  // Send notification to admins about the reply (optional - you may want to skip this to avoid spam)
  // Uncomment if you want admins to be notified of every reply
  /*
  const adminHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket Reply - ${ticketNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">New Reply Added to Ticket</h1>
        </div>
        <p>A new reply has been added to support ticket <strong>${ticketNumber}</strong>.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #14b8a6;">Ticket Details</h3>
          <p><strong>Ticket Number:</strong> ${ticketNumber}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Subject:</strong> ${subject}</p>
        </div>
        <div style="background-color: #ffffff; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #14b8a6;">Admin Reply:</h4>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${origin}/admin/support/${ticketId}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Ticket</a>
        </div>
      </body>
    </html>
  `

  if (adminEmails.length > 0) {
    await sendEmail({
      to: systemEmail,
      subject: `Ticket Reply ${tag} ${subject}`,
      html: adminHtml,
    })
  }
  */

  return { success: true }
}

// Send password reset email with custom branding
// Send order update notification email to customer
export async function sendOrderUpdateEmail(
  to: string,
  customerName: string,
  orderNumber: string,
  changes: string[],
  shippingAddress: any,
  customerPhone?: string | null
) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Update - ${orderNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Order Update</h1>
          <p style="font-size: 18px; font-weight: bold;">Order #${orderNumber}</p>
        </div>
        <p>Hi ${customerName},</p>
        <p>We wanted to inform you that your order has been updated. The following ${changes.length === 1 ? 'change has' : 'changes have'} been made:</p>
        
        <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #856404;">Updated Information:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${changes.map(change => `<li style="margin: 5px 0;">${change.charAt(0).toUpperCase() + change.slice(1)}</li>`).join('')}
          </ul>
        </div>

        ${shippingAddress ? `
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #14b8a6;">Updated Shipping Address:</h3>
          <p style="margin: 4px 0;">${shippingAddress.address_line1 || ''}</p>
          ${shippingAddress.address_line2 ? `<p style="margin: 4px 0;">${shippingAddress.address_line2}</p>` : ''}
          <p style="margin: 4px 0;">
            ${shippingAddress.city || ''}${shippingAddress.city && shippingAddress.state ? ', ' : ''}${shippingAddress.state || ''} ${shippingAddress.postal_code || ''}
          </p>
          ${shippingAddress.country ? `<p style="margin: 4px 0;">${shippingAddress.country}</p>` : ''}
        </div>
        ` : ''}

        ${customerPhone ? `
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #14b8a6;">Updated Phone Number:</h3>
          <p style="margin: 4px 0;">${customerPhone}</p>
        </div>
        ` : ''}

        <div style="background-color: #e7f3ff; border-left: 4px solid #14b8a6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px;">
            <strong>Note:</strong> If you did not request these changes or notice any discrepancies, please contact our support team immediately.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${origin}/account/orders/${orderNumber}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Order</a>
        </div>

        <p>Best regards,<br>The BREVI™ Team</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="font-size: 12px; color: #666; text-align: center;">
          This is an automated email. If you have any questions, please contact us at hello@brevibrushes.com
        </p>
      </body>
    </html>
  `

  await sendEmail({
    to,
    subject: `Order Update - ${orderNumber}`,
    html,
  })
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetLink: string
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const origin = siteUrl
  
  // Normalize reset link to use production URL
  const normalizedResetLink = normalizeUrl(resetLink)
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - BREVI</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Reset Your Password</h1>
        </div>
        
        <p>Hi ${name || 'there'},</p>
        <p>We received a request to reset your password for your BREVI account. Click the button below to create a new password:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${normalizedResetLink}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </div>
        
        <p style="font-size: 12px; color: #666; margin-top: 20px;">
          This link will expire in 1 hour for security reasons.
        </p>
        
        <p style="font-size: 12px; color: #666;">
          If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
        </p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #666;">
          <p>Having trouble with the link? Copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #14b8a6;">${normalizedResetLink}</p>
        </div>
        
        <p style="margin-top: 30px;">Best regards,<br>The BREVI™ Team</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated email. Please do not reply to this message.</p>
          <p style="margin-top: 10px;">
            <a href="${origin}" style="color: #14b8a6; text-decoration: none;">Visit BREVI</a> | 
            <a href="${origin}/contact" style="color: #14b8a6; text-decoration: none;">Contact Support</a>
          </p>
        </div>
      </body>
    </html>
  `

  try {
    const result = await sendEmail({
      to,
      subject: 'Reset Your BREVI Password',
      html,
    })
    console.log('Password reset email sent successfully:', { to, messageId: result?.messageId })
    return result
  } catch (error: any) {
    console.error('Error in sendPasswordResetEmail:', error)
    console.error('Error details:', {
      to,
      message: error.message,
      stack: error.stack,
    })
    throw error
  }
}

// ===========================
// AFFILIATE EMAILS
// ===========================

// Send affiliate invitation email
export async function sendAffiliateInvitationEmail(
  to: string,
  name: string,
  invitationToken: string,
  tierName?: string,
  commissionRate?: number
) {
  const normalizedUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com')
  const invitationUrl = `${normalizedUrl}/affiliate/register?token=${invitationToken}`
  
  const tierInfo = tierName && commissionRate
    ? `<p><strong>Assigned Tier:</strong> ${tierName} (${commissionRate}% commission)</p>`
    : ''

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're Invited to Join BREVI Affiliate Program</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">You're Invited to Join BREVI Affiliates!</h1>
        </div>
        <p>Hi ${name},</p>
        <p>You've been invited to join the BREVI Affiliate Program! As an affiliate partner, you'll earn competitive commissions for every customer you refer.</p>
        ${tierInfo}
        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">What You'll Get:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Competitive commission rates</li>
            <li>Real-time performance tracking</li>
            <li>Easy-to-use affiliate dashboard</li>
            <li>Unique affiliate links for products</li>
            <li>Fast and secure payouts</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationUrl}" style="background-color: #14b8a6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Accept Invitation & Register</a>
        </div>
        <p style="color: #666; font-size: 14px;">This invitation link will expire in 7 days. If you have any questions, please contact our affiliate support team.</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: 'You\'re Invited to Join BREVI Affiliate Program',
    html,
  })
}

// Send affiliate account approved email
export async function sendAffiliateApprovedEmail(
  to: string,
  name: string,
  affiliateCode: string,
  dashboardUrl: string,
  tierName?: string,
  commissionRate?: number
) {
  const normalizedUrl = normalizeUrl(dashboardUrl)
  const tierInfo = tierName && commissionRate
    ? `<p><strong>Your Tier:</strong> ${tierName} (${commissionRate}% commission)</p>`
    : ''

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your BREVI Affiliate Account Has Been Approved</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Congratulations! Your Affiliate Account is Active</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Great news! Your BREVI affiliate application has been approved. You can now start earning commissions by sharing BREVI products with your audience.</p>
        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">Your Affiliate Details</h3>
          <p><strong>Affiliate Code:</strong> <code style="background-color: #e0f2f1; padding: 4px 8px; border-radius: 3px; font-family: monospace;">${affiliateCode}</code></p>
          ${tierInfo}
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${normalizedUrl}" style="background-color: #14b8a6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Access Your Dashboard</a>
        </div>
        <p><strong>Next Steps:</strong></p>
        <ol style="padding-left: 20px;">
          <li>Log in to your affiliate dashboard</li>
          <li>Generate your unique affiliate links</li>
          <li>Start sharing and earning commissions!</li>
        </ol>
        <p>If you have any questions, our affiliate support team is here to help.</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: 'Your BREVI Affiliate Account Has Been Approved',
    html,
  })
}

// Send affiliate application confirmation email
export async function sendAffiliateApplicationConfirmationEmail(
  to: string,
  name: string
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Affiliate Application Has Been Received</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Application Received!</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Thank you for applying to join the BREVI Affiliate Program! We've received your application and our team is reviewing it.</p>
        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">What Happens Next?</h3>
          <ol style="margin: 0; padding-left: 20px;">
            <li>Our team will review your application (usually within 1-2 business days)</li>
            <li>You'll receive an email notification once your application is approved</li>
            <li>Once approved, you'll get access to your affiliate dashboard and unique affiliate links</li>
            <li>Start sharing and earning commissions!</li>
          </ol>
        </div>
        <p><strong>Note:</strong> Your commission tier will be assigned by our team based on your application and performance. You'll be notified of your tier assignment when your application is approved.</p>
        <p>If you have any questions in the meantime, feel free to contact our affiliate support team.</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: 'Your BREVI Affiliate Application Has Been Received',
    html,
  })
}

// Send affiliate payout notification email
export async function sendAffiliatePayoutEmail(
  to: string,
  name: string,
  amount: number,
  paymentMethod: string,
  paymentDetails?: any,
  transactionId?: string
) {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

  const paymentInfo = paymentMethod === 'paypal' && paymentDetails?.paypal_email
    ? `<p><strong>PayPal Email:</strong> ${paymentDetails.paypal_email}</p>`
    : paymentMethod === 'bank_transfer' && paymentDetails?.account_number
    ? `<p><strong>Account:</strong> ****${paymentDetails.account_number.slice(-4)}</p>`
    : ''

  const transactionInfo = transactionId
    ? `<p><strong>Transaction ID:</strong> ${transactionId}</p>`
    : ''

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Affiliate Payout Has Been Processed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Your Payout Has Been Processed</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Great news! Your affiliate commission payout has been processed and sent to your account.</p>
        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">Payout Details</h3>
          <p style="font-size: 24px; font-weight: bold; color: #14b8a6; margin: 10px 0;">${formattedAmount}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod === 'paypal' ? 'PayPal' : paymentMethod === 'bank_transfer' ? 'Bank Transfer' : 'Check'}</p>
          ${paymentInfo}
          ${transactionInfo}
        </div>
        <p>The funds should appear in your account within 3-5 business days, depending on your payment method.</p>
        <p>You can view your payout history and earnings in your <a href="${normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com')}/account/affiliate" style="color: #14b8a6;">affiliate dashboard</a>.</p>
        <p>Thank you for being a valued BREVI affiliate partner!</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Your Affiliate Payout: ${formattedAmount}`,
    html,
  })
}

// ===========================
// SUBSCRIPTION EMAIL FUNCTIONS
// ===========================

// Send new subscription email
export async function sendSubscriptionPausedEmail(
  to: string,
  name: string,
  productName: string
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const accountUrl = `${siteUrl}/account/subscriptions`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Paused</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Subscription Paused</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Your subscription for <strong>${productName}</strong> has been paused.</p>
        <p>No further charges or shipments will occur while your subscription is paused. You can resume it anytime from your account.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accountUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Manage Subscription
          </a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Your Subscription Has Been Paused`,
    html,
  })
}

// Send subscription resumed email
export async function sendSubscriptionResumedEmail(
  to: string,
  name: string,
  productName: string
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const accountUrl = `${siteUrl}/account/subscriptions`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Resumed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Subscription Resumed</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Great news! Your subscription for <strong>${productName}</strong> has been resumed.</p>
        <p>Your subscription will continue as scheduled. You'll receive your next shipment and billing according to your subscription plan.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accountUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Manage Subscription
          </a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Your Subscription Has Been Resumed`,
    html,
  })
}

// Send subscription cancelled email
export async function sendSubscriptionCancelledEmail(
  to: string,
  name: string,
  productName: string
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Cancelled</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Subscription Cancelled</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Your subscription for <strong>${productName}</strong> has been cancelled.</p>
        <p>No further charges or shipments will occur. We're sorry to see you go!</p>
        <p>If you change your mind, you can always start a new subscription anytime.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${siteUrl}/product" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Browse Products
          </a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Your Subscription Has Been Cancelled`,
    html,
  })
}

// Send order skipped email
export async function sendOrderSkippedEmail(
  to: string,
  name: string,
  productName: string
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const accountUrl = `${siteUrl}/account/subscriptions`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Skipped</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Order Skipped</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Your next scheduled order for <strong>${productName}</strong> has been skipped.</p>
        <p>Your subscription will continue, and the next order will be scheduled according to your subscription plan.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accountUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Manage Subscription
          </a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Your Next Order Has Been Skipped`,
    html,
  })
}

// Send subscription edited email
export async function sendSubscriptionEditedEmail(
  to: string,
  name: string,
  productName: string
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const accountUrl = `${siteUrl}/account/subscriptions`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Updated</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Subscription Updated</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Your subscription for <strong>${productName}</strong> has been updated.</p>
        <p>The changes will take effect on your next billing cycle.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accountUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            View Subscription
          </a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Your Subscription Has Been Updated - ${productName}`,
    html,
  })
}

// Send new subscription email
export async function sendNewSubscriptionEmail(
  to: string,
  name: string,
  productName: string
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const accountUrl = `${siteUrl}/account/subscriptions`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Your New Subscription</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Welcome to Your New Subscription!</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Thank you for subscribing to <strong>${productName}</strong>!</p>
        <p>Your subscription is now active and you'll receive regular deliveries according to your subscription plan.</p>
        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">What's Next?</h3>
          <p>You can manage your subscription anytime from your account:</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Update delivery frequency</li>
            <li>Pause or resume your subscription</li>
            <li>Update payment method</li>
            <li>View subscription history</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accountUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Manage Subscription
          </a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Welcome to Your New Subscription - ${productName}`,
    html,
  })
}

// Send email when an order is converted to a subscription (by admin)
export async function sendOrderConvertedToSubscriptionEmail(
  to: string,
  name: string,
  productName: string,
  orderNumber: string,
  frequencyLabel: string,
  nextBillingDate: string
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const accountUrl = `${siteUrl}/account/subscriptions`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Order Is Now a Subscription</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Your Order Is Now a Subscription</h1>
        </div>
        <p>Hi ${name},</p>
        <p>Good news! Your order <strong>#${orderNumber}</strong> has been converted to a subscription for <strong>${productName}</strong>.</p>
        <p>You'll receive deliveries every <strong>${frequencyLabel}</strong>. Your existing order counts as your first delivery; the next charge and shipment will be on <strong>${nextBillingDate}</strong>.</p>
        <div style="background-color: #f0fdfa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #14b8a6;">
          <h3 style="margin-top: 0; color: #14b8a6;">Manage Your Subscription</h3>
          <p>You can update frequency, pause, update payment, or cancel anytime from your account.</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${accountUrl}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            View Subscription
          </a>
        </div>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  return sendEmail({
    to,
    subject: `Your order #${orderNumber} is now a subscription - ${productName}`,
    html,
  })
}

// Send replacement shipped notification email
export async function sendReplacementShippedEmail(
  to: string,
  recipientName: string,
  returnNumber: string,
  orderNumber: string,
  productName: string,
  trackingNumber: string,
  carrier: string
) {
  // Generate proper tracking URL using the tracking-urls utility
  let trackingUrl: string | null = null
  if (trackingNumber && carrier) {
    const { getTrackingUrl } = await import('@/lib/tracking-urls')
    trackingUrl = getTrackingUrl(carrier, trackingNumber)
    // Fallback to Google search if no specific URL is available
    if (!trackingUrl) {
      trackingUrl = `https://www.google.com/search?q=${encodeURIComponent(carrier)}+tracking+${encodeURIComponent(trackingNumber)}`
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Replacement Shipped</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #14b8a6;">Replacement Shipped</h1>
        </div>
        <p>Hi ${recipientName},</p>
        <p>Good news! Your replacement for the following item has been shipped:</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Return Number:</strong> ${returnNumber}</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <p><strong>Product:</strong> ${productName}</p>
          ${trackingNumber ? `<p><strong>Tracking Number:</strong> ${trackingUrl ? `<a href="${trackingUrl}" target="_blank" style="color: #14b8a6; text-decoration: underline;">${trackingNumber}</a>` : trackingNumber}</p>` : ''}
          ${carrier ? `<p><strong>Carrier:</strong> ${carrier}</p>` : ''}
        </div>
        ${trackingUrl ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${trackingUrl}" target="_blank" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Track Your Replacement</a>
        </div>
        ` : ''}
        <p>Your replacement should arrive soon. If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>The BREVI™ Team</p>
      </body>
    </html>
  `

  try {
    await sendEmail({
      to,
      subject: `Replacement Shipped - ${returnNumber}`,
      html,
      categories: ['return', 'replacement', 'shipping'],
    })
    return { success: true }
  } catch (error: any) {
    console.error('Error sending replacement shipped email:', error)
    throw error
  }
}

