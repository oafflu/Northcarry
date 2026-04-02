"use server"

import { createAdminSupabaseClient } from "@/lib/supabase/admin"

export interface AnalyticsData {
  revenue: {
    total: number
    current: number
    previous: number
    change: number
  }
  orders: {
    total: number
    current: number
    previous: number
    change: number
  }
  customers: {
    total: number
    new: number
    returning: number
    retentionRate: number
  }
  products: {
    total: number
    topSelling: Array<{
      id: string
      name: string
      sales: number
      revenue: number
    }>
  }
  conversion: {
    rate: number
    avgOrderValue: number
  }
  trends: {
    revenueByDay: Array<{ date: string; revenue: number }>
    ordersByDay: Array<{ date: string; count: number }>
  }
}

export async function getAnalyticsData(
  dateRange: "7d" | "30d" | "90d" | "1y" | "custom" = "30d",
  customStart?: string,
  customEnd?: string
): Promise<AnalyticsData> {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Calculate date ranges
    const now = new Date()
    const ranges: Record<string, { current: Date; previous: Date }> = {
      "7d": {
        current: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        previous: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      },
      "30d": {
        current: new Date(now.getFullYear(), now.getMonth(), 1),
        previous: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      },
      "90d": {
        current: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        previous: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      },
      "1y": {
        current: new Date(now.getFullYear(), 0, 1),
        previous: new Date(now.getFullYear() - 1, 0, 1),
      },
    }

    let current: Date
    let previous: Date

    if (dateRange === "custom" && customStart && customEnd) {
      current = new Date(customStart)
      const customStartDate = new Date(customStart)
      const customEndDate = new Date(customEnd)
      const periodMs = Math.max(customEndDate.getTime() - customStartDate.getTime(), 24 * 60 * 60 * 1000)
      previous = new Date(customStartDate.getTime() - periodMs)
    } else {
      const selected = ranges[dateRange as "7d" | "30d" | "90d" | "1y"] || ranges["30d"]
      current = selected.current
      previous = selected.previous
    }

    const previousEnd = new Date(current.getTime() - 1)
    
    // Get revenue data
    const [currentRevenue, previousRevenue, totalRevenue] = await Promise.all([
      supabase
        .from("orders")
        .select("total")
        .eq("payment_status", "paid")
        .gte("created_at", current.toISOString()),
      supabase
        .from("orders")
        .select("total")
        .eq("payment_status", "paid")
        .gte("created_at", previous.toISOString())
        .lte("created_at", previousEnd.toISOString()),
      supabase
        .from("orders")
        .select("total")
        .eq("payment_status", "paid"),
    ])
    
    const currentRev = (currentRevenue.data || []).reduce((sum, o) => sum + parseFloat(o.total?.toString() || "0"), 0)
    const prevRev = (previousRevenue.data || []).reduce((sum, o) => sum + parseFloat(o.total?.toString() || "0"), 0)
    const totalRev = (totalRevenue.data || []).reduce((sum, o) => sum + parseFloat(o.total?.toString() || "0"), 0)
    const revenueChange = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : (currentRev > 0 ? 100 : 0)
    
    // Get orders data
    const [currentOrders, previousOrders, totalOrders] = await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", current.toISOString()),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", previous.toISOString())
        .lte("created_at", previousEnd.toISOString()),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true }),
    ])
    
    const currentOrd = currentOrders.count || 0
    const prevOrd = previousOrders.count || 0
    const totalOrd = totalOrders.count || 0
    const ordersChange = prevOrd > 0 ? ((currentOrd - prevOrd) / prevOrd) * 100 : (currentOrd > 0 ? 100 : 0)
    
    // Get customer data
    const { count: totalCustomers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
    
    const { count: newCustomers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
      .gte("created_at", current.toISOString())
    
    // Get top selling products
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(`
        product_id,
        quantity,
        line_total,
        products:product_id (id, title)
      `)
      .gte("created_at", current.toISOString())
    
    const productSales = new Map<string, { name: string; sales: number; revenue: number }>()
    orderItems?.forEach((item: any) => {
      const productId = item.product_id
      const product = item.products
      if (product) {
        if (!productSales.has(productId)) {
          productSales.set(productId, { name: product.title, sales: 0, revenue: 0 })
        }
        const current = productSales.get(productId)!
        current.sales += item.quantity || 0
        current.revenue += parseFloat(item.line_total?.toString() || "0")
      }
    })
    
    const topSelling = Array.from(productSales.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
    
    // Calculate conversion rate and AOV
    const avgOrderValue = currentOrd > 0 ? currentRev / currentOrd : 0
    
    // Get daily trends
    const days =
      dateRange === "custom" && customStart && customEnd
        ? Math.max(
            1,
            Math.ceil(
              (new Date(customEnd).getTime() - new Date(customStart).getTime()) / (24 * 60 * 60 * 1000)
            ) + 1
          )
        : dateRange === "7d"
          ? 7
          : dateRange === "30d"
            ? 30
            : dateRange === "90d"
              ? 90
              : 365
    const revenueByDay: Array<{ date: string; revenue: number }> = []
    const ordersByDay: Array<{ date: string; count: number }> = []
    
    for (let i = days - 1; i >= 0; i--) {
      const baseDate =
        dateRange === "custom" && customStart && customEnd
          ? new Date(customStart)
          : now
      const date =
        dateRange === "custom" && customStart && customEnd
          ? new Date(baseDate.getTime() + (days - 1 - i) * 24 * 60 * 60 * 1000)
          : new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split("T")[0]
      const dayStart = new Date(date.setHours(0, 0, 0, 0))
      const dayEnd = new Date(date.setHours(23, 59, 59, 999))
      
      const [dayRevenue, dayOrders] = await Promise.all([
        supabase
          .from("orders")
          .select("total")
          .eq("payment_status", "paid")
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString()),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .gte("created_at", dayStart.toISOString())
          .lte("created_at", dayEnd.toISOString()),
      ])
      
      const dayRev = (dayRevenue.data || []).reduce((sum, o) => sum + parseFloat(o.total?.toString() || "0"), 0)
      revenueByDay.push({ date: dateStr, revenue: dayRev })
      ordersByDay.push({ date: dateStr, count: dayOrders.count || 0 })
    }
    
    return {
      revenue: {
        total: totalRev,
        current: currentRev,
        previous: prevRev,
        change: revenueChange,
      },
      orders: {
        total: totalOrd,
        current: currentOrd,
        previous: prevOrd,
        change: ordersChange,
      },
      customers: {
        total: totalCustomers || 0,
        new: newCustomers || 0,
        returning: (totalCustomers || 0) - (newCustomers || 0),
        retentionRate: 0, // TODO: Calculate retention rate
      },
      products: {
        total: productSales.size,
        topSelling,
      },
      conversion: {
        rate: 0, // TODO: Calculate conversion rate
        avgOrderValue,
      },
      trends: {
        revenueByDay,
        ordersByDay,
      },
    }
  } catch (error: any) {
    console.error("Error getting analytics data:", error)
    return {
      revenue: { total: 0, current: 0, previous: 0, change: 0 },
      orders: { total: 0, current: 0, previous: 0, change: 0 },
      customers: { total: 0, new: 0, returning: 0, retentionRate: 0 },
      products: { total: 0, topSelling: [] },
      conversion: { rate: 0, avgOrderValue: 0 },
      trends: { revenueByDay: [], ordersByDay: [] },
    }
  }
}

export async function generateAIAnalysis(data: AnalyticsData, analysisType: "summary" | "insights" | "recommendations" = "summary"): Promise<string> {
  // This is a placeholder for AI analysis
  // In production, you would integrate with OpenAI, Anthropic, or another AI service
  
  const insights: string[] = []
  
  // Revenue analysis
  if (data.revenue.change > 0) {
    insights.push(`Revenue increased by ${data.revenue.change.toFixed(1)}% compared to the previous period, showing strong growth.`)
  } else if (data.revenue.change < 0) {
    insights.push(`Revenue decreased by ${Math.abs(data.revenue.change).toFixed(1)}% compared to the previous period. Consider reviewing marketing strategies.`)
  }
  
  // Orders analysis
  if (data.orders.change > 0) {
    insights.push(`Order volume increased by ${data.orders.change.toFixed(1)}%, indicating growing customer engagement.`)
  }
  
  // Top products
  if (data.products.topSelling.length > 0) {
    const topProduct = data.products.topSelling[0]
    insights.push(`${topProduct.name} is your top-selling product with $${topProduct.revenue.toFixed(2)} in revenue.`)
  }
  
  // Average order value
  if (data.conversion.avgOrderValue > 0) {
    insights.push(`Average order value is $${data.conversion.avgOrderValue.toFixed(2)}. Consider upselling strategies to increase this.`)
  }
  
  if (analysisType === "recommendations") {
    const recommendations: string[] = []
    
    if (data.revenue.change < 0) {
      recommendations.push("Focus on customer retention and re-engagement campaigns.")
      recommendations.push("Review pricing strategy and consider promotional offers.")
    }
    
    if (data.conversion.avgOrderValue < 50) {
      recommendations.push("Implement product bundles or upsell strategies to increase average order value.")
    }
    
    if (data.customers.new < data.customers.returning) {
      recommendations.push("Invest in customer acquisition campaigns to grow your customer base.")
    }
    
    return recommendations.join("\n\n")
  }
  
  return insights.join("\n\n")
}

