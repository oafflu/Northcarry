'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Link as LinkIcon, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createSampleRequest } from '@/app/actions/sample-requests'
import { getSuppliers } from '@/app/actions/users'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'

export default function NewSampleRequestPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [requestType, setRequestType] = useState<'existing_product' | 'custom_product'>('existing_product')
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  
  // Existing product fields - now support multiple products
  const [supplierInventory, setSupplierInventory] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Array<{
    type: 'inventory' | 'product'
    inventoryId?: string
    productId?: string
    variantId?: string
    name: string
    quantity: number
  }>>([])
  const [tempInventoryId, setTempInventoryId] = useState('')
  const [tempProductId, setTempProductId] = useState('')
  const [tempVariantId, setTempVariantId] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  
  // Custom product fields
  const [customProductName, setCustomProductName] = useState('')
  const [customProductDescription, setCustomProductDescription] = useState('')
  const [customImages, setCustomImages] = useState<string[]>([])
  const [customLinks, setCustomLinks] = useState<string[]>([])
  const [newLink, setNewLink] = useState('')
  
  // Shipping fields
  const [shippingName, setShippingName] = useState('')
  const [shippingAddress1, setShippingAddress1] = useState('')
  const [shippingAddress2, setShippingAddress2] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingPostalCode, setShippingPostalCode] = useState('')
  const [shippingCountry, setShippingCountry] = useState('US')
  const [shippingPhone, setShippingPhone] = useState('')
  const [shippingNotes, setShippingNotes] = useState('')
  
  // Notes
  const [adminNotes, setAdminNotes] = useState('')
  
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadSuppliers()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const sid = params.get('supplier_id')
      if (sid) setSelectedSupplier(sid)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (selectedSupplier) {
      if (requestType === 'existing_product') {
        loadSupplierInventory()
      }
    }
  }, [selectedSupplier, requestType])

  useEffect(() => {
    if (tempProductId) {
      loadProductVariants()
    } else {
      setVariants([])
      setTempVariantId('')
    }
  }, [tempProductId])

  const loadSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const result = await getSuppliers()
      if (result.data) {
        setSuppliers(result.data)
      }
    } catch (error) {
      console.error('Error loading suppliers:', error)
      toast.error('Failed to load suppliers')
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, status')
        .eq('status', 'active')
        .order('title', { ascending: true })

      if (error) {
        console.error('Error loading products:', error)
      } else {
        setProducts(data || [])
      }
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadSupplierInventory = async () => {
    if (!selectedSupplier) return
    
    try {
      const { data, error } = await supabase
        .from('supplier_inventory')
        .select('*')
        .eq('supplier_id', selectedSupplier)
        .eq('status', 'active')
        .order('product_name', { ascending: true })

      if (error) {
        console.error('Error loading supplier inventory:', error)
        toast.error('Failed to load supplier inventory')
      } else {
        setSupplierInventory(data || [])
      }
    } catch (error) {
      console.error('Error loading supplier inventory:', error)
    }
  }

  const loadProductVariants = async () => {
    if (!tempProductId) return
    
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', tempProductId)
        .order('color', { ascending: true })

      if (error) {
        console.error('Error loading variants:', error)
      } else {
        setVariants(data || [])
      }
    } catch (error) {
      console.error('Error loading variants:', error)
    }
  }

  const addProductFromInventory = () => {
    if (!tempInventoryId || tempInventoryId === 'none') {
      toast.error('Please select an inventory item')
      return
    }

    const inventoryItem = supplierInventory.find(item => item.id === tempInventoryId)
    if (!inventoryItem) {
      toast.error('Inventory item not found')
      return
    }

    // Check if already added
    if (selectedProducts.some(p => p.inventoryId === tempInventoryId)) {
      toast.error('This product is already added')
      return
    }

    setSelectedProducts(prev => [...prev, {
      type: 'inventory',
      inventoryId: tempInventoryId,
      name: `${inventoryItem.product_name} (SKU: ${inventoryItem.sku})`,
      quantity: 1
    }])
    setTempInventoryId('')
  }

  const addProductFromCatalog = async () => {
    if (!tempProductId || tempProductId === 'none') {
      toast.error('Please select a product')
      return
    }

    const product = products.find(p => p.id === tempProductId)
    if (!product) {
      toast.error('Product not found')
      return
    }

    // Check if already added
    if (selectedProducts.some(p => p.productId === tempProductId && p.variantId === tempVariantId)) {
      toast.error('This product variant is already added')
      return
    }

    const variant = tempVariantId ? variants.find(v => v.id === tempVariantId) : null
    const productName = variant 
      ? `${product.title} - ${variant.color}`
      : product.title

    setSelectedProducts(prev => [...prev, {
      type: 'product',
      productId: tempProductId,
      variantId: tempVariantId || undefined,
      name: productName,
      quantity: 1
    }])
    setTempProductId('')
    setTempVariantId('')
    setVariants([])
  }

  const removeProduct = (index: number) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index))
  }

  const updateProductQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return
    setSelectedProducts(prev => prev.map((p, i) => 
      i === index ? { ...p, quantity } : p
    ))
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `sample-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `sample-requests/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file)

        if (uploadError) {
          console.error('Error uploading image:', uploadError)
          toast.error(`Failed to upload ${file.name}`)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(filePath)

        setCustomImages(prev => [...prev, publicUrl])
        toast.success(`Uploaded ${file.name}`)
      } catch (error) {
        console.error('Error uploading image:', error)
        toast.error(`Failed to upload ${file.name}`)
      }
    }
  }

  const removeImage = (index: number) => {
    setCustomImages(prev => prev.filter((_, i) => i !== index))
  }

  const addLink = () => {
    if (newLink.trim()) {
      setCustomLinks(prev => [...prev, newLink.trim()])
      setNewLink('')
    }
  }

  const removeLink = (index: number) => {
    setCustomLinks(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Validate required fields
      if (!selectedSupplier) {
        toast.error('Please select a supplier')
        setSubmitting(false)
        return
      }

      if (requestType === 'existing_product') {
        if (selectedProducts.length === 0) {
          toast.error('Please add at least one product')
          setSubmitting(false)
          return
        }
      } else {
        if (!customProductName.trim()) {
          toast.error('Please enter a product name')
          setSubmitting(false)
          return
        }
      }

      if (!shippingName.trim() || !shippingAddress1.trim() || !shippingCity.trim() || 
          !shippingState.trim() || !shippingPostalCode.trim() || !shippingCountry.trim()) {
        toast.error('Please fill in all required shipping address fields')
        setSubmitting(false)
        return
      }

      // Prepare product arrays for multiple products with quantities
      // Quantities array should match the combined order: [inventory quantities..., product quantities...]
      const supplierInventoryIds: string[] = []
      const productIds: string[] = []
      const variantIds: string[] = []
      const quantities: number[] = []

      if (requestType === 'existing_product') {
        for (const product of selectedProducts) {
          if (product.type === 'inventory' && product.inventoryId) {
            supplierInventoryIds.push(product.inventoryId)
            quantities.push(product.quantity)
          } else if (product.type === 'product' && product.productId) {
            productIds.push(product.productId)
            if (product.variantId) {
              variantIds.push(product.variantId)
            }
            quantities.push(product.quantity)
          }
        }
      }

      const result = await createSampleRequest({
        request_type: requestType,
        supplier_id: selectedSupplier,
        supplier_inventory_ids: supplierInventoryIds.length > 0 ? supplierInventoryIds : undefined,
        product_ids: productIds.length > 0 ? productIds : undefined,
        variant_ids: variantIds.length > 0 ? variantIds : undefined,
        quantities: quantities.length > 0 ? quantities : undefined,
        // Keep single product fields for backward compatibility
        supplier_inventory_id: supplierInventoryIds.length === 1 ? supplierInventoryIds[0] : undefined,
        product_id: productIds.length === 1 ? productIds[0] : undefined,
        variant_id: variantIds.length === 1 ? variantIds[0] : undefined,
        custom_product_name: requestType === 'custom_product' ? customProductName : undefined,
        custom_product_description: requestType === 'custom_product' ? customProductDescription : undefined,
        custom_product_images: requestType === 'custom_product' ? customImages : undefined,
        custom_product_links: requestType === 'custom_product' ? customLinks : undefined,
        shipping_address: {
          name: shippingName,
          address_line1: shippingAddress1,
          address_line2: shippingAddress2 || undefined,
          city: shippingCity,
          state: shippingState,
          postal_code: shippingPostalCode,
          country: shippingCountry,
          phone: shippingPhone || undefined,
        },
        shipping_notes: shippingNotes || undefined,
        admin_notes: adminNotes || undefined,
      })

      if (result.success) {
        toast.success('Sample request created successfully')
        router.push('/admin/sample-requests')
      } else {
        toast.error(result.error || 'Failed to create sample request')
      }
    } catch (error: any) {
      console.error('Error creating sample request:', error)
      toast.error(error.message || 'Failed to create sample request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/sample-requests">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Request Sample</h1>
          <p className="text-gray-600 mt-1">Request a product sample from a supplier</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request Type */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <Label className="text-base font-semibold mb-4 block">Request Type</Label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="requestType"
                value="existing_product"
                checked={requestType === 'existing_product'}
                onChange={() => {
                  setRequestType('existing_product')
                  setSelectedInventoryId('')
                  setSelectedProductId('')
                  setSelectedVariantId('')
                }}
                className="w-4 h-4"
              />
              <span>Existing Product (from supplier inventory or products)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="requestType"
                value="custom_product"
                checked={requestType === 'custom_product'}
                onChange={() => {
                  setRequestType('custom_product')
                  setCustomProductName('')
                  setCustomProductDescription('')
                  setCustomImages([])
                  setCustomLinks([])
                }}
                className="w-4 h-4"
              />
              <span>Custom Product (with images and links)</span>
            </label>
          </div>
        </div>

        {/* Supplier Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <Label htmlFor="supplier" className="text-base font-semibold mb-2 block">
            Supplier *
          </Label>
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger id="supplier">
              <SelectValue placeholder="Select a supplier" />
            </SelectTrigger>
            <SelectContent>
              {loadingSuppliers ? (
                <SelectItem value="loading" disabled>Loading suppliers...</SelectItem>
              ) : suppliers.length === 0 ? (
                <SelectItem value="none" disabled>No suppliers available</SelectItem>
              ) : (
                suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.company_name || `${supplier.first_name} ${supplier.last_name}` || supplier.email}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Existing Product Selection - Multiple Products */}
        {requestType === 'existing_product' && selectedSupplier && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <Label className="text-base font-semibold mb-4 block">Product Selection</Label>
            
            {/* Selected Products List */}
            {selectedProducts.length > 0 && (
              <div className="space-y-2 mb-4">
                <Label className="text-sm font-medium">Selected Products ({selectedProducts.length})</Label>
                <div className="space-y-2">
                  {selectedProducts.map((product, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">
                          {product.type === 'inventory' ? 'From Supplier Inventory' : 'From Products Catalog'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`quantity-${index}`} className="text-xs text-gray-500 whitespace-nowrap">
                          Quantity:
                        </Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          min="1"
                          value={product.quantity}
                          onChange={(e) => updateProductQuantity(index, parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProduct(index)}
                        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Product from Supplier Inventory */}
            <div className="border-t border-gray-200 pt-4">
              <Label className="text-sm font-medium mb-2 block">Add from Supplier Inventory</Label>
              <div className="flex gap-2">
                <Select value={tempInventoryId || 'none'} onValueChange={(value) => setTempInventoryId(value === 'none' ? '' : value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select from supplier inventory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select an item...</SelectItem>
                    {supplierInventory
                      .filter(item => !selectedProducts.some(p => p.inventoryId === item.id))
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.product_name} (SKU: {item.sku})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={addProductFromInventory}
                  disabled={!tempInventoryId || tempInventoryId === 'none'}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>

            <div className="text-center text-gray-500">OR</div>

            {/* Add Product from Catalog */}
            <div className="border-t border-gray-200 pt-4 space-y-3">
              <Label className="text-sm font-medium mb-2 block">Add from Products Catalog</Label>
              <div className="flex gap-2">
                <Select 
                  value={tempProductId || 'none'} 
                  onValueChange={(value) => {
                    setTempProductId(value === 'none' ? '' : value)
                    setTempVariantId('')
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a product...</SelectItem>
                    {products
                      .filter(product => !selectedProducts.some(p => p.productId === product.id && !p.variantId))
                      .map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Variant Selection */}
              {tempProductId && tempProductId !== 'none' && variants.length > 0 && (
                <div>
                  <Label htmlFor="variant" className="text-sm font-medium mb-2 block">
                    Variant (Optional)
                  </Label>
                  <Select value={tempVariantId || 'none'} onValueChange={(value) => setTempVariantId(value === 'none' ? '' : value)}>
                    <SelectTrigger id="variant">
                      <SelectValue placeholder="Select a variant (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific variant</SelectItem>
                      {variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.color} - ${variant.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                type="button"
                onClick={addProductFromCatalog}
                disabled={!tempProductId || tempProductId === 'none'}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>
        )}

        {/* Custom Product Fields */}
        {requestType === 'custom_product' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <Label className="text-base font-semibold mb-4 block">Custom Product Details</Label>
            
            <div>
              <Label htmlFor="customName" className="text-sm font-medium mb-2 block">
                Product Name *
              </Label>
              <Input
                id="customName"
                value={customProductName}
                onChange={(e) => setCustomProductName(e.target.value)}
                placeholder="Enter product name"
                required
              />
            </div>

            <div>
              <Label htmlFor="customDescription" className="text-sm font-medium mb-2 block">
                Description
              </Label>
              <Textarea
                id="customDescription"
                value={customProductDescription}
                onChange={(e) => setCustomProductDescription(e.target.value)}
                placeholder="Enter product description"
                rows={4}
              />
            </div>

            {/* Custom Images */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Product Images (Multiple images supported)</Label>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500">You can select multiple images at once</span>
                </div>
                {customImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-3">
                    {customImages.map((url, index) => (
                      <div key={index} className="relative group">
                        <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                          <Image
                            src={url}
                            alt={`Custom product image ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Links */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Web Links</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    placeholder="https://example.com"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addLink()
                      }
                    }}
                  />
                  <Button type="button" onClick={addLink} variant="outline">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Add Link
                  </Button>
                </div>
                {customLinks.length > 0 && (
                  <div className="space-y-1">
                    {customLinks.map((link, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <LinkIcon className="w-4 h-4 text-gray-400" />
                        <a href={link} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-blue-600 hover:underline truncate">
                          {link}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeLink(index)}
                          className="p-1 text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shipping Address */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <Label className="text-base font-semibold mb-4 block">Shipping Address</Label>
          
          <div>
            <Label htmlFor="shippingName" className="text-sm font-medium mb-2 block">
              Recipient Name *
            </Label>
            <Input
              id="shippingName"
              value={shippingName}
              onChange={(e) => setShippingName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="shippingAddress1" className="text-sm font-medium mb-2 block">
              Address Line 1 *
            </Label>
            <Input
              id="shippingAddress1"
              value={shippingAddress1}
              onChange={(e) => setShippingAddress1(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="shippingAddress2" className="text-sm font-medium mb-2 block">
              Address Line 2
            </Label>
            <Input
              id="shippingAddress2"
              value={shippingAddress2}
              onChange={(e) => setShippingAddress2(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shippingCity" className="text-sm font-medium mb-2 block">
                City *
              </Label>
              <Input
                id="shippingCity"
                value={shippingCity}
                onChange={(e) => setShippingCity(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="shippingState" className="text-sm font-medium mb-2 block">
                State/Province *
              </Label>
              <Input
                id="shippingState"
                value={shippingState}
                onChange={(e) => setShippingState(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shippingPostalCode" className="text-sm font-medium mb-2 block">
                Postal Code *
              </Label>
              <Input
                id="shippingPostalCode"
                value={shippingPostalCode}
                onChange={(e) => setShippingPostalCode(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="shippingCountry" className="text-sm font-medium mb-2 block">
                Country *
              </Label>
              <Input
                id="shippingCountry"
                value={shippingCountry}
                onChange={(e) => setShippingCountry(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="shippingPhone" className="text-sm font-medium mb-2 block">
              Phone Number
            </Label>
            <Input
              id="shippingPhone"
              value={shippingPhone}
              onChange={(e) => setShippingPhone(e.target.value)}
              type="tel"
            />
          </div>

          <div>
            <Label htmlFor="shippingNotes" className="text-sm font-medium mb-2 block">
              Shipping Notes
            </Label>
            <Textarea
              id="shippingNotes"
              value={shippingNotes}
              onChange={(e) => setShippingNotes(e.target.value)}
              placeholder="Any special shipping instructions..."
              rows={3}
            />
          </div>
        </div>

        {/* Admin Notes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <Label htmlFor="adminNotes" className="text-base font-semibold mb-2 block">
            Admin Notes
          </Label>
          <Textarea
            id="adminNotes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Internal notes about this sample request..."
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/admin/sample-requests">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
            {submitting ? 'Creating...' : 'Create Sample Request'}
          </Button>
        </div>
      </form>
    </div>
  )
}

