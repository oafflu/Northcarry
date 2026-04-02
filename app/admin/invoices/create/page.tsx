"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, FileText, Download, Loader2 } from "lucide-react"
import { getCustomersWithStats } from "@/app/actions/users"
import { getActiveProductsForAdmin, getProductVariantsForAdmin } from "@/app/actions/products"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
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

export default function CreateInvoicePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [customerType, setCustomerType] = useState<'existing' | 'new'>('existing')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
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
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return date.toISOString().split('T')[0]
  })
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadCustomers()
    loadProducts()
    generateInvoiceNumber()
  }, [])

  useEffect(() => {
    if (selectedCustomerId && customerType === 'existing') {
      const customer = customers.find(c => c.id === selectedCustomerId)
      if (customer) {
        setCustomerInfo({
          firstName: customer.first_name || '',
          lastName: customer.last_name || '',
          email: customer.email || '',
          phone: customer.phone || '',
        })
      }
    }
  }, [selectedCustomerId, customerType, customers])

  const loadCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const result = await getCustomersWithStats('customer')
      if (result.data) {
        setCustomers(result.data)
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoadingCustomers(false)
    }
  }

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const result = await getActiveProductsForAdmin()
      if (result.data) {
        setProducts(result.data)
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const generateInvoiceNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    setInvoiceNumber(`INV-${year}${month}${day}-${random}`)
  }

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    }
    setItems([...items, newItem])
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value }
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice
        }
        return updated
      }
      return item
    }))
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0)
    const tax = subtotal * 0.1 // 10% tax (can be made configurable)
    const total = subtotal + tax
    return { subtotal, tax, total }
  }

  const handleGenerateInvoice = () => {
    // Validation
    if (!customerInfo.firstName || !customerInfo.lastName || !customerInfo.email) {
      toast.error('Please fill in customer information')
      return
    }

    if (items.length === 0) {
      toast.error('Please add at least one invoice item')
      return
    }

    if (!invoiceNumber) {
      toast.error('Invoice number is required')
      return
    }

    if (items.some(item => !item.description || item.quantity <= 0 || item.unitPrice <= 0)) {
      toast.error('Please fill in all item details correctly')
      return
    }

    setGenerating(true)
    try {
      generateInvoicePDF()
    } catch (error: any) {
      console.error('Error generating invoice:', error)
      toast.error('Failed to generate invoice')
    } finally {
      setGenerating(false)
    }
  }

  const generateInvoicePDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to generate invoice')
      return
    }

    const origin = window.location.origin
    const { subtotal, tax, total } = calculateTotals()

    const invoiceDateFormatted = new Date(invoiceDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const customerName = `${customerInfo.firstName} ${customerInfo.lastName}`

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${invoiceNumber}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #333;
              background: white;
            }
            .invoice-header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 2px solid #14b8a6;
            }
            .invoice-header h1 {
              color: #14b8a6;
              font-size: 32px;
              font-weight: bold;
            }
            .invoice-info {
              text-align: right;
            }
            .invoice-info p {
              margin: 4px 0;
              font-size: 14px;
            }
            .company-info {
              margin-bottom: 30px;
            }
            .company-info img {
              height: 50px;
              width: auto;
              margin-bottom: 10px;
            }
            .billing-shipping {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
            }
            .address-box {
              background: #f9fafb;
              padding: 15px;
              border-radius: 8px;
            }
            .address-box h3 {
              color: #14b8a6;
              font-size: 16px;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .address-box p {
              margin: 4px 0;
              font-size: 14px;
              line-height: 1.6;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .items-table thead {
              background: #14b8a6;
              color: white;
            }
            .items-table th {
              padding: 12px;
              text-align: left;
              font-weight: bold;
              font-size: 14px;
            }
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 14px;
            }
            .items-table tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            .items-table .text-right {
              text-align: right;
            }
            .items-table .text-center {
              text-align: center;
            }
            .totals {
              margin-left: auto;
              width: 300px;
              margin-top: 20px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .totals-row.total {
              font-size: 18px;
              font-weight: bold;
              padding-top: 12px;
              border-top: 2px solid #14b8a6;
              margin-top: 8px;
            }
            .totals-row.label {
              color: #666;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            .notes {
              margin-top: 30px;
              padding: 15px;
              background: #f9fafb;
              border-radius: 8px;
            }
            .notes h3 {
              color: #14b8a6;
              font-size: 16px;
              margin-bottom: 8px;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <div>
              <h1>INVOICE</h1>
              <p style="margin-top: 8px; color: #666;">Invoice #${invoiceNumber}</p>
            </div>
            <div class="invoice-info">
              <p><strong>Invoice Date:</strong> ${invoiceDateFormatted}</p>
              <p><strong>Due Date:</strong> ${dueDateFormatted}</p>
            </div>
          </div>

          <div class="company-info">
            <img src="${origin}/brevi-logo.png" alt="BREVI Logo" />
            <p style="color: #666; font-size: 14px;">Premium Oral Care Products</p>
          </div>

          <div class="billing-shipping">
            <div class="address-box">
              <h3>Bill To</h3>
              <p><strong>${customerName}</strong></p>
              ${customerInfo.email ? `<p>${customerInfo.email}</p>` : ''}
              ${customerInfo.phone ? `<p>${customerInfo.phone}</p>` : ''}
              ${billingAddress.address_line1 ? `<p>${billingAddress.address_line1}</p>` : ''}
              ${billingAddress.address_line2 ? `<p>${billingAddress.address_line2}</p>` : ''}
              ${billingAddress.city || billingAddress.state || billingAddress.postal_code
                ? `<p>${[billingAddress.city, billingAddress.state, billingAddress.postal_code].filter(Boolean).join(', ')}</p>`
                : ''}
              ${billingAddress.country ? `<p>${billingAddress.country}</p>` : ''}
            </div>
            <div class="address-box">
              <h3>Ship To</h3>
              <p><strong>${customerName}</strong></p>
              ${shippingAddress.address_line1 ? `<p>${shippingAddress.address_line1}</p>` : ''}
              ${shippingAddress.address_line2 ? `<p>${shippingAddress.address_line2}</p>` : ''}
              ${shippingAddress.city || shippingAddress.state || shippingAddress.postal_code
                ? `<p>${[shippingAddress.city, shippingAddress.state, shippingAddress.postal_code].filter(Boolean).join(', ')}</p>`
                : ''}
              ${shippingAddress.country ? `<p>${shippingAddress.country}</p>` : ''}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-center">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">$${item.unitPrice.toFixed(2)}</td>
                  <td class="text-right">$${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span class="label">Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span class="label">Tax:</span>
              <span>$${tax.toFixed(2)}</span>
            </div>
            <div class="totals-row total">
              <span>Total:</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>

          ${notes ? `
            <div class="notes">
              <h3>Notes</h3>
              <p>${notes}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your business!</p>
            <p style="margin-top: 8px;">This is an official invoice #${invoiceNumber}</p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
              <p style="color: #666; font-size: 12px; margin: 0;">BREVI™ is a product of</p>
              <img src="${origin}/oafflu-icon.svg" alt="OAFFLU LLC" style="height: 24px; width: auto;" />
              <p style="color: #666; font-size: 12px; margin: 0;">OAFFLU LLC</p>
            </div>
          </div>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
      }, 250)
    }

    toast.success('Invoice generated successfully')
  }

  const { subtotal, tax, total } = calculateTotals()

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Create Invoice</h1>
        <p className="text-gray-600 mt-1">Generate a manual invoice for any customer</p>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  disabled={loadingCustomers}
                >
                  <option value="">Select a customer...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.first_name} {customer.last_name} ({customer.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                <Input
                  value={customerInfo.firstName}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                <Input
                  value={customerInfo.lastName}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <Input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <Input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Addresses</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Billing Address</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Address Line 1"
                  value={billingAddress.address_line1}
                  onChange={(e) => setBillingAddress({ ...billingAddress, address_line1: e.target.value })}
                />
                <Input
                  placeholder="Address Line 2"
                  value={billingAddress.address_line2}
                  onChange={(e) => setBillingAddress({ ...billingAddress, address_line2: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="City"
                    value={billingAddress.city}
                    onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                  />
                  <Input
                    placeholder="State"
                    value={billingAddress.state}
                    onChange={(e) => setBillingAddress({ ...billingAddress, state: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Postal Code"
                    value={billingAddress.postal_code}
                    onChange={(e) => setBillingAddress({ ...billingAddress, postal_code: e.target.value })}
                  />
                  <Input
                    placeholder="Country"
                    value={billingAddress.country}
                    onChange={(e) => setBillingAddress({ ...billingAddress, country: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Shipping Address</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Address Line 1"
                  value={shippingAddress.address_line1}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, address_line1: e.target.value })}
                />
                <Input
                  placeholder="Address Line 2"
                  value={shippingAddress.address_line2}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, address_line2: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="City"
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                  />
                  <Input
                    placeholder="State"
                    value={shippingAddress.state}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Postal Code"
                    value={shippingAddress.postal_code}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, postal_code: e.target.value })}
                  />
                  <Input
                    placeholder="Country"
                    value={shippingAddress.country}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Number *</label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invoice Date *</label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Invoice Items</h2>
            <Button onClick={addItem} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 items-end p-4 border border-gray-200 rounded-lg">
                <div className="col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Item description"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price *</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total</label>
                  <Input
                    value={`$${item.total.toFixed(2)}`}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    onClick={() => removeItem(item.id)}
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No items added yet. Click "Add Item" to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        {items.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax (10%):</span>
                  <span className="font-medium">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            placeholder="Additional notes or terms..."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <Link href="/admin/orders">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            onClick={handleGenerateInvoice}
            disabled={generating || items.length === 0}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Generate Invoice
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

