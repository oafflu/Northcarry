import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { getTrackingUrl } from '@/lib/tracking-urls'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticketId, category, subject, messages, customerEmail, userId } = body

    if (!ticketId) {
      return NextResponse.json({ success: false, error: 'Ticket ID required' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    // Get customer orders with tracking information
    let orders: any[] = []

    // Helper to load orders (by user_id or customer_email)
    const loadOrdersForCustomer = async (filters: { userId?: string; customerEmail?: string | null }) => {
      const query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          payment_status,
          fulfillment_status,
          created_at,
          customer_email,
          order_items (
            id,
            product_title,
            quantity
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (filters.userId) {
        query.eq('user_id', filters.userId)
      } else if (filters.customerEmail) {
        query.ilike('customer_email', filters.customerEmail.toLowerCase())
      }

      const { data: customerOrders } = await query

      if (!customerOrders || customerOrders.length === 0) {
        return []
      }

      const orderIds = customerOrders.map(o => o.id)

      // Get tracking information for each order
      const { data: trackingData } = await supabase
        .from('order_tracking')
        .select('order_id, carrier, tracking_number, status')
        .in('order_id', orderIds)

      // Also check supplier_order_assignments for tracking
      const { data: assignments } = await supabase
        .from('supplier_order_assignments')
        .select('order_id, carrier, tracking_number, assignment_status')
        .in('order_id', orderIds)
        .eq('assignment_status', 'shipped')

      // Combine tracking data
      const trackingMap = new Map()
      trackingData?.forEach(t => {
        if (!trackingMap.has(t.order_id)) {
          trackingMap.set(t.order_id, {
            carrier: t.carrier,
            trackingNumber: t.tracking_number,
            status: t.status,
          })
        }
      })
      assignments?.forEach(a => {
        if (!trackingMap.has(a.order_id) && a.carrier && a.tracking_number) {
          trackingMap.set(a.order_id, {
            carrier: a.carrier,
            trackingNumber: a.tracking_number,
            status: 'shipped',
          })
        }
      })

      // Enrich orders with tracking info
      return customerOrders.map(order => {
        const tracking = trackingMap.get(order.id)
        let trackingUrl = null
        if (tracking?.carrier && tracking?.trackingNumber) {
          trackingUrl = getTrackingUrl(tracking.carrier, tracking.trackingNumber)
        }
        return {
          ...order,
          tracking: tracking ? {
            carrier: tracking.carrier,
            trackingNumber: tracking.trackingNumber,
            status: tracking.status,
            trackingUrl,
          } : null,
        }
      })
    }

    // 1) Try by user_id if present
    if (userId) {
      orders = await loadOrdersForCustomer({ userId })
    }

    // 2) If no orders by user_id, try by customer email
    if ((!orders || orders.length === 0) && customerEmail) {
      orders = await loadOrdersForCustomer({ customerEmail })
    }

    // Get all messages text for context
    const allMessagesText = messages
      ?.map((m: any) => m.message || '')
      .join(' ')
      .toLowerCase() || ''
    const subjectText = (subject || '').toLowerCase()

    // Generate context-aware suggestions
    const suggestions: any[] = []

    // Order-related suggestions
    if (category === 'order' || subjectText.includes('order') || allMessagesText.includes('order')) {
      if (orders.length > 0) {
        // Find most recent order with tracking
        const orderWithTracking = orders.find(o => o.tracking?.trackingNumber)
        const recentOrder = orders[0]

        if (orderWithTracking && orderWithTracking.tracking) {
          suggestions.push({
            id: 1,
            title: 'Track Package Response',
            message: `I've checked your order tracking. Your package for order ${orderWithTracking.order_number} is currently ${orderWithTracking.tracking.status || 'in transit'} and should arrive soon.\n\nTracking Number: ${orderWithTracking.tracking.trackingNumber}\nCarrier: ${orderWithTracking.tracking.carrier}${orderWithTracking.tracking.trackingUrl ? `\nTrack here: ${orderWithTracking.tracking.trackingUrl}` : ''}\n\nWe apologize for any inconvenience.`,
          })
        }

        if (recentOrder.fulfillment_status === 'pending' || recentOrder.fulfillment_status === 'processing') {
          suggestions.push({
            id: 2,
            title: 'Order Processing Update',
            message: `Thank you for your order ${recentOrder.order_number}. Your order is currently being processed and will be shipped soon. You'll receive a tracking number via email once it ships.\n\nWe appreciate your patience!`,
          })
        }

        if (recentOrder.payment_status !== 'paid') {
          suggestions.push({
            id: 3,
            title: 'Payment Issue Response',
            message: `I see there's an issue with the payment for order ${recentOrder.order_number}. Let me help you resolve this. Please check your payment method or contact your bank if the payment was declined.\n\nWould you like me to help you update your payment information?`,
          })
        }
      } else {
        suggestions.push({
          id: 1,
          title: 'Order Not Found Response',
          message: `I've searched for your order but couldn't find it in our system. Could you please provide your order number or the email address you used when placing the order? This will help me locate your order and assist you further.`,
        })
      }
    }

    // Shipping-related suggestions
    if (category === 'shipping' || subjectText.includes('shipping') || subjectText.includes('delivery') || allMessagesText.includes('shipping') || allMessagesText.includes('delivery') || allMessagesText.includes('not received')) {
      if (orders.length > 0) {
        const shippedOrder = orders.find(o => o.fulfillment_status === 'fulfilled' || o.tracking?.trackingNumber)
        
        if (shippedOrder && shippedOrder.tracking) {
          suggestions.push({
            id: 4,
            title: 'Shipping Delay Response',
            message: `I apologize for the delay with your order ${shippedOrder.order_number}. Your package was shipped on ${new Date(shippedOrder.created_at).toLocaleDateString()}.\n\nTracking Number: ${shippedOrder.tracking.trackingNumber}\nCarrier: ${shippedOrder.tracking.carrier}${shippedOrder.tracking.trackingUrl ? `\nTrack here: ${shippedOrder.tracking.trackingUrl}` : ''}\n\nIf you don't receive your package within the expected timeframe, please let me know and I'll investigate further.`,
          })
        } else {
          suggestions.push({
            id: 5,
            title: 'Shipping Status Update',
            message: `I understand your concern about your order. Let me check the shipping status for you. Your order is currently being prepared for shipment and you'll receive tracking information via email once it ships.\n\nWe appreciate your patience!`,
          })
        }

        suggestions.push({
          id: 6,
          title: 'Offer Compensation',
          message: `I sincerely apologize for the shipping delay. As a gesture of goodwill, I'd like to offer you a 15% discount on your next order. Your package should arrive within 2-3 business days.\n\nPlease use code APOLOGIZE15 at checkout.`,
        })
      }
    }

    // Product-related suggestions
    if (category === 'product' || subjectText.includes('product') || allMessagesText.includes('product') || allMessagesText.includes('defect') || allMessagesText.includes('broken')) {
      suggestions.push({
        id: 7,
        title: 'Product Issue Response',
        message: `I'm sorry to hear about the issue with your product. To help you better, could you please provide:\n\n1. Your order number\n2. A description of the issue\n3. Photos if possible\n\nOnce I have this information, I'll be able to assist you with a replacement or refund.`,
      })

      suggestions.push({
        id: 8,
        title: 'Return/Refund Offer',
        message: `I understand your concern. We want to make this right. Would you like me to:\n\n1. Process a return and full refund\n2. Send a replacement product\n3. Offer store credit\n\nPlease let me know which option you prefer, and I'll take care of it right away.`,
      })
    }

    // General/Other category suggestions
    if (category === 'other' || category === 'technical') {
      suggestions.push({
        id: 9,
        title: 'General Assistance',
        message: `Thank you for reaching out. I'm here to help you with your inquiry. Could you please provide more details so I can assist you better?\n\nI'll make sure to get this resolved for you as quickly as possible.`,
      })
    }

    // Add order details suggestion if orders exist
    if (orders.length > 0) {
      const orderDetails = orders.slice(0, 3).map((order: any) => {
        let details = `Order ${order.order_number}:\n- Status: ${order.fulfillment_status || 'pending'}\n- Total: $${parseFloat(order.total?.toString() || '0').toFixed(2)}`
        if (order.tracking) {
          details += `\n- Tracking: ${order.tracking.trackingNumber} (${order.tracking.carrier})`
          if (order.tracking.trackingUrl) {
            details += `\n- Track here: ${order.tracking.trackingUrl}`
          }
        }
        return details
      }).join('\n\n')

      suggestions.push({
        id: 10,
        title: 'Order Details Summary',
        message: `Here are your recent order details:\n\n${orderDetails}\n\nIs there anything specific about these orders I can help you with?`,
      })
    }

    // If no specific suggestions, provide general ones
    if (suggestions.length === 0) {
      suggestions.push({
        id: 11,
        title: 'General Response',
        message: `Thank you for contacting us. I've received your message and I'm looking into this for you. I'll get back to you with an update as soon as possible.\n\nIs there anything else I can help you with in the meantime?`,
      })
    }

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, 5), // Limit to 5 suggestions
      orders: orders.map(o => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.fulfillment_status,
        tracking: o.tracking,
      })),
    })
  } catch (error: any) {
    console.error('Error generating AI suggestions:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}

