'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, MapPin, Plus, Edit, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function EditCustomerPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [customer, setCustomer] = useState<any>(null)
  const [addresses, setAddresses] = useState<any[]>([])
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<any>(null)
  const [countries, setCountries] = useState<any[]>([])
  const [countriesLoading, setCountriesLoading] = useState(true)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })
  const [addressFormData, setAddressFormData] = useState({
    type: 'shipping' as 'shipping' | 'billing',
    is_default: false,
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  })

  useEffect(() => {
    if (customerId) {
      loadCustomer()
      loadCountries()
    }
  }, [customerId])

  const loadCountries = async () => {
    setCountriesLoading(true)
    try {
      const response = await fetch('/api/countries')
      if (response.ok) {
        const result = await response.json()
        const list = result.data || []
        setCountries(list)
        if (list.length > 0) {
          const defaultCountry = list.find((c: any) => c.is_default) || list[0]
          setAddressFormData((prev) => ({ ...prev, country: defaultCountry.code }))
        }
      } else {
        setCountries([])
      }
    } catch (error) {
      console.error('Error loading countries:', error)
      setCountries([])
    } finally {
      setCountriesLoading(false)
    }
  }

  const loadCustomer = async () => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.customer) {
          setCustomer(data.customer)
          setFormData({
            first_name: data.customer.first_name || '',
            last_name: data.customer.last_name || '',
            email: data.customer.email || '',
            phone: data.customer.phone || '',
          })
          setAddresses(data.addresses || [])
        }
      } else {
        toast.error('Failed to load customer')
        router.push('/admin/customers')
      }
    } catch (error) {
      console.error('Error loading customer:', error)
      toast.error('Failed to load customer')
      router.push('/admin/customers')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: formData.first_name.trim() || null,
          last_name: formData.last_name.trim() || null,
          email: formData.email.trim().toLowerCase() || null,
          phone: formData.phone.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update customer')
      }

      toast.success('Customer updated successfully')
      router.push(`/admin/customers/${customerId}`)
    } catch (error: any) {
      console.error('Error updating customer:', error)
      toast.error('Failed to update customer', {
        description: error.message || 'An unexpected error occurred',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate country is allowed
    const allowedCountry = countries.find((c) => c.code === addressFormData.country)
    if (!allowedCountry) {
      toast.error('Brevi does not ship to this country. Please choose an allowed country.')
      return
    }

    try {
      if (editingAddress) {
        // Update existing address
        const response = await fetch(`/api/admin/customers/${customerId}/addresses/${editingAddress.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(addressFormData),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update address')
        }

        toast.success('Address updated successfully')
      } else {
        // Create new address
        const response = await fetch(`/api/admin/customers/${customerId}/addresses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(addressFormData),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create address')
        }

        toast.success('Address added successfully')
      }

      setIsAddressDialogOpen(false)
      setEditingAddress(null)
      resetAddressForm()
      loadCustomer() // Reload to get updated addresses
    } catch (error: any) {
      console.error('Error saving address:', error)
      toast.error('Failed to save address', {
        description: error.message || 'An unexpected error occurred',
      })
    }
  }

  const handleEditAddress = (address: any) => {
    setEditingAddress(address)
    setAddressFormData({
      type: address.type,
      is_default: address.is_default,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
    })
    setIsAddressDialogOpen(true)
  }

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return

    try {
      const response = await fetch(`/api/admin/customers/${customerId}/addresses/${addressId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete address')
      }

      toast.success('Address deleted successfully')
      loadCustomer() // Reload to get updated addresses
    } catch (error: any) {
      console.error('Error deleting address:', error)
      toast.error('Failed to delete address', {
        description: error.message || 'An unexpected error occurred',
      })
    }
  }

  const handleSetDefaultAddress = async (addressId: string, type: 'shipping' | 'billing') => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}/addresses/${addressId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_default: true,
          type: type,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set default address')
      }

      toast.success('Default address updated')
      loadCustomer() // Reload to get updated addresses
    } catch (error: any) {
      console.error('Error setting default address:', error)
      toast.error('Failed to update default address', {
        description: error.message || 'An unexpected error occurred',
      })
    }
  }

  const resetAddressForm = () => {
    setAddressFormData({
      type: 'shipping',
      is_default: false,
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    })
  }

  const openAddAddressDialog = () => {
    resetAddressForm()
    setEditingAddress(null)
    setIsAddressDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-8">
        <Link href="/admin/customers" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </Link>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">Customer not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href={`/admin/customers/${customerId}`} className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Customer Details
        </Link>
        <h1 className="text-3xl font-bold">Edit Customer</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name
            </label>
            <Input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              placeholder="First name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name
            </label>
            <Input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              placeholder="Last name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Email address"
            />
            <p className="text-xs text-gray-500 mt-1">Updating email also updates the customer's login email.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone
            </label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Phone number"
            />
          </div>

          {/* Addresses Section */}
          <div className="pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">Addresses</h3>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={openAddAddressDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Address
              </Button>
            </div>
            {addresses.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No addresses on file</p>
            ) : (
              <div className="space-y-4">
                {addresses.map((address: any) => (
                  <div
                    key={address.id}
                    className="p-4 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {address.type} Address
                        </span>
                        {address.is_default && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-teal-50 text-teal-700 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!address.is_default && (
                          <button
                            onClick={() => handleSetDefaultAddress(address.id, address.type)}
                            className="p-2 text-gray-400 hover:text-gray-600"
                            title="Set as default"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditAddress(address)}
                          className="p-2 text-gray-400 hover:text-gray-600"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(address.id)}
                          className="p-2 text-red-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{address.address_line1}</p>
                      {address.address_line2 && <p>{address.address_line2}</p>}
                      <p>
                        {address.city}, {address.state} {address.postal_code}
                      </p>
                      <p>{address.country}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
            <Link href={`/admin/customers/${customerId}`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>

      {/* Address Dialog */}
      <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddressSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address_type">Address Type</Label>
                <Select
                  value={addressFormData.type}
                  onValueChange={(value) => setAddressFormData({ ...addressFormData, type: value as 'shipping' | 'billing' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shipping">Shipping</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addressFormData.is_default}
                    onChange={(e) => setAddressFormData({ ...addressFormData, is_default: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm">Set as default</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line1">Address Line 1 *</Label>
              <Input
                id="address_line1"
                value={addressFormData.address_line1}
                onChange={(e) => setAddressFormData({ ...addressFormData, address_line1: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                value={addressFormData.address_line2}
                onChange={(e) => setAddressFormData({ ...addressFormData, address_line2: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={addressFormData.city}
                  onChange={(e) => setAddressFormData({ ...addressFormData, city: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State/Province *</Label>
                <Input
                  id="state"
                  value={addressFormData.state}
                  onChange={(e) => setAddressFormData({ ...addressFormData, state: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">ZIP/Postal Code *</Label>
                <Input
                  id="postal_code"
                  value={addressFormData.postal_code}
                  onChange={(e) => setAddressFormData({ ...addressFormData, postal_code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select
                  value={addressFormData.country}
                  onValueChange={(value) => setAddressFormData({ ...addressFormData, country: value })}
                  disabled={countriesLoading || countries.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={countriesLoading ? "Loading countries..." : (countries.length === 0 ? "No shipping countries configured" : undefined)} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!countriesLoading && countries.length === 0 && (
                  <p className="text-sm text-red-600">No shipping countries are configured. Please add countries in settings.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddressDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingAddress ? 'Update' : 'Add'} Address</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

