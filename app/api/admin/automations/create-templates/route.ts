import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { normalizePromoCode } from '@/lib/promo-utils'

// Helper function to create or get promotion code (uses same normalization as checkout)
async function ensurePromotionCode(
  code: string,
  discountType: 'percentage' | 'fixed' | 'free_shipping',
  discountValue: number,
  description?: string
) {
  const supabase = createAdminSupabaseClient()
  const normalized = normalizePromoCode(code)
  if (!normalized) return { success: false, promotionId: null, created: false }

  // Check if promotion already exists
  const { data: existing } = await supabase
    .from('promotions')
    .select('id')
    .eq('code', normalized)
    .single()
  
  if (existing) {
    return { success: true, promotionId: existing.id, created: false }
  }
  
  // Create new promotion with normalized code
  const { data: promotion, error } = await supabase
    .from('promotions')
    .insert({
      code: normalized,
      discount_type: discountType,
      discount_value: discountValue,
      status: 'active',
    })
    .select()
    .single()
  
  if (error) {
    console.error(`Error creating promotion ${code}:`, error)
    return { success: false, promotionId: null, created: false }
  }
  
  return { success: true, promotionId: promotion.id, created: true }
}

// Helper function to create automation (duplicated from server action to work in API route)
async function createAutomationInRoute(input: {
  name: string
  description?: string
  trigger_type: string
  trigger_config: any
  steps: Array<{
    step_order: number
    delay_hours: number
    template_id?: string
    subject: string
    content: any
    html_content?: string
  }>
}, userId?: string) {
  const supabase = createAdminSupabaseClient()

  // Create automation
  const automationData = {
    name: input.name,
    description: input.description || null,
    trigger_type: input.trigger_type,
    trigger_config: input.trigger_config,
    is_active: false, // Start as inactive so user can review before activating
    created_by: userId || null,
  }

  const { data: automation, error: automationError } = await supabase
    .from("email_automations")
    .insert(automationData)
    .select()
    .single()

  if (automationError) {
    console.error("Error creating email automation:", automationError)
    return { success: false, error: automationError.message, data: null }
  }

  // Create steps
  if (input.steps && input.steps.length > 0) {
    const stepsData = input.steps.map((step, index) => ({
      automation_id: automation.id,
      step_order: step.step_order || index + 1,
      delay_hours: step.delay_hours || 0,
      template_id: step.template_id || null,
      subject: step.subject,
      content: step.content || {},
      html_content: step.html_content || null,
    }))

    const { error: stepsError } = await supabase.from("email_automation_steps").insert(stepsData)

    if (stepsError) {
      console.error("Error creating automation steps:", stepsError)
      // Delete automation if steps fail
      await supabase.from("email_automations").delete().eq("id", automation.id)
      return { success: false, error: stepsError.message, data: null }
    }
  }

  return { success: true, data: automation, error: null }
}

// POST - Create all pre-built automation templates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userId = body.userId || null
    
    const automations = []
    const errors = []
    const promotionCodesCreated: string[] = []
    const promotionCodesExisted: string[] = []
    
    // Create promotion codes for automations (if they don't exist)
    // Abandoned Cart: CART10 (10% off)
    const cart10Result = await ensurePromotionCode('CART10', 'percentage', 10, 'Abandoned cart recovery - 10% off')
    if (cart10Result.created) promotionCodesCreated.push('CART10')
    else if (cart10Result.success) promotionCodesExisted.push('CART10')
    
    // Win-Back: COMEBACK15 (15% off) and FINAL20 (20% off)
    const comeback15Result = await ensurePromotionCode('COMEBACK15', 'percentage', 15, 'Win-back campaign - 15% off')
    if (comeback15Result.created) promotionCodesCreated.push('COMEBACK15')
    else if (comeback15Result.success) promotionCodesExisted.push('COMEBACK15')
    
    const final20Result = await ensurePromotionCode('FINAL20', 'percentage', 20, 'Win-back campaign - 20% off')
    if (final20Result.created) promotionCodesCreated.push('FINAL20')
    else if (final20Result.success) promotionCodesExisted.push('FINAL20')
    
    // Birthday: BIRTHDAY20 (20% off)
    const birthday20Result = await ensurePromotionCode('BIRTHDAY20', 'percentage', 20, 'Birthday special - 20% off')
    if (birthday20Result.created) promotionCodesCreated.push('BIRTHDAY20')
    else if (birthday20Result.success) promotionCodesExisted.push('BIRTHDAY20')
    
    // 1. Welcome Series (3 emails)
    try {
      const welcomeSeries = await createAutomationInRoute({
        name: "Welcome Series",
        description: "3-email welcome series for new subscribers",
        trigger_type: "new_subscriber",
        trigger_config: {},
        steps: [
          {
            step_order: 1,
            delay_hours: 0,
            subject: "Welcome to BREVI! 🎉",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #14b8a6;">Welcome to BREVI!</h1>
                  </div>
                  <p>Hi {{firstName}},</p>
                  <p>Thank you for joining BREVI! We're excited to have you as part of our community.</p>
                  <p>Start exploring our premium toothbrushes and discover why thousands of customers trust BREVI for their oral care.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Shop Now</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
          {
            step_order: 2,
            delay_hours: 24,
            subject: "Discover Our Premium Products",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>Ready to upgrade your oral care routine? Our premium nano toothbrushes are designed with Nordic inspiration for the perfect clean.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com/products" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Explore Products</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
          {
            step_order: 3,
            delay_hours: 72,
            subject: "Special Offer: 10% Off Your First Order",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>As a welcome gift, enjoy 10% off your first order! Use code: WELCOME10</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Shop Now</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
        ],
      }, userId)
      if (welcomeSeries.success) automations.push({ name: "Welcome Series", id: welcomeSeries.data?.id })
      else errors.push(`Welcome Series: ${welcomeSeries.error}`)
    } catch (error: any) {
      errors.push(`Welcome Series: ${error.message}`)
    }
    
    // 2. Abandoned Cart Recovery (3 emails)
    try {
      const abandonedCart = await createAutomationInRoute({
        name: "Abandoned Cart Recovery",
        description: "3-email sequence to recover abandoned carts",
        trigger_type: "abandoned_cart",
        trigger_config: {},
        steps: [
          {
            step_order: 1,
            delay_hours: 1,
            subject: "You left something in your cart! 🛒",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>We noticed you left some items in your cart. Complete your purchase now!</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="{{cartLink}}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Purchase</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
          {
            step_order: 2,
            delay_hours: 24,
            subject: "Still interested? Here's 10% off!",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>Complete your purchase and save 10%! Use code: CART10</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="{{cartLink}}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Purchase</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
          {
            step_order: 3,
            delay_hours: 72,
            subject: "Last chance to complete your order",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>This is your last chance! Complete your purchase now before your cart expires.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="{{cartLink}}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Purchase</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
        ],
      }, userId)
      if (abandonedCart.success) automations.push({ name: "Abandoned Cart Recovery", id: abandonedCart.data?.id })
      else errors.push(`Abandoned Cart: ${abandonedCart.error}`)
    } catch (error: any) {
      errors.push(`Abandoned Cart: ${error.message}`)
    }
    
    // 3. Post-Purchase Follow-up (3 emails)
    try {
      const postPurchase = await createAutomationInRoute({
        name: "Post-Purchase Follow-up",
        description: "Follow-up emails after purchase completion",
        trigger_type: "post_purchase",
        trigger_config: {},
        steps: [
          {
            step_order: 1,
            delay_hours: 0,
            subject: "Thank you for your order!",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>Thank you for your order! We're preparing it for shipment.</p>
                  <p>You'll receive a shipping confirmation email once your order is on its way.</p>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
          {
            step_order: 2,
            delay_hours: 0,
            subject: "Your order has shipped! 📦",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>Great news! Your order has shipped and is on its way to you.</p>
                  <p>You can track your order in your account dashboard.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com/account/orders" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Track Order</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
          {
            step_order: 3,
            delay_hours: 72,
            subject: "How was your experience?",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>We hope you're loving your BREVI products! We'd love to hear about your experience.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com/account/orders" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Leave a Review</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
        ],
      }, userId)
      if (postPurchase.success) automations.push({ name: "Post-Purchase Follow-up", id: postPurchase.data?.id })
      else errors.push(`Post-Purchase: ${postPurchase.error}`)
    } catch (error: any) {
      errors.push(`Post-Purchase: ${error.message}`)
    }
    
    // 4. Win-Back Campaign (2 emails)
    try {
      const winBack = await createAutomationInRoute({
        name: "Win-Back Campaign",
        description: "Re-engage inactive customers",
        trigger_type: "win_back",
        trigger_config: { days_inactive: 90 },
        steps: [
          {
            step_order: 1,
            delay_hours: 0,
            subject: "We miss you! Come back to BREVI",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>We haven't seen you in a while! We miss you and would love to have you back.</p>
                  <p>Enjoy 15% off your next order with code: COMEBACK15</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Shop Now</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
          {
            step_order: 2,
            delay_hours: 168,
            subject: "Last chance: 20% off everything!",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>This is your last chance! Get 20% off everything with code: FINAL20</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Shop Now</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
        ],
      }, userId)
      if (winBack.success) automations.push({ name: "Win-Back Campaign", id: winBack.data?.id })
      else errors.push(`Win-Back: ${winBack.error}`)
    } catch (error: any) {
      errors.push(`Win-Back: ${error.message}`)
    }
    
    // 5. Birthday Campaign (1 email)
    try {
      const birthday = await createAutomationInRoute({
        name: "Birthday Campaign",
        description: "Send birthday discount to customers",
        trigger_type: "birthday",
        trigger_config: {},
        steps: [
          {
            step_order: 1,
            delay_hours: 0,
            subject: "Happy Birthday! 🎂 Special Gift for You",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>Happy Birthday! 🎉</p>
                  <p>As a special birthday gift, enjoy 20% off your entire order! Use code: BIRTHDAY20</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Shop Now</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
        ],
      }, userId)
      if (birthday.success) automations.push({ name: "Birthday Campaign", id: birthday.data?.id })
      else errors.push(`Birthday: ${birthday.error}`)
    } catch (error: any) {
      errors.push(`Birthday: ${error.message}`)
    }
    
    // 6. Incomplete Payment Recovery (2 emails)
    try {
      const paymentRecovery = await createAutomationInRoute({
        name: "Incomplete Payment Recovery",
        description: "Recover failed payment attempts",
        trigger_type: "custom",
        trigger_config: { trigger_name: "incomplete_payment" },
        steps: [
          {
            step_order: 1,
            delay_hours: 1,
            subject: "Payment Issue - We're Here to Help",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>We noticed there was an issue processing your payment. Don't worry, we're here to help!</p>
                  <p>Please try again or contact us if you need assistance.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com/checkout" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Payment</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
          {
            step_order: 2,
            delay_hours: 24,
            subject: "Still having payment issues? Let's fix it together",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <p>Hi {{firstName}},</p>
                  <p>If you're still experiencing payment issues, our support team is ready to help!</p>
                  <p>Contact us at support@brevibrushes.com or try completing your order again.</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="https://brevibrushes.com/checkout" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Payment</a>
                  </div>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
        ],
      }, userId)
      if (paymentRecovery.success) automations.push({ name: "Incomplete Payment Recovery", id: paymentRecovery.data?.id })
      else errors.push(`Payment Recovery: ${paymentRecovery.error}`)
    } catch (error: any) {
      errors.push(`Payment Recovery: ${error.message}`)
    }

    // 7. Review Request (1 email - sent 25 days after purchase)
    try {
      const reviewRequest = await createAutomationInRoute({
        name: "Review Request",
        description: "Request product review 25 days after purchase",
        trigger_type: "review_request",
        trigger_config: {
          days_after_purchase: 25,
        },
        steps: [
          {
            step_order: 1,
            delay_hours: 0,
            subject: "How was your BREVI experience? We'd love your feedback! ⭐",
            html_content: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #14b8a6;">We'd Love Your Feedback!</h1>
                  </div>
                  <p>Hi {{firstName}},</p>
                  <p>It's been about 25 days since your purchase, and we hope you're loving your BREVI toothbrush!</p>
                  <p>Your experience matters to us and helps other customers make informed decisions. Would you mind sharing your thoughts?</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="{{reviewLink}}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Leave a Review</a>
                  </div>
                  <p>It only takes a minute, and you'll help others discover the BREVI difference!</p>
                  <p>Thank you for being a valued BREVI customer.</p>
                  <p>Best regards,<br>The BREVI™ Team</p>
                </body>
              </html>
            `,
            content: {},
          },
        ],
      }, userId)
      if (reviewRequest.success) automations.push({ name: "Review Request", id: reviewRequest.data?.id })
      else errors.push(`Review Request: ${reviewRequest.error}`)
    } catch (error: any) {
      errors.push(`Review Request: ${error.message}`)
    }
    
    return NextResponse.json({
      success: automations.length > 0,
      message: `Created ${automations.length} automation templates${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
      automations,
      errors: errors.length > 0 ? errors : undefined,
      promotionCodes: {
        created: promotionCodesCreated,
        alreadyExisted: promotionCodesExisted,
      },
    })
  } catch (error: any) {
    console.error('Error creating automation templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create automation templates', success: false },
      { status: 500 }
    )
  }
}
