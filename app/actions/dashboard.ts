'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'

export type DateRange = 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'custom'

export interface DashboardMetrics {
  orders: {
    current: number
    previous: number
    change: number
  }
  aov: {
    current: number
    previous: number
    change: number
  }
  revenue: {
    current: number
    previous: number
    change: number
  }
  cogs: {
    current: number
    previous: number
    change: number
  }
  profit: {
    current: number
    previous: number
    change: number
  }
  sessions: {
    current: number
    previous: number
    change: number
  }
  subscriptions: {
    current: number
    previous: number
    change: number
    active: number
    new: number
  }
  customers: {
    current: number
    previous: number
    change: number
  }
  trafficSources: {
    organic: number
    direct: number
    referral: number
    social: number
    email: number
    paid: number
  }
}

function getDateRange(range: DateRange, customStart?: Date, customEnd?: Date): {
  currentStart: Date
  currentEnd: Date
  previousStart: Date
  previousEnd: Date
} {
  const now = new Date()
  now.setHours(23, 59, 59, 999)
  
  let currentStart: Date
  let currentEnd: Date = now
  let previousStart: Date
  let previousEnd: Date

  switch (range) {
    case 'today':
      currentStart = new Date(now)
      currentStart.setHours(0, 0, 0, 0)
      previousStart = new Date(currentStart)
      previousStart.setDate(previousStart.getDate() - 1)
      previousEnd = new Date(previousStart)
      previousEnd.setHours(23, 59, 59, 999)
      break

    case 'thisWeek':
      // Start of week (Monday)
      currentStart = new Date(now)
      const dayOfWeek = currentStart.getDay()
      const diff = currentStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      currentStart.setDate(diff)
      currentStart.setHours(0, 0, 0, 0)
      
      previousStart = new Date(currentStart)
      previousStart.setDate(previousStart.getDate() - 7)
      previousEnd = new Date(currentStart)
      previousEnd.setDate(previousEnd.getDate() - 1)
      previousEnd.setHours(23, 59, 59, 999)
      break

    case 'lastWeek':
      // Last week (Monday to Sunday)
      currentStart = new Date(now)
      const lastWeekDay = currentStart.getDay()
      const lastWeekDiff = currentStart.getDate() - lastWeekDay + (lastWeekDay === 0 ? -6 : 1) - 7
      currentStart.setDate(lastWeekDiff)
      currentStart.setHours(0, 0, 0, 0)
      
      currentEnd = new Date(currentStart)
      currentEnd.setDate(currentEnd.getDate() + 6)
      currentEnd.setHours(23, 59, 59, 999)
      
      previousStart = new Date(currentStart)
      previousStart.setDate(previousStart.getDate() - 7)
      previousEnd = new Date(currentStart)
      previousEnd.setDate(previousEnd.getDate() - 1)
      previousEnd.setHours(23, 59, 59, 999)
      break

    case 'thisMonth':
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1)
      currentStart.setHours(0, 0, 0, 0)
      
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      previousStart.setHours(0, 0, 0, 0)
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      break

    case 'lastMonth':
      currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      currentStart.setHours(0, 0, 0, 0)
      currentEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      
      previousStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      previousStart.setHours(0, 0, 0, 0)
      previousEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999)
      break

    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('Custom date range requires start and end dates')
      }
      currentStart = new Date(customStart)
      currentStart.setHours(0, 0, 0, 0)
      currentEnd = new Date(customEnd)
      currentEnd.setHours(23, 59, 59, 999)
      
      // Calculate previous period (same duration before current start)
      const duration = currentEnd.getTime() - currentStart.getTime()
      previousEnd = new Date(currentStart)
      previousEnd.setTime(previousEnd.getTime() - 1)
      previousStart = new Date(previousEnd)
      previousStart.setTime(previousStart.getTime() - duration)
      previousStart.setHours(0, 0, 0, 0)
      break

    default:
      throw new Error(`Unknown date range: ${range}`)
  }

  return { currentStart, currentEnd, previousStart, previousEnd }
}

export async function getDashboardMetrics(
  dateRange: DateRange = 'thisMonth',
  customStart?: Date,
  customEnd?: Date
): Promise<DashboardMetrics> {
  try {
    const supabase = createAdminSupabaseClient()
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRange(dateRange, customStart, customEnd)

    // Helper to format dates for queries
    const formatDate = (date: Date) => date.toISOString()

    // Get orders for current period
    const [currentOrdersResult, previousOrdersResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, total, payment_status, created_at, order_items(id, variant_id, quantity, sku)')
        .gte('created_at', formatDate(currentStart))
        .lte('created_at', formatDate(currentEnd)),
      supabase
        .from('orders')
        .select('id, total, payment_status, created_at, order_items(id, variant_id, quantity, sku)')
        .gte('created_at', formatDate(previousStart))
        .lte('created_at', formatDate(previousEnd)),
    ])

    const currentOrders = currentOrdersResult.data || []
    const previousOrders = previousOrdersResult.data || []

    // Filter paid orders
    const currentPaidOrders = currentOrders.filter(o => o.payment_status === 'paid')
    const previousPaidOrders = previousOrders.filter(o => o.payment_status === 'paid')

    // Calculate revenue
    const currentRevenue = currentPaidOrders.reduce(
      (sum, o) => sum + parseFloat(o.total?.toString() || '0'),
      0
    )
    const previousRevenue = previousPaidOrders.reduce(
      (sum, o) => sum + parseFloat(o.total?.toString() || '0'),
      0
    )

    // Calculate orders count - include all orders (including pending)
    const currentOrdersCount = currentOrders.length
    const previousOrdersCount = previousOrders.length

    // Calculate AOV (Average Order Value)
    const currentAOV = currentOrdersCount > 0 ? currentRevenue / currentOrdersCount : 0
    const previousAOV = previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0

    // Calculate COGs (Cost of Goods Sold)
    // Get all variant IDs and SKUs from order items
    const currentVariantIds = new Set<string>()
    const currentSKUs = new Set<string>()
    currentPaidOrders.forEach(order => {
      order.order_items?.forEach((item: any) => {
        if (item.variant_id) currentVariantIds.add(item.variant_id)
        if (item.sku) currentSKUs.add(item.sku)
      })
    })

    const previousVariantIds = new Set<string>()
    const previousSKUs = new Set<string>()
    previousPaidOrders.forEach(order => {
      order.order_items?.forEach((item: any) => {
        if (item.variant_id) previousVariantIds.add(item.variant_id)
        if (item.sku) previousSKUs.add(item.sku)
      })
    })

    // Get inventory costs
    let currentCOGs = 0
    let previousCOGs = 0

    if (currentVariantIds.size > 0) {
      // Get product supplier links to find supplier inventory IDs
      const { data: currentSupplierLinks } = await supabase
        .from('product_supplier_links')
        .select('variant_id, supplier_inventory_id')
        .in('variant_id', Array.from(currentVariantIds))

      if (currentSupplierLinks && currentSupplierLinks.length > 0) {
        // Get inventory prices
        const inventoryIds = currentSupplierLinks
          .map(link => link.supplier_inventory_id)
          .filter(Boolean) as string[]

        if (inventoryIds.length > 0) {
          const { data: currentInventory } = await supabase
            .from('supplier_inventory')
            .select('id, cost_price')
            .in('id', inventoryIds)

          // Create cost map: variant_id -> cost_price
          const variantCostMap = new Map<string, number>()
          currentSupplierLinks.forEach((link: any) => {
            if (link.supplier_inventory_id) {
              const inv = currentInventory?.find((i: any) => i.id === link.supplier_inventory_id)
              if (inv?.cost_price) {
                // Use the first cost found for each variant (or average if multiple suppliers)
                const existingCost = variantCostMap.get(link.variant_id) || 0
                const newCost = parseFloat(inv.cost_price)
                variantCostMap.set(link.variant_id, existingCost > 0 ? (existingCost + newCost) / 2 : newCost)
              }
            }
          })

          // Calculate COGs for current period
          currentPaidOrders.forEach(order => {
            order.order_items?.forEach((item: any) => {
              const cost = variantCostMap.get(item.variant_id) || 0
              currentCOGs += cost * (item.quantity || 1)
            })
          })
        }
      }
    }

    if (previousVariantIds.size > 0) {
      const { data: previousSupplierLinks } = await supabase
        .from('product_supplier_links')
        .select('variant_id, supplier_inventory_id')
        .in('variant_id', Array.from(previousVariantIds))

      if (previousSupplierLinks && previousSupplierLinks.length > 0) {
        const previousInventoryIds = previousSupplierLinks
          .map(link => link.supplier_inventory_id)
          .filter(Boolean) as string[]

        if (previousInventoryIds.length > 0) {
          const { data: previousInventory } = await supabase
            .from('supplier_inventory')
            .select('id, cost_price')
            .in('id', previousInventoryIds)

          const previousVariantCostMap = new Map<string, number>()
          previousSupplierLinks.forEach((link: any) => {
            if (link.supplier_inventory_id) {
              const inv = previousInventory?.find((i: any) => i.id === link.supplier_inventory_id)
              if (inv?.cost_price) {
                const existingCost = previousVariantCostMap.get(link.variant_id) || 0
                const newCost = parseFloat(inv.cost_price)
                previousVariantCostMap.set(link.variant_id, existingCost > 0 ? (existingCost + newCost) / 2 : newCost)
              }
            }
          })

          previousPaidOrders.forEach(order => {
            order.order_items?.forEach((item: any) => {
              const cost = previousVariantCostMap.get(item.variant_id) || 0
              previousCOGs += cost * (item.quantity || 1)
            })
          })
        }
      }
    }

    // Calculate profit
    const currentProfit = currentRevenue - currentCOGs
    const previousProfit = previousRevenue - previousCOGs

    // Get sessions from analytics_events
    const [currentSessionsResult, previousSessionsResult] = await Promise.all([
      supabase
        .from('analytics_events')
        .select('session_id', { count: 'exact', head: false })
        .eq('event_type', 'page_view')
        .gte('created_at', formatDate(currentStart))
        .lte('created_at', formatDate(currentEnd)),
      supabase
        .from('analytics_events')
        .select('session_id', { count: 'exact', head: false })
        .eq('event_type', 'page_view')
        .gte('created_at', formatDate(previousStart))
        .lte('created_at', formatDate(previousEnd)),
    ])

    // Count unique sessions
    const currentSessions = new Set(
      (currentSessionsResult.data || []).map((e: any) => e.session_id).filter(Boolean)
    ).size
    const previousSessions = new Set(
      (previousSessionsResult.data || []).map((e: any) => e.session_id).filter(Boolean)
    ).size

    // Get subscriptions
    const [currentSubscriptionsResult, previousSubscriptionsResult] = await Promise.all([
      supabase
        .from('customer_subscriptions')
        .select('id, status, created_at')
        .gte('created_at', formatDate(currentStart))
        .lte('created_at', formatDate(currentEnd)),
      supabase
        .from('customer_subscriptions')
        .select('id, status, created_at')
        .gte('created_at', formatDate(previousStart))
        .lte('created_at', formatDate(previousEnd)),
    ])

    const currentSubscriptions = currentSubscriptionsResult.data || []
    const previousSubscriptions = previousSubscriptionsResult.data || []

    // Get active subscriptions count
    const { count: activeSubscriptionsCount } = await supabase
      .from('customer_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get new subscriptions in current period
    const newSubscriptions = currentSubscriptions.length

    // Get customers
    const [currentCustomersResult, previousCustomersResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', formatDate(currentStart))
        .lte('created_at', formatDate(currentEnd)),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer')
        .gte('created_at', formatDate(previousStart))
        .lte('created_at', formatDate(previousEnd)),
    ])

    const currentCustomers = currentCustomersResult.count || 0
    const previousCustomers = previousCustomersResult.count || 0

    // Get traffic sources from analytics_events
    const { data: trafficEvents } = await supabase
      .from('analytics_events')
      .select('properties')
      .eq('event_type', 'page_view')
      .gte('created_at', formatDate(currentStart))
      .lte('created_at', formatDate(currentEnd))

    const trafficSources = {
      organic: 0,
      direct: 0,
      referral: 0,
      social: 0,
      email: 0,
      paid: 0,
    }

    // Parse traffic sources from event properties
    trafficEvents?.forEach((event: any) => {
      const props = event.properties || {}
      const source = (props.source || props.utm_source || 'direct').toLowerCase()
      
      if (source.includes('google') || source.includes('bing') || source.includes('yahoo')) {
        trafficSources.organic++
      } else if (source.includes('facebook') || source.includes('instagram') || source.includes('twitter') || source.includes('linkedin')) {
        trafficSources.social++
      } else if (source.includes('email') || source.includes('mail')) {
        trafficSources.email++
      } else if (source.includes('ad') || source.includes('cpc') || source.includes('paid')) {
        trafficSources.paid++
      } else if (source !== 'direct' && source !== '') {
        trafficSources.referral++
      } else {
        trafficSources.direct++
      }
    })

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }

    return {
      orders: {
        current: currentOrdersCount,
        previous: previousOrdersCount,
        change: calculateChange(currentOrdersCount, previousOrdersCount),
      },
      aov: {
        current: currentAOV,
        previous: previousAOV,
        change: calculateChange(currentAOV, previousAOV),
      },
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        change: calculateChange(currentRevenue, previousRevenue),
      },
      cogs: {
        current: currentCOGs,
        previous: previousCOGs,
        change: calculateChange(currentCOGs, previousCOGs),
      },
      profit: {
        current: currentProfit,
        previous: previousProfit,
        change: calculateChange(currentProfit, previousProfit),
      },
      sessions: {
        current: currentSessions,
        previous: previousSessions,
        change: calculateChange(currentSessions, previousSessions),
      },
      subscriptions: {
        current: currentSubscriptions.length,
        previous: previousSubscriptions.length,
        change: calculateChange(currentSubscriptions.length, previousSubscriptions.length),
        active: activeSubscriptionsCount || 0,
        new: newSubscriptions,
      },
      customers: {
        current: currentCustomers,
        previous: previousCustomers,
        change: calculateChange(currentCustomers, previousCustomers),
      },
      trafficSources,
    }
  } catch (error: any) {
    console.error('Error getting dashboard metrics:', error)
    // Return zero values on error
    return {
      orders: { current: 0, previous: 0, change: 0 },
      aov: { current: 0, previous: 0, change: 0 },
      revenue: { current: 0, previous: 0, change: 0 },
      cogs: { current: 0, previous: 0, change: 0 },
      profit: { current: 0, previous: 0, change: 0 },
      sessions: { current: 0, previous: 0, change: 0 },
      subscriptions: { current: 0, previous: 0, change: 0, active: 0, new: 0 },
      customers: { current: 0, previous: 0, change: 0 },
      trafficSources: {
        organic: 0,
        direct: 0,
        referral: 0,
        social: 0,
        email: 0,
        paid: 0,
      },
    }
  }
}

