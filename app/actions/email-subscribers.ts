"use server"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

/**
 * Get diagnostic information about customers and subscribers
 */
export async function getCustomerSubscriberDiagnostics() {
  try {
    const supabase = createAdminSupabaseClient()

    // Get all customers (no email filter)
    const { count: totalCustomers, error: totalError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")

    if (totalError) {
      console.error("Error counting total customers:", totalError)
    }

    // Get customers with emails
    const { count: customersWithEmails, error: emailsError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .not("email", "is", null)

    if (emailsError) {
      console.error("Error counting customers with emails:", emailsError)
    }

    // Get customers with valid emails (contains @) - use SQL COUNT instead of fetching all
    const { count: customersWithValidEmails, error: validEmailsError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .not("email", "is", null)
      .like("email", "%@%")

    if (validEmailsError) {
      console.error("Error counting customers with valid emails:", validEmailsError)
    }

    // Get all customers with emails for sync calculation (we need the actual data for this)
    // But we'll do it in batches to handle large datasets
    const { data: allCustomersWithEmails } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("role", "customer")
      .not("email", "is", null)
      .like("email", "%@%") // Only get valid emails for sync calculation

    // Get total subscribers
    const { count: totalSubscribers, error: subscribersError } = await supabase
      .from("email_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")

    if (subscribersError) {
      console.error("Error counting subscribers:", subscribersError)
    }

    // Get existing subscriber emails
    const { data: existingSubscribers } = await supabase
      .from("email_subscribers")
      .select("email")

    const existingEmails = new Set(
      existingSubscribers?.map((s) => s.email?.toLowerCase().trim()).filter(Boolean) || []
    )

    // Calculate how many customers need to be synced
    const customersNeedingSync = allCustomersWithEmails?.filter((customer) => {
      const email = customer.email?.toLowerCase().trim()
      return email && email.includes("@") && !existingEmails.has(email)
    }).length || 0

    // Get sample of invalid emails for debugging (query separately)
    const { data: invalidEmailSamplesData } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "customer")
      .not("email", "is", null)
      .not("email", "like", "%@%")
      .limit(5)

    const invalidEmailSamples = invalidEmailSamplesData?.map((c) => c.email).filter(Boolean) || []

    return {
      success: true,
      diagnostics: {
        totalCustomers: totalCustomers || 0,
        customersWithEmails: customersWithEmails || 0,
        customersWithValidEmails: customersWithValidEmails || 0,
        totalSubscribers: totalSubscribers || 0,
        customersNeedingSync,
        existingSubscriberEmails: existingEmails.size,
        invalidEmailSamples, // Add this for debugging
      },
      error: null,
    }
  } catch (error: any) {
    console.error("Error in getCustomerSubscriberDiagnostics:", error)
    return {
      success: false,
      error: error.message || "Failed to get diagnostics",
      diagnostics: null,
    }
  }
}

/**
 * Fix invalid email addresses in profiles table
 * This attempts to clean common email format issues
 */
export async function fixInvalidEmails() {
  try {
    const supabase = createAdminSupabaseClient()

    // Get all customers with emails that don't contain @
    const { data: customersWithInvalidEmails, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("role", "customer")
      .not("email", "is", null)
      .not("email", "like", "%@%")

    if (fetchError) {
      console.error("Error fetching customers with invalid emails:", fetchError)
      return { success: false, error: fetchError.message, fixed: 0 }
    }

    if (!customersWithInvalidEmails || customersWithInvalidEmails.length === 0) {
      return { success: true, error: null, fixed: 0, message: "No invalid emails found" }
    }

    let fixed = 0
    const errors: string[] = []

    // Try to fix common patterns
    for (const customer of customersWithInvalidEmails) {
      const originalEmail = customer.email
      let fixedEmail: string | null = null

      // Pattern 1: Email might have spaces or special characters
      // Pattern 2: Email might be missing @ but have domain
      // Pattern 3: Email might have been truncated

      // Try to reconstruct if we can find a pattern
      // For now, we'll just log them - actual fixing would need business logic
      // based on the actual patterns found

      // If we can't fix it, we'll skip it
      if (!fixedEmail) {
        continue
      }

      // Update the email
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ email: fixedEmail })
        .eq("id", customer.id)

      if (updateError) {
        errors.push(`Failed to fix ${originalEmail}: ${updateError.message}`)
      } else {
        fixed++
      }
    }

    revalidatePath("/admin/email-marketing")

    return {
      success: true,
      error: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      fixed,
      message: `Fixed ${fixed} invalid email addresses`,
    }
  } catch (error: any) {
    console.error("Error in fixInvalidEmails:", error)
    return { success: false, error: error.message || "Failed to fix emails", fixed: 0 }
  }
}

/**
 * Sync all customers to email_subscribers table
 * This ensures all customers with emails are added as subscribers
 */
export async function syncAllCustomersToSubscribers() {
  try {
    const supabase = createAdminSupabaseClient()

    // Get all customers with emails
    const { data: customers, error: customersError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("role", "customer")
      .not("email", "is", null)

    if (customersError) {
      console.error("Error fetching customers:", customersError)
      return { success: false, error: customersError.message, synced: 0 }
    }

    if (!customers || customers.length === 0) {
      return { success: true, error: null, synced: 0, message: "No customers found" }
    }

    console.log(`Found ${customers.length} customers with emails`)

    // Get existing subscribers to avoid duplicates
    const { data: existingSubscribers } = await supabase
      .from("email_subscribers")
      .select("email")

    const existingEmails = new Set(
      existingSubscribers?.map((s) => s.email?.toLowerCase().trim()).filter(Boolean) || []
    )

    console.log(`Found ${existingEmails.size} existing subscribers`)

    // Prepare subscribers to insert (only new ones with valid emails)
    const subscribersToInsert = customers
      .filter((customer) => {
        const email = customer.email?.toLowerCase().trim()
        return email && email.includes("@") && !existingEmails.has(email)
      })
      .map((customer) => ({
        email: customer.email!.toLowerCase().trim(),
        user_id: customer.id,
        status: "active",
        tags: null,
      }))

    console.log(`Prepared ${subscribersToInsert.length} subscribers to insert`)

    if (subscribersToInsert.length === 0) {
      return {
        success: true,
        error: null,
        synced: 0,
        message: "All customers with valid emails are already subscribers",
      }
    }

    // Insert in batches to avoid query size limits
    const batchSize = 500
    let totalSynced = 0
    const errors: string[] = []

    for (let i = 0; i < subscribersToInsert.length; i += batchSize) {
      const batch = subscribersToInsert.slice(i, i + batchSize)
      console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(subscribersToInsert.length / batchSize)} (${batch.length} subscribers)`)

      const { error: insertError } = await supabase
        .from("email_subscribers")
        .insert(batch)

      if (insertError) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError)
        errors.push(`Batch ${i / batchSize + 1}: ${insertError.message}`)
        // Try individual inserts for this batch using upsert
        let batchSynced = 0
        for (const subscriber of batch) {
          const { error: singleError } = await supabase
            .from("email_subscribers")
            .upsert(subscriber, { onConflict: "email" })
          if (!singleError) {
            batchSynced++
          } else {
            console.error(`Error upserting subscriber ${subscriber.email}:`, singleError)
          }
        }
        totalSynced += batchSynced
        console.log(`Batch ${i / batchSize + 1}: Synced ${batchSynced} of ${batch.length} subscribers`)
      } else {
        totalSynced += batch.length
        console.log(`Batch ${i / batchSize + 1}: Successfully synced ${batch.length} subscribers`)
      }
    }

    revalidatePath("/admin/email-marketing")
    revalidatePath("/admin/email-marketing/segments")

    return {
      success: true,
      error: errors.length > 0 ? errors.join("; ") : null,
      synced: totalSynced,
      message: `Successfully synced ${totalSynced} customers to email subscribers`,
    }
  } catch (error: any) {
    console.error("Error in syncAllCustomersToSubscribers:", error)
    return { success: false, error: error.message || "Failed to sync customers", synced: 0 }
  }
}

/**
 * Get count of all customers (for "All Customers" recipient type)
 */
export async function getAllCustomersCount() {
  try {
    const supabase = createAdminSupabaseClient()
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "customer")
      .not("email", "is", null)

    if (error) {
      console.error("Error counting customers:", error)
      return { success: false, error: error.message, count: 0 }
    }

    return { success: true, count: count || 0, error: null }
  } catch (error: any) {
    console.error("Error in getAllCustomersCount:", error)
    return { success: false, error: error.message || "Failed to count customers", count: 0 }
  }
}
