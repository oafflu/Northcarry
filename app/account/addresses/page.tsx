'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress } from '@/app/actions/addresses'
import { Plus, MapPin, Edit, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Address {
  id: string
  user_id: string
  type: 'shipping' | 'billing'
  is_default: boolean
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
  phone?: string
  created_at: string
  updated_at: string
}

interface Country {
  code: string
  name: string
}

export default function AddressesPage() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [countries, setCountries] = useState<Country[]>([])
  const [loadingCountries, setLoadingCountries] = useState(true)
  const [formData, setFormData] = useState({
    type: 'shipping' as 'shipping' | 'billing',
    is_default: false,
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    phone: '',
  })

  useEffect(() => {
    loadCountries()
    if (user?.id) {
      loadAddresses()
    }
  }, [user])

  const loadCountries = async () => {
    setLoadingCountries(true)
    try {
      const response = await fetch('/api/countries')
      if (response.ok) {
        const result = await response.json()
        setCountries(result.data || [])
        // Set default country if available
        if (result.data && result.data.length > 0) {
          const defaultCountry = result.data.find((c: Country) => c.code === 'US') || result.data[0]
          if (!formData.country) {
            setFormData(prev => ({ ...prev, country: defaultCountry.code }))
          }
        }
      }
    } catch (error) {
      console.error('Error loading countries:', error)
    } finally {
      setLoadingCountries(false)
    }
  }

  const loadAddresses = async () => {
    if (!user?.id) return

    setLoading(true)
    const result = await getAddresses()
    if (result.error) {
      toast.error('Failed to load addresses')
    } else {
      setAddresses(result.data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    try {
      if (editingAddress) {
        const result = await updateAddress(editingAddress.id, formData)
        if (!result.success) throw new Error(result.error)
        toast.success('Address updated successfully')
      } else {
        const result = await createAddress(formData)
        if (!result.success) throw new Error(result.error)
        toast.success('Address added successfully')
      }

      setIsDialogOpen(false)
      setEditingAddress(null)
      resetForm()
      loadAddresses()
    } catch (error: any) {
      console.error('Error saving address:', error)
      toast.error(error.message || 'Failed to save address')
    }
  }

  const handleEdit = (address: Address) => {
    setEditingAddress(address)
    setFormData({
      type: address.type,
      is_default: address.is_default,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country || 'US',
      phone: address.phone || '',
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return

    try {
      const result = await deleteAddress(id)
      if (!result.success) throw new Error(result.error)
      toast.success('Address deleted successfully')
      loadAddresses()
    } catch (error: any) {
      console.error('Error deleting address:', error)
      toast.error(error.message || 'Failed to delete address')
    }
  }

  const handleSetDefault = async (id: string, type: 'shipping' | 'billing') => {
    try {
      const result = await setDefaultAddress(id, type)
      if (!result.success) throw new Error(result.error)
      toast.success('Default address updated')
      loadAddresses()
    } catch (error: any) {
      console.error('Error setting default address:', error)
      toast.error(error.message || 'Failed to update default address')
    }
  }

  const resetForm = () => {
    const defaultCountry = countries.find(c => c.code === 'US')?.code || (countries.length > 0 ? countries[0].code : 'US')
    setFormData({
      type: 'shipping',
      is_default: false,
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: defaultCountry,
      phone: '',
    })
  }

  const openAddDialog = () => {
    resetForm()
    setEditingAddress(null)
    setIsDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="lg:col-span-2">
        <div className="text-center py-12">Loading addresses...</div>
      </div>
    )
  }

  return (
    <div className="lg:col-span-2">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Addresses</h1>
          <p className="mt-1 text-gray-600">Manage your shipping and billing addresses</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow-sm">
          <MapPin className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <h3 className="mb-2 text-xl font-bold">No addresses saved</h3>
          <p className="mb-6 text-gray-600">Add an address to make checkout faster</p>
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Address
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {addresses.map((address) => (
            <div key={address.id} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <div>
                    <h3 className="font-semibold capitalize">{address.type} Address</h3>
                    {address.is_default && (
                      <span className="text-xs text-teal-600 font-medium">Default {address.type}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!address.is_default && (
                    <button
                      onClick={() => handleSetDefault(address.id, address.type)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                      title="Set as default"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(address)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    className="p-2 text-red-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>{address.address_line1}</p>
                {address.address_line2 && <p>{address.address_line2}</p>}
                <p>
                  {address.city}, {address.state} {address.postal_code}
                </p>
                <p>{countries.find(c => c.code === address.country)?.name || address.country || 'N/A'}</p>
                {address.phone && <p className="mt-2 text-gray-500">Phone: {address.phone}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAddress ? 'Edit Address' : 'Add New Address'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Address Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as 'shipping' | 'billing' })}
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
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
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
                value={formData.address_line1}
                onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                value={formData.address_line2}
                onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State/Province *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">ZIP/Postal Code *</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => setFormData({ ...formData, country: value })}
                  disabled={loadingCountries}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCountries ? "Loading..." : "Select country"} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
              <p className="text-xs text-gray-500">Optional - for delivery notifications</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
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

