'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/lib/translations/supplier/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CreditCard, Plus, Edit, Trash2, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function PaymentMethodsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const { t } = useTranslation()
  const [methods, setMethods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    method_type: 'bank',
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    routing_number: '',
    iban: '',
    swift_code: '',
    paypal_email: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    is_default: false,
  })

  useEffect(() => {
    if (user) {
      loadMethods()
    }
  }, [user])

  const loadMethods = async () => {
    setLoading(true)
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) return

      const { data, error } = await supabase
        .from('supplier_payment_methods')
        .select('*')
        .eq('supplier_id', user.id)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading payment methods:', error)
        toast.error(t('payment.failedToLoadPaymentMethods') || 'Failed to load payment methods')
      } else {
        setMethods(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error(t('payment.unexpectedError') || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // User is already authenticated by layout - no need to check again
      if (!user) {
        toast.error(t('payment.notAuthenticated') || 'Not authenticated')
        return
      }

      const methodData: any = {
        supplier_id: user.id,
        method_type: formData.method_type,
        is_default: formData.is_default,
      }

      if (formData.method_type === 'bank') {
        methodData.bank_name = formData.bank_name
        methodData.account_holder_name = formData.account_holder_name
        methodData.account_number = formData.account_number
        methodData.routing_number = formData.routing_number
        if (formData.iban) methodData.iban = formData.iban
        if (formData.swift_code) methodData.swift_code = formData.swift_code
        methodData.address_line1 = formData.address_line1
        methodData.address_line2 = formData.address_line2 || null
        methodData.city = formData.city
        methodData.state = formData.state
        methodData.postal_code = formData.postal_code
        methodData.country = formData.country
      } else if (formData.method_type === 'paypal') {
        methodData.paypal_email = formData.paypal_email
      }

      // If setting as default, unset other defaults
      if (formData.is_default) {
        await supabase
          .from('supplier_payment_methods')
          .update({ is_default: false })
          .eq('supplier_id', user.id)
      }

      if (editingId) {
        const { error } = await supabase
          .from('supplier_payment_methods')
          .update(methodData)
          .eq('id', editingId)

        if (error) throw error
        toast.success(t('payment.paymentMethodUpdated') || 'Payment method updated successfully')
      } else {
        const { error } = await supabase
          .from('supplier_payment_methods')
          .insert(methodData)

        if (error) throw error
        toast.success(t('payment.paymentMethodAdded') || 'Payment method added successfully')
      }

      setShowForm(false)
      setEditingId(null)
      resetForm()
      loadMethods()
    } catch (error: any) {
      console.error('Error saving payment method:', error)
      toast.error(error.message || t('payment.failedToAddPaymentMethod') || 'Failed to save payment method')
    }
  }

  const handleEdit = (method: any) => {
    setEditingId(method.id)
    setFormData({
      method_type: method.method_type,
      bank_name: method.bank_name || '',
      account_holder_name: method.account_holder_name || '',
      account_number: method.account_number || '',
      routing_number: method.routing_number || '',
      iban: method.iban || '',
      swift_code: method.swift_code || '',
      paypal_email: method.paypal_email || '',
      address_line1: method.address_line1 || '',
      address_line2: method.address_line2 || '',
      city: method.city || '',
      state: method.state || '',
      postal_code: method.postal_code || '',
      country: method.country || '',
      is_default: method.is_default || false,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('payment.confirmDeletePaymentMethod') || 'Are you sure you want to delete this payment method?')) return

    try {
      const { error } = await supabase
        .from('supplier_payment_methods')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
      toast.success(t('payment.paymentMethodDeleted') || 'Payment method deleted')
      loadMethods()
    } catch (error: any) {
      console.error('Error deleting payment method:', error)
      toast.error(error.message || t('payment.failedToDeletePaymentMethod') || 'Failed to delete payment method')
    }
  }

  const resetForm = () => {
    setFormData({
      method_type: 'bank',
      bank_name: '',
      account_holder_name: '',
      account_number: '',
      routing_number: '',
      iban: '',
      swift_code: '',
      paypal_email: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      is_default: false,
    })
  }

  const getCountrySpecificFields = () => {
    const country = formData.country?.toLowerCase() || ''
    
    if (country === 'cn' || country === 'china') {
      return {
        showRouting: false,
        showIBAN: false,
        showSWIFT: true,
        routingLabel: t('payment.bankCode') || 'Bank Code',
        accountLabel: t('payment.accountNumber') || 'Account Number',
        requiredFields: ['bank_name', 'account_holder_name', 'account_number', 'swift_code', 'address_line1', 'city', 'postal_code', 'country'],
      }
    } else if (['de', 'fr', 'it', 'es', 'nl', 'be', 'at', 'ch', 'se', 'no', 'dk', 'fi', 'ie', 'pt', 'pl', 'cz', 'hu', 'gr', 'ro', 'bg', 'hr', 'sk', 'si', 'ee', 'lv', 'lt', 'lu', 'mt', 'cy'].includes(country) || country.includes('europe')) {
      return {
        showRouting: false,
        showIBAN: true,
        showSWIFT: true,
        routingLabel: t('payment.routingNumber') || 'Routing Number',
        accountLabel: t('payment.accountNumber') || 'Account Number',
        requiredFields: ['bank_name', 'account_holder_name', 'iban', 'swift_code', 'address_line1', 'city', 'postal_code', 'country'],
      }
    } else {
      // USA and others
      return {
        showRouting: true,
        showIBAN: false,
        showSWIFT: false,
        routingLabel: t('payment.routingNumber') || 'Routing Number',
        accountLabel: t('payment.accountNumber') || 'Account Number',
        requiredFields: ['bank_name', 'account_holder_name', 'account_number', 'routing_number', 'address_line1', 'city', 'state', 'postal_code', 'country'],
      }
    }
  }

  const countryFields = getCountrySpecificFields()

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/supplier/payment" className="flex items-center text-gray-600 hover:text-gray-900 mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back') || 'Back'}
          </Link>
          <h1 className="text-3xl font-bold">{t('payment.paymentMethods') || 'Payment Methods'}</h1>
          <p className="text-gray-600 mt-1">{t('payment.managePaymentMethods') || 'Manage your bank details and payment methods'}</p>
        </div>
        <Button
          onClick={() => {
            resetForm()
            setEditingId(null)
            setShowForm(true)
          }}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('payment.addPaymentMethod') || 'Add Payment Method'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? (t('payment.editPaymentMethod') || 'Edit Payment Method') : (t('payment.addPaymentMethod') || 'Add Payment Method')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('payment.methodType') || 'Method Type'}</label>
              <select
                value={formData.method_type}
                onChange={(e) => setFormData({ ...formData, method_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="bank">{t('payment.bank') || 'Bank Account'}</option>
                <option value="paypal">{t('payment.paypal') || 'PayPal'}</option>
              </select>
            </div>

            {formData.method_type === 'bank' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('payment.country') || 'Country'} *</label>
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">{t('payment.selectCountry') || 'Select Country'}</option>
                    <option value="US">United States</option>
                    <option value="CN">China</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="IT">Italy</option>
                    <option value="ES">Spain</option>
                    <option value="NL">Netherlands</option>
                    <option value="BE">Belgium</option>
                    <option value="AT">Austria</option>
                    <option value="CH">Switzerland</option>
                    <option value="SE">Sweden</option>
                    <option value="NO">Norway</option>
                    <option value="DK">Denmark</option>
                    <option value="FI">Finland</option>
                    <option value="IE">Ireland</option>
                    <option value="PT">Portugal</option>
                    <option value="PL">Poland</option>
                    <option value="CZ">Czech Republic</option>
                    <option value="HU">Hungary</option>
                    <option value="GR">Greece</option>
                    <option value="RO">Romania</option>
                    <option value="BG">Bulgaria</option>
                    <option value="HR">Croatia</option>
                    <option value="SK">Slovakia</option>
                    <option value="SI">Slovenia</option>
                    <option value="EE">Estonia</option>
                    <option value="LV">Latvia</option>
                    <option value="LT">Lithuania</option>
                    <option value="LU">Luxembourg</option>
                    <option value="MT">Malta</option>
                    <option value="CY">Cyprus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('payment.bankName') || 'Bank Name'} *</label>
                  <Input
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('payment.accountHolderName') || 'Account Holder Name'} *</label>
                  <Input
                    value={formData.account_holder_name}
                    onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{countryFields.accountLabel} *</label>
                  <Input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    required
                  />
                </div>
                {countryFields.showRouting && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{countryFields.routingLabel} *</label>
                    <Input
                      type="text"
                      value={formData.routing_number}
                      onChange={(e) => setFormData({ ...formData, routing_number: e.target.value })}
                      required
                    />
                  </div>
                )}
                {countryFields.showIBAN && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('payment.iban') || 'IBAN'} *</label>
                    <Input
                      type="text"
                      value={formData.iban}
                      onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                      required
                    />
                  </div>
                )}
                {countryFields.showSWIFT && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('payment.swiftCode') || 'SWIFT Code'} *</label>
                    <Input
                      type="text"
                      value={formData.swift_code}
                      onChange={(e) => setFormData({ ...formData, swift_code: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('payment.addressLine1') || 'Address Line 1'} *</label>
                  <Input
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('payment.addressLine2') || 'Address Line 2'}</label>
                  <Input
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('payment.city') || 'City'} *</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                {formData.country?.toLowerCase() === 'us' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('payment.state') || 'State'} *</label>
                    <Input
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">{t('payment.postalCode') || 'Postal Code'} *</label>
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    required
                  />
                </div>
              </>
            )}

            {formData.method_type === 'paypal' && (
              <div>
                <label className="block text-sm font-medium mb-2">{t('payment.paypalEmail') || 'PayPal Email'}</label>
                <Input
                  type="email"
                  value={formData.paypal_email}
                  onChange={(e) => setFormData({ ...formData, paypal_email: e.target.value })}
                  required
                />
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="is_default" className="text-sm">
                {t('payment.setAsDefault') || 'Set as default payment method'}
              </label>
            </div>

            <div className="flex gap-3">
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                {editingId ? (t('common.save') || 'Save') : (t('common.add') || 'Add')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  resetForm()
                }}
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        {methods.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">{t('payment.noPaymentMethods') || 'No payment methods added yet'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {methods.map((method) => (
              <div key={method.id} className="p-6 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">
                      {method.method_type === 'bank' 
                        ? `${method.bank_name} • ••••${method.account_number?.slice(-4) || ''}`
                        : `PayPal • ${method.paypal_email}`
                      }
                    </h3>
                    {method.is_default && (
                      <span className="px-2 py-1 text-xs font-medium bg-teal-100 text-teal-800 rounded-full">
                        {t('payment.default') || 'Default'}
                      </span>
                    )}
                  </div>
                  {method.method_type === 'bank' && (
                    <p className="text-sm text-gray-600">
                      {method.account_holder_name} • {method.routing_number ? `Routing: ${method.routing_number}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(method)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(method.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

