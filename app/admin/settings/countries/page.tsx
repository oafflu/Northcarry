'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { getCountries, saveCountry, deleteCountry } from '@/app/actions/settings'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function CountriesSettingsPage() {
  const [countries, setCountries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCountry, setEditingCountry] = useState<any>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    currency_code: 'USD',
    currency_symbol: '$',
    is_active: true,
    is_default: false,
    sort_order: 0,
    shipping_enabled: true,
  })

  useEffect(() => {
    loadCountries()
  }, [])

  const loadCountries = async () => {
    setLoading(true)
    const result = await getCountries()
    if (result.data) {
      setCountries(result.data)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    const result = await saveCountry({
      ...formData,
      id: editingCountry?.id,
    })
    if (result.success) {
      toast.success(editingCountry ? 'Country updated!' : 'Country added!')
      setIsDialogOpen(false)
      setEditingCountry(null)
      setFormData({
        code: '',
        name: '',
        currency_code: 'USD',
        currency_symbol: '$',
        is_active: true,
        is_default: false,
        sort_order: 0,
      })
      loadCountries()
    } else {
      toast.error(result.error || 'Failed to save country')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this country?')) return
    const result = await deleteCountry(id)
    if (result.success) {
      toast.success('Country deleted!')
      loadCountries()
    } else {
      toast.error(result.error || 'Failed to delete country')
    }
  }

  const openEditDialog = (country: any) => {
    setEditingCountry(country)
    setFormData({
      ...country,
      shipping_enabled: country.shipping_enabled ?? true,
    })
    setIsDialogOpen(true)
  }

  const openAddDialog = () => {
    setEditingCountry(null)
    setFormData({
      code: '',
      name: '',
      currency_code: 'USD',
      currency_symbol: '$',
      is_active: true,
      is_default: false,
      sort_order: 0,
      shipping_enabled: true,
    })
    setIsDialogOpen(true)
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Countries & Regions</h1>
          <p className="text-gray-600 mt-1">Manage available countries and regions</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Country
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shipping</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading countries...</TableCell>
                </TableRow>
              ) : countries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">No countries found</TableCell>
                </TableRow>
              ) : (
                countries.map((country) => (
                  <TableRow key={country.id}>
                    <TableCell className="font-mono">{country.code}</TableCell>
                    <TableCell>{country.name}</TableCell>
                    <TableCell>{country.currency_symbol} ({country.currency_code})</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${country.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {country.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${country.shipping_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {country.shipping_enabled ? 'Allowed' : 'Not Allowed'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {country.is_default && <span className="text-teal-600 font-medium">Default</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(country)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(country.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCountry ? 'Edit Country' : 'Add Country'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Country Code (ISO 3166-1)</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="US"
                maxLength={2}
                disabled={!!editingCountry}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Country Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="United States"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency_code">Currency Code</Label>
              <Input
                id="currency_code"
                value={formData.currency_code}
                onChange={(e) => setFormData({ ...formData, currency_code: e.target.value.toUpperCase() })}
                placeholder="USD"
                maxLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency_symbol">Currency Symbol</Label>
              <Input
                id="currency_symbol"
                value={formData.currency_symbol}
                onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                placeholder="$"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="shipping_enabled">Available for Shipping</Label>
              <Switch
                id="shipping_enabled"
                checked={formData.shipping_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, shipping_enabled: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_default">Default Country</Label>
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

