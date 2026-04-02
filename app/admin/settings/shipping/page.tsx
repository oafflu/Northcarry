'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { getSetting, saveSetting } from '@/app/actions/settings'
import { toast } from 'sonner'
import { Save, Plus, Trash2, Truck } from 'lucide-react'

interface ShippingMethod {
  id: string
  name: string
  price: number
  enabled: boolean
  description?: string
  estimatedDays?: number // Legacy: single number (for backward compatibility)
  estimatedDaysMin?: number // New: minimum days in range
  estimatedDaysMax?: number // New: maximum days in range
  showEstimatedDays?: boolean
}

export default function ShippingSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([
    { id: 'standard', name: 'Standard Shipping', price: 0, enabled: true, description: 'Free standard shipping', estimatedDaysMin: 7, estimatedDaysMax: 14, showEstimatedDays: true },
    { id: 'express', name: 'Express Shipping', price: 4.99, enabled: true, description: 'Fast express delivery', estimatedDaysMin: 2, estimatedDaysMax: 5, showEstimatedDays: true },
  ])

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await getSetting('shipping_methods')
      if (result.data) {
        // Migrate legacy single estimatedDays to range format
        const methods = (result.data as ShippingMethod[]).map((method: ShippingMethod) => {
          // If has legacy estimatedDays but no range, convert it
          if (method.estimatedDays && (method.estimatedDaysMin === undefined || method.estimatedDaysMax === undefined)) {
            return {
              ...method,
              estimatedDaysMin: method.estimatedDays,
              estimatedDaysMax: method.estimatedDays,
            }
          }
          // Ensure both min and max are set if one is set
          if (method.estimatedDaysMin !== undefined && method.estimatedDaysMax === undefined) {
            return {
              ...method,
              estimatedDaysMax: method.estimatedDaysMin,
            }
          }
          if (method.estimatedDaysMax !== undefined && method.estimatedDaysMin === undefined) {
            return {
              ...method,
              estimatedDaysMin: method.estimatedDaysMax,
            }
          }
          return method
        })
        setShippingMethods(methods)
      }
    } catch (error) {
      console.error('Error loading shipping settings:', error)
      toast.error('Failed to load shipping settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveSetting(
        'shipping_methods',
        shippingMethods,
        'shipping',
        'Shipping methods configuration'
      )

      if (result.success) {
        toast.success('Shipping methods saved successfully')
      } else {
        toast.error(result.error || 'Failed to save shipping methods')
      }
    } catch (error) {
      console.error('Error saving shipping settings:', error)
      toast.error('Failed to save shipping settings')
    } finally {
      setSaving(false)
    }
  }

  const addShippingMethod = () => {
    const newMethod: ShippingMethod = {
      id: `shipping-${Date.now()}`,
      name: 'New Shipping Method',
      price: 0,
      enabled: true,
      description: '',
      estimatedDaysMin: 7,
      estimatedDaysMax: 14,
      showEstimatedDays: true,
    }
    setShippingMethods([...shippingMethods, newMethod])
  }

  const removeShippingMethod = (id: string) => {
    if (shippingMethods.length <= 1) {
      toast.error('You must have at least one shipping method')
      return
    }
    setShippingMethods(shippingMethods.filter(m => m.id !== id))
  }

  const updateShippingMethod = (id: string, field: keyof ShippingMethod, value: any) => {
    setShippingMethods(shippingMethods.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading shipping settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Shipping Settings</h1>
        <p className="text-gray-600 mt-1">Manage shipping methods and rates</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipping Methods</CardTitle>
          <CardDescription>
            Configure shipping options available to customers at checkout
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {shippingMethods.map((method) => (
            <div key={method.id} className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-semibold">{method.name}</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={method.enabled}
                      onCheckedChange={(checked) => updateShippingMethod(method.id, 'enabled', checked)}
                    />
                    <Label className="text-sm">{method.enabled ? 'Enabled' : 'Disabled'}</Label>
                  </div>
                  {shippingMethods.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeShippingMethod(method.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`name-${method.id}`}>Method Name</Label>
                  <Input
                    id={`name-${method.id}`}
                    value={method.name}
                    onChange={(e) => updateShippingMethod(method.id, 'name', e.target.value)}
                    placeholder="Standard Shipping"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`price-${method.id}`}>Price ($)</Label>
                  <Input
                    id={`price-${method.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={method.price}
                    onChange={(e) => updateShippingMethod(method.id, 'price', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor={`description-${method.id}`}>Description (Optional)</Label>
                  <Input
                    id={`description-${method.id}`}
                    value={method.description || ''}
                    onChange={(e) => updateShippingMethod(method.id, 'description', e.target.value)}
                    placeholder="Free standard shipping"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`days-min-${method.id}`}>Estimated Days (Min)</Label>
                  <Input
                    id={`days-min-${method.id}`}
                    type="number"
                    min="1"
                    value={method.estimatedDaysMin || ''}
                    onChange={(e) => {
                      const min = parseInt(e.target.value) || 0
                      updateShippingMethod(method.id, 'estimatedDaysMin', min)
                      // Ensure max is not less than min
                      if (method.estimatedDaysMax && min > method.estimatedDaysMax) {
                        updateShippingMethod(method.id, 'estimatedDaysMax', min)
                      }
                    }}
                    placeholder="7"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`days-max-${method.id}`}>Estimated Days (Max)</Label>
                  <Input
                    id={`days-max-${method.id}`}
                    type="number"
                    min="1"
                    value={method.estimatedDaysMax || ''}
                    onChange={(e) => {
                      const max = parseInt(e.target.value) || 0
                      updateShippingMethod(method.id, 'estimatedDaysMax', max)
                      // Ensure min is not greater than max
                      if (method.estimatedDaysMin && max < method.estimatedDaysMin) {
                        updateShippingMethod(method.id, 'estimatedDaysMin', max)
                      }
                    }}
                    placeholder="14"
                    className="mt-1"
                  />
                  {method.estimatedDaysMin && method.estimatedDaysMax && (
                    <p className="text-xs text-gray-500 mt-1">
                      Display: {method.estimatedDaysMin === method.estimatedDaysMax 
                        ? `${method.estimatedDaysMin} days` 
                        : `${method.estimatedDaysMin}-${method.estimatedDaysMax} days`}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor={`show-days-${method.id}`}>Show Estimated Days on Checkout</Label>
                    <p className="text-sm text-gray-500">Display estimated delivery days to customers</p>
                  </div>
                  <Switch
                    id={`show-days-${method.id}`}
                    checked={method.showEstimatedDays ?? true}
                    onCheckedChange={(checked) => updateShippingMethod(method.id, 'showEstimatedDays', checked)}
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addShippingMethod}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Shipping Method
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

