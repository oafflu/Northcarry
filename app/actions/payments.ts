'use server'

import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendInvoicePaidEmail } from '@/lib/email'

// Get all supplier invoices for admin
export async function getSupplierInvoices(filters?: {
  status?: string
  supplierId?: string
  search?: string
  limit?: number
  offset?: number
}) {
  try {
    const supabase = createAdminSupabaseClient()
    
    let query = supabase
      .from('supplier_invoices')
      .select(`
        *,
        profiles!supplier_invoices_supplier_id_fkey (
          id,
          email,
          first_name,
          last_name,
          company_name
        )
      `)
      .order('created_at', { ascending: false })

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters?.supplierId) {
      query = query.eq('supplier_id', filters.supplierId)
    }

    if (filters?.search) {
      query = query.or(`invoice_number.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 100) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching invoices:', error)
      return { success: false, error: error.message, data: [] }
    }

    // Format invoices for display
    const formattedInvoices = (data || []).map(invoice => {
      const supplier = invoice.profiles as any
      const supplierName = supplier?.company_name || 
        `${supplier?.first_name || ''} ${supplier?.last_name || ''}`.trim() || 
        supplier?.email || 'Unknown Supplier'

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        supplierId: invoice.supplier_id,
        supplierName,
        supplierEmail: supplier?.email,
        orderNumbers: invoice.order_numbers || [],
        orderCount: (invoice.order_numbers || []).length,
        subtotal: parseFloat(invoice.subtotal || '0'),
        taxAmount: parseFloat(invoice.tax_amount || '0'),
        totalAmount: parseFloat(invoice.total_amount || '0'),
        amount: parseFloat(invoice.amount || invoice.total_amount || '0'),
        status: invoice.status,
        companyName: invoice.company_name,
        companyAddress: invoice.address_line1 
          ? `${invoice.address_line1}${invoice.address_line2 ? ', ' + invoice.address_line2 : ''}, ${invoice.city}, ${invoice.state} ${invoice.postal_code}`
          : '',
        country: invoice.country,
        contactNumber: invoice.contact_number,
        email: invoice.email,
        taxId: invoice.tax_id,
        businessRegistrationNumber: invoice.business_registration_number,
        paidAt: invoice.paid_at,
        paidAmount: invoice.paid_amount ? parseFloat(invoice.paid_amount.toString()) : null,
        notes: invoice.notes,
        receiptUrl: invoice.receipt_url,
        createdAt: invoice.created_at,
      }
    })

    return { success: true, data: formattedInvoices }
  } catch (error: any) {
    console.error('Error in getSupplierInvoices:', error)
    return { success: false, error: error.message || 'Failed to fetch invoices', data: [] }
  }
}

// Get single invoice by ID for supplier (with ownership verification)
export async function getSupplierInvoiceByIdForSupplier(invoiceId: string, supplierId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data, error } = await supabase
      .from('supplier_invoices')
      .select(`
        *,
        profiles!supplier_invoices_supplier_id_fkey (
          id,
          email,
          first_name,
          last_name,
          company_name
        )
      `)
      .eq('id', invoiceId)
      .eq('supplier_id', supplierId)
      .single()

    if (error || !data) {
      if (error) {
        console.error('Error fetching invoice:', error)
        return { success: false, error: error.message, data: null }
      }
      return { success: false, error: 'Invoice not found or unauthorized', data: null }
    }

    // Get supplier's default payment method
    const { data: paymentMethod } = await supabase
      .from('supplier_payment_methods')
      .select('*')
      .eq('supplier_id', data.supplier_id)
      .eq('is_active', true)
      .eq('is_default', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const supplier = data.profiles as any
    const supplierName = supplier?.company_name || 
      `${supplier?.first_name || ''} ${supplier?.last_name || ''}`.trim() || 
      supplier?.email || 'Unknown Supplier'

    const formattedInvoice = {
      id: data.id,
      invoiceNumber: data.invoice_number,
      invoiceDate: data.invoice_date,
      dueDate: data.due_date,
      supplierId: data.supplier_id,
      supplierName,
      supplierEmail: supplier?.email,
      orderNumbers: data.order_numbers || [],
      orderCount: (data.order_numbers || []).length,
      subtotal: parseFloat(data.subtotal || '0'),
      taxAmount: parseFloat(data.tax_amount || '0'),
      totalAmount: parseFloat(data.total_amount || '0'),
      amount: parseFloat(data.amount || data.total_amount || '0'),
      status: data.status,
      companyName: data.company_name,
      companyAddress: data.address_line1 
        ? `${data.address_line1}${data.address_line2 ? ', ' + data.address_line2 : ''}, ${data.city}, ${data.state} ${data.postal_code}`
        : '',
      country: data.country,
      contactNumber: data.contact_number,
      email: data.email,
      taxId: data.tax_id,
      businessRegistrationNumber: data.business_registration_number,
      addressLine1: data.address_line1,
      addressLine2: data.address_line2,
      city: data.city,
      state: data.state,
      postalCode: data.postal_code,
      paidAt: data.paid_at,
      paidAmount: data.paid_amount ? parseFloat(data.paid_amount.toString()) : null,
      paymentMethodId: data.payment_method_id,
      notes: data.notes,
      receiptUrl: data.receipt_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      paymentMethod: paymentMethod ? {
        id: paymentMethod.id,
        methodType: paymentMethod.method_type,
        bankName: paymentMethod.bank_name,
        accountHolderName: paymentMethod.account_holder_name,
        accountNumber: paymentMethod.account_number ? '****' + paymentMethod.account_number.slice(-4) : null,
        routingNumber: paymentMethod.routing_number,
        iban: paymentMethod.iban,
        swiftCode: paymentMethod.swift_code,
        paypalEmail: paymentMethod.paypal_email,
        addressLine1: paymentMethod.address_line1,
        addressLine2: paymentMethod.address_line2,
        city: paymentMethod.city,
        state: paymentMethod.state,
        postalCode: paymentMethod.postal_code,
        country: paymentMethod.country,
      } : null,
    }

    return { success: true, data: formattedInvoice }
  } catch (error: any) {
    console.error('Error in getSupplierInvoiceByIdForSupplier:', error)
    return { success: false, error: error.message || 'Failed to fetch invoice', data: null }
  }
}

// Get single invoice by ID
export async function getSupplierInvoiceById(invoiceId: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data, error } = await supabase
      .from('supplier_invoices')
      .select(`
        *,
        profiles!supplier_invoices_supplier_id_fkey (
          id,
          email,
          first_name,
          last_name,
          company_name
        )
      `)
      .eq('id', invoiceId)
      .single()

    if (error || !data) {
      if (error) {
        console.error('Error fetching invoice:', error)
        return { success: false, error: error.message, data: null }
      }
      return { success: false, error: 'Invoice not found', data: null }
    }

    // Get supplier's default payment method
    const { data: paymentMethod } = await supabase
      .from('supplier_payment_methods')
      .select('*')
      .eq('supplier_id', data.supplier_id)
      .eq('is_active', true)
      .eq('is_default', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const supplier = data.profiles as any
    const supplierName = supplier?.company_name || 
      `${supplier?.first_name || ''} ${supplier?.last_name || ''}`.trim() || 
      supplier?.email || 'Unknown Supplier'

    const formattedInvoice = {
      id: data.id,
      invoiceNumber: data.invoice_number,
      invoiceDate: data.invoice_date,
      dueDate: data.due_date,
      supplierId: data.supplier_id,
      supplierName,
      supplierEmail: supplier?.email,
      orderNumbers: data.order_numbers || [],
      orderCount: (data.order_numbers || []).length,
      subtotal: parseFloat(data.subtotal || '0'),
      taxAmount: parseFloat(data.tax_amount || '0'),
      totalAmount: parseFloat(data.total_amount || '0'),
      amount: parseFloat(data.amount || data.total_amount || '0'),
      status: data.status,
      companyName: data.company_name,
      companyAddress: data.address_line1 
        ? `${data.address_line1}${data.address_line2 ? ', ' + data.address_line2 : ''}, ${data.city}, ${data.state} ${data.postal_code}`
        : '',
      country: data.country,
      contactNumber: data.contact_number,
      email: data.email,
      taxId: data.tax_id,
      businessRegistrationNumber: data.business_registration_number,
      addressLine1: data.address_line1,
      addressLine2: data.address_line2,
      city: data.city,
      state: data.state,
      postalCode: data.postal_code,
      paidAt: data.paid_at,
      paidAmount: data.paid_amount ? parseFloat(data.paid_amount.toString()) : null,
      paymentMethodId: data.payment_method_id,
      notes: data.notes,
      receiptUrl: data.receipt_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      paymentMethod: paymentMethod ? {
        id: paymentMethod.id,
        methodType: paymentMethod.method_type,
        bankName: paymentMethod.bank_name,
        accountHolderName: paymentMethod.account_holder_name,
        accountNumber: paymentMethod.account_number ? '****' + paymentMethod.account_number.slice(-4) : null,
        routingNumber: paymentMethod.routing_number,
        iban: paymentMethod.iban,
        swiftCode: paymentMethod.swift_code,
        paypalEmail: paymentMethod.paypal_email,
        addressLine1: paymentMethod.address_line1,
        addressLine2: paymentMethod.address_line2,
        city: paymentMethod.city,
        state: paymentMethod.state,
        postalCode: paymentMethod.postal_code,
        country: paymentMethod.country,
      } : null,
    }

    return { success: true, data: formattedInvoice }
  } catch (error: any) {
    console.error('Error in getSupplierInvoiceById:', error)
    return { success: false, error: error.message || 'Failed to fetch invoice', data: null }
  }
}

// Mark invoice as paid
// Update invoice notes (for paid invoices)
export async function updateInvoiceNotes(
  invoiceId: string,
  notes: string
) {
  try {
    const supabase = createAdminSupabaseClient()

    // First check if invoice exists and is paid
    const { data: invoice, error: fetchError } = await supabase
      .from('supplier_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .single()

    if (fetchError || !invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    if (invoice.status !== 'paid') {
      return { success: false, error: 'Can only update notes for paid invoices' }
    }

    // Update notes
    const { error } = await supabase
      .from('supplier_invoices')
      .update({ 
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)

    if (error) {
      console.error('Error updating invoice notes:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/payments')
    revalidatePath(`/admin/payments/${invoiceId}`)
    return { success: true }
  } catch (error: any) {
    console.error('Error in updateInvoiceNotes:', error)
    return { success: false, error: error.message || 'Failed to update invoice notes' }
  }
}

export async function markInvoiceAsPaid(
  invoiceId: string,
  data?: {
    paidAmount?: number
    paymentMethodId?: string
    notes?: string
    receiptUrl?: string
  }
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get invoice first to get the total amount
    const { data: invoice, error: invoiceError } = await supabase
      .from('supplier_invoices')
      .select('total_amount, amount')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    const totalAmount = parseFloat(invoice.total_amount || invoice.amount || '0')
    const paidAmount = data?.paidAmount || totalAmount

    const { error } = await supabase
      .from('supplier_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        paid_amount: paidAmount,
        payment_method_id: data?.paymentMethodId || null,
        notes: data?.notes || null,
        receipt_url: data?.receiptUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (error) {
      console.error('Error marking invoice as paid:', error)
      return { success: false, error: error.message }
    }

    // Get full invoice details for email
    const { data: fullInvoice } = await supabase
      .from('supplier_invoices')
      .select(`
        *,
        profiles!supplier_invoices_supplier_id_fkey (
          id,
          email,
          first_name,
          last_name,
          company_name
        )
      `)
      .eq('id', invoiceId)
      .single()

    // Send email notifications to supplier and admin
    if (fullInvoice) {
      const supplier = fullInvoice.profiles as any
      const supplierEmail = supplier?.email
      const supplierName = supplier?.company_name || 
        `${supplier?.first_name || ''} ${supplier?.last_name || ''}`.trim() || 
        supplier?.email || 'Supplier'

      // Get all admin emails
      const { data: admins } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('role', 'admin')
        .not('email', 'is', null)

      const adminEmails = admins?.map(admin => admin.email).filter(Boolean) || []

      // Send email to supplier
      if (supplierEmail) {
        try {
          await sendInvoicePaidEmail(
            supplierEmail,
            supplierName,
            fullInvoice.invoice_number,
            parseFloat(fullInvoice.total_amount || '0'),
            'supplier'
          )
        } catch (emailError) {
          console.error('Error sending invoice paid email to supplier:', emailError)
          // Don't fail the payment if email fails
        }
      }

      // Send email to all admins
      for (const adminEmail of adminEmails) {
        try {
          await sendInvoicePaidEmail(
            adminEmail,
            'Admin',
            fullInvoice.invoice_number,
            parseFloat(fullInvoice.total_amount || '0'),
            'admin'
          )
        } catch (emailError) {
          console.error(`Error sending invoice paid email to admin ${adminEmail}:`, emailError)
          // Don't fail the payment if email fails
        }
      }

      // Also send to system email
      try {
        await sendInvoicePaidEmail(
          'hello@brevibrushes.com',
          'BREVI™ Team',
          fullInvoice.invoice_number,
          parseFloat(fullInvoice.total_amount || '0'),
          'admin'
        )
      } catch (emailError) {
        console.error('Error sending invoice paid email to system email:', emailError)
      }
    }

    revalidatePath('/admin/payments')
    revalidatePath(`/admin/payments/${invoiceId}`)
    return { success: true }
  } catch (error: any) {
    console.error('Error in markInvoiceAsPaid:', error)
    return { success: false, error: error.message || 'Failed to mark invoice as paid' }
  }
}

// Cancel invoice
export async function cancelInvoice(invoiceId: string, reason?: string) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { error } = await supabase
      .from('supplier_invoices')
      .update({
        status: 'cancelled',
        notes: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (error) {
      console.error('Error cancelling invoice:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/payments')
    return { success: true }
  } catch (error: any) {
    console.error('Error in cancelInvoice:', error)
    return { success: false, error: error.message || 'Failed to cancel invoice' }
  }
}

// Resend invoice paid email
export async function resendInvoicePaidEmail(
  invoiceId: string,
  recipientType: 'supplier' | 'admin'
) {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('supplier_invoices')
      .select(`
        *,
        profiles!supplier_invoices_supplier_id_fkey (
          id,
          email,
          first_name,
          last_name,
          company_name
        )
      `)
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    if (invoice.status !== 'paid') {
      return { success: false, error: 'Invoice is not marked as paid' }
    }

    const supplier = invoice.profiles as any
    const supplierEmail = supplier?.email
    const supplierName = supplier?.company_name || 
      `${supplier?.first_name || ''} ${supplier?.last_name || ''}`.trim() || 
      supplier?.email || 'Supplier'

    if (recipientType === 'supplier') {
      if (!supplierEmail) {
        return { success: false, error: 'Supplier email not found' }
      }
      
      try {
        await sendInvoicePaidEmail(
          supplierEmail,
          supplierName,
          invoice.invoice_number,
          parseFloat(invoice.total_amount || '0'),
          'supplier'
        )
      } catch (emailError: any) {
        console.error('Error sending invoice paid email to supplier:', emailError)
        // Extract the error message, handling both Error objects and strings
        const errorMessage = emailError?.message || emailError || 'Failed to send email'
        return { success: false, error: errorMessage }
      }
    } else {
      // Send to all admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('role', 'admin')
        .not('email', 'is', null)

      const adminEmails = admins?.map(admin => admin.email).filter(Boolean) || []

      const errors: string[] = []

      for (const adminEmail of adminEmails) {
        try {
          await sendInvoicePaidEmail(
            adminEmail,
            'Admin',
            invoice.invoice_number,
            parseFloat(invoice.total_amount || '0'),
            'admin'
          )
        } catch (emailError: any) {
          console.error(`Error sending invoice paid email to admin ${adminEmail}:`, emailError)
          errors.push(`Failed to send to ${adminEmail}: ${emailError?.message || emailError}`)
        }
      }

      // Also send to system email
      try {
        await sendInvoicePaidEmail(
          'hello@brevibrushes.com',
          'BREVI™ Team',
          invoice.invoice_number,
          parseFloat(invoice.total_amount || '0'),
          'admin'
        )
      } catch (emailError: any) {
        console.error('Error sending invoice paid email to system email:', emailError)
        errors.push(`Failed to send to system email: ${emailError?.message || emailError}`)
      }

      // If all emails failed, return error
      if (errors.length > 0 && errors.length === adminEmails.length + 1) {
        return { success: false, error: errors[0] || 'Failed to send emails' }
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error resending invoice paid email:', error)
    return { success: false, error: error.message || 'Failed to resend email' }
  }
}

// Get payment statistics
export async function getPaymentStats() {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Get all invoices
    const { data: invoices, error } = await supabase
      .from('supplier_invoices')
      .select('status, total_amount, amount, created_at, paid_at')

    if (error) {
      console.error('Error fetching payment stats:', error)
      return { success: false, error: error.message }
    }

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    let totalPending = 0
    let totalPaid = 0
    let thisMonthPaid = 0
    let lastMonthPaid = 0
    let totalInvoices = 0
    let pendingInvoices = 0

    invoices?.forEach((invoice: any) => {
      const amount = parseFloat(invoice.total_amount || invoice.amount || '0')
      totalInvoices++

      if (invoice.status === 'paid') {
        totalPaid += amount
        const paidDate = invoice.paid_at ? new Date(invoice.paid_at) : null
        if (paidDate) {
          if (paidDate >= thisMonthStart) {
            thisMonthPaid += amount
          } else if (paidDate >= lastMonthStart && paidDate <= lastMonthEnd) {
            lastMonthPaid += amount
          }
        }
      } else if (invoice.status === 'sent' || invoice.status === 'pending') {
        totalPending += amount
        pendingInvoices++
      }
    })

    const changePercent = lastMonthPaid > 0 
      ? ((thisMonthPaid - lastMonthPaid) / lastMonthPaid) * 100 
      : 0

    return {
      success: true,
      data: {
        totalPending,
        totalPaid,
        thisMonthPaid,
        lastMonthPaid,
        changePercent,
        totalInvoices,
        pendingInvoices,
      }
    }
  } catch (error: any) {
    console.error('Error in getPaymentStats:', error)
    return { success: false, error: error.message || 'Failed to fetch payment stats' }
  }
}

