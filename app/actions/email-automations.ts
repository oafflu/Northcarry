"use server"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export interface EmailAutomation {
  id: string
  name: string
  description?: string
  trigger_type: string
  trigger_config: any
  is_active: boolean
  total_sent: number
  open_rate?: number
  click_rate?: number
  conversion_rate?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface AutomationStep {
  id: string
  automation_id: string
  step_order: number
  delay_hours: number
  template_id?: string
  subject: string
  content: any
  html_content?: string
  created_at: string
}

export interface CreateAutomationInput {
  name: string
  description?: string
  trigger_type: string
  trigger_config: any
  steps: Omit<AutomationStep, "id" | "automation_id" | "created_at">[]
}

export interface UpdateAutomationInput {
  name?: string
  description?: string
  trigger_type?: string
  trigger_config?: any
  is_active?: boolean
}

/**
 * Get all email automations
 */
export async function getEmailAutomations(filters?: {
  is_active?: boolean
  trigger_type?: string
  search?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    let query = supabase.from("email_automations").select("*").order("created_at", { ascending: false })

    if (filters?.is_active !== undefined) {
      query = query.eq("is_active", filters.is_active)
    }

    if (filters?.trigger_type) {
      query = query.eq("trigger_type", filters.trigger_type)
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching email automations:", error)
      return { success: false, error: error.message, data: null }
    }

    // Fetch steps for each automation
    const automationsWithSteps = await Promise.all(
      (data || []).map(async (automation) => {
        const { data: steps } = await supabase
          .from("email_automation_steps")
          .select("*")
          .eq("automation_id", automation.id)
          .order("step_order", { ascending: true })
        return { ...automation, steps: steps || [] }
      })
    )

    return { success: true, data: automationsWithSteps, error: null }
  } catch (error: any) {
    console.error("Error in getEmailAutomations:", error)
    return { success: false, error: error.message || "Failed to fetch automations", data: null }
  }
}

/**
 * Get a single email automation by ID
 */
export async function getEmailAutomationById(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data: automation, error } = await supabase
      .from("email_automations")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("Error fetching email automation:", error)
      return { success: false, error: error.message, data: null }
    }

    // Fetch steps
    const { data: steps } = await supabase
      .from("email_automation_steps")
      .select("*")
      .eq("automation_id", id)
      .order("step_order", { ascending: true })

    return { success: true, data: { ...automation, steps: steps || [] }, error: null }
  } catch (error: any) {
    console.error("Error in getEmailAutomationById:", error)
    return { success: false, error: error.message || "Failed to fetch automation", data: null }
  }
}

/**
 * Create a new email automation
 */
export async function createEmailAutomation(input: CreateAutomationInput, userId?: string) {
  try {
    const supabase = createAdminSupabaseClient()

    // Create automation
    const automationData = {
      name: input.name,
      description: input.description || null,
      trigger_type: input.trigger_type,
      trigger_config: input.trigger_config,
      is_active: true,
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

    revalidatePath("/admin/email-marketing/automations")
    return { success: true, data: automation, error: null }
  } catch (error: any) {
    console.error("Error in createEmailAutomation:", error)
    return { success: false, error: error.message || "Failed to create automation", data: null }
  }
}

/**
 * Update an email automation
 */
export async function updateEmailAutomation(id: string, input: UpdateAutomationInput) {
  try {
    const supabase = createAdminSupabaseClient()

    const updateData: any = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.trigger_type !== undefined) updateData.trigger_type = input.trigger_type
    if (input.trigger_config !== undefined) updateData.trigger_config = input.trigger_config
    if (input.is_active !== undefined) updateData.is_active = input.is_active

    const { data, error } = await supabase.from("email_automations").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("Error updating email automation:", error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath("/admin/email-marketing/automations")
    revalidatePath(`/admin/email-marketing/automations/${id}`)
    return { success: true, data: data as EmailAutomation, error: null }
  } catch (error: any) {
    console.error("Error in updateEmailAutomation:", error)
    return { success: false, error: error.message || "Failed to update automation", data: null }
  }
}

/**
 * Delete an email automation
 */
export async function deleteEmailAutomation(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from("email_automations").delete().eq("id", id)

    if (error) {
      console.error("Error deleting email automation:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/email-marketing/automations")
    return { success: true, error: null }
  } catch (error: any) {
    console.error("Error in deleteEmailAutomation:", error)
    return { success: false, error: error.message || "Failed to delete automation" }
  }
}

/**
 * Toggle automation active status
 */
export async function toggleAutomationStatus(id: string, isActive: boolean) {
  return updateEmailAutomation(id, { is_active: isActive })
}

/**
 * Execute an automation step - send email via Mailgun
 * This is called when an automation is triggered
 */
export async function executeAutomationStep(
  automationId: string,
  stepId: string,
  recipientEmail: string,
  recipientName?: string,
  extraData?: {
    userId?: string
    sessionId?: string
    [key: string]: any
  }
) {
  try {
    const supabase = createAdminSupabaseClient()

    // Get automation and step
    const { data: automation } = await supabase
      .from("email_automations")
      .select("*")
      .eq("id", automationId)
      .eq("is_active", true)
      .single()

    if (!automation) {
      return { success: false, error: "Automation not found or inactive" }
    }

    const { data: step } = await supabase
      .from("email_automation_steps")
      .select("*")
      .eq("id", stepId)
      .eq("automation_id", automationId)
      .single()

    if (!step) {
      return { success: false, error: "Automation step not found" }
    }

    // Get template if step uses one
    let htmlContent = step.html_content || ""
    let subject = step.subject

    if (step.template_id) {
      const { getEmailTemplateById } = await import("@/app/actions/email-templates")
      const templateResult = await getEmailTemplateById(step.template_id)
      if (templateResult.success && templateResult.data) {
        htmlContent = templateResult.data.html_content || htmlContent
        if (templateResult.data.subject) {
          subject = templateResult.data.subject
        }
      }
    }

    // Personalize email content using template replacement utility
    const { replaceTemplateVariables } = await import('@/lib/email-template-utils')
    const recipientData = {
      email: recipientEmail,
      name: recipientName || '',
      firstName: recipientName ? recipientName.split(" ")[0] : '',
      lastName: recipientName ? recipientName.split(" ").slice(1).join(" ") : '',
      ...(extraData || {}),
    }
    
    htmlContent = replaceTemplateVariables(htmlContent, recipientData)
    subject = replaceTemplateVariables(subject, recipientData)

    // Replace dynamic variables
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
    
    // Replace recipientData variables
    if (recipientData) {
      for (const [key, value] of Object.entries(recipientData)) {
        if (value !== undefined && value !== null) {
          const placeholder = `{{${key}}}`
          htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), String(value))
          subject = subject.replace(new RegExp(placeholder, 'g'), String(value))
        }
      }
    }
    
    // Generate cart recovery link
    let cartLink = `${siteUrl}/cart`
    if (automation.trigger_type === 'abandoned_cart' && recipientData) {
      // For abandoned cart, create a recovery link
      // If user is logged in, cart is automatically loaded by user_id
      // If guest, we'll use a recovery token
      if (recipientData.userId) {
        // Logged-in user: cart is tied to user_id, so /cart works
        cartLink = `${siteUrl}/cart`
      } else if (recipientData.sessionId) {
        // Guest user: create recovery link with session_id token
        // We'll create a recovery endpoint that restores the session
        const recoveryToken = Buffer.from(recipientData.sessionId).toString('base64url')
        cartLink = `${siteUrl}/cart?recover=${recoveryToken}`
      } else {
        // Fallback: try to find session_id from cart_items for this user's email
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', recipientEmail.toLowerCase())
          .single()
        
        if (profile?.id) {
          // User exists, cart should be tied to user_id
          cartLink = `${siteUrl}/cart`
        } else {
          // Guest user without sessionId - try to find any cart items by email
          // For now, just use regular cart link
          cartLink = `${siteUrl}/cart`
        }
      }
    }
    
    // Replace cart link placeholder
    htmlContent = htmlContent.replace(/\{\{cartLink\}\}/g, cartLink)
    htmlContent = htmlContent.replace(/\{\{checkoutLink\}\}/g, `${siteUrl}/checkout`)
    htmlContent = htmlContent.replace(/\{\{shopLink\}\}/g, `${siteUrl}`)

    // Send email via Mailgun (default for all automation emails)
    const { sendMarketingEmail } = await import("@/lib/email-marketing")
    try {
      await sendMarketingEmail({
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
        categories: ["automation", automation.trigger_type],
      })
    } catch (emailError: any) {
      // Log the full error for debugging
      console.error('[executeAutomationStep] Email sending error:', {
        message: emailError.message,
        stack: emailError.stack,
      })
      
      // Provide more helpful error messages
      const errorMessage = emailError.message || ''
      
      // Check if it's a Mailgun-specific error
      if (errorMessage.includes('Mailgun')) {
        if (errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
          throw new Error('Mailgun API key is invalid or expired. Please check your API key in /admin/settings/email')
        } else if (errorMessage.includes('domain') || errorMessage.includes('sender')) {
          throw new Error('Mailgun domain or sender email issue. Please verify:\n\n1. Domain is verified in Mailgun dashboard\n2. Sender email matches verified domain\n3. Check Mailgun configuration in /admin/settings/email')
        }
      }
      // Generic email provider errors
      else if (errorMessage.includes('Email provider not configured') || errorMessage.includes('API key is missing')) {
        throw new Error('Email provider is not configured. Please set up Mailgun in /admin/settings/email')
      }
      
      // For other errors, throw the original error
      throw emailError
    }

    // Update automation metrics
    await supabase
      .from("email_automations")
      .update({
        total_sent: (automation.total_sent || 0) + 1,
      })
      .eq("id", automationId)

    return { success: true, error: null }
  } catch (error: any) {
    console.error("Error executing automation step:", error)
    return { success: false, error: error.message || "Failed to execute automation step" }
  }
}

/**
 * Trigger an automation based on trigger type
 * This is called from various places in the system (checkout, cart abandonment, etc.)
 */
export async function triggerAutomation(
  triggerType: string,
  recipientEmail: string,
  recipientData?: {
    userId?: string
    name?: string
    [key: string]: any
  }
) {
  try {
    const supabase = createAdminSupabaseClient()

    // Find active automations for this trigger type
    const { data: automations } = await supabase
      .from("email_automations")
      .select("*")
      .eq("trigger_type", triggerType)
      .eq("is_active", true)

    if (!automations || automations.length === 0) {
      return { success: true, triggered: 0, message: "No active automations found for this trigger" }
    }

    let triggered = 0

    // Execute first step of each matching automation
    for (const automation of automations) {
      // Check trigger conditions if configured
      if (automation.trigger_config) {
        // For custom triggers, check trigger_name
        if (triggerType === 'custom' && automation.trigger_config.trigger_name) {
          const expectedTriggerName = recipientData?.trigger_name || automation.trigger_config.trigger_name
          if (automation.trigger_config.trigger_name !== expectedTriggerName) {
            continue // Skip this automation if trigger name doesn't match
          }
        }
        // TODO: Implement other trigger condition checking
        // For now, we'll execute all active automations
      }

      // Get first step (step_order = 1)
      const { data: firstStep } = await supabase
        .from("email_automation_steps")
        .select("*")
        .eq("automation_id", automation.id)
        .eq("step_order", 1)
        .single()

      if (firstStep) {
        // If delay is 0, send immediately, otherwise schedule it
        if (firstStep.delay_hours === 0) {
          const result = await executeAutomationStep(
            automation.id,
            firstStep.id,
            recipientEmail,
            recipientData?.name,
            recipientData
          )
          if (result.success) {
            triggered++
          }
        } else {
          // TODO: Implement scheduled step execution
          // For now, we'll send immediately if delay is 0
          const result = await executeAutomationStep(
            automation.id,
            firstStep.id,
            recipientEmail,
            recipientData?.name,
            recipientData
          )
          if (result.success) {
            triggered++
          }
        }
      }
    }

    return { success: true, triggered, error: null }
  } catch (error: any) {
    console.error("Error triggering automation:", error)
    return { success: false, error: error.message || "Failed to trigger automation", triggered: 0 }
  }
}

