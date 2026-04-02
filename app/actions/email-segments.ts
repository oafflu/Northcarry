"use server"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export interface EmailSegment {
  id: string
  name: string
  description?: string
  conditions: any[]
  subscriber_count: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateSegmentInput {
  name: string
  description?: string
  conditions: any[]
}

export interface UpdateSegmentInput {
  name?: string
  description?: string
  conditions?: any[]
}

/**
 * Helper function to fetch all customers with pagination
 */
async function fetchAllCustomers(): Promise<Array<{ id: string; email: string }>> {
  const supabase = createAdminSupabaseClient()
  let allCustomers: Array<{ id: string; email: string }> = []
  let page = 0
  const pageSize = 1000
  let hasMore = true
  
  while (hasMore) {
    const { data: customers, error } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('role', 'customer')
      .not('email', 'is', null)
      .like('email', '%@%')
      .range(page * pageSize, (page + 1) * pageSize - 1)
    
    if (error) {
      console.error('[fetchAllCustomers] Error fetching customers:', error)
      break
    }
    
    if (!customers || customers.length === 0) {
      hasMore = false
    } else {
      allCustomers = allCustomers.concat(customers)
      hasMore = customers.length === pageSize
      page++
    }
  }
  
  return allCustomers
}

/**
 * Helper function to fetch all paid orders with pagination
 */
async function fetchAllPaidOrders(): Promise<Array<any>> {
  const supabase = createAdminSupabaseClient()
  let allOrders: Array<any> = []
  let page = 0
  const pageSize = 1000
  let hasMore = true
  
  while (hasMore) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, user_id, customer_email, total, payment_status')
      .eq('payment_status', 'paid')
      .range(page * pageSize, (page + 1) * pageSize - 1)
    
    if (error) {
      console.error('[fetchAllPaidOrders] Error fetching orders:', error)
      break
    }
    
    if (!orders || orders.length === 0) {
      hasMore = false
    } else {
      allOrders = allOrders.concat(orders)
      hasMore = orders.length === pageSize
      page++
    }
  }
  
  return allOrders
}

/**
 * Calculate total spent for a customer from their paid orders
 */
async function getCustomerTotalSpent(customerId: string, customerEmail: string): Promise<number> {
  const supabase = createAdminSupabaseClient()
  
  // Get all orders for this customer - check both user_id and customer_email
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, total, payment_status')
    .or(`user_id.eq.${customerId},customer_email.ilike.%${customerEmail}%`)
  
  if (error || !orders || orders.length === 0) {
    return 0
  }
  
  // Remove duplicates by order ID
  const uniqueOrders = Array.from(
    new Map(orders.map(order => [order.id, order])).values()
  )
  
  // Calculate total spent from paid orders only
  // Use total_amount if available (newer field), otherwise fall back to total
  const totalSpent = uniqueOrders
    .filter(order => order.payment_status === 'paid')
    .reduce((sum, order) => {
      const orderTotal = order.total_amount || order.total || 0
      const numericTotal = typeof orderTotal === 'string' 
        ? parseFloat(orderTotal) 
        : (typeof orderTotal === 'number' ? orderTotal : 0)
      return sum + (isNaN(numericTotal) ? 0 : numericTotal)
    }, 0)
  
  return Math.round(totalSpent * 100) / 100 // Round to 2 decimal places
}

/**
 * Get customers matching total_spent condition
 * This checks if a customer has ANY SINGLE ORDER greater than/less than/equals the value
 * Optimized to batch process all customers and orders
 */
export async function getCustomersByTotalSpent(operator: string, value: number): Promise<string[]> {
  const supabase = createAdminSupabaseClient()
  
  // Ensure value is a number
  const numericValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[$,\s]/g, '')) 
    : (typeof value === 'number' ? value : 0)
  
  if (isNaN(numericValue) || numericValue <= 0) {
    console.error(`[getCustomersByTotalSpent] Invalid value: ${value} (parsed as ${numericValue})`)
    return []
  }
  
  console.log(`[getCustomersByTotalSpent] Searching for customers with ${operator} ${numericValue}`)
  
  // Get all customers with valid emails - use same filter as is_customer condition
  const allCustomers = await fetchAllCustomers()
  
  if (allCustomers.length === 0) {
    console.log(`[getCustomersByTotalSpent] No customers found`)
    return []
  }
  
  console.log(`[getCustomersByTotalSpent] Found ${allCustomers.length} customers to process`)
  
  // Create a map of customer emails to customer IDs (for quick lookup)
  const customerMap = new Map<string, { id: string; email: string }>()
  for (const customer of allCustomers) {
    const email = customer.email?.toLowerCase().trim() || ''
    if (email) {
      customerMap.set(email, { id: customer.id, email })
    }
  }
  
  console.log(`[getCustomersByTotalSpent] Created customer map with ${customerMap.size} valid emails`)
  
  // Get all paid orders at once (much more efficient than querying per customer)
  const allOrders = await fetchAllPaidOrders()
  
  if (allOrders.length === 0) {
    console.log(`[getCustomersByTotalSpent] No paid orders found`)
    // If we can't fetch orders, no customer can match (they all have 0 spent)
    return []
  }
  
  console.log(`[getCustomersByTotalSpent] Found ${allOrders.length} paid orders`)
  
  // Process all orders and check if ANY single order matches the condition per customer
  // Use a Map to track which customers have matching orders
  const customersWithMatchingOrders = new Set<string>()
  
  if (allOrders && allOrders.length > 0) {
    // Remove duplicates by order ID first
    const uniqueOrdersMap = new Map<string, any>()
    for (const order of allOrders) {
      if (!uniqueOrdersMap.has(order.id)) {
        uniqueOrdersMap.set(order.id, order)
      }
    }
    
    const uniqueOrders = Array.from(uniqueOrdersMap.values())
    console.log(`[getCustomersByTotalSpent] Processing ${uniqueOrders.length} unique paid orders`)
    
    for (const order of uniqueOrders) {
      // Parse order total
      const orderTotal = order.total || order.total_amount || 0
      const numericTotal = typeof orderTotal === 'string' 
        ? parseFloat(orderTotal.toString().replace(/[$,\s]/g, '')) 
        : (typeof orderTotal === 'number' ? orderTotal : 0)
      
      if (isNaN(numericTotal) || numericTotal <= 0) {
        continue
      }
      
      // Check if this order matches the condition
      let orderMatches = false
      switch (operator) {
        case 'greater_than':
          orderMatches = numericTotal > numericValue
          break
        case 'less_than':
          orderMatches = numericTotal < numericValue
          break
        case 'equals':
          orderMatches = Math.abs(numericTotal - numericValue) < 0.01
          break
      }
      
      if (!orderMatches) continue
      
      // This order matches - find all customers associated with it
      // Match by user_id
      if (order.user_id) {
        const customer = Array.from(customerMap.values()).find(c => c.id === order.user_id)
        if (customer) {
          customersWithMatchingOrders.add(customer.email)
        }
      }
      
      // Also match by customer_email (for guest orders or orders with different emails)
      if (order.customer_email) {
        const orderEmail = order.customer_email.toLowerCase().trim()
        if (customerMap.has(orderEmail)) {
          customersWithMatchingOrders.add(orderEmail)
        }
      }
    }
  }
  
  const matchingCustomers = Array.from(customersWithMatchingOrders)
  console.log(`[getCustomersByTotalSpent] Found ${matchingCustomers.length} customers with ${operator} ${numericValue}`)
  
  return matchingCustomers
}

async function fetchActiveEmailSubscriberEmails(): Promise<string[]> {
  const supabase = createAdminSupabaseClient()
  const out: string[] = []
  let page = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await supabase
      .from("email_subscribers")
      .select("email")
      .eq("status", "active")
      .range(page * pageSize, (page + 1) * pageSize - 1)
    if (error) break
    if (!data?.length) break
    for (const row of data) {
      const e = String(row.email || "").toLowerCase().trim()
      if (e.includes("@")) out.push(e)
    }
    if (data.length < pageSize) break
    page++
  }
  return out
}

/**
 * Customer profiles (role customer) who have opted out of marketing:
 * email_subscribers.status = unsubscribed OR newsletter_subscriptions unsubscribed/bounced.
 */
export async function getCustomerEmailsUnsubscribedMarketing(): Promise<string[]> {
  const supabase = createAdminSupabaseClient()
  const allCustomers = await fetchAllCustomers()
  const customerEmails = new Set(
    allCustomers.map((c) => c.email?.toLowerCase().trim()).filter((e): e is string => !!e && e.includes("@"))
  )
  const unsubscribed = new Set<string>()
  let offset = 0
  const page = 1000
  for (;;) {
    const { data } = await supabase
      .from("email_subscribers")
      .select("email")
      .eq("status", "unsubscribed")
      .range(offset, offset + page - 1)
    if (!data?.length) break
    for (const row of data) {
      const e = String(row.email || "").toLowerCase().trim()
      if (e && customerEmails.has(e)) unsubscribed.add(e)
    }
    if (data.length < page) break
    offset += page
  }
  offset = 0
  for (;;) {
    const { data } = await supabase
      .from("newsletter_subscriptions")
      .select("email")
      .in("status", ["unsubscribed", "bounced"])
      .range(offset, offset + page - 1)
    if (!data?.length) break
    for (const row of data) {
      const e = String(row.email || "").toLowerCase().trim()
      if (e && customerEmails.has(e)) unsubscribed.add(e)
    }
    if (data.length < page) break
    offset += page
  }
  return Array.from(unsubscribed)
}

/** Customers with valid email who are not in the unsubscribed marketing set. */
export async function getCustomerEmailsSubscribedMarketing(): Promise<string[]> {
  const all = await fetchAllCustomers()
  const unsub = new Set(await getCustomerEmailsUnsubscribedMarketing())
  return all
    .map((c) => c.email?.toLowerCase().trim())
    .filter((e): e is string => !!e && e.includes("@") && !unsub.has(e))
}

function segmentIntersect(a: Set<string> | null, b: Set<string>): Set<string> {
  if (!a) return new Set(b)
  const out = new Set<string>()
  for (const v of a) {
    if (b.has(v)) out.add(v)
  }
  return out
}

/**
 * Resolve segment JSON conditions to unique recipient emails (lowercase).
 * Used for counts, campaigns, and segment detail member lists.
 */
export async function resolveSegmentConditionsToEmails(conditions: any[]): Promise<string[]> {
  const supabase = createAdminSupabaseClient()
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return fetchActiveEmailSubscriberEmails()
  }

  const supportedFields = [
    "is_customer",
    "user_id",
    "has_subscription",
    "total_spent",
    "total_orders",
    "country",
    "newsletter_status",
  ]
  const hasUnsupported = conditions.some((c: any) => c?.field && !supportedFields.includes(c.field))
  if (hasUnsupported) {
    return fetchActiveEmailSubscriberEmails()
  }

  let resultSet: Set<string> | null = null

  const hasIsCustomerCondition = conditions.some((c: any) => c?.field === "is_customer")
  if (hasIsCustomerCondition) {
    let page = 0
    const pageSize = 1000
    for (;;) {
      const { data: customers, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("role", "customer")
        .not("email", "is", null)
        .like("email", "%@%")
        .range(page * pageSize, (page + 1) * pageSize - 1)
      if (error) break
      if (!customers?.length) break
      const s = new Set<string>()
      for (const c of customers) {
        if (c?.email) s.add(String(c.email).toLowerCase().trim())
      }
      resultSet = resultSet ? new Set([...resultSet, ...s]) : new Set([...s])
      if (customers.length < pageSize) break
      page++
    }
  }

  const userIdCondition = conditions.find((c: any) => c?.field === "user_id" && c?.operator === "in")
  if (userIdCondition && Array.isArray(userIdCondition.value)) {
    const userIds = userIdCondition.value.filter((id: any) => id && typeof id === "string")
    if (userIds.length > 0) {
      const emails = new Set<string>()
      for (let i = 0; i < userIds.length; i += 1000) {
        const chunk = userIds.slice(i, i + 1000)
        const { data: customers, error } = await supabase
          .from("profiles")
          .select("email")
          .in("id", chunk)
          .eq("role", "customer")
          .not("email", "is", null)
          .like("email", "%@%")
        if (error) break
        for (const c of customers || []) {
          if (c?.email) emails.add(String(c.email).toLowerCase().trim())
        }
      }
      resultSet = segmentIntersect(resultSet, emails)
    } else {
      resultSet = segmentIntersect(resultSet, new Set())
    }
  }

  const hasSubscriptionCondition = conditions.find((c: any) => c?.field === "has_subscription")
  if (
    hasSubscriptionCondition &&
    hasSubscriptionCondition.operator === "equals" &&
    hasSubscriptionCondition.value === true
  ) {
    const matching = await getCustomersWithSubscriptions()
    resultSet = segmentIntersect(resultSet, new Set(matching.map((e) => e.toLowerCase().trim())))
  }

  const totalOrdersCondition = conditions.find((c: any) => c?.field === "total_orders")
  if (totalOrdersCondition) {
    const matching = await getCustomersByTotalOrders(
      totalOrdersCondition.operator,
      parseInt(totalOrdersCondition.value?.toString() || "0", 10)
    )
    resultSet = segmentIntersect(resultSet, new Set(matching.map((e) => e.toLowerCase().trim())))
  }

  const totalSpentCondition = conditions.find((c: any) => c?.field === "total_spent")
  if (totalSpentCondition) {
    let value = totalSpentCondition.value
    if (typeof value === "string") {
      value = value.replace(/[$,\s]/g, "")
      value = parseFloat(value) || 0
    } else if (typeof value !== "number") {
      value = parseFloat(value?.toString() || "0") || 0
    }
    const matching = await getCustomersByTotalSpent(totalSpentCondition.operator, value as number)
    resultSet = segmentIntersect(resultSet, new Set(matching.map((e) => e.toLowerCase().trim())))
  }

  const countryConditions = conditions.filter((c: any) => c?.field === "country")
  if (countryConditions.length > 0) {
    const countryEmails = new Set<string>()
    for (const cc of countryConditions) {
      const matching = await getCustomersByCountry(cc.operator, cc.value?.toString() || "")
      for (const e of matching) {
        countryEmails.add(String(e).toLowerCase().trim())
      }
    }
    resultSet = segmentIntersect(resultSet, countryEmails)
  }

  const newsletterConditions = conditions.filter((c: any) => c?.field === "newsletter_status")
  for (const nc of newsletterConditions) {
    if (nc.operator !== "equals") continue
    const v = String(nc.value ?? "").toLowerCase()
    if (v === "unsubscribed" || v === "opted_out" || v === "false") {
      const matching = await getCustomerEmailsUnsubscribedMarketing()
      resultSet = segmentIntersect(resultSet, new Set(matching.map((e) => e.toLowerCase().trim())))
    } else if (v === "active" || v === "subscribed" || v === "true") {
      const matching = await getCustomerEmailsSubscribedMarketing()
      resultSet = segmentIntersect(resultSet, new Set(matching.map((e) => e.toLowerCase().trim())))
    }
  }

  if (!resultSet) {
    return fetchActiveEmailSubscriberEmails()
  }

  return Array.from(resultSet)
}

async function calculateSegmentSubscriberCount(conditions: any[]): Promise<number> {
  const emails = await resolveSegmentConditionsToEmails(conditions || [])
  return emails.length
}

/**
 * Get all email segments.
 * When refreshCounts is true, recalculates each segment's subscriber count from current data and persists it,
 * so segments list and campaign flows always use up-to-date counts.
 */
export async function getEmailSegments(search?: string, refreshCounts?: boolean) {
  try {
    const supabase = createAdminSupabaseClient()
    let query = supabase.from("email_segments").select("*").order("created_at", { ascending: false })

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching email segments:", error)
      return { success: false, error: error.message, data: null }
    }

    const segments = (data || []) as EmailSegment[]

    if (refreshCounts && segments.length > 0) {
      for (const segment of segments) {
        try {
          const count = await calculateSegmentSubscriberCount(segment.conditions || [])
          segment.subscriber_count = count
          await supabase.from("email_segments").update({ subscriber_count: count, updated_at: new Date().toISOString() }).eq("id", segment.id)
        } catch (e) {
          console.warn(`[getEmailSegments] Failed to refresh count for segment ${segment.id}:`, e)
        }
      }
    }

    return { success: true, data: segments, error: null }
  } catch (error: any) {
    console.error("Error in getEmailSegments:", error)
    return { success: false, error: error.message || "Failed to fetch segments", data: null }
  }
}

/**
 * Get a single email segment by ID
 */
export async function getEmailSegmentById(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase.from("email_segments").select("*").eq("id", id).single()

    if (error) {
      console.error("Error fetching email segment:", error)
      return { success: false, error: error.message, data: null }
    }

    return { success: true, data: data as EmailSegment, error: null }
  } catch (error: any) {
    console.error("Error in getEmailSegmentById:", error)
    return { success: false, error: error.message || "Failed to fetch segment", data: null }
  }
}

export async function getEmailSegmentMembers(
  segmentId: string,
  opts?: { search?: string; limit?: number; offset?: number }
) {
  try {
    const segmentResult = await getEmailSegmentById(segmentId)
    if (!segmentResult.success || !segmentResult.data) {
      return { success: false as const, error: segmentResult.error || "Segment not found", data: null }
    }
    const emails = await resolveSegmentConditionsToEmails(segmentResult.data.conditions || [])
    const search = opts?.search?.toLowerCase().trim()
    let filtered = emails
    if (search) {
      filtered = emails.filter((e) => e.includes(search))
    }
    const total = filtered.length
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200)
    const offset = Math.max(opts?.offset ?? 0, 0)
    const pageEmails = filtered.slice(offset, offset + limit)

    const supabase = createAdminSupabaseClient()
    const members: Array<{
      id: string
      email: string
      first_name: string | null
      last_name: string | null
      marketing_status: "active" | "unsubscribed" | "unknown"
    }> = []

    await Promise.all(
      pageEmails.map(async (em) => {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .ilike("email", em)
          .eq("role", "customer")
          .limit(1)
          .maybeSingle()
        if (!prof?.id) return
        let marketing_status: "active" | "unsubscribed" | "unknown" = "unknown"
        const { data: sub } = await supabase
          .from("email_subscribers")
          .select("status")
          .eq("user_id", prof.id)
          .maybeSingle()
        if (sub?.status === "unsubscribed" || sub?.status === "bounced") {
          marketing_status = "unsubscribed"
        } else if (sub?.status === "active") {
          marketing_status = "active"
        } else {
          const pe = prof.email?.toLowerCase().trim()
          if (pe) {
            const { data: byEmail } = await supabase
              .from("email_subscribers")
              .select("status")
              .eq("email", pe)
              .maybeSingle()
            if (byEmail?.status === "unsubscribed" || byEmail?.status === "bounced") {
              marketing_status = "unsubscribed"
            } else if (byEmail?.status === "active") {
              marketing_status = "active"
            } else {
              const { data: nl } = await supabase
                .from("newsletter_subscriptions")
                .select("status")
                .eq("email", pe)
                .maybeSingle()
              if (nl?.status === "unsubscribed" || nl?.status === "bounced") {
                marketing_status = "unsubscribed"
              } else if (nl?.status === "active") {
                marketing_status = "active"
              }
            }
          }
        }
        members.push({
          id: prof.id,
          email: prof.email || em,
          first_name: prof.first_name,
          last_name: prof.last_name,
          marketing_status,
        })
      })
    )

    members.sort((a, b) => (a.email || "").localeCompare(b.email || ""))

    return {
      success: true as const,
      data: {
        segment: segmentResult.data,
        members,
        total,
        limit,
        offset,
      },
      error: null,
    }
  } catch (e: any) {
    console.error("getEmailSegmentMembers:", e)
    return { success: false as const, error: e?.message || "Failed to load members", data: null }
  }
}

/**
 * Create a new email segment
 */
export async function createEmailSegment(input: CreateSegmentInput, userId?: string) {
  try {
    const supabase = createAdminSupabaseClient()

    // Calculate initial subscriber count
    const subscriberCount = await calculateSegmentSubscriberCount(input.conditions)

    const segmentData = {
      name: input.name,
      description: input.description || null,
      conditions: input.conditions,
      subscriber_count: subscriberCount,
      created_by: userId || null,
    }

    const { data, error } = await supabase.from("email_segments").insert(segmentData).select().single()

    if (error) {
      console.error("Error creating email segment:", error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath("/admin/email-marketing/segments")
    if (data?.id) {
      revalidatePath(`/admin/email-marketing/segments/${data.id}`)
    }
    return { success: true, data: data as EmailSegment, error: null }
  } catch (error: any) {
    console.error("Error in createEmailSegment:", error)
    return { success: false, error: error.message || "Failed to create segment", data: null }
  }
}

/**
 * Create a segment of customers who had bounce/failed events (Mailgun maps failures to bounced).
 */
export async function createBouncedFailedSegment(opts?: {
  startIso?: string
  endIso?: string
  userId?: string
}) {
  try {
    const supabase = createAdminSupabaseClient()
    const emails = new Set<string>()
    let offset = 0
    const page = 1000
    for (;;) {
      let q = supabase.from("email_campaign_events").select("email").eq("event_type", "bounced")
      if (opts?.startIso) q = q.gte("created_at", opts.startIso)
      if (opts?.endIso) q = q.lte("created_at", opts.endIso)
      const { data, error } = await q.range(offset, offset + page - 1)
      if (error) {
        return { success: false, error: error.message, data: null as EmailSegment | null }
      }
      if (!data?.length) break
      for (const row of data) {
        const e = String(row.email || "").toLowerCase().trim()
        if (e.includes("@")) emails.add(e)
      }
      if (data.length < page) break
      offset += page
    }
    if (emails.size === 0) {
      return {
        success: false,
        error: "No bounced/failed events in the selected range.",
        data: null as EmailSegment | null,
      }
    }
    const list = Array.from(emails)
    const userIds = new Set<string>()
    for (let i = 0; i < list.length; i += 400) {
      const chunk = list.slice(i, i + 400)
      const { data: profs } = await supabase
        .from("profiles")
        .select("id")
        .in("email", chunk)
        .eq("role", "customer")
      for (const p of profs || []) {
        if (p.id) userIds.add(p.id)
      }
    }
    const ids = Array.from(userIds)
    if (ids.length === 0) {
      return {
        success: false,
        error: "Bounced emails did not match any customer profiles.",
        data: null as EmailSegment | null,
      }
    }
    const label =
      opts?.startIso && opts?.endIso
        ? `${opts.startIso.slice(0, 10)}–${opts.endIso.slice(0, 10)}`
        : "all dates"
    return createEmailSegment(
      {
        name: `Bounced / failed (${label})`,
        description: "Customers tied to bounce or delivery-failure events from email campaigns.",
        conditions: [{ field: "user_id", operator: "in", value: ids }],
      },
      opts?.userId
    )
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to create segment", data: null }
  }
}

/**
 * Update an email segment
 */
export async function updateEmailSegment(id: string, input: UpdateSegmentInput) {
  try {
    const supabase = createAdminSupabaseClient()

    const updateData: any = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.conditions !== undefined) {
      updateData.conditions = input.conditions
      // Recalculate subscriber count when conditions change
      updateData.subscriber_count = await calculateSegmentSubscriberCount(input.conditions)
    }

    const { data, error } = await supabase.from("email_segments").update(updateData).eq("id", id).select().single()

    if (error) {
      console.error("Error updating email segment:", error)
      return { success: false, error: error.message, data: null }
    }

    revalidatePath("/admin/email-marketing/segments")
    revalidatePath(`/admin/email-marketing/segments/${id}`)
    return { success: true, data: data as EmailSegment, error: null }
  } catch (error: any) {
    console.error("Error in updateEmailSegment:", error)
    return { success: false, error: error.message || "Failed to update segment", data: null }
  }
}

/**
 * Delete an email segment
 */
export async function deleteEmailSegment(id: string) {
  try {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from("email_segments").delete().eq("id", id)

    if (error) {
      console.error("Error deleting email segment:", error)
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/email-marketing/segments")
    return { success: true, error: null }
  } catch (error: any) {
    console.error("Error in deleteEmailSegment:", error)
    return { success: false, error: error.message || "Failed to delete segment" }
  }
}

/**
 * Get customers matching country condition
 */
/**
 * Get customers matching country condition
 * Optimized to batch process all customers, addresses, and orders
 */
export async function getCustomersByCountry(operator: string, value: string): Promise<string[]> {
  const supabase = createAdminSupabaseClient()
  
  console.log(`[getCustomersByCountry] Searching for customers with country ${operator} ${value}`)
  
  // Get all customers with valid emails - use same filter as is_customer condition
  const allCustomers = await fetchAllCustomers()
  
  if (allCustomers.length === 0) {
    console.error('[getCustomersByCountry] No customers found')
    return []
  }
  
  console.log(`[getCustomersByCountry] Found ${allCustomers.length} customers to process`)
  
  // Create a map of customer emails to customer IDs
  const customerMap = new Map<string, { id: string; email: string }>()
  const customerIds = new Set<string>()
  for (const customer of allCustomers) {
    const email = customer.email?.toLowerCase().trim() || ''
    if (email) {
      customerMap.set(email, { id: customer.id, email })
      customerIds.add(customer.id)
    }
  }
  
  console.log(`[getCustomersByCountry] Created customer map with ${customerMap.size} valid emails`)
  
  // Get all addresses at once
  const { data: allAddresses, error: addressesError } = await supabase
    .from('addresses')
    .select('user_id, country')
    .in('user_id', Array.from(customerIds))
  
  if (addressesError) {
    console.warn('[getCustomersByCountry] Error fetching addresses:', addressesError)
  }
  
  console.log(`[getCustomersByCountry] Found ${allAddresses?.length || 0} addresses`)
  
  // Get all orders at once (to check shipping_address JSONB)
  const { data: allOrders, error: ordersError } = await supabase
    .from('orders')
    .select('user_id, customer_email, shipping_address')
  
  if (ordersError) {
    console.warn('[getCustomersByCountry] Error fetching orders:', ordersError)
  }
  
  console.log(`[getCustomersByCountry] Found ${allOrders?.length || 0} orders`)
  
  // Build a map of customer email -> set of countries
  const customerCountries = new Map<string, Set<string>>()
  
  // Initialize all customers with empty country sets
  for (const [email] of customerMap) {
    customerCountries.set(email, new Set<string>())
  }
  
  // Process addresses
  if (allAddresses && allAddresses.length > 0) {
    for (const address of allAddresses) {
      if (!address.country || !address.user_id) continue
      
      const customer = Array.from(customerMap.values()).find(c => c.id === address.user_id)
      if (customer) {
        const countries = customerCountries.get(customer.email)
        if (countries) {
          countries.add(address.country.toLowerCase().trim())
        }
      }
    }
  }
  
  // Process orders (from shipping_address JSONB)
  if (allOrders && allOrders.length > 0) {
    for (const order of allOrders) {
      let country: string | null = null
      
      // Extract country from shipping_address JSONB
      if (order.shipping_address && typeof order.shipping_address === 'object') {
        const shippingAddr = order.shipping_address as any
        if (shippingAddr.country && typeof shippingAddr.country === 'string') {
          country = shippingAddr.country.toLowerCase().trim()
        }
      }
      
      if (!country) continue
      
      // Match by user_id
      if (order.user_id) {
        const customer = Array.from(customerMap.values()).find(c => c.id === order.user_id)
        if (customer) {
          const countries = customerCountries.get(customer.email)
          if (countries) {
            countries.add(country)
          }
        }
      }
      
      // Also match by customer_email
      if (order.customer_email) {
        const orderEmail = order.customer_email.toLowerCase().trim()
        if (customerCountries.has(orderEmail)) {
          const countries = customerCountries.get(orderEmail)
          if (countries) {
            countries.add(country)
          }
        }
      }
    }
  }
  
  // Find matching customers
  const matchingCustomers: string[] = []
  const searchCountry = value.toLowerCase().trim()

  // Normalize common country synonyms (currently focused on US variants)
  const normalizeCountryGroup = (country: string): string => {
    const c = country.toLowerCase().trim()
    if (["us", "u.s.", "usa", "u.s.a.", "united states", "united states of america"].includes(c)) {
      return "us"
    }
    return c
  }

  const targetGroup = normalizeCountryGroup(searchCountry)
  
  for (const [email, countries] of customerCountries) {
    // We'll decide how to treat customers with no country data below
    let matches = false
    switch (operator) {
      case "equals": {
        if (countries.size === 0) {
          // If we have *no* country data at all for this customer,
          // treat them as matching when searching for US variants.
          // This aligns segments more closely with the total customer base
          // when most customers are from the US but country wasn't captured.
          matches = targetGroup === "us"
        } else {
          // Exact match within a normalized country group (handles US / USA / United States, etc.)
          matches = Array.from(countries).some(c => normalizeCountryGroup(c) === targetGroup)
        }
        break
      }
      case "contains": {
        matches = Array.from(countries).some(c => c.includes(searchCountry) || searchCountry.includes(c))
        break
      }
    }
    
    if (matches) {
      matchingCustomers.push(email)
    }
  }
  
  console.log(`[getCustomersByCountry] Found ${matchingCustomers.length} customers with country ${operator} ${value}`)
  
  return matchingCustomers
}

/**
 * Get customers matching total_orders condition
 * Optimized to batch process all customers and orders
 */
export async function getCustomersByTotalOrders(operator: string, value: number): Promise<string[]> {
  const supabase = createAdminSupabaseClient()
  
  console.log(`[getCustomersByTotalOrders] Starting calculation for ${operator} ${value}`)
  
  // Get all customers with valid emails - use same filter as is_customer condition
  const allCustomers = await fetchAllCustomers()
  
  if (allCustomers.length === 0) {
    console.error('[getCustomersByTotalOrders] No customers found')
    return []
  }
  
  console.log(`[getCustomersByTotalOrders] Found ${allCustomers.length} customers to process`)
  
  // Create a map of customer emails to customer IDs (for quick lookup)
  const customerMap = new Map<string, { id: string; email: string }>()
  for (const customer of allCustomers) {
    const email = customer.email?.toLowerCase().trim() || ''
    if (email) {
      customerMap.set(email, { id: customer.id, email })
    }
  }
  
  console.log(`[getCustomersByTotalOrders] Created customer map with ${customerMap.size} valid emails`)
  
  // Count orders per customer
  // Use a Map to track unique order counts per customer email
  const orderCountsByEmail = new Map<string, Set<string>>()
  
  // Create a reverse map: customer ID -> email (for efficient user_id matching)
  const customerIdToEmail = new Map<string, string>()
  for (const [email, customer] of customerMap) {
    customerIdToEmail.set(customer.id, email)
  }
  
  console.log(`[getCustomersByTotalOrders] Created reverse map with ${customerIdToEmail.size} customer IDs`)
  
  // Get all paid orders at once
  const allOrders = await fetchAllPaidOrders()
  
  console.log(`[getCustomersByTotalOrders] Found ${allOrders.length} paid orders`)
  
  // If we can't fetch orders, treat all customers as having 0 orders
  if (allOrders.length === 0) {
    if (operator === 'equals' && value === 0) {
      return Array.from(customerMap.values()).map(c => c.email)
    }
    return []
  }
  
  // Initialize all customers with empty order sets (so we can count 0 orders)
  for (const [email] of customerMap) {
    orderCountsByEmail.set(email, new Set<string>())
  }
  
  // Process all orders and count them per customer
  let ordersMatchedByUserId = 0
  let ordersMatchedByEmail = 0
  let ordersUnmatched = 0
  
  if (allOrders && allOrders.length > 0) {
    // Track which orders we've already processed to avoid double-counting
    const processedOrders = new Set<string>()
    
    for (const order of allOrders) {
      // Skip if we've already processed this order
      if (processedOrders.has(order.id)) {
        continue
      }
      
      let matchedEmail: string | null = null
      let matchedBy = ''
      
      // Match by user_id first (most reliable)
      if (order.user_id) {
        const email = customerIdToEmail.get(order.user_id)
        if (email) {
          matchedEmail = email
          matchedBy = 'user_id'
          ordersMatchedByUserId++
        }
      }
      
      // Also match by customer_email (for guest orders or orders with different emails)
      // This should match even if the email is slightly different from profile email
      if (!matchedEmail && order.customer_email) {
        const orderEmail = order.customer_email.toLowerCase().trim()
        // Check if this email belongs to any customer in our map
        if (customerMap.has(orderEmail)) {
          matchedEmail = orderEmail
          matchedBy = 'customer_email'
          ordersMatchedByEmail++
        }
      }
      
      // Add order to the matched customer's count
      if (matchedEmail) {
        const orderSet = orderCountsByEmail.get(matchedEmail)
        if (orderSet) {
          orderSet.add(order.id)
          processedOrders.add(order.id)
        }
      } else {
        ordersUnmatched++
        // Log unmatched orders for debugging (limit to first 10)
        if (ordersUnmatched <= 10) {
          console.log(`[getCustomersByTotalOrders] Unmatched order: id=${order.id}, user_id=${order.user_id}, customer_email=${order.customer_email}`)
        }
      }
    }
  }
  
  console.log(`[getCustomersByTotalOrders] Order matching stats: ${ordersMatchedByUserId} by user_id, ${ordersMatchedByEmail} by email, ${ordersUnmatched} unmatched`)
  console.log(`[getCustomersByTotalOrders] Processed orders for ${orderCountsByEmail.size} customer emails`)
  
  // Find matching customers
  const matchingCustomers: string[] = []
  
  for (const [email, orderSet] of orderCountsByEmail) {
    const uniqueOrderCount = orderSet.size
    
    let matches = false
    switch (operator) {
      case 'greater_than':
        matches = uniqueOrderCount > value
        break
      case 'less_than':
        matches = uniqueOrderCount < value
        break
      case 'equals':
        matches = uniqueOrderCount === value
        break
    }
    
    if (matches) {
      matchingCustomers.push(email)
    }
  }
  
  console.log(`[getCustomersByTotalOrders] Found ${matchingCustomers.length} matching customers for ${operator} ${value}`)
  
  return matchingCustomers
}

/**
 * Get customers with active subscriptions
 */
/**
 * Get customers with active subscriptions
 * Optimized to batch process all subscriptions and ensure consistent customer filtering
 */
export async function getCustomersWithSubscriptions(): Promise<string[]> {
  const supabase = createAdminSupabaseClient()
  
  console.log('[getCustomersWithSubscriptions] Fetching customers with active subscriptions')
  
  // Get all customers with valid emails first (to ensure we only return valid customers)
  // Use same filter as is_customer condition for consistency
  const allCustomers = await fetchAllCustomers()
  
  if (allCustomers.length === 0) {
    console.error('[getCustomersWithSubscriptions] No customers found')
    return []
  }
  
  // Create a set of valid customer IDs for quick lookup
  const validCustomerIds = new Set<string>()
  const customerEmailMap = new Map<string, string>() // user_id -> email
  
  if (allCustomers) {
    for (const customer of allCustomers) {
      const email = customer.email?.toLowerCase().trim() || ''
      if (email) {
        validCustomerIds.add(customer.id)
        customerEmailMap.set(customer.id, email)
      }
    }
  }
  
  console.log(`[getCustomersWithSubscriptions] Found ${validCustomerIds.size} valid customers`)
  
  // Get all customers with active subscriptions
  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('customer_subscriptions')
    .select('user_id, profiles!customer_subscriptions_user_id_fkey(email)')
    .eq('status', 'active')
  
  if (subscriptionsError || !subscriptions || subscriptions.length === 0) {
    console.log(`[getCustomersWithSubscriptions] No active subscriptions found or error:`, subscriptionsError)
    return []
  }
  
  console.log(`[getCustomersWithSubscriptions] Found ${subscriptions.length} active subscriptions`)
  
  // Extract unique customer emails (only for valid customers)
  const customerEmails = new Set<string>()
  
  for (const sub of subscriptions) {
    const userId = sub.user_id
    
    // Only include if user_id is in our valid customers list
    if (!userId || !validCustomerIds.has(userId)) {
      continue
    }
    
    // Get email from map or from subscription profile
    const email = customerEmailMap.get(userId) || 
                  (sub as any).profiles?.email || 
                  (sub as any).email
    
    if (email && typeof email === 'string' && email.includes('@')) {
      customerEmails.add(email.toLowerCase().trim())
    }
  }
  
  // If we still don't have emails, use the customerEmailMap we already built
  if (customerEmails.size === 0) {
    for (const sub of subscriptions) {
      const userId = sub.user_id
      if (userId && validCustomerIds.has(userId)) {
        const email = customerEmailMap.get(userId)
        if (email) {
          customerEmails.add(email)
        }
      }
    }
  }
  
  const result = Array.from(customerEmails)
  console.log(`[getCustomersWithSubscriptions] Found ${result.length} customers with active subscriptions`)
  
  return result
}

/**
 * Recalculate subscriber count for a segment
 */
export async function recalculateSegmentSubscriberCount(id: string) {
  try {
    const segmentResult = await getEmailSegmentById(id)
    if (!segmentResult.success || !segmentResult.data) {
      return { success: false, error: "Segment not found" }
    }

    const subscriberCount = await calculateSegmentSubscriberCount(segmentResult.data.conditions)
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from("email_segments").update({ subscriber_count: subscriberCount }).eq("id", id)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: subscriberCount, error: null }
  } catch (error: any) {
    console.error("Error in recalculateSegmentSubscriberCount:", error)
    return { success: false, error: error.message || "Failed to recalculate count" }
  }
}

/**
 * Export helper functions for use in email-campaigns
 */
export { getCustomersByTotalSpent, getCustomersWithSubscriptions, getCustomersByCountry, getCustomersByTotalOrders }

