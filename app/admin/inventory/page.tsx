'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Package, Building2, AlertTriangle } from 'lucide-react'
import { getSuppliers } from '@/app/actions/users'
import Link from 'next/link'

export default function AdminInventoryPage() {
  const supabase = createClient()
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('all')
  const [suppliers, setSuppliers] = useState<any[]>([])

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (suppliers.length > 0 || filterSupplier === 'all') {
      loadInventory()
    }
  }, [filterSupplier, suppliers])

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

  const loadInventory = async () => {
    setLoading(true)
    try {
      // First, get all inventory items
      let inventoryQuery = supabase
        .from('supplier_inventory')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterSupplier !== 'all') {
        inventoryQuery = inventoryQuery.eq('supplier_id', filterSupplier)
      }

      const { data: inventoryData, error: inventoryError } = await inventoryQuery

      if (inventoryError) {
        console.error('Error loading inventory:', inventoryError)
        setInventory([])
        setLoading(false)
        return
      }

      // Use the suppliers data we already fetched (from getSuppliers server action)
      // Create a map of supplier_id -> profile
      const profilesMap = new Map(suppliers.map(profile => [profile.id, profile]))

      // Merge inventory with profiles
      const inventoryWithProfiles = (inventoryData || []).map(item => ({
        ...item,
        profiles: profilesMap.get(item.supplier_id) || null
      }))

      setInventory(inventoryWithProfiles)
    } catch (error) {
      console.error('Error loading inventory:', error)
      setInventory([])
    } finally {
      setLoading(false)
    }
  }

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  const getSupplierName = (profile: any) => {
    if (!profile) return 'Unknown'
    return profile.company_name || `${profile.first_name} ${profile.last_name}` || 'Unknown Supplier'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Inventory Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">View and manage supplier inventory across all suppliers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by SKU or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm sm:text-base"
          />
        </div>
        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="px-3 sm:px-4 py-2 text-sm sm:text-base border rounded-md"
        >
          <option value="all">All Suppliers</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.company_name || `${supplier.first_name} ${supplier.last_name}`}
            </option>
          ))}
        </select>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading inventory...</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">SKU</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Product Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Supplier</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Available</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Reserved</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Committed</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Cost Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      No inventory items found
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{item.sku}</td>
                      <td className="py-3 px-4 font-medium">{item.product_name}</td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/users?role=supplier&search=${getSupplierName(item.profiles)}`}
                          className="text-teal-600 hover:underline flex items-center gap-1"
                        >
                          <Building2 className="w-4 h-4" />
                          {getSupplierName(item.profiles)}
                        </Link>
                      </td>
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
                            ? 'Out of Stock'
                            : item.quantity_available <= item.reorder_point
                            ? 'Low Stock'
                            : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden divide-y">
            {filteredInventory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No inventory items found
              </div>
            ) : (
              filteredInventory.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.product_name}</p>
                      <p className="text-xs font-mono text-gray-500 mt-1">{item.sku}</p>
                    </div>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium flex-shrink-0 ml-2 ${
                      item.quantity_available === 0
                        ? 'bg-red-100 text-red-800'
                        : item.quantity_available <= item.reorder_point
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {item.quantity_available === 0
                        ? 'Out of Stock'
                        : item.quantity_available <= item.reorder_point
                        ? 'Low Stock'
                        : 'In Stock'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Supplier</p>
                      <Link
                        href={`/admin/users?role=supplier&search=${getSupplierName(item.profiles)}`}
                        className="text-teal-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">{getSupplierName(item.profiles)}</span>
                      </Link>
                    </div>
                    <div>
                      <p className="text-gray-500">Cost Price</p>
                      <p className="font-medium mt-1">${parseFloat(item.cost_price?.toString() || '0').toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Available</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-medium">{item.quantity_available}</p>
                        {item.quantity_available <= item.reorder_point && (
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500">Reserved</p>
                      <p className="font-medium mt-1">{item.quantity_reserved}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Committed</p>
                      <p className="font-medium mt-1">{item.quantity_committed}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Items</div>
          <div className="text-2xl font-bold">{filteredInventory.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Low Stock Items</div>
          <div className="text-2xl font-bold text-orange-600">
            {filteredInventory.filter(item => item.quantity_available <= item.reorder_point).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Out of Stock</div>
          <div className="text-2xl font-bold text-red-600">
            {filteredInventory.filter(item => item.quantity_available === 0).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Suppliers</div>
          <div className="text-2xl font-bold">{suppliers.length}</div>
        </div>
      </div>
    </div>
  )
}

