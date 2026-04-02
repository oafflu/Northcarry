import { getPageTemplate } from '@/app/actions/cms'
import { getAllActiveProducts } from '@/app/actions/products'
import Image from 'next/image'
import Link from 'next/link'

interface ProductGridSectionProps {
  cmsContent?: any
  cmsConfig?: any
}

export async function ProductGridSection({ cmsContent, cmsConfig }: ProductGridSectionProps = {}) {
  // Get CMS content if not provided
  if (!cmsContent) {
    try {
      const template = await getPageTemplate('home')
      const section = template.data?.sections?.find((s: any) => s.section_type === 'product_grid' && s.is_enabled)
      if (section) {
        cmsContent = section.content
        cmsConfig = section.config
        
        // Debug logging
        console.log('[ProductGridSection] Loaded from template:', {
          sectionId: section.id,
          content: section.content,
          contentKeys: section.content ? Object.keys(section.content) : [],
          productIds: section.content?.productIds,
          productIdsType: typeof section.content?.productIds,
          productIdsIsArray: Array.isArray(section.content?.productIds)
        })
      } else {
        console.log('[ProductGridSection] No product_grid section found in template')
      }
    } catch (error) {
      console.error('[ProductGridSection] Error loading CMS content:', error)
    }
  }

  const title = cmsContent?.title || 'Featured Products'
  const subtitle = cmsContent?.subtitle || ''
  const columns = cmsConfig?.columns || 4
  const limit = cmsConfig?.limit || 8
  
  // Handle productIds - can be array, null, or undefined
  let selectedProductIds: string[] = []
  if (cmsContent?.productIds) {
    if (Array.isArray(cmsContent.productIds)) {
      selectedProductIds = cmsContent.productIds.filter((id: any) => id != null && id !== '')
    } else if (typeof cmsContent.productIds === 'string') {
      // Handle case where productIds might be a JSON string
      try {
        const parsed = JSON.parse(cmsContent.productIds)
        if (Array.isArray(parsed)) {
          selectedProductIds = parsed.filter((id: any) => id != null && id !== '')
        }
      } catch (e) {
        console.error('[ProductGridSection] Error parsing productIds:', e)
      }
    }
  }

  // Debug logging
  console.log('[ProductGridSection] Debug:', {
    hasContent: !!cmsContent,
    cmsContentKeys: cmsContent ? Object.keys(cmsContent) : [],
    productIds: cmsContent?.productIds,
    productIdsType: typeof cmsContent?.productIds,
    productIdsIsArray: Array.isArray(cmsContent?.productIds),
    selectedProductIds,
    selectedProductIdsLength: selectedProductIds.length,
    title,
    subtitle,
    columns,
    limit
  })

  // Fetch products - use admin client to bypass RLS for public display
  let products: any[] = []
  try {
    // Try with admin client first (bypasses RLS) since this is a public page component
    const result = await getAllActiveProducts(true)
    console.log('[ProductGridSection] getAllActiveProducts result:', {
      hasData: !!result.data,
      dataLength: result.data?.length || 0,
      error: result.error,
      productIds: result.data?.map((p: any) => p.id) || []
    })
    
    if (result.data) {
      products = result.data

      // If specific products are selected (manual mode), filter to only those
      if (selectedProductIds.length > 0) {
        console.log('[ProductGridSection] Filtering products by selected IDs:', {
          selectedProductIds,
          selectedProductIdsTypes: selectedProductIds.map(id => ({ id, type: typeof id })),
          totalProducts: products.length,
          productIds: products.map((p: any) => p.id),
          productIdsTypes: products.map((p: any) => ({ id: p.id, type: typeof p.id, title: p.title }))
        })
        
        // Try both string and UUID comparison
        products = products.filter((p: any) => {
          // Direct match
          const directMatch = selectedProductIds.includes(p.id)
          // String comparison (in case of type mismatch)
          const stringMatch = selectedProductIds.some(id => String(id) === String(p.id))
          // UUID comparison (in case of format differences)
          const uuidMatch = selectedProductIds.some(id => {
            const idStr = String(id).toLowerCase().trim()
            const pIdStr = String(p.id).toLowerCase().trim()
            return idStr === pIdStr
          })
          
          const matches = directMatch || stringMatch || uuidMatch
          
          if (!matches) {
            console.log('[ProductGridSection] Product not in selection:', {
              productId: p.id,
              productIdType: typeof p.id,
              productTitle: p.title,
              selectedIds: selectedProductIds,
              directMatch,
              stringMatch,
              uuidMatch
            })
          } else {
            console.log('[ProductGridSection] Product matched:', {
              productId: p.id,
              productTitle: p.title,
              matchedId: selectedProductIds.find(id => String(id) === String(p.id) || String(id).toLowerCase().trim() === String(p.id).toLowerCase().trim())
            })
          }
          
          return matches
        })
        console.log('[ProductGridSection] Filtered products count:', products.length)
        // Maintain the order of selectedProductIds
        products.sort((a: any, b: any) => {
          const indexA = selectedProductIds.indexOf(a.id)
          const indexB = selectedProductIds.indexOf(b.id)
          return indexA - indexB
        })
      } else {
        // Automatic mode: limit to the configured limit
        console.log('[ProductGridSection] Using automatic mode, limiting to:', limit)
        products = products.slice(0, limit)
      }
    }
  } catch (error) {
    console.error('Error loading products:', error)
  }

  // Don't return null - always render the section if enabled, even if no products
  // This allows admins to see the section exists and configure it

  // Calculate grid columns class
  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
  }[columns] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'

  return (
    <section className="py-12 md:py-16 lg:py-20 px-4 md:px-6 lg:px-8 bg-background">
      <div className="container mx-auto max-w-7xl">
        {(title || subtitle) && (
          <div className="text-center mb-8 md:mb-12">
            {title && (
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">{title}</h2>
            )}
            {subtitle && (
              <p className="text-lg md:text-xl text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}

        {products.length > 0 ? (
          <div className={`grid ${gridColsClass} gap-6 md:gap-8`}>
            {products.map((product: any) => {
            // Get the first variant for price
            const firstVariant = product.product_variants?.[0]
            const price = firstVariant?.price || product.base_price || 0
            const compareAtPrice = product.compare_at_price
            const slug = product.slug || product.id
            
            // Get primary image from product_images (Shopify-like logic)
            // Priority: primary image from product_images > product.image_url > first variant image
            const productImages = product.product_images || []
            const primaryImage = productImages
              .filter((img: any) => img.is_primary && !img.variant_id)
              .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))[0]
            
            const imageUrl = primaryImage?.image_url || 
              product.image_url || 
              firstVariant?.image_url || 
              '/placeholder.svg'

            // Calculate discount percentage
            const hasDiscount = compareAtPrice && compareAtPrice > price
            const discountPercentage = hasDiscount 
              ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
              : 0

            // Check if product has subscription
            const hasSubscription = product.product_variants?.some((v: any) => 
              v.subscription_products && v.subscription_products.length > 0
            )

            return (
              <Link
                key={product.id}
                href={`/product/${slug}`}
                className="group relative bg-white rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all"
              >
                {/* Product Image */}
                <div className="relative aspect-square bg-gray-50 overflow-hidden">
                  <Image
                    src={imageUrl}
                    alt={product.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Discount Badge */}
                  {hasDiscount && discountPercentage > 0 && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg z-10">
                      -{discountPercentage}%
                    </div>
                  )}
                  {/* Subscribe Badge */}
                  {hasSubscription && (
                    <div className="absolute top-2 right-2 bg-teal-600 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-lg z-10">
                      Subscribe
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-teal-600 transition-colors">
                    {product.title}
                  </h3>
                  
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-gray-900">
                      ${price.toFixed(2)}
                    </span>
                    {compareAtPrice && compareAtPrice > price && (
                      <span className="text-sm text-gray-500 line-through">
                        ${compareAtPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No products available to display.</p>
            <p className="text-sm mt-2">Please configure product selection in the CMS editor.</p>
          </div>
        )}
      </div>
    </section>
  )
}

