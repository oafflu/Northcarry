'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link as LinkIcon, Unlink, Plus } from 'lucide-react'
import { linkProductToSupplier, unlinkProductFromSupplier } from '@/app/actions/suppliers'
import { getSuppliers } from '@/app/actions/users'
import { createClient } from '@/lib/supabase/client'

interface PendingLink {
  supplierId: string
  supplierInventoryId: string
  leadTimeDays: number
  isPrimarySupplier: boolean
}

interface ProductSupplierLinkerProps {
  productId: string
  variantId: string
  currentLinks?: any[]
  onLinkAdd?: (link: PendingLink) => void // Callback for adding pending links
  onLinkRemove?: (linkId: string) => void // Callback for removing links
  mode?: 'immediate' | 'deferred' // 'immediate' = save right away, 'deferred' = queue for later
  linksToRemove?: Set<string> // Links marked for removal (for deferred mode)
}

export function ProductSupplierLinker({
  productId,
  variantId,
  currentLinks = [],
  onLinkAdd,
  onLinkRemove,
  mode = 'immediate',
  linksToRemove
}: ProductSupplierLinkerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [supplierInventory, setSupplierInventory] = useState<any[]>([])
  const [selectedInventoryItem, setSelectedInventoryItem] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState(3)
  const [loading, setLoading] = useState(false)
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([])
  const [allSupplierInventory, setAllSupplierInventory] = useState<Record<string, any[]>>({})
  const supabase = createClient()

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (selectedSupplier) {
      loadSupplierInventory(selectedSupplier)
    } else {
      setSupplierInventory([])
    }
  }, [selectedSupplier])

  const loadSuppliers = async () => {
    try {
      const result = await getSuppliers()
      if (result.error) {
        console.error('Error loading suppliers:', result.error)
        setSuppliers([])
      } else {
        setSuppliers(result.data || [])
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
      setSuppliers([])
    }
  }

  const loadSupplierInventory = async (supplierId: string) => {
    // Check if we already have this supplier's inventory cached
    if (allSupplierInventory[supplierId]) {
      setSupplierInventory(allSupplierInventory[supplierId])
      return
    }

    const { data, error } = await supabase
      .from('supplier_inventory')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('status', 'active')
      .order('product_name', { ascending: true })

    if (error) {
      console.error('Error loading supplier inventory:', error)
    } else {
      const inventory = data || []
      setSupplierInventory(inventory)
      // Cache it for pending links display
      setAllSupplierInventory(prev => ({ ...prev, [supplierId]: inventory }))
    }
  }

  const handleLink = async () => {
    if (!selectedSupplier || !selectedInventoryItem) {
      alert('Please select both supplier and inventory item')
      return
    }

    if (mode === 'deferred' && onLinkAdd) {
      // Deferred mode: queue the link for later
      const newLink: PendingLink = {
        supplierId: selectedSupplier,
        supplierInventoryId: selectedInventoryItem,
        leadTimeDays,
        isPrimarySupplier: currentLinks.length === 0 && pendingLinks.length === 0
      }
      onLinkAdd(newLink)
      setPendingLinks(prev => [...prev, newLink])
      // Ensure inventory is cached for display
      if (selectedSupplier && supplierInventory.length > 0) {
        setAllSupplierInventory(prev => ({ ...prev, [selectedSupplier]: supplierInventory }))
      }
      setIsDialogOpen(false)
      setSelectedSupplier('')
      setSelectedInventoryItem('')
      setLeadTimeDays(3)
      return
    }

    // Immediate mode: save right away (original behavior)
    setLoading(true)
    try {
      const result = await linkProductToSupplier({
        productId,
        variantId,
        supplierId: selectedSupplier,
        supplierInventoryId: selectedInventoryItem,
        leadTimeDays,
        isPrimarySupplier: currentLinks.length === 0
      })

      if (result.success) {
        setIsDialogOpen(false)
        setSelectedSupplier('')
        setSelectedInventoryItem('')
        setLeadTimeDays(3)
        // Reload page or refresh links
        window.location.reload()
      } else {
        alert(result.error || 'Failed to link product to supplier')
      }
    } catch (error) {
      console.error('Error linking product:', error)
      alert('Failed to link product to supplier')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlink = async (linkId: string) => {
    if (!confirm('Are you sure you want to unlink this supplier?')) {
      return
    }

    if (mode === 'deferred' && onLinkRemove) {
      // Deferred mode: queue the removal
      onLinkRemove(linkId)
      return
    }

    // Immediate mode: save right away (original behavior)
    try {
      const result = await unlinkProductFromSupplier(linkId)
      if (result.success) {
        window.location.reload()
      } else {
        alert(result.error || 'Failed to unlink product from supplier')
      }
    } catch (error) {
      console.error('Error unlinking product:', error)
      alert('Failed to unlink product from supplier')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Supplier Links</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Link to Supplier
        </Button>
      </div>

      {/* Current Links */}
      {(currentLinks.length === 0 && pendingLinks.length === 0) ? (
        <p className="text-sm text-gray-500">No supplier links yet. Click "Link to Supplier" to add one.</p>
      ) : (
        <div className="space-y-2">
          {/* Show pending links in deferred mode */}
          {mode === 'deferred' && pendingLinks.map((link, index) => {
            const supplier = suppliers.find(s => s.id === link.supplierId)
            // Load inventory for this supplier if not already loaded
            if (link.supplierId && !allSupplierInventory[link.supplierId]) {
              loadSupplierInventory(link.supplierId)
            }
            const inventory = allSupplierInventory[link.supplierId]?.find(i => i.id === link.supplierInventoryId)
            
            return (
              <div
                key={`pending-${index}`}
                className="flex items-center justify-between p-3 border border-teal-200 bg-teal-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {supplier?.company_name || supplier?.first_name || 'Supplier'} (Pending)
                  </p>
                  <p className="text-xs text-gray-600">
                    SKU: {inventory?.sku || 'Loading...'}
                    {link.isPrimarySupplier && (
                      <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-800 text-xs rounded">
                        Primary
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Lead time: {link.leadTimeDays} days
                  </p>
                </div>
                <span className="text-xs text-teal-600 font-medium">Will be saved</span>
              </div>
            )
          })}
          {/* Show existing links (filter out ones marked for removal) */}
          {currentLinks
            .filter(link => !linksToRemove?.has(link.id))
            .map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex-1">
                <p className="font-medium">
                  {link.profiles?.company_name || link.profiles?.first_name || 'Supplier'}
                </p>
                <p className="text-sm text-gray-600">
                  SKU: {link.supplier_inventory?.sku || 'N/A'}
                  {link.is_primary_supplier && (
                    <span className="ml-2 px-2 py-0.5 bg-teal-100 text-teal-800 text-xs rounded">
                      Primary
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  Lead time: {link.lead_time_days} days
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleUnlink(link.id)}
              >
                <Unlink className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Link Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Link Product to Supplier Inventory</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Supplier</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Choose a supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.company_name || `${supplier.first_name} ${supplier.last_name}`}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSupplier && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Select Inventory Item
                  </label>
                  {supplierInventory.length === 0 ? (
                    <p className="text-sm text-gray-500">No inventory items available for this supplier</p>
                  ) : (
                    <select
                      value={selectedInventoryItem}
                      onChange={(e) => setSelectedInventoryItem(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Choose inventory item</option>
                      {supplierInventory.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.sku} - {item.product_name} (Available: {item.quantity_available})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Lead Time (days)
                </label>
                <Input
                  type="number"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(parseInt(e.target.value) || 3)}
                  min={1}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setSelectedSupplier('')
                    setSelectedInventoryItem('')
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleLink}
                  disabled={!selectedSupplier || !selectedInventoryItem || loading}
                  className="flex-1"
                >
                  {loading ? 'Linking...' : 'Link to Supplier'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

