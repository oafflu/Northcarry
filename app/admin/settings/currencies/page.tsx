'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { getCurrencies, saveCurrency, deleteCurrency } from '@/app/actions/settings'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function CurrenciesSettingsPage() {
  const [currencies, setCurrencies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCurrency, setEditingCurrency] = useState<any>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: '$',
    symbol_position: 'before',
    decimal_places: 2,
    exchange_rate: 1.0,
    is_active: true,
    is_base: false,
  })

  useEffect(() => {
    loadCurrencies()
  }, [])

  const loadCurrencies = async () => {
    setLoading(true)
    const result = await getCurrencies()
    if (result.data) {
      setCurrencies(result.data)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    const result = await saveCurrency({
      ...formData,
      id: editingCurrency?.id,
    })
    if (result.success) {
      toast.success(editingCurrency ? 'Currency updated!' : 'Currency added!')
      setIsDialogOpen(false)
      setEditingCurrency(null)
      loadCurrencies()
    } else {
      toast.error(result.error || 'Failed to save currency')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this currency?')) return
    const result = await deleteCurrency(id)
    if (result.success) {
      toast.success('Currency deleted!')
      loadCurrencies()
    } else {
      toast.error(result.error || 'Failed to delete currency')
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Currencies</h1>
          <p className="text-gray-600 mt-1">Manage available currencies and exchange rates</p>
        </div>
        <Button onClick={() => {
          setEditingCurrency(null)
          setFormData({
            code: '',
            name: '',
            symbol: '$',
            symbol_position: 'before',
            decimal_places: 2,
            exchange_rate: 1.0,
            is_active: true,
            is_base: false,
          })
          setIsDialogOpen(true)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Currency
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Exchange Rate</TableHead>
                <TableHead>Base</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading currencies...</TableCell>
                </TableRow>
              ) : currencies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">No currencies found</TableCell>
                </TableRow>
              ) : (
                currencies.map((currency) => (
                  <TableRow key={currency.id}>
                    <TableCell className="font-mono">{currency.code}</TableCell>
                    <TableCell>{currency.name}</TableCell>
                    <TableCell>{currency.symbol}</TableCell>
                    <TableCell>{currency.exchange_rate.toFixed(4)}</TableCell>
                    <TableCell>
                      {currency.is_base && <span className="text-teal-600 font-medium">Base</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${currency.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {currency.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingCurrency(currency)
                          setFormData(currency)
                          setIsDialogOpen(true)
                        }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(currency.id)}>
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
            <DialogTitle>{editingCurrency ? 'Edit Currency' : 'Add Currency'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Currency Code (ISO 4217)</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="USD"
                maxLength={3}
                disabled={!!editingCurrency}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Currency Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="US Dollar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                placeholder="$"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol_position">Symbol Position</Label>
              <Select
                value={formData.symbol_position}
                onValueChange={(value) => setFormData({ ...formData, symbol_position: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before amount ($100)</SelectItem>
                  <SelectItem value="after">After amount (100$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="decimal_places">Decimal Places</Label>
              <Input
                id="decimal_places"
                type="number"
                value={formData.decimal_places}
                onChange={(e) => setFormData({ ...formData, decimal_places: parseInt(e.target.value) || 2 })}
                min={0}
                max={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchange_rate">Exchange Rate</Label>
              <Input
                id="exchange_rate"
                type="number"
                step="0.0001"
                value={formData.exchange_rate}
                onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) || 1.0 })}
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
              <Label htmlFor="is_base">Base Currency</Label>
              <Switch
                id="is_base"
                checked={formData.is_base}
                onCheckedChange={(checked) => setFormData({ ...formData, is_base: checked })}
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

