"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
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
import { updateProduct } from "@/app/actions/products"
import { uploadMediaFile } from "@/app/actions/media"
import { createClient } from "@/lib/supabase/client"
import { ProductSupplierLinker } from "@/components/admin/product-supplier-linker"
import { ImagePicker } from "@/components/admin/image-picker"
import { MediaPicker } from "@/components/admin/media-picker"
import type { MediaFile } from "@/app/actions/media"
import { linkProductToSupplier, unlinkProductFromSupplier } from "@/app/actions/suppliers"
import { getAllProductTemplates } from "@/app/actions/cms"

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

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supplierLinks, setSupplierLinks] = useState<Record<string, any[]>>({})
  // Track pending supplier links to save when product is updated
  const [pendingSupplierLinks, setPendingSupplierLinks] = useState<Record<string, Array<{
    supplierId: string
    supplierInventoryId: string
    leadTimeDays: number
    isPrimarySupplier: boolean
  }>>>({})
  // Track links to remove
  const [linksToRemove, setLinksToRemove] = useState<Set<string>>(new Set())
  
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
  const [templateId, setTemplateId] = useState<string>("")
  const [productTemplates, setProductTemplates] = useState<any[]>([])
  
  const [variants, setVariants] = useState<Variant[]>([])
  const [productImages, setProductImages] = useState<ProductImage[]>([])
  const [variantOptions, setVariantOptions] = useState<Array<{ name: string; values: string[] }>>([])
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [mediaPickerVariantId, setMediaPickerVariantId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (productId) {
      loadProductData()
      loadSuppliers()
      loadProductTemplates()
    }
  }, [productId])

  const loadProductTemplates = async () => {
    try {
      const result = await getAllProductTemplates()
      if (result.data) {
        setProductTemplates(result.data)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, company_name, first_name, last_name')
      .eq('role', 'supplier')

    if (data) {
      setSuppliers(data)
    }
  }

  const loadProductData = async () => {
    setLoading(true)
    try {
      // Load product
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()

      if (!product) {
        toast.error('Product not found')
        router.push('/admin/products')
        return
      }

      // Load variants
      const { data: variantsData } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

      // Load images
      const { data: imagesData } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true })

      // Load supplier links
      const { data: linksData } = await supabase
        .from('product_supplier_links')
        .select(`
          *,
          profiles (
            company_name,
            first_name,
            last_name
          ),
          supplier_inventory (
            sku,
            product_name
          )
        `)
        .eq('product_id', productId)

      // Set form fields
      setTitle(product.title || "")
      setDescription(product.description || "")
      setBasePrice(product.base_price?.toString() || "")
      setComparePrice(product.compare_at_price?.toString() || "")
      setStatus(product.status || 'draft')
      // Inventory fields
      setInventoryTracked(product.inventory_tracked !== undefined ? product.inventory_tracked : true)
      setQuantity(product.quantity || 0)
      setShopLocation(product.shop_location || "0")
      setBarcode(product.barcode || "")
      setSellWhenOutOfStock(product.sell_when_out_of_stock || false)
      // Shipping fields
      setPhysicalProduct(product.physical_product !== undefined ? product.physical_product : true)
      setProductWeight(product.product_weight?.toString() || "0.0")
      setWeightUnit(product.weight_unit || "kg")
      setCountryOfOrigin(product.country_of_origin || "")
      setHsCode(product.hs_code || "")
      setPackageType(product.package_type || "default")
      setTemplateId(product.template_id || "")
      setCategory(product.category || "")

      // Set variants
      const loadedVariants: Variant[] = (variantsData || []).map(v => ({
        id: v.id,
        color: v.color || "",
        price: v.price?.toString() || "",
        sku: v.sku || "",
        inventory_quantity: v.inventory_quantity || 0,
        image_url: v.image_url || undefined,
        color_image_url: v.color_image_url || undefined,
      }))
      setVariants(loadedVariants)

      // Set images - preserve the database ID for tracking
      const loadedImages: ProductImage[] = (imagesData || []).map((img, index) => ({
        id: img.id, // Use actual database ID to preserve existing images
        url: img.image_url || "",
        alt_text: img.alt_text || "",
        variant_id: img.variant_id || undefined,
        is_primary: img.is_primary || false,
        sort_order: img.sort_order || index,
      }))
      setProductImages(loadedImages)

      // Organize supplier links by variant
      const linksByVariant: Record<string, any[]> = {}
      if (linksData) {
        linksData.forEach(link => {
          const variantId = link.variant_id
          if (!linksByVariant[variantId]) {
            linksByVariant[variantId] = []
          }
          linksByVariant[variantId].push(link)
        })
      }
      setSupplierLinks(linksByVariant)

    } catch (error) {
      console.error('Error loading product:', error)
      toast.error('Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, variantId?: string) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newImages: ProductImage[] = []
    
    for (const file of Array.from(files)) {
      const id = `new-img-${Date.now()}-${Math.random()}`
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

  const handleMediaLibrarySelect = (mediaFile: MediaFile, variantId?: string) => {
    const newImage: ProductImage = {
      id: `new-img-${Date.now()}-${Math.random()}`,
      url: mediaFile.url || "",
      alt_text: mediaFile.alt_text || "",
      variant_id: variantId,
      is_primary: productImages.length === 0 && !variantId,
      sort_order: productImages.length,
    }
    setProductImages([...productImages, newImage])
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
    setProductImages((prev) => {
      // Mark selected as primary
      const updated = prev.map((img) => ({
        ...img,
        is_primary: img.id === imageId,
      }))

      // Sort so primary is first, then preserve existing order
      updated.sort((a, b) => {
        const primaryDiff = (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
        if (primaryDiff !== 0) return primaryDiff
        return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      })

      // Re-assign sort_order to keep ordering consistent
      return updated.map((img, idx) => ({
        ...img,
        sort_order: idx,
      }))
    })
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

  const handleVariantMediaSelect = (mediaFile: MediaFile, variantId: string) => {
    const newImage: ProductImage = {
      id: `new-img-${Date.now()}-${Math.random()}`,
      url: mediaFile.url || "",
      alt_text: mediaFile.alt_text || "",
      variant_id: variantId,
      is_primary: false,
      sort_order: productImages.length,
    }
    setProductImages([...productImages, newImage])
    // Also update variant's image_url for display
    updateVariant(variantId, 'image_url', mediaFile.url || "")
  }

  const handleVariantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, variantId: string) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const id = `new-img-${Date.now()}-${Math.random()}`
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
    setSaving(true)

    try {
      if (!title.trim()) {
        toast.error('Product title is required')
        setSaving(false)
        return
      }

      if (!basePrice || parseFloat(basePrice) <= 0) {
        toast.error('Base price is required and must be greater than 0')
        setSaving(false)
        return
      }

      const validVariants = variants.filter(v => 
        v.color.trim() && v.sku.trim() && v.price && parseFloat(v.price) > 0
      )

      if (validVariants.length === 0) {
        toast.error('At least one valid variant is required')
        setSaving(false)
        return
      }

      // Check for duplicate SKUs within the form
      const skus = validVariants.map(v => v.sku.trim().toLowerCase())
      const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index)
      if (duplicateSkus.length > 0) {
        toast.error(`Duplicate SKUs found: ${[...new Set(duplicateSkus)].join(', ')}. Each variant must have a unique SKU.`)
        setSaving(false)
        return
      }

      // Upload all images first
      const uploadedImageUrls: Record<string, string> = {}
      
      // Process images: upload new ones, preserve existing ones
      for (const image of productImages) {
        if (image.file) {
          // New image - upload it
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
        } else if (image.url) {
          // Existing image - preserve the URL
          // Check if it's a blob URL (temporary) or a real URL
          if (!image.url.startsWith('blob:') && image.url.trim() !== '') {
            uploadedImageUrls[image.id] = image.url
          }
        }
      }

      // Ensure at least one primary image (fallback to first main image)
      let normalizedImages = [...productImages]
      const hasPrimary = normalizedImages.some((img) => img.is_primary)
      if (!hasPrimary && normalizedImages.length > 0) {
        normalizedImages = normalizedImages.map((img, idx) => ({
          ...img,
          is_primary: idx === 0,
        }))
      }

      // Find primary image URL for product.image_url
      const primaryImage = normalizedImages
        .filter(img => uploadedImageUrls[img.id] && img.is_primary && !img.variant_id)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]
      
      const primaryImageUrl = primaryImage ? uploadedImageUrls[primaryImage.id] : 
        (normalizedImages
          .filter(img => uploadedImageUrls[img.id] && !img.variant_id)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0]?.id 
          ? uploadedImageUrls[normalizedImages
              .filter(img => uploadedImageUrls[img.id] && !img.variant_id)
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))[0].id]
          : undefined)

      // Prepare product images data
      const productImagesData = normalizedImages
        .filter(img => uploadedImageUrls[img.id])
        .map((img, index) => ({
          image_url: uploadedImageUrls[img.id],
          alt_text: img.alt_text || undefined,
          variant_id: img.variant_id || undefined,
          is_primary: img.is_primary,
          sort_order: img.sort_order,
        }))

      // Prepare variants data - preserve existing variant IDs
      const variantsData = validVariants.map(variant => {
        const variantImage = productImages.find(img => 
          img.variant_id === variant.id && uploadedImageUrls[img.id]
        )

        return {
          id: variant.id.startsWith('variant-') ? undefined : variant.id, // Only include ID if it's a real UUID
          color: variant.color.trim(),
          price: parseFloat(variant.price),
          sku: variant.sku.trim(),
          inventory_quantity: inventoryTracked ? (variant.inventory_quantity || 0) : 0,
          image_url: variantImage ? uploadedImageUrls[variantImage.id] : variant.image_url,
          color_image_url: variant.color_image_url || undefined,
        }
      })

      // Update product
      // Note: image_url is not passed - primary image is handled via product_images table with is_primary flag
      const result = await updateProduct(productId, {
        title: title.trim(),
        description: description.trim() || undefined,
        base_price: parseFloat(basePrice),
        compare_at_price: comparePrice ? parseFloat(comparePrice) : undefined,
        status,
        template_id: templateId || null,
        category: category || undefined,
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
        // Save all pending supplier links after product update
        // We need to wait for variants to be created/updated first
        const { data: updatedVariants } = await supabase
          .from('product_variants')
          .select('id, color')
          .eq('product_id', productId)
        
        const variantIdMap = new Map<string, string>()
        if (updatedVariants) {
          updatedVariants.forEach(v => {
            variantIdMap.set(v.color.toLowerCase(), v.id)
            variantIdMap.set(v.id, v.id) // Also map by ID for existing variants
          })
        }

        // Save pending supplier links
        for (const [variantKey, links] of Object.entries(pendingSupplierLinks)) {
          // Find the actual variant ID
          let variantId: string | null = null
          
          // Find the variant in our current form state
          const matchingVariant = variants.find(v => v.id === variantKey)
          
          if (matchingVariant) {
            if (!matchingVariant.id.startsWith('variant-')) {
              // Existing variant with real UUID - use it directly
              variantId = matchingVariant.id
            } else {
              // New variant (temp ID) - find by color in updated variants from database
              variantId = variantIdMap.get(matchingVariant.color.toLowerCase()) || null
            }
          } else {
            // Fallback: try to find by the key itself (might be a real UUID)
            if (variantKey.includes('-') && !variantKey.startsWith('variant-') && variantKey.length > 20) {
              variantId = variantIdMap.get(variantKey) || variantKey
            }
          }
          
          if (!variantId) {
            console.error(`Could not find variant ID for key: ${variantKey}`)
            toast.error(`Could not find variant for supplier link. Please try again.`)
            continue
          }

          for (const link of links) {
            try {
              const linkResult = await linkProductToSupplier({
                productId,
                variantId,
                supplierId: link.supplierId,
                supplierInventoryId: link.supplierInventoryId,
                leadTimeDays: link.leadTimeDays,
                isPrimarySupplier: link.isPrimarySupplier
              })
              if (!linkResult.success) {
                console.error('Failed to save supplier link:', linkResult.error)
                toast.error(`Failed to save supplier link: ${linkResult.error}`)
              }
            } catch (error: any) {
              console.error('Error saving supplier link:', error)
              toast.error(`Error saving supplier link: ${error.message}`)
            }
          }
        }

        // Remove links that were marked for removal
        for (const linkId of linksToRemove) {
          try {
            const unlinkResult = await unlinkProductFromSupplier(linkId)
            if (!unlinkResult.success) {
              console.error('Failed to remove supplier link:', unlinkResult.error)
            }
          } catch (error: any) {
            console.error('Error removing supplier link:', error)
          }
        }

        // Clear pending links
        setPendingSupplierLinks({})
        setLinksToRemove(new Set())

        toast.success('Product updated successfully!')
        // Reload to refresh supplier links
        loadProductData()
      } else {
        toast.error(result.error || 'Failed to update product')
      }
    } catch (error: any) {
      console.error('Error updating product:', error)
      toast.error(error.message || 'Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  const mainProductImages = productImages.filter(img => !img.variant_id)
  const variantImages = productImages.filter(img => img.variant_id)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading product...</p>
      </div>
    )
  }

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
            <span className="text-gray-900 font-medium">Edit product</span>
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
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setMediaPickerVariantId(undefined)
                        setMediaPickerOpen(true)
                      }}
                    >
                      Select from Media Library
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
              <MediaPicker
                open={mediaPickerOpen}
                onClose={() => {
                  setMediaPickerOpen(false)
                  setMediaPickerVariantId(undefined)
                }}
                onSelect={(file) => {
                  if (mediaPickerVariantId) {
                    handleVariantMediaSelect(file, mediaPickerVariantId)
                  } else {
                    handleMediaLibrarySelect(file)
                  }
                  setMediaPickerOpen(false)
                  setMediaPickerVariantId(undefined)
                }}
                bucket="product-media"
                fileType="image"
              />
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
                          <Button
                            type="button"
                            variant={image.is_primary ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPrimaryImage(image.id)}
                            className="text-xs px-2"
                          >
                            {image.is_primary ? 'Primary' : 'Set primary'}
                          </Button>
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
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
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
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
                <div className="mt-4 space-y-6">
                  {variants.map((variant, index) => {
                    const variantImgs = variantImages.filter(img => img.variant_id === variant.id)
                    const variantLinks = supplierLinks[variant.id] || []
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
                            <div className="flex flex-col gap-1">
                              <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors">
                                <Upload className="w-4 h-4 text-gray-400 mb-1" />
                                <span className="text-xs text-gray-600">Upload</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => handleVariantImageUpload(e, variant.id)}
                                  className="hidden" 
                                />
                              </label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setMediaPickerVariantId(variant.id)
                                  setMediaPickerOpen(true)
                                }}
                              >
                                From Library
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Supplier Linking */}
                        <div className="pt-4 border-t">
                          <ProductSupplierLinker
                            productId={productId}
                            variantId={variant.id}
                            currentLinks={variantLinks}
                            mode="deferred"
                            linksToRemove={linksToRemove}
                            onLinkAdd={(link) => {
                              // Store pending link by variant ID (we'll map it after update)
                              // Use variant ID directly, and we'll resolve it after variants are saved
                              setPendingSupplierLinks(prev => ({
                                ...prev,
                                [variant.id]: [...(prev[variant.id] || []), link]
                              }))
                            }}
                            onLinkRemove={(linkId) => {
                              // Mark link for removal
                              setLinksToRemove(prev => new Set([...prev, linkId]))
                              // Also remove from current links display
                              setSupplierLinks(prev => ({
                                ...prev,
                                [variant.id]: (prev[variant.id] || []).filter(link => link.id !== linkId)
                              }))
                            }}
                          />
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

            {/* Page Template */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-1 mb-2">
                <Label className="text-sm font-medium text-gray-700">Page Template</Label>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Select a custom page template for this product. Leave empty to use the default template.
              </p>
              <Select value={templateId || "default"} onValueChange={(value) => setTemplateId(value === "default" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Template</SelectItem>
                  {productTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.template_name} {template.is_active && '(Active)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templateId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => router.push(`/admin/cms/product-template`)}
                >
                  <Settings className="w-3 h-3 mr-2" />
                  Edit Template
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Save Button & Preview */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/products')}
            className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors">
            {saving ? 'Saving...' : 'Update Product'}
          </Button>
        </div>
      </form>
    </div>
  )
}
