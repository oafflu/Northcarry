'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/translations/supplier/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, ArrowLeft, CheckSquare, Square, Calendar, Loader2, Send, Eye, Upload, X } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getSupplierOrdersCosts } from '@/app/actions/suppliers'
import { updateSupplierCompanyInfo } from '@/app/actions/auth'

export default function InvoicePage() {
  const { user } = useAuth()
  const supabase = createClient()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [fulfilledOrders, setFulfilledOrders] = useState<any[]>([])
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [orderCosts, setOrderCosts] = useState<Map<string, number>>(new Map())
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showPaidOrders, setShowPaidOrders] = useState(false)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [companyData, setCompanyData] = useState({
    company_name: '',
    tax_id: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    contact_number: '',
    email: '',
    business_registration_number: '',
  })
  const [brandingData, setBrandingData] = useState({
    logo_url: '',
    brand_color: '#14b8a6', // Default teal color
  })
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      loadFulfilledOrders()
      loadCompanyData()
    }
  }, [user, dateFilter, customStartDate, customEndDate, showPaidOrders])

  const loadCompanyData = async () => {
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) return

      // Load full profile data
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, email, phone, tax_id, business_address')
        .eq('id', user.id)
        .single()

      // Load company data from last invoice (most complete)
      const { data: lastInvoice } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('supplier_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastInvoice) {
        // Use invoice data as it has the most complete company information
        setCompanyData({
          company_name: lastInvoice.company_name || profile?.company_name || '',
          tax_id: lastInvoice.tax_id || profile?.tax_id || '',
          address_line1: lastInvoice.address_line1 || '',
          address_line2: lastInvoice.address_line2 || '',
          city: lastInvoice.city || '',
          state: lastInvoice.state || '',
          postal_code: lastInvoice.postal_code || '',
          country: lastInvoice.country || '',
          contact_number: lastInvoice.contact_number || profile?.phone || '',
          email: lastInvoice.email || profile?.email || '',
          business_registration_number: lastInvoice.business_registration_number || '',
        })
        setBrandingData({
          logo_url: lastInvoice.logo_url || '',
          brand_color: lastInvoice.brand_color || '#14b8a6',
        })
      } else if (profile) {
        // Use profile data, including business_address JSONB
        const businessAddress = profile.business_address as any || {}
        setCompanyData({
          company_name: profile.company_name || '',
          email: profile.email || '',
          contact_number: profile.phone || '',
          tax_id: profile.tax_id || '',
          address_line1: businessAddress.address_line1 || '',
          address_line2: businessAddress.address_line2 || '',
          city: businessAddress.city || '',
          state: businessAddress.state || '',
          postal_code: businessAddress.postal_code || '',
          country: businessAddress.country || '',
          business_registration_number: '',
        })
        setBrandingData({
          logo_url: '',
          brand_color: '#14b8a6',
        })
      }
    } catch (error) {
      console.error('Error loading company data:', error)
    }
  }

  const handleSaveCompanyInfo = async () => {
    if (!companyData.company_name || !companyData.email || !companyData.address_line1 || 
        !companyData.city || !companyData.state || !companyData.postal_code || 
        !companyData.country || !companyData.contact_number) {
      toast.error(t('payment.pleaseFillRequiredFields') || 'Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const result = await updateSupplierCompanyInfo(companyData)
      if (result.success) {
        toast.success(t('payment.companyInformationSaved') || 'Company information saved successfully')
        setShowCompanyForm(false)
        // Reload company data to ensure consistency
        await loadCompanyData()
      } else {
        toast.error('Failed to save company information', {
          description: result.error,
        })
      }
    } catch (error: any) {
      console.error('Error saving company information:', error)
      toast.error('Failed to save company information', {
        description: error.message || 'An unexpected error occurred',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, WEBP, SVG)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setUploadingLogo(true)
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) {
        toast.error('Not authenticated')
        return
      }

      // Generate file path
      const timestamp = Date.now()
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = `supplier-invoices/${user.id}/${timestamp}-${sanitizedFileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('cms-media')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        toast.error(uploadError.message || 'Failed to upload logo')
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('cms-media')
        .getPublicUrl(filePath)

      setBrandingData(prev => ({ ...prev, logo_url: publicUrl }))
      toast.success('Logo uploaded successfully')
    } catch (error: any) {
      console.error('Error uploading logo:', error)
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  const loadFulfilledOrders = async () => {
    setLoading(true)
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) return

      // Calculate date range
      let startDate: Date | null = null
      let endDate: Date | null = null

      if (dateFilter === 'today') {
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date()
        endDate.setHours(23, 59, 59, 999)
      } else if (dateFilter === 'week') {
        endDate = new Date()
        endDate.setHours(23, 59, 59, 999)
        startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
      } else if (dateFilter === 'month') {
        endDate = new Date()
        endDate.setHours(23, 59, 59, 999)
        startDate = new Date(endDate)
        startDate.setMonth(startDate.getMonth() - 1)
        startDate.setHours(0, 0, 0, 0)
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        startDate = new Date(customStartDate)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(customEndDate)
        endDate.setHours(23, 59, 59, 999)
      }

      // Get assignments where supplier has shipped (assignment_status = 'shipped')
      // This is more accurate than checking main order fulfillment_status
      // Only include paid orders (suppliers should only fulfill paid orders)
      let assignmentsQuery = supabase
        .from('supplier_order_assignments')
        .select('order_id, shipped_at, orders!inner(id, payment_status)')
        .eq('supplier_id', user.id)
        .eq('assignment_status', 'shipped')
        .eq('orders.payment_status', 'paid') // Only show paid orders

      // Apply date filter on shipped_at if needed
      if (startDate && endDate) {
        assignmentsQuery = assignmentsQuery.gte('shipped_at', startDate.toISOString())
        assignmentsQuery = assignmentsQuery.lte('shipped_at', endDate.toISOString())
      }

      const { data: assignments, error: assignmentsError } = await assignmentsQuery

      if (assignmentsError) {
        console.error('Error loading assignments:', assignmentsError)
        toast.error('Failed to load orders')
        setFulfilledOrders([])
        setLoading(false)
        return
      }

      if (!assignments || assignments.length === 0) {
        setFulfilledOrders([])
        setLoading(false)
        return
      }

      const orderIds = assignments.map(a => a.order_id).filter(Boolean)

      // Get orders that are already in paid invoices (if filter is enabled)
      let paidOrderNumbers: Set<string> = new Set()
      if (!showPaidOrders) {
        // Get all paid invoices for this supplier
        const { data: paidInvoices } = await supabase
          .from('supplier_invoices')
          .select('order_numbers')
          .eq('supplier_id', user.id)
          .eq('status', 'paid')

        if (paidInvoices) {
          paidInvoices.forEach(invoice => {
            if (invoice.order_numbers && Array.isArray(invoice.order_numbers)) {
              invoice.order_numbers.forEach((orderNum: string) => {
                paidOrderNumbers.add(orderNum)
              })
            }
          })
        }
      }

      // Now get the order details for these shipped assignments
      // Date filtering is already done on assignments.shipped_at, so we don't need to filter again
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, fulfillment_status, fulfilled_at, created_at')
        .in('id', orderIds)
        .order('fulfilled_at', { ascending: false })

      if (ordersError) {
        console.error('Error loading orders:', ordersError)
        toast.error('Failed to load orders')
        setFulfilledOrders([])
      } else {
        // Filter out paid orders if filter is enabled
        let filteredOrders = ordersData || []
        if (!showPaidOrders && paidOrderNumbers.size > 0) {
          filteredOrders = filteredOrders.filter((order: any) => 
            !paidOrderNumbers.has(order.order_number)
          )
        }
        setFulfilledOrders(filteredOrders)

        // Calculate costs
        if (ordersData && ordersData.length > 0) {
          const fulfilledOrderIds = ordersData.map((o: any) => o.id).filter(Boolean)
          const costsResult = await getSupplierOrdersCosts(fulfilledOrderIds, user.id)
          
          if (costsResult.success) {
            const costsMap = new Map<string, number>()
            costsResult.orderCosts.forEach(cost => {
              costsMap.set(cost.orderId, cost.cost)
            })
            setOrderCosts(costsMap)
          }
        }
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error(t('payment.unexpectedError') || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedOrders.size === fulfilledOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(fulfilledOrders.map(o => o.id)))
    }
  }

  const handleGenerateInvoice = async () => {
    if (selectedOrders.size === 0) {
      toast.error(t('payment.pleaseSelectOrders') || 'Please select at least one order')
      return
    }

    if (!companyData.company_name || !companyData.email) {
      toast.error(t('payment.pleaseConfigureCompanyInfo') || 'Please configure your company information first')
      setShowCompanyForm(true)
      return
    }

    setSaving(true)
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) {
        toast.error('Not authenticated')
        return
      }

      const selectedOrderNumbers = fulfilledOrders
        .filter(o => selectedOrders.has(o.id))
        .map(o => o.order_number)
        .filter(Boolean)

      const totalCost = Array.from(selectedOrders).reduce((sum, orderId) => {
        return sum + (orderCosts.get(orderId) || 0)
      }, 0)

      // Generate invoice number
      let invoiceNumber: string
      try {
        const { data: invoiceNumberData, error: rpcError } = await supabase.rpc('generate_invoice_number')
        if (rpcError || !invoiceNumberData) {
          // Fallback: generate manually if function doesn't exist
          const year = new Date().getFullYear()
          const month = String(new Date().getMonth() + 1).padStart(2, '0')
          const { count } = await supabase
            .from('supplier_invoices')
            .select('*', { count: 'exact', head: true })
            .like('invoice_number', `INV-${year}${month}-%`)
          
          const seqNum = ((count || 0) + 1).toString().padStart(4, '0')
          invoiceNumber = `INV-${year}${month}-${seqNum}`
        } else {
          invoiceNumber = invoiceNumberData
        }
      } catch (error) {
        // Fallback: generate manually
        const year = new Date().getFullYear()
        const month = String(new Date().getMonth() + 1).padStart(2, '0')
        const { count } = await supabase
          .from('supplier_invoices')
          .select('*', { count: 'exact', head: true })
          .like('invoice_number', `INV-${year}${month}-%`)
        
        const seqNum = ((count || 0) + 1).toString().padStart(4, '0')
        invoiceNumber = `INV-${year}${month}-${seqNum}`
      }

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('supplier_invoices')
        .insert({
          supplier_id: user.id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          order_numbers: selectedOrderNumbers,
          subtotal: totalCost,
          tax_amount: 0,
          total_amount: totalCost,
          amount: totalCost,
          status: 'sent',
          logo_url: brandingData.logo_url || null,
          brand_color: brandingData.brand_color || '#14b8a6',
          company_name: companyData.company_name,
          tax_id: companyData.tax_id || null,
          address_line1: companyData.address_line1,
          address_line2: companyData.address_line2 || null,
          city: companyData.city,
          state: companyData.state,
          postal_code: companyData.postal_code,
          country: companyData.country,
          contact_number: companyData.contact_number,
          email: companyData.email,
          business_registration_number: companyData.business_registration_number || null,
        })
        .select()
        .single()

      if (invoiceError) {
        throw invoiceError
      }

      // Send email notification to hello@brevibrushes.com
      try {
        const { sendSupplierInvoiceCreatedEmail } = await import('@/lib/email')
        await sendSupplierInvoiceCreatedEmail(
          invoice.invoice_number,
          companyData.company_name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Supplier',
          companyData.email || user.email || '',
          totalCost,
          selectedOrderNumbers
        )
        console.log('Invoice creation email sent to hello@brevibrushes.com')
      } catch (emailError) {
        console.error('Error sending invoice creation email:', emailError)
        // Don't fail invoice creation if email fails
      }

      toast.success(t('payment.invoiceGenerated') || 'Invoice generated and sent to admin')
      setSelectedOrders(new Set())
      loadFulfilledOrders()
    } catch (error: any) {
      console.error('Error generating invoice:', error)
      toast.error(error.message || t('payment.failedToGenerateInvoice') || 'Failed to generate invoice')
    } finally {
      setSaving(false)
    }
  }

  const selectedTotal = Array.from(selectedOrders).reduce((sum, orderId) => {
    return sum + (orderCosts.get(orderId) || 0)
  }, 0)

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/supplier/payment" className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back') || 'Back'}
        </Link>
        <h1 className="text-3xl font-bold">{t('payment.sendInvoice') || 'Send Invoice'}</h1>
        <p className="text-gray-600 mt-1">{t('payment.generateInvoice') || 'Generate and send invoices for fulfilled orders'}</p>
      </div>

      {/* Company Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t('payment.companyInformation') || 'Company Information'}</h2>
          <Button
            variant="outline"
            onClick={() => setShowCompanyForm(!showCompanyForm)}
          >
            {showCompanyForm ? (t('common.hide') || 'Hide') : (t('common.edit') || 'Edit')}
          </Button>
        </div>

        {!showCompanyForm ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">{t('payment.companyName') || 'Company Name'}:</span>
              <p className="font-medium">{companyData.company_name || '-'}</p>
            </div>
            <div>
              <span className="text-gray-600">{t('payment.email') || 'Email'}:</span>
              <p className="font-medium">{companyData.email || '-'}</p>
            </div>
            <div>
              <span className="text-gray-600">{t('payment.address') || 'Address'}:</span>
              <p className="font-medium">
                {companyData.address_line1 ? `${companyData.address_line1}, ${companyData.city}, ${companyData.state} ${companyData.postal_code}` : '-'}
              </p>
            </div>
            <div>
              <span className="text-gray-600">{t('payment.country') || 'Country'}:</span>
              <p className="font-medium">{companyData.country || '-'}</p>
            </div>
          </div>
        ) : (
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.companyName') || 'Company Name'} *</label>
                <Input
                  value={companyData.company_name}
                  onChange={(e) => setCompanyData({ ...companyData, company_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.taxId') || 'Tax ID (Optional)'}</label>
                <Input
                  value={companyData.tax_id}
                  onChange={(e) => setCompanyData({ ...companyData, tax_id: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">{t('payment.addressLine1') || 'Address Line 1'} *</label>
                <Input
                  value={companyData.address_line1}
                  onChange={(e) => setCompanyData({ ...companyData, address_line1: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">{t('payment.addressLine2') || 'Address Line 2'}</label>
                <Input
                  value={companyData.address_line2}
                  onChange={(e) => setCompanyData({ ...companyData, address_line2: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.city') || 'City'} *</label>
                <Input
                  value={companyData.city}
                  onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.state') || 'State'} *</label>
                <Input
                  value={companyData.state}
                  onChange={(e) => setCompanyData({ ...companyData, state: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.postalCode') || 'Postal Code'} *</label>
                <Input
                  value={companyData.postal_code}
                  onChange={(e) => setCompanyData({ ...companyData, postal_code: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.country') || 'Country'} *</label>
                <Input
                  value={companyData.country}
                  onChange={(e) => setCompanyData({ ...companyData, country: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.contactNumber') || 'Contact Number'} *</label>
                <Input
                  value={companyData.contact_number}
                  onChange={(e) => setCompanyData({ ...companyData, contact_number: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.email') || 'Email'} *</label>
                <Input
                  type="email"
                  value={companyData.email}
                  onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.businessRegistrationNumber') || 'Business Registration Number'}</label>
                <Input
                  value={companyData.business_registration_number}
                  onChange={(e) => setCompanyData({ ...companyData, business_registration_number: e.target.value })}
                />
              </div>
            </div>

            {/* Branding Section */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-4">{t('payment.invoiceBranding') || 'Invoice Branding'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('payment.logo') || 'Logo'}</label>
                  <div className="flex items-center gap-4">
                    {brandingData.logo_url ? (
                      <div className="relative">
                        <img
                          src={brandingData.logo_url}
                          alt="Logo"
                          className="h-20 w-auto object-contain border border-gray-200 rounded"
                        />
                        <button
                          onClick={() => setBrandingData(prev => ({ ...prev, logo_url: '' }))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-20 w-32 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                        <p className="text-xs text-gray-400 text-center px-2">No logo</p>
                      </div>
                    )}
                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploadingLogo}
                          className="cursor-pointer"
                        >
                          {uploadingLogo ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t('payment.uploading') || 'Uploading...'}
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              {t('payment.uploadLogo') || 'Upload Logo'}
                            </>
                          )}
                        </Button>
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Max 5MB, JPG/PNG/GIF/WEBP/SVG</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('payment.brandColor') || 'Brand Color'}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandingData.brand_color}
                      onChange={(e) => setBrandingData(prev => ({ ...prev, brand_color: e.target.value }))}
                      className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={brandingData.brand_color}
                      onChange={(e) => setBrandingData(prev => ({ ...prev, brand_color: e.target.value }))}
                      placeholder="#14b8a6"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('payment.colorHint') || 'Color used for invoice header and accents'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCompanyForm(false)
                  loadCompanyData() // Reset to original values
                }}
                disabled={saving}
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button
                type="button"
                onClick={handleSaveCompanyInfo}
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('common.saving') || 'Saving...'}
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    {t('common.save') || 'Save'}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{t('payment.filterByDate') || 'Filter by Date'}:</span>
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">{t('payment.allTime') || 'All Time'}</option>
            <option value="today">{t('payment.today') || 'Today'}</option>
            <option value="week">{t('payment.last7Days') || 'Last 7 Days'}</option>
            <option value="month">{t('payment.last30Days') || 'Last 30 Days'}</option>
            <option value="custom">{t('payment.customRange') || 'Custom Range'}</option>
          </select>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-sm"
              />
              <span className="text-gray-500">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-sm"
              />
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="checkbox"
              id="showPaidOrders"
              checked={showPaidOrders}
              onChange={(e) => setShowPaidOrders(e.target.checked)}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            <label htmlFor="showPaidOrders" className="text-sm text-gray-700 cursor-pointer">
              {t('payment.showPaidOrders')}
            </label>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('payment.fulfilledOrders') || 'Fulfilled Orders'}</h2>
          {fulfilledOrders.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
            >
              {selectedOrders.size === fulfilledOrders.length ? (
                <>
                  <CheckSquare className="w-4 h-4 mr-2" />
                  {t('payment.deselectAll') || 'Deselect All'}
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  {t('payment.selectAll') || 'Select All'}
                </>
              )}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" />
          </div>
        ) : fulfilledOrders.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('payment.noFulfilledOrders') || 'No fulfilled orders found'}</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-200">
              {fulfilledOrders.map((order) => (
                <div
                  key={order.id}
                  className={`p-4 flex items-center justify-between hover:bg-gray-50 ${
                    selectedOrders.has(order.id) ? 'bg-teal-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleOrderSelection(order.id)}
                      className="flex items-center justify-center"
                    >
                      {selectedOrders.has(order.id) ? (
                        <CheckSquare className="w-5 h-5 text-teal-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <div>
                      <p className="font-mono font-medium">{order.order_number}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(order.fulfilled_at || order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${(orderCosts.get(order.id) || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedOrders.size > 0 && (
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600">
                      {selectedOrders.size} {t('payment.ordersSelected') || 'order(s) selected'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      ${selectedTotal.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateInvoice}
                    disabled={saving || !companyData.company_name || !companyData.email}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('payment.generating') || 'Generating...'}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        {t('payment.sendInvoice') || 'Send Invoice'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{t('payment.invoicePreview') || 'Invoice Preview'}</h2>
              <Button
                variant="outline"
                onClick={() => setShowPreview(false)}
              >
                <X className="w-4 h-4 mr-2" />
                {t('common.close') || 'Close'}
              </Button>
            </div>
            <div className="p-8">
              {/* Invoice Preview Content */}
              <div className="border-2 border-gray-200 rounded-lg p-8 bg-white">
                {/* Header */}
                <div className="mb-8" style={{ borderBottom: `3px solid ${brandingData.brand_color}` }}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      {brandingData.logo_url && (
                        <img
                          src={brandingData.logo_url}
                          alt="Logo"
                          className="h-16 w-auto mb-4"
                        />
                      )}
                      <h1 className="text-3xl font-bold" style={{ color: brandingData.brand_color }}>
                        {companyData.company_name || 'Company Name'}
                      </h1>
                    </div>
                    <div className="text-right">
                      <h2 className="text-2xl font-bold mb-2">INVOICE</h2>
                      <p className="text-sm text-gray-600">
                        {t('payment.invoiceNumber') || 'Invoice #'}: INV-{new Date().getFullYear()}{String(new Date().getMonth() + 1).padStart(2, '0')}-0001
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('payment.date') || 'Date'}: {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Company Info */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="font-semibold mb-2">{t('payment.from') || 'From'}:</h3>
                    <p className="text-sm">{companyData.company_name}</p>
                    {companyData.address_line1 && (
                      <p className="text-sm">
                        {companyData.address_line1}
                        {companyData.address_line2 && `, ${companyData.address_line2}`}
                        <br />
                        {companyData.city}, {companyData.state} {companyData.postal_code}
                        <br />
                        {companyData.country}
                      </p>
                    )}
                    {companyData.email && <p className="text-sm mt-2">{companyData.email}</p>}
                    {companyData.contact_number && <p className="text-sm">{companyData.contact_number}</p>}
                    {companyData.tax_id && <p className="text-sm mt-2">{t('payment.taxId') || 'Tax ID'}: {companyData.tax_id}</p>}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">{t('payment.to') || 'To'}:</h3>
                    <p className="text-sm">BREVI Admin</p>
                  </div>
                </div>

                {/* Order Numbers */}
                <div className="mb-8">
                  <h3 className="font-semibold mb-4">{t('payment.orderNumbers') || 'Order Numbers'}:</h3>
                  <div className="border border-gray-200 rounded">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold">{t('payment.orderNumber') || 'Order Number'}</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold">{t('payment.amount') || 'Amount'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fulfilledOrders
                          .filter(o => selectedOrders.has(o.id))
                          .map((order) => (
                            <tr key={order.id} className="border-t border-gray-200">
                              <td className="px-4 py-3 text-sm font-mono">{order.order_number}</td>
                              <td className="px-4 py-3 text-sm text-right">${(orderCosts.get(order.id) || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-8">
                  <div className="w-64">
                    <div className="flex justify-between py-2 border-t border-gray-200">
                      <span className="font-semibold">{t('payment.subtotal') || 'Subtotal'}:</span>
                      <span className="font-semibold">${selectedTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-t border-gray-200">
                      <span className="font-semibold">{t('payment.tax') || 'Tax'}:</span>
                      <span className="font-semibold">$0.00</span>
                    </div>
                    <div className="flex justify-between py-3 border-t-2 border-gray-300 mt-2" style={{ borderColor: brandingData.brand_color }}>
                      <span className="text-lg font-bold">{t('payment.total') || 'Total'}:</span>
                      <span className="text-lg font-bold" style={{ color: brandingData.brand_color }}>${selectedTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
                  <p>{t('payment.thankYou') || 'Thank you for your business!'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

