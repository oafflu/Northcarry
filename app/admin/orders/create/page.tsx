"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Loader2, Mail, Search, X } from "lucide-react"
import { getCustomersWithStats } from "@/app/actions/users"
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from "@/app/actions/products"
import { getSubscriptionProducts } from "@/app/actions/subscriptions"
import { createManualOrder, createPaymentLinkForOrder, getCustomerAddressesForAdmin } from "@/app/actions/orders"
import { searchCustomers } from "@/app/actions/tickets"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"

interface OrderItem {
  id: string
  variantId: string
  productTitle: string
  variantColor: string
  quantity: number
  unitPrice: number
  lineTotal: number
  purchaseType?: 'one-time' | 'subscription' | 'prepaid'
  subscriptionProductId?: string | null
  frequencyMonths?: number
  prepaidCycles?: number
}

interface CustomerInfo {
  firstName: string
  lastName: string
  email: string
  phone?: string
}

interface Address {
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
}

export default function CreateOrderPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [customerType, setCustomerType] = useState<'existing' | 'new'>('existing')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })
  const [billingAddress, setBillingAddress] = useState<Address>({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  })
  const [shippingAddress, setShippingAddress] = useState<Address>({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  })
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true)
  const [shippingCost, setShippingCost] = useState('0.00')
  const [applyTax, setApplyTax] = useState(true)
  const [taxAmount, setTaxAmount] = useState('0.00')
  const [discountAmount, setDiscountAmount] = useState('0.00')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [subscriptionProducts, setSubscriptionProducts] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [selectedSubscriptionProductId, setSelectedSubscriptionProductId] = useState<string | null>(null)
  const [selectedItemPurchaseType, setSelectedItemPurchaseType] = useState<'subscription' | 'prepaid'>('subscription')
  const [selectedFrequencyMonths, setSelectedFrequencyMonths] = useState(1)
  const [selectedPrepaidCycles, setSelectedPrepaidCycles] = useState(3)
  const [addItemQuantity, setAddItemQuantity] = useState(1)
  const [addItemPrice, setAddItemPrice] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [creating, setCreating] = useState(false)
  const [sendPaymentLink, setSendPaymentLink] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  // Search customers with debounce
  useEffect(() => {
    if (customerSearch.length >= 2) {
      setSearchingCustomers(true)
      const timeoutId = setTimeout(async () => {
        try {
          const result = await searchCustomers(customerSearch)
          if (result.data) {
            setCustomerResults(result.data)
            setShowCustomerResults(true)
          }
        } catch (error) {
          console.error('Error searching customers:', error)
          setCustomerResults([])
        } finally {
          setSearchingCustomers(false)
        }
      }, 300)
      return () => {
        clearTimeout(timeoutId)
        setSearchingCustomers(false)
      }
    } else {
      setCustomerResults([])
      setShowCustomerResults(false)
    }
  }, [customerSearch])

  // Handle clicking outside to close results dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.customer-search-container')) {
        setShowCustomerResults(false)
      }
    }

    if (showCustomerResults) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCustomerResults])

  useEffect(() => {
    if (billingSameAsShipping) {
      setBillingAddress({ ...shippingAddress })
    }
  }, [billingSameAsShipping, shippingAddress])

  // Auto-calculate tax when items, discount, shipping, or applyTax changes
  useEffect(() => {
    if (applyTax) {
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
      const discount = parseFloat(discountAmount || '0')
      const subtotalAfterDiscount = Math.max(0, subtotal - discount)
      const calculatedTax = subtotalAfterDiscount * 0.08
      setTaxAmount(calculatedTax.toFixed(2))
    }
  }, [items, discountAmount, applyTax])

  useEffect(() => {
    if (selectedProductId.startsWith('sub-')) {
      const subId = selectedProductId.slice(4)
      const subProduct = subscriptionProducts.find((sp: any) => sp.id === subId)
      if (subProduct) {
        setSelectedSubscriptionProductId(subId)
        const v = (subProduct as any).product_variants
        setVariants(v ? [v] : [])
        setSelectedVariantId(v?.id || '')
        const freqs = (subProduct as any).available_frequencies
        const availableFrequencies = Array.isArray(freqs) && freqs.length > 0 ? freqs : [1]
        if (!availableFrequencies.includes(selectedFrequencyMonths)) {
          setSelectedFrequencyMonths(availableFrequencies[0])
        }
        const subPrice = (subProduct as any).subscription_price
        const prepaidPrice = (subProduct as any).prepaid_price
        const price = selectedItemPurchaseType === 'prepaid'
          ? (prepaidPrice ?? subPrice ?? 0)
          : (subPrice ?? prepaidPrice ?? 0)
        setAddItemPrice(parseFloat(String(price)).toFixed(2))
      } else {
        setSelectedSubscriptionProductId(null)
        setVariants([])
        setSelectedVariantId('')
      }
    } else {
      setSelectedSubscriptionProductId(null)
      setSelectedItemPurchaseType('subscription')
      setSelectedFrequencyMonths(1)
      setSelectedPrepaidCycles(3)
      if (selectedProductId) {
        loadVariants(selectedProductId)
      } else {
        setVariants([])
        setSelectedVariantId('')
      }
    }
  }, [selectedProductId, subscriptionProducts, selectedItemPurchaseType])

  useEffect(() => {
    if (selectedVariantId) {
      const variant = variants.find(v => v.id === selectedVariantId)
      if (variant) {
        setAddItemPrice(variant.price || '0.00')
      }
    }
  }, [selectedVariantId, variants])

  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomerId(customer.id)
    setCustomerInfo({
      firstName: customer.first_name || customer.name?.split(' ')[0] || '',
      lastName: customer.last_name || customer.name?.split(' ').slice(1).join(' ') || '',
      email: customer.email || '',
      phone: customer.phone || '',
    })
    setCustomerSearch(`${customer.first_name || customer.name?.split(' ')[0] || ''} ${customer.last_name || customer.name?.split(' ').slice(1).join(' ') || ''} (${customer.email || ''})`.trim())
    setShowCustomerResults(false)
    setCustomerResults([])

    // Load customer's saved address(es) and fill shipping/billing (including city, state, postal_code, country)
    try {
      const result = await getCustomerAddressesForAdmin(customer.id)
      if (result.data && result.data.length > 0) {
        // Prefer first address that has city/state/postal_code filled; otherwise use first
        const addrs = result.data as any[]
        const addr = addrs.find((a: any) => (a.city && String(a.city).trim()) && (a.postal_code && String(a.postal_code).trim())) || addrs[0]
        const fullAddress: Address = {
          address_line1: (addr?.address_line1 != null && addr?.address_line1 !== '') ? String(addr.address_line1) : '',
          address_line2: (addr?.address_line2 != null && addr?.address_line2 !== '') ? String(addr.address_line2) : '',
          city: (addr?.city != null && addr?.city !== '') ? String(addr.city).trim() : '',
          state: (addr?.state != null && addr?.state !== '') ? String(addr.state).trim() : '',
          postal_code: (addr?.postal_code != null && addr?.postal_code !== '') ? String(addr.postal_code).trim() : '',
          country: (addr?.country != null && addr?.country !== '') ? String(addr.country).trim() : 'US',
        }
        setShippingAddress(fullAddress)
        setBillingAddress(fullAddress)
      }
    } catch (err) {
      console.error('Error loading customer addresses:', err)
    }
  }

  const handleClearCustomer = () => {
    setSelectedCustomerId('')
    setCustomerSearch('')
    setCustomerInfo({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    })
    setShippingAddress({
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    })
    setBillingAddress({
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    })
    setShowCustomerResults(false)
    setCustomerResults([])
  }

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const [productsResult, subResult] = await Promise.all([
        getActiveProductsForAdmin(),
        getSubscriptionProducts(true),
      ])
      if (productsResult.data) {
        setProducts(productsResult.data)
      }
      if (subResult.data) {
        const active = (subResult.data as any[]).filter((sp: any) => sp.is_subscription_enabled && sp.status === 'active')
        setSubscriptionProducts(active)
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const loadVariants = async (productId: string) => {
    try {
      const result = await getProductVariantsForAdmin(productId)
      if (result.data) {
        setVariants(result.data)
      }
    } catch (error) {
      console.error('Error loading variants:', error)
      toast.error('Failed to load product variants')
    }
  }

  const addItem = () => {
    if (!selectedVariantId) {
      toast.error('Please select a product variant')
      return
    }

    const variant = variants.find((v: any) => v.id === selectedVariantId)
    if (!variant) {
      toast.error('Variant not found')
      return
    }

    const quantity = parseInt(addItemQuantity.toString()) || 1
    const unitPrice = parseFloat(addItemPrice || '0')
    const cycles = selectedItemPurchaseType === 'prepaid' ? Math.max(1, Math.min(12, selectedPrepaidCycles)) : 1
    const lineTotal = selectedItemPurchaseType === 'prepaid'
      ? quantity * unitPrice * cycles
      : quantity * unitPrice
    const productTitle = variant.products?.title || (selectedSubscriptionProductId && subscriptionProducts.find((sp: any) => sp.id === selectedSubscriptionProductId)?.products?.title) || 'Product'
    const variantColor = variant.color || 'Unknown'

    const newItem: OrderItem = {
      id: Date.now().toString(),
      variantId: selectedVariantId,
      productTitle,
      variantColor,
      quantity,
      unitPrice,
      lineTotal,
      ...(selectedSubscriptionProductId && {
        purchaseType: selectedItemPurchaseType,
        subscriptionProductId: selectedSubscriptionProductId,
        frequencyMonths: selectedFrequencyMonths,
        ...(selectedItemPurchaseType === 'prepaid' && { prepaidCycles: cycles }),
      }),
    }

    setItems([...items, newItem])
    setSelectedProductId('')
    setSelectedSubscriptionProductId(null)
    setSelectedVariantId('')
    setSelectedFrequencyMonths(1)
    setSelectedPrepaidCycles(3)
    setAddItemQuantity(1)
    setAddItemPrice('')
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const updateItemQuantity = (id: string, quantity: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      const newQuantity = Math.max(1, quantity)
      const cycles = item.purchaseType === 'prepaid' && item.prepaidCycles != null ? item.prepaidCycles : 1
      const lineTotal = item.purchaseType === 'prepaid'
        ? newQuantity * item.unitPrice * cycles
        : newQuantity * item.unitPrice
      return { ...item, quantity: newQuantity, lineTotal }
    }))
  }

  const updateItemPrice = (id: string, price: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item
      const cycles = item.purchaseType === 'prepaid' && item.prepaidCycles != null ? item.prepaidCycles : 1
      const lineTotal = item.purchaseType === 'prepaid'
        ? item.quantity * price * cycles
        : item.quantity * price
      return { ...item, unitPrice: price, lineTotal }
    }))
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
    const shipping = parseFloat(shippingCost || '0')
    const discount = parseFloat(discountAmount || '0')
    const subtotalAfterDiscount = Math.max(0, subtotal - discount)
    // Calculate tax automatically: 8% of subtotal after discount (same as checkout)
    const tax = applyTax ? subtotalAfterDiscount * 0.08 : 0
    const total = subtotalAfterDiscount + shipping + tax
    return { subtotal, shipping, tax, discount, total, subtotalAfterDiscount }
  }

  const handleCreateOrder = async () => {
    // Validation
    if (!customerInfo.firstName || !customerInfo.lastName || !customerInfo.email) {
      toast.error('Please fill in customer information')
      return
    }

    if (!customerInfo.email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one item to the order')
      return
    }

    if (!shippingAddress.address_line1 || !shippingAddress.city || !shippingAddress.postal_code) {
      toast.error('Please fill in shipping address')
      return
    }

    if (!billingSameAsShipping && (!billingAddress.address_line1 || !billingAddress.city || !billingAddress.postal_code)) {
      toast.error('Please fill in billing address')
      return
    }

    setCreating(true)
    try {
      const totals = calculateTotals()
      
      const result = await createManualOrder({
        customerId: customerType === 'existing' ? selectedCustomerId : null,
        customerEmail: customerInfo.email,
        customerFirstName: customerInfo.firstName,
        customerLastName: customerInfo.lastName,
        customerPhone: customerInfo.phone || undefined,
        shippingAddress: {
          address_line1: shippingAddress.address_line1,
          address_line2: shippingAddress.address_line2 || undefined,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.postal_code,
          country: shippingAddress.country,
        },
        billingAddress: billingSameAsShipping ? undefined : {
          address_line1: billingAddress.address_line1,
          address_line2: billingAddress.address_line2 || undefined,
          city: billingAddress.city,
          state: billingAddress.state,
          postal_code: billingAddress.postal_code,
          country: billingAddress.country,
        },
        items: items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          ...(item.purchaseType && { purchaseType: item.purchaseType }),
          ...(item.subscriptionProductId && { subscriptionProductId: item.subscriptionProductId }),
          ...(item.frequencyMonths != null && { frequencyMonths: item.frequencyMonths }),
          ...(item.prepaidCycles != null && { prepaidCycles: item.prepaidCycles }),
        })),
        shippingCost: totals.shipping,
        taxAmount: totals.tax,
        discountAmount: totals.discount,
        notes: notes || undefined,
        sendPaymentLink,
      })

      if (result.success) {
        toast.success('Order created successfully!', {
          description: `Order ${result.orderNumber} has been created`,
        })

        if (result.paymentLink) {
          const paymentLinkMsg = result.paymentLinkEmailSent
            ? 'Payment link was generated and emailed to the customer.'
            : result.paymentLinkEmailSkipped
              ? 'Payment link generated. Email skipped because one was already sent.'
              : result.paymentLinkEmailError
                ? `Payment link generated but email failed: ${result.paymentLinkEmailError}`
                : 'Payment link generated.'

          toast.info('Payment link generated', {
            description: paymentLinkMsg,
            duration: 10000,
          })
        }

        // Redirect to order detail page
        router.push(`/admin/orders/${result.orderId}`)
      } else {
        toast.error('Failed to create order', {
          description: result.error,
        })
      }
    } catch (error: any) {
      console.error('Error creating order:', error)
      toast.error('Failed to create order', {
        description: error.message || 'An unexpected error occurred',
      })
    } finally {
      setCreating(false)
    }
  }

  const totals = calculateTotals()

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/orders">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Create Manual Order</h1>
              <p className="text-gray-600 mt-1">Create an order for an existing or new customer</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Customer Selection */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="existing"
                    checked={customerType === 'existing'}
                    onChange={(e) => setCustomerType(e.target.value as 'existing' | 'new')}
                    className="w-4 h-4"
                  />
                  <span>Existing Customer</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="new"
                    checked={customerType === 'new'}
                    onChange={(e) => setCustomerType(e.target.value as 'existing' | 'new')}
                    className="w-4 h-4"
                  />
                  <span>New Customer</span>
                </label>
              </div>

              {customerType === 'existing' ? (
                <div className="relative customer-search-container">
                  <Label>Search Customer</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        if (selectedCustomerId) {
                          setSelectedCustomerId('')
                        }
                      }}
                      onFocus={() => {
                        if (customerResults.length > 0) {
                          setShowCustomerResults(true)
                        }
                      }}
                      placeholder="Search by name or email (type at least 2 characters)..."
                      className="w-full pl-10 pr-10"
                    />
                    {customerSearch && (
                      <button
                        onClick={handleClearCustomer}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {showCustomerResults && customerResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {searchingCustomers ? (
                        <div className="p-4 text-center text-gray-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Searching...
                        </div>
                      ) : (
                        customerResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => handleSelectCustomer(customer)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-gray-900">
                              {customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer'}
                            </div>
                            <div className="text-sm text-gray-600">{customer.email}</div>
                            {customer.phone && (
                              <div className="text-xs text-gray-500">{customer.phone}</div>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  
                  {showCustomerResults && customerSearch.length >= 2 && !searchingCustomers && customerResults.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
                      No customers found
                    </div>
                  )}
                  
                  {selectedCustomerId && (
                    <div className="mt-2 text-sm text-green-600">
                      ✓ Customer selected
                    </div>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input
                    value={customerInfo.firstName}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, firstName: e.target.value })}
                    placeholder="John"
                    required
                    disabled={customerType === 'existing' && selectedCustomerId !== ''}
                  />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input
                    value={customerInfo.lastName}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, lastName: e.target.value })}
                    placeholder="Doe"
                    required
                    disabled={customerType === 'existing' && selectedCustomerId !== ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                    placeholder="john@example.com"
                    required
                    disabled={customerType === 'existing' && selectedCustomerId !== ''}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    value={customerInfo.phone || ''}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    disabled={customerType === 'existing' && selectedCustomerId !== ''}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
            <div className="space-y-4">
              <div>
                <Label>Address Line 1 *</Label>
                <Input
                  value={shippingAddress.address_line1}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, address_line1: e.target.value })}
                  placeholder="123 Main St"
                  required
                />
              </div>
              <div>
                <Label>Address Line 2</Label>
                <Input
                  value={shippingAddress.address_line2 || ''}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, address_line2: e.target.value })}
                  placeholder="Apt 4B"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>City *</Label>
                  <Input
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                    placeholder="New York"
                    required
                  />
                </div>
                <div>
                  <Label>State *</Label>
                  <Input
                    value={shippingAddress.state}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                    placeholder="NY"
                    required
                  />
                </div>
                <div>
                  <Label>Postal Code *</Label>
                  <Input
                    value={shippingAddress.postal_code}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, postal_code: e.target.value })}
                    placeholder="10001"
                    required
                  />
                </div>
              </div>
              <div>
                <Label>Country *</Label>
                <Input
                  value={shippingAddress.country}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                  placeholder="US"
                  required
                />
              </div>
            </div>
          </div>

          {/* Billing Address */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="billingSameAsShipping"
                checked={billingSameAsShipping}
                onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="billingSameAsShipping">Billing address same as shipping</Label>
            </div>

            {!billingSameAsShipping && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Billing Address</h2>
                <div>
                  <Label>Address Line 1 *</Label>
                  <Input
                    value={billingAddress.address_line1}
                    onChange={(e) => setBillingAddress({ ...billingAddress, address_line1: e.target.value })}
                    placeholder="123 Main St"
                    required
                  />
                </div>
                <div>
                  <Label>Address Line 2</Label>
                  <Input
                    value={billingAddress.address_line2 || ''}
                    onChange={(e) => setBillingAddress({ ...billingAddress, address_line2: e.target.value })}
                    placeholder="Apt 4B"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>City *</Label>
                    <Input
                      value={billingAddress.city}
                      onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                      placeholder="New York"
                      required
                    />
                  </div>
                  <div>
                    <Label>State *</Label>
                    <Input
                      value={billingAddress.state}
                      onChange={(e) => setBillingAddress({ ...billingAddress, state: e.target.value })}
                      placeholder="NY"
                      required
                    />
                  </div>
                  <div>
                    <Label>Postal Code *</Label>
                    <Input
                      value={billingAddress.postal_code}
                      onChange={(e) => setBillingAddress({ ...billingAddress, postal_code: e.target.value })}
                      placeholder="10001"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label>Country *</Label>
                  <Input
                    value={billingAddress.country}
                    onChange={(e) => setBillingAddress({ ...billingAddress, country: e.target.value })}
                    placeholder="US"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          {/* Order Items */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Order Items</h2>
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 mb-4">
              <div className={`grid gap-4 ${
                  selectedProductId.startsWith('sub-')
                    ? selectedItemPurchaseType === 'prepaid'
                      ? 'grid-cols-7'
                      : 'grid-cols-6'
                    : 'grid-cols-4'
                }`}>
                <div>
                  <Label>Product</Label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    disabled={loadingProducts}
                  >
                    <option value="">Select product...</option>
                    <optgroup label="Products">
                      {products.map((product: any) => (
                        <option key={product.id} value={product.id}>
                          {product.title}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Subscription products">
                      {subscriptionProducts.map((sp: any) => (
                        <option key={sp.id} value={`sub-${sp.id}`}>
                          {sp.products?.title || 'Subscription'} — {sp.product_variants?.color || 'Variant'}
                          {sp.subscription_price != null ? ` ($${parseFloat(String(sp.subscription_price)).toFixed(2)}/cycle)` : ''}
                          {sp.prepaid_price != null ? ` / $${parseFloat(String(sp.prepaid_price)).toFixed(2)} prepaid` : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {selectedProductId.startsWith('sub-') && (
                  <div>
                    <Label>Purchase type</Label>
                    <select
                      value={selectedItemPurchaseType}
                      onChange={(e) => setSelectedItemPurchaseType(e.target.value as 'subscription' | 'prepaid')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="subscription">Ongoing subscription</option>
                      <option value="prepaid">Prepaid subscription</option>
                    </select>
                  </div>
                )}
                {selectedProductId.startsWith('sub-') && (() => {
                  const subProduct = subscriptionProducts.find((sp: any) => sp.id === selectedSubscriptionProductId)
                  const freqs = subProduct && Array.isArray((subProduct as any).available_frequencies) && (subProduct as any).available_frequencies.length > 0
                    ? (subProduct as any).available_frequencies
                    : [1]
                  return (
                    <div>
                      <Label>Frequency (delivery interval)</Label>
                      <select
                        value={selectedFrequencyMonths}
                        onChange={(e) => setSelectedFrequencyMonths(parseInt(e.target.value, 10))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        {freqs.map((f: number) => (
                          <option key={f} value={f}>
                            Every {f} {f === 1 ? 'month' : 'months'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })()}
                {selectedProductId.startsWith('sub-') && selectedItemPurchaseType === 'prepaid' && (
                  <div>
                    <Label>Number of cycles</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={selectedPrepaidCycles}
                      onChange={(e) => setSelectedPrepaidCycles(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))}
                      className="w-full"
                      placeholder="e.g. 3"
                    />
                    <p className="text-xs text-gray-500 mt-0.5">Cycles before subscription expires</p>
                  </div>
                )}
                <div>
                  <Label>Variant</Label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    disabled={!selectedProductId || variants.length === 0}
                  >
                    <option value="">Select variant...</option>
                    {variants.map(variant => (
                      <option key={variant.id} value={variant.id}>
                        {variant.color} - ${variant.price}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={addItemQuantity}
                    onChange={(e) => setAddItemQuantity(parseInt(e.target.value) || 1)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addItemPrice}
                    onChange={(e) => setAddItemPrice(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              <Button onClick={addItem} type="button">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {items.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Product</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Variant</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Quantity</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Unit Price</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Total</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map(item => (
                      <tr key={item.id}>
                        <td className="px-4 py-3">{item.productTitle}</td>
                        <td className="px-4 py-3">{item.variantColor}</td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice.toFixed(2)}
                            onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                            className="w-24"
                          />
                        </td>
                        <td className="px-4 py-3">${item.lineTotal.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Order Totals */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Order Totals</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Shipping Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Switch
                    checked={applyTax}
                    onCheckedChange={setApplyTax}
                  />
                  <Label>Apply Tax (8%)</Label>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxAmount}
                  onChange={(e) => {
                    setTaxAmount(e.target.value)
                    setApplyTax(false) // If manually edited, disable auto-calculation
                  }}
                  disabled={applyTax}
                  className={applyTax ? "bg-gray-100" : ""}
                />
                {applyTax && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tax calculated automatically: 8% of subtotal after discount
                  </p>
                )}
              </div>
              <div>
                <Label>Discount Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between mb-2">
                <span>Subtotal:</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Shipping:</span>
                <span>${totals.shipping.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Tax:</span>
                <span>${totals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Discount:</span>
                <span>-${totals.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Options */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Options</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={sendPaymentLink}
                  onCheckedChange={setSendPaymentLink}
                />
                <Label>Send payment link to customer</Label>
              </div>
              <div>
                <Label>Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Internal notes about this order..."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Link href="/admin/orders">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleCreateOrder} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Order'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
