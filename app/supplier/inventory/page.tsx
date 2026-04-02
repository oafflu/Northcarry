'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Edit, AlertTriangle, Trash2, Info } from 'lucide-react'
import { updateInventory, createInventoryItem, deleteInventoryItem } from '@/app/actions/suppliers'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/translations/supplier/context'

interface InventoryItem {
  id: string
  sku: string
  product_name: string
  quantity_available: number
  quantity_reserved: number
  quantity_committed: number
  cost_price: number
  reorder_point: number
  status: string
}

export default function InventoryPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const { t } = useTranslation()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null)
  const [showReserveInfo, setShowReserveInfo] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadInventory()
    }
  }, [user?.id])

  const loadInventory = async () => {
    if (!user?.id) return
    
    setLoading(true)
    const { data, error } = await supabase
      .from('supplier_inventory')
      .select('*')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading inventory:', error)
    } else {
      setInventory(data || [])
    }
    setLoading(false)
  }

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'low_stock' && item.quantity_available <= item.reorder_point) ||
      (filterStatus === 'out_of_stock' && item.quantity_available === 0) ||
      (filterStatus === 'active' && item.status === 'active')
    
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('inventory.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">{t('inventory.subtitle')}</p>
        </div>
        <Button 
          onClick={() => {
            setSelectedItem(null)
            setIsDialogOpen(true)
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('inventory.addInventoryItem')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('inventory.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm sm:text-base"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-md"
        >
          <option value="all">{t('common.all')}</option>
          <option value="active">{t('common.active')}</option>
          <option value="low_stock">{t('inventory.lowStock')}</option>
          <option value="out_of_stock">{t('inventory.outOfStock')}</option>
        </select>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">{t('common.loading')}</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('inventory.sku')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('inventory.productName')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('inventory.quantityAvailable')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">
                  <div className="flex items-center gap-1">
                    {t('inventory.quantityReserved')}
                    <button
                      onClick={() => setShowReserveInfo(true)}
                      className="text-gray-400 hover:text-gray-600"
                      title={t('inventory.reservedInfo')}
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </div>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('inventory.quantityCommitted')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('inventory.costPrice')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('common.status')}</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-sm">{item.sku}</td>
                    <td className="py-3 px-4 font-medium">{item.product_name}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {item.quantity_available}
                        {item.quantity_available <= item.reorder_point && (
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">{item.quantity_reserved}</td>
                    <td className="py-3 px-4">{item.quantity_committed}</td>
                    <td className="py-3 px-4">${parseFloat(item.cost_price?.toString() || '0').toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        item.quantity_available === 0
                          ? 'bg-red-100 text-red-800'
                          : item.quantity_available <= item.reorder_point
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.quantity_available === 0
                          ? t('inventory.outOfStock')
                          : item.quantity_available <= item.reorder_point
                          ? t('inventory.lowStock')
                          : t('inventory.active')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item)
                            setIsDialogOpen(true)
                          }}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setItemToDelete(item)
                            setIsDeleteDialogOpen(true)
                          }}
                          title="Delete"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Simple Add/Edit Dialog */}
      {isDialogOpen && (
        <InventoryDialog
          item={selectedItem}
          onClose={() => {
            setIsDialogOpen(false)
            setSelectedItem(null)
            loadInventory()
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('inventory.deleteItem')}</DialogTitle>
            <DialogDescription>
              {t('inventory.deleteConfirmMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeleteDialogOpen(false)
              setItemToDelete(null)
            }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (itemToDelete) {
                  try {
                    const result = await deleteInventoryItem(itemToDelete.id)
                    if (result.success) {
                      toast.success(t('common.success'))
                      setIsDeleteDialogOpen(false)
                      setItemToDelete(null)
                      loadInventory()
                    } else {
                      toast.error(result.error || t('common.error'))
                    }
                  } catch (error: any) {
                    toast.error(error.message || t('common.error'))
                  }
                }
              }}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reserve/Committed Info Dialog */}
      <Dialog open={showReserveInfo} onOpenChange={setShowReserveInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Understanding Reserved & Committed Inventory</DialogTitle>
            <DialogDescription>
              Learn how inventory tracking works in the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <h3 className="font-semibold mb-2">Reserved Inventory</h3>
              <p className="text-sm text-gray-600">
                When a customer places an order, the required quantity is automatically <strong>reserved</strong> from your available inventory. 
                This ensures the items are set aside for that order and prevents overselling.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Reserved inventory is still in your warehouse but cannot be used for other orders.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Committed Inventory</h3>
              <p className="text-sm text-gray-600">
                When you mark an order as <strong>shipped</strong>, the reserved inventory moves to <strong>committed</strong>. 
                This indicates the items have been physically shipped and are no longer in your warehouse.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Committed inventory represents items that have been fulfilled and are in transit to customers.
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Formula:</strong> Available = Total Stock - Reserved - Committed
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowReserveInfo(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InventoryDialog({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const [sku, setSku] = useState(item?.sku || '')
  const [productName, setProductName] = useState(item?.product_name || '')
  const [quantity, setQuantity] = useState(item?.quantity_available?.toString() || '0')
  const [costPrice, setCostPrice] = useState(item?.cost_price?.toString() || '0')
  const [reorderPoint, setReorderPoint] = useState(item?.reorder_point?.toString() || '10')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      if (item) {
        // Update existing
        await updateInventory(item.id, {
          product_name: productName.trim(),
          quantity_available: parseInt(quantity),
          cost_price: parseFloat(costPrice),
          reorder_point: parseInt(reorderPoint)
        })
      } else {
        // Create new
        await createInventoryItem({
          sku,
          product_name: productName,
          quantity_available: parseInt(quantity),
          cost_price: parseFloat(costPrice),
          reorder_point: parseInt(reorderPoint)
        })
      }
      onClose()
    } catch (error) {
      console.error('Error saving inventory:', error)
      alert('Failed to save inventory item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">{item ? 'Edit' : 'Add'} Inventory Item</h2>
        
        <div className="space-y-4">
          {!item && (
            <div>
              <label className="block text-sm font-medium mb-1">SKU</label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-001"
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1">Product Name</label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Product Name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Quantity Available</label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Cost Price</label>
            <Input
              type="number"
              step="0.01"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Reorder Point</label>
            <Input
              type="number"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

