"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, X, Plus, ChevronDown, Info, Calendar, Settings, Eye } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createProduct } from "@/app/actions/products"
import { uploadMediaFile } from "@/app/actions/media"
import { createClient } from "@/lib/supabase/client"
import { ImagePicker } from "@/components/admin/image-picker"

interface Variant {
  id: string
  color: string
  price: string
  sku: string
  inventory_quantity: number
  image_url?: string
  color_image_url?: string // Separate image for color selection display
  imageFile?: File
}

interface ProductImage {
  id: string
  file?: File
  url: string
  alt_text: string
  variant_id?: string
  is_primary: boolean
  sort_order: number
}

export default function NewProductPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [currencySymbol, setCurrencySymbol] = useState('$')
  
  // Form fields
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [basePrice, setBasePrice] = useState("")
  const [comparePrice, setComparePrice] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [costPerItem, setCostPerItem] = useState("")
  const [chargeTax, setChargeTax] = useState(true)
  const [status, setStatus] = useState<'active' | 'draft' | 'archived'>('draft')
  const [inventoryTracked, setInventoryTracked] = useState(true)
  const [quantity, setQuantity] = useState(0)
  const [shopLocation, setShopLocation] = useState("0")
  const [barcode, setBarcode] = useState("")
  const [sellWhenOutOfStock, setSellWhenOutOfStock] = useState(false)
  const [physicalProduct, setPhysicalProduct] = useState(true)
  const [productWeight, setProductWeight] = useState("0.0")
  const [weightUnit, setWeightUnit] = useState("kg")
  const [countryOfOrigin, setCountryOfOrigin] = useState("")
  const [hsCode, setHsCode] = useState("")
  const [packageType, setPackageType] = useState("default")
  const [productType, setProductType] = useState("")
  const [vendor, setVendor] = useState("")
  const [collections, setCollections] = useState("")
  const [tags, setTags] = useState("")
  const [category, setCategory] = useState("")
  const [seoTitle, setSeoTitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")
  const [showSeoPreview, setShowSeoPreview] = useState(false)
  
  const [variants, setVariants] = useState<Variant[]>([])
  const [productImages, setProductImages] = useState<ProductImage[]>([])
  const [variantOptions, setVariantOptions] = useState<Array<{ name: string; values: string[] }>>([])
  const [createdProductSlug, setCreatedProductSlug] = useState<string | null>(null)

  useEffect(() => {
    loadSuppliers()
    loadBaseCurrency()
  }, [])

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, company_name, first_name, last_name')
      .eq('role', 'supplier')

    if (data) {
      setSuppliers(data)
    }
  }

  const loadBaseCurrency = async () => {
    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('code, symbol, is_base, is_active')
        .eq('is_active', true)
        .order('is_base', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error loading base currency:', error)
        return
      }

      if (data && data.length > 0) {
        setCurrencyCode(data[0].code || 'USD')
        setCurrencySymbol(data[0].symbol || '$')
      }
    } catch (err) {
      console.error('Error loading base currency:', err)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, variantId?: string) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newImages: ProductImage[] = []
    
    for (const file of Array.from(files)) {
      const id = `img-${Date.now()}-${Math.random()}`
      const url = URL.createObjectURL(file)
      
      newImages.push({
        id,
        file,
        url,
        alt_text: "",
        variant_id: variantId,
        is_primary: productImages.length === 0 && !variantId,
        sort_order: productImages.length + newImages.length,
      })
    }

    setProductImages([...productImages, ...newImages])
  }

  const removeImage = (imageId: string) => {
    const image = productImages.find(img => img.id === imageId)
    if (image?.url && image.url.startsWith('blob:')) {
      URL.revokeObjectURL(image.url)
    }
    setProductImages(productImages.filter(img => img.id !== imageId))
  }

  const updateImage = (imageId: string, updates: Partial<ProductImage>) => {
    setProductImages(productImages.map(img => 
      img.id === imageId ? { ...img, ...updates } : img
    ))
  }

  const moveImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...productImages]
    const [moved] = newImages.splice(fromIndex, 1)
    newImages.splice(toIndex, 0, moved)
    
    const updatedImages = newImages.map((img, index) => ({
      ...img,
      sort_order: index,
    }))
    
    setProductImages(updatedImages)
  }

  const setPrimaryImage = (imageId: string) => {
    setProductImages(productImages.map(img => ({
      ...img,
      is_primary: img.id === imageId,
    })))
  }

  const updateVariant = (variantId: string, field: keyof Variant, value: any) => {
    setVariants(variants.map(v => 
      v.id === variantId ? { ...v, [field]: value } : v
    ))
  }

  const addVariant = () => {
    setVariants([...variants, {
      id: `variant-${Date.now()}`,
      color: "",
      price: "",
      sku: "",
      inventory_quantity: 0,
    }])
  }

  const removeVariant = (variantId: string) => {
    setVariants(variants.filter(v => v.id !== variantId))
    setProductImages(productImages.filter(img => img.variant_id !== variantId))
  }

  const handleVariantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, variantId: string) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const id = `img-${Date.now()}-${Math.random()}`
    const url = URL.createObjectURL(file)
    
    const newImage: ProductImage = {
      id,
      file,
      url,
      alt_text: "",
      variant_id: variantId,
      is_primary: false,
      sort_order: productImages.length,
    }

    setProductImages([...productImages, newImage])
    
    const variant = variants.find(v => v.id === variantId)
    if (variant) {
      updateVariant(variantId, 'image_url', url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!title.trim()) {
        toast.error('Product title is required')
        setLoading(false)
        return
      }

      if (!basePrice || parseFloat(basePrice) <= 0) {
        toast.error('Base price is required and must be greater than 0')
        setLoading(false)
        return
      }

      const validVariants = variants.filter(v => 
        v.color.trim() && v.sku.trim() && v.price && parseFloat(v.price) > 0
      )

      // If no variants are provided, create a default one automatically
      const variantsToSave = validVariants.length > 0
        ? validVariants
        : [{
            id: `variant-default-${Date.now()}`,
            color: 'Default',
            price: basePrice,
            sku: `SKU-${Date.now()}`,
            inventory_quantity: 0,
            image_url: undefined,
            color_image_url: undefined,
          }]

      // Check for duplicate SKUs within the form
      const skus = variantsToSave.map(v => v.sku.trim().toLowerCase())
      const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index)
      if (duplicateSkus.length > 0) {
        toast.error(`Duplicate SKUs found: ${[...new Set(duplicateSkus)].join(', ')}. Each variant must have a unique SKU.`)
        setLoading(false)
        return
      }

      // Upload all images first
      const uploadedImageUrls: Record<string, string> = {}
      
      for (const image of productImages) {
        if (image.file) {
          const result = await uploadMediaFile(image.file, 'product-media', {
            folder: 'products',
            altText: image.alt_text || undefined,
            associatedType: 'product',
          })

          if (result.success && result.data) {
            uploadedImageUrls[image.id] = result.data.url || result.data.file_path
          } else {
            console.error('Failed to upload image:', result.error)
            toast.error(`Failed to upload image: ${result.error}`)
          }
        } else if (image.url && !image.url.startsWith('blob:')) {
          uploadedImageUrls[image.id] = image.url
        }
      }

      // Prepare product images data
      const productImagesData = productImages
        .filter(img => uploadedImageUrls[img.id])
        .map((img, index) => ({
          image_url: uploadedImageUrls[img.id],
          alt_text: img.alt_text || undefined,
          variant_id: img.variant_id || undefined,
          is_primary: img.is_primary,
          sort_order: img.sort_order,
        }))

      // Prepare variants data
      const variantsData = variantsToSave.map(variant => {
        const variantImage = productImages.find(img => 
          img.variant_id === variant.id && uploadedImageUrls[img.id]
        )

        return {
          color: variant.color.trim(),
          price: parseFloat(variant.price),
          sku: variant.sku.trim(),
          inventory_quantity: inventoryTracked ? (variant.inventory_quantity || 0) : 0,
          image_url: variantImage ? uploadedImageUrls[variantImage.id] : undefined,
          color_image_url: variant.color_image_url || undefined,
        }
      })

      // Create product
      const result = await createProduct({
        title: title.trim(),
        description: description.trim() || undefined,
        base_price: parseFloat(basePrice),
        compare_at_price: comparePrice ? parseFloat(comparePrice) : undefined,
        status,
        // Inventory fields
        inventory_tracked: inventoryTracked,
        quantity: quantity,
        shop_location: shopLocation,
        barcode: barcode || undefined,
        sell_when_out_of_stock: sellWhenOutOfStock,
        // Shipping fields
        physical_product: physicalProduct,
        product_weight: productWeight ? parseFloat(productWeight) : 0.0,
        weight_unit: weightUnit,
        country_of_origin: countryOfOrigin || undefined,
        hs_code: hsCode || undefined,
        package_type: packageType,
        variants: variantsData,
        images: productImagesData,
      })

      if (result.success) {
        toast.success('Product created successfully!')
        // Store product slug for preview
        if (result.data?.slug) {
          setCreatedProductSlug(result.data.slug)
        }
        // Optionally redirect after a delay, or let user stay to preview
        setTimeout(() => {
          // Auto-redirect after 3 seconds if user doesn't interact
          // User can click preview or update to stay on page
        }, 3000)
      } else {
        toast.error(result.error || 'Failed to create product')
      }
    } catch (error: any) {
      console.error('Error creating product:', error)
      toast.error(error.message || 'Failed to create product')
    } finally {
      setLoading(false)
    }
  }

  const mainProductImages = productImages.filter(img => !img.variant_id)
  const variantImages = productImages.filter(img => img.variant_id)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/products" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/admin/products" className="text-gray-500 hover:text-gray-700">Products</Link>
            <ChevronDown className="w-4 h-4 text-gray-400 rotate-[-90deg]" />
            <span className="text-gray-900 font-medium">Add product</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label htmlFor="title" className="text-sm font-medium text-gray-700 mb-2 block">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short sleeve t-shirt"
                className="w-full"
                required
              />
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label htmlFor="description" className="text-sm font-medium text-gray-700 mb-2 block">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={8}
                placeholder="Enter product description..."
                className="w-full font-sans"
              />
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span>Bold</span> <span>Italic</span> <span>Link</span> <span>•</span> <span>More formatting options</span>
              </div>
            </div>

            {/* Media */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Media</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <div className="space-y-4">
                  <div className="flex justify-center gap-3">
                    <Button type="button" variant="outline" onClick={() => document.getElementById('media-upload')?.click()}>
                      Upload new
                    </Button>
                    <Button type="button" variant="outline">
                      Select existing
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Accepts images, videos, or 3D models</p>
                </div>
                <input
                  id="media-upload"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              {mainProductImages.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  {mainProductImages
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((image, index) => (
                      <div key={image.id} className="relative group">
                        <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                          <Image
                            src={image.url || "/placeholder.svg"}
                            alt={image.alt_text || `Product ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                          {image.is_primary && (
                            <div className="absolute top-2 left-2 bg-teal-600 text-white text-xs px-2 py-1 rounded">
                              Primary
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(image.id)}
                            className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="mt-2 flex gap-1">
                          {index > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => moveImage(index, index - 1)}
                              className="text-xs px-2"
                            >
                              ↑
                            </Button>
                          )}
                          {index < mainProductImages.length - 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => moveImage(index, index + 1)}
                              className="text-xs px-2"
                            >
                              ↓
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Category */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label htmlFor="category" className="text-sm font-medium text-gray-700 mb-2 block">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Choose a product category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toothbrushes">Toothbrushes</SelectItem>
                  <SelectItem value="oral-care">Oral Care</SelectItem>
                  <SelectItem value="accessories">Accessories</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Determines tax rates and adds metafields to improve search, filters, and cross-channel sales
              </p>
            </div>

            {/* Price */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label htmlFor="basePrice" className="text-sm font-medium text-gray-700 mb-2 block">
                Price
              </Label>
              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencyCode}</span>
                  <Input
                    id="basePrice"
                    type="number"
                    step="0.01"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="0.00"
                    className="pl-12"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setComparePrice(basePrice)}>
                    Compare at
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setUnitPrice(basePrice)}>
                    Unit price
                  </Button>
                  <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md">
                    <span className="text-sm">Charge tax</span>
                    <Switch checked={chargeTax} onCheckedChange={setChargeTax} />
                    <span className="text-sm">{chargeTax ? 'Yes' : 'No'}</span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCostPerItem(basePrice)}>
                    Cost per item
                  </Button>
                </div>
                {comparePrice && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencyCode}</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={comparePrice}
                      onChange={(e) => setComparePrice(e.target.value)}
                      placeholder="Compare at price"
                      className="pl-12"
                    />
                  </div>
                )}
                {unitPrice && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencyCode}</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="Unit price"
                      className="pl-12"
                    />
                  </div>
                )}
                {costPerItem && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{currencyCode}</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={costPerItem}
                      onChange={(e) => setCostPerItem(e.target.value)}
                      placeholder="Cost per item"
                      className="pl-12"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Inventory */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Inventory</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Inventory tracked</span>
                  <Switch checked={inventoryTracked} onCheckedChange={setInventoryTracked} />
                </div>
                {inventoryTracked && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="quantity" className="text-xs text-gray-600 mb-1 block">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="shopLocation" className="text-xs text-gray-600 mb-1 block">Shop location</Label>
                        <Input
                          id="shopLocation"
                          type="text"
                          value={shopLocation}
                          onChange={(e) => setShopLocation(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm">SKU</Button>
                      <Button type="button" variant="outline" size="sm">Barcode</Button>
                      <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md">
                        <span className="text-sm">Sell when out of stock</span>
                        <Switch checked={sellWhenOutOfStock} onCheckedChange={setSellWhenOutOfStock} />
                        <span className="text-sm">{sellWhenOutOfStock ? 'On' : 'Off'}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Shipping */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Shipping</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Physical product</span>
                  <Switch checked={physicalProduct} onCheckedChange={setPhysicalProduct} />
                </div>
                {physicalProduct && (
                  <>
                    <div>
                      <Label htmlFor="package" className="text-xs text-gray-600 mb-1 block flex items-center gap-1">
                        Package
                        <Info className="w-3 h-3 text-gray-400" />
                      </Label>
                      <Select value={packageType} onValueChange={setPackageType}>
                        <SelectTrigger id="package">
                          <SelectValue placeholder="Store default • Sample box - 22 x 13.7 x 4.2 cm, 0 kg" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Store default</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="weight" className="text-xs text-gray-600 mb-1 block">Product weight</Label>
                        <div className="flex gap-2">
                          <Input
                            id="weight"
                            type="number"
                            step="0.1"
                            value={productWeight}
                            onChange={(e) => setProductWeight(e.target.value)}
                            placeholder="0.0"
                          />
                          <Select value={weightUnit} onValueChange={setWeightUnit}>
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="lb">lb</SelectItem>
                              <SelectItem value="oz">oz</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="countryOfOrigin" className="text-xs text-gray-600 mb-1 block">Country of origin</Label>
                        <Input
                          id="countryOfOrigin"
                          type="text"
                          value={countryOfOrigin}
                          onChange={(e) => setCountryOfOrigin(e.target.value)}
                          placeholder="e.g., United States"
                        />
                      </div>
                      <div>
                        <Label htmlFor="hsCode" className="text-xs text-gray-600 mb-1 block">HS Code</Label>
                        <Input
                          id="hsCode"
                          type="text"
                          value={hsCode}
                          onChange={(e) => setHsCode(e.target.value)}
                          placeholder="e.g., 1234.56.78"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Variants */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Variants</Label>
              <Button type="button" variant="outline" onClick={addVariant} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add options like size or color
              </Button>
              {variants.length > 0 && (
                <div className="mt-4 space-y-4">
                  {variants.map((variant, index) => {
                    const variantImgs = variantImages.filter(img => img.variant_id === variant.id)
                    return (
                      <div key={variant.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">Color</Label>
                            <Input
                              value={variant.color}
                              onChange={(e) => updateVariant(variant.id, 'color', e.target.value)}
                              placeholder="Black"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">Price</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={variant.price}
                              onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">SKU</Label>
                            <Input
                              value={variant.sku}
                              onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                              placeholder="SKU"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600 mb-1 block">Stock</Label>
                            <Input
                              type="number"
                              value={variant.inventory_quantity}
                              onChange={(e) => updateVariant(variant.id, 'inventory_quantity', parseInt(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 mb-1 block">Color Selection Image</Label>
                          <p className="text-xs text-gray-500 mb-2">This image is used for the color/variant selection display (separate from variant gallery images)</p>
                          <div className="mb-4">
                            <ImagePicker
                              value={variant.color_image_url || ""}
                              onChange={(url) => updateVariant(variant.id, 'color_image_url', url)}
                              label=""
                              bucket="product-media"
                              recommendedSize="100x100px"
                              previewWidth={100}
                              previewHeight={100}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 mb-1 block">Variant Images</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {variantImgs.map((img) => (
                              <div key={img.id} className="relative group">
                                <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                                  <Image
                                    src={img.url || "/placeholder.svg"}
                                    alt={variant.color}
                                    fill
                                    className="object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(img.id)}
                                    className="absolute top-1 right-1 p-1 bg-white rounded-full shadow-md hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
                              <Upload className="w-4 h-4 text-gray-400 mb-1" />
                              <span className="text-xs text-gray-600">Add</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleVariantImageUpload(e, variant.id)}
                                className="hidden" 
                              />
                            </label>
                          </div>
                        </div>
                        {variants.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariant(variant.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Remove variant
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Search engine listing */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">Search engine listing</Label>
                <button
                  type="button"
                  onClick={() => setShowSeoPreview(!showSeoPreview)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Add a title and description to see how this product might appear in a search engine listing
              </p>
              {showSeoPreview && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="seoTitle" className="text-xs text-gray-600 mb-1 block">Title</Label>
                    <Input
                      id="seoTitle"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                      placeholder="SEO title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="seoDescription" className="text-xs text-gray-600 mb-1 block">Description</Label>
                    <Textarea
                      id="seoDescription"
                      value={seoDescription}
                      onChange={(e) => setSeoDescription(e.target.value)}
                      rows={3}
                      placeholder="SEO description"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Status</Label>
              <Select value={status} onValueChange={(value: 'active' | 'draft' | 'archived') => setStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Publishing */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Publishing</Label>
              <div className="space-y-2">
                <Button type="button" variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Online Store
                </Button>
                <Button type="button" variant="outline" className="w-full justify-start">
                  Point of Sale
                </Button>
              </div>
            </div>

            {/* Product organization */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-1 mb-4">
                <Label className="text-sm font-medium text-gray-700">Product organization</Label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="productType" className="text-xs text-gray-600 mb-1 block">Type</Label>
                  <Input
                    id="productType"
                    value={productType}
                    onChange={(e) => setProductType(e.target.value)}
                    placeholder="Type"
                  />
                </div>
                <div>
                  <Label htmlFor="vendor" className="text-xs text-gray-600 mb-1 block">Vendor</Label>
                  <Select value={vendor} onValueChange={setVendor}>
                    <SelectTrigger id="vendor">
                      <SelectValue placeholder="Vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.company_name || `${supplier.first_name} ${supplier.last_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="collections" className="text-xs text-gray-600 mb-1 block">Collections</Label>
                  <Input
                    id="collections"
                    value={collections}
                    onChange={(e) => setCollections(e.target.value)}
                    placeholder="Collections"
                  />
                </div>
                <div>
                  <Label htmlFor="tags" className="text-xs text-gray-600 mb-1 block">Tags</Label>
                  <Input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Tags"
                  />
                </div>
              </div>
            </div>

            {/* Theme template */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Theme template</Label>
              <Select defaultValue="default">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default product</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Save Button & Preview */}
        <div className="mt-6 flex justify-end gap-3">
          {createdProductSlug && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(`/product/${createdProductSlug}?preview=true`, '_blank')}
                className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Product
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/products')}
                className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                View All Products
              </Button>
            </>
          )}
          <Button type="submit" disabled={loading} className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors">
            {loading ? 'Saving...' : createdProductSlug ? 'Update Product' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
