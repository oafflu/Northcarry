import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductHero } from "@/components/product/product-hero"
import { ProductFeatures } from "@/components/product/product-features"
import { BristlesSection } from "@/components/product/bristles-section"
import { BrushSection } from "@/components/product/brush-section"
import { ConfidenceSection } from "@/components/product/confidence-section"
import { ImageTextSection } from "@/components/product/image-text-section"
import { VideoTextSection } from "@/components/product/video-text-section"
import { CompareSection } from "@/components/product/compare-section"
import { ImageImageSection } from "@/components/product/image-image-section"
import { ProductGallerySection } from "@/components/product/product-gallery-section"
import { ProductVideoSection } from "@/components/product/product-video-section"
import { ProductDescriptionSection } from "@/components/product/product-description-section"
import { ProductSpecsSection } from "@/components/product/product-specs-section"
import { CartDrawer } from "@/components/cart-drawer"
import { AddToCartNotification } from "@/components/add-to-cart-notification"
import { InteractiveReviewsWrapper } from "@/components/product/interactive-reviews-wrapper"
import { ProductBundlesSection } from "@/components/upsells/product-bundles-section"
import { FrequentlyBoughtSection } from "@/components/upsells/frequently-bought-section"
import { QuantityBreakBadge } from "@/components/upsells/quantity-break-badge"
import { getProductWithVariants } from "@/app/actions/products"
import { getProductReviews } from "@/app/actions/reviews"
import { getProductPageContent, getProductTemplate } from "@/app/actions/cms"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"

// Mark route as dynamic to allow preview mode
export const dynamic = 'force-dynamic'

export default async function ProductPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ preview?: string; template_id?: string }>
}) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const productSlug = slug
  const isPreview = resolvedSearchParams?.preview === 'true'
  const previewTemplateId = resolvedSearchParams?.template_id // For template preview in admin
  
  // Fetch product data in parallel - allow draft products in preview mode
  const [productData, reviewsData, cmsContent] = await Promise.all([
    getProductWithVariants(productSlug, isPreview),
    // Get reviews for average rating calculation
    (async () => {
      const supabase = await createServerSupabaseClient()
      // First get product ID
      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('slug', productSlug)
        .single()
      
      if (!product) return { data: [], averageRating: 5, count: 233 }
      
      const { data: reviews } = await getProductReviews(product.id)
      
      if (!reviews || reviews.length === 0) {
        return { data: [], averageRating: 5, count: 233 }
      }
      
      const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      return { data: reviews, averageRating, count: reviews.length }
    })(),
    getProductPageContent(),
  ])

  // Get product template (will use product's assigned template or default)
  // If previewTemplateId is provided (for admin template preview), use that instead
  let productTemplate = null
  if (previewTemplateId) {
    // For template preview in admin, load the specific template
    const { getPageTemplate } = await import('@/app/actions/cms')
    const templateResult = await getPageTemplate('product', previewTemplateId, true) // includeDisabled = true to show all sections
    productTemplate = templateResult.data
    if (productTemplate) {
      // Convert to same format as getProductTemplate
      // For preview, show ALL sections (enabled and disabled) so admins can see everything
      const allSections = (productTemplate.sections || []).sort((a: any, b: any) => a.section_order - b.section_order)
      const enabledSections = allSections.filter((s: any) => s.is_enabled)
      // In preview mode, use allSections for rendering so disabled sections are visible
      productTemplate = { ...productTemplate, allSections, sections: allSections, previewMode: true }
    }
  } else if (productData.data?.product?.id) {
    const templateResult = await getProductTemplate(productData.data.product.id)
    productTemplate = templateResult.data
    
    // Debug logging
    if (productData.data.product.template_id) {
      console.log(`[ProductPage] Product ${productData.data.product.id} has template_id: ${productData.data.product.template_id}`)
      console.log(`[ProductPage] Loaded template:`, {
        templateId: productTemplate?.id,
        templateName: productTemplate?.template_name,
        sectionsCount: productTemplate?.allSections?.length || productTemplate?.sections?.length || 0,
        enabledSectionsCount: productTemplate?.sections?.length || 0
      })
    } else {
      console.log(`[ProductPage] Product ${productData.data.product.id} has no template_id, using default template`)
    }
  }

  // Check if product exists
  if (!productData.data?.product) {
    console.error('Product not found:', {
      slug: productSlug,
      preview: isPreview,
      error: productData.error
    })
    notFound()
  }

  const product = productData.data.product
  const variants = productData.data.variants || []
  const images = productData.data.images || []
  const subscriptions = productData.data.subscriptions || []
  const subscriptionsByVariant = productData.data.subscriptionsByVariant || {}
  const linkedSubscriptions = productData.data.linkedSubscriptions || []
  const linkedSubscriptionsByVariant = productData.data.linkedSubscriptionsByVariant || {}
  const inventoryByVariant = productData.data.inventoryByVariant || {}

  // Get enabled sections from template (if available) and sort by section_order
  // Use allSections if available (for checking enabled status), otherwise use sections
  // IMPORTANT: Always use the loaded productTemplate, not the default
  const templateSections = productTemplate?.allSections || productTemplate?.sections || []
  const enabledSections = templateSections
    .filter((s: any) => s.is_enabled)
    .sort((a: any, b: any) => a.section_order - b.section_order)
    .map((s: any) => s.section_type)
  // Only show default sections if NO template was loaded at all
  // If a template exists (even with no enabled sections), use it (will render nothing if empty)
  const showAll = !productTemplate // If no template loaded, show all default sections
  
  // Debug logging
  console.log(`[ProductPage] Template sections:`, {
    hasTemplate: !!productTemplate,
    templateName: productTemplate?.template_name,
    allSectionsCount: productTemplate?.allSections?.length || 0,
    sectionsCount: productTemplate?.sections?.length || 0,
    templateSectionsCount: templateSections.length,
    enabledSectionsCount: enabledSections.length,
    enabledSectionTypes: enabledSections,
    showAll
  })

  // Render section helper function
  const renderSection = (section: any) => {
    const sectionType = section.section_type
    const key = section.id || sectionType

    switch (sectionType) {
      case 'product_hero':
        // ProductHero is rendered separately above, but if CMS has custom content, we can use it
        // For now, return null since ProductHero is already rendered
        // In the future, this could be used to conditionally render a custom hero
        return null
      case 'product_features':
        return <ProductFeatures key={key} />
      case 'bristles_section':
        return <BristlesSection key={key} cmsContent={section.content} cmsConfig={section.config} />
      case 'brush_section':
        return <BrushSection key={key} cmsContent={section.content} cmsConfig={section.config} />
      case 'confidence_section':
        return <ConfidenceSection key={key} cmsContent={section.content} cmsConfig={section.config} />
      case 'image_text':
        return (
          <ImageTextSection
            key={key}
            cmsContent={section.content}
            cmsConfig={section.config}
          />
        )
      case 'video_with_text':
        return (
          <VideoTextSection
            key={key}
            cmsContent={section.content}
            cmsConfig={section.config}
          />
        )
      case 'compare_section':
        return <CompareSection key={key} cmsContent={section.content} />
      case 'image_image':
        return (
          <ImageImageSection
            key={key}
            cmsContent={section.content}
            cmsConfig={section.config}
          />
        )
      case 'reviews':
        return (
          <InteractiveReviewsWrapper
            key={key}
            productId={product.id}
            cmsContent={section.content}
          />
        )
      case 'product_gallery':
        return (
          <ProductGallerySection
            key={key}
            cmsContent={section.content}
            cmsConfig={section.config}
          />
        )
      case 'product_video':
        return <ProductVideoSection key={key} cmsContent={section.content} />
      case 'product_description':
        return (
          <ProductDescriptionSection key={key} cmsContent={section.content} />
        )
      case 'product_specs':
        return <ProductSpecsSection key={key} cmsContent={section.content} />
      case 'testimonials':
      case 'related_products':
      case 'faq':
      case 'multi_column':
      case 'trust_badges':
      case 'stats':
        // These sections have content but may not have components yet
        // Return a placeholder or null for now - they can be implemented later
        // The important thing is they're in the template and can be enabled/disabled
        return (
          <div key={key} className="py-8 px-4">
            <p className="text-gray-500 text-center">
              Section "{sectionType}" is enabled but component not yet implemented.
            </p>
          </div>
        )
      default:
        // Log unknown section types for debugging
        if (section) {
          console.warn(`Unknown section type: ${sectionType}`, section)
        }
        return null
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Product Hero - Always shown */}
        <ProductHero 
          product={product}
          variants={variants}
          images={images}
          subscriptions={subscriptions}
          subscriptionsByVariant={subscriptionsByVariant}
          linkedSubscriptions={linkedSubscriptions}
          linkedSubscriptionsByVariant={linkedSubscriptionsByVariant}
          inventoryByVariant={inventoryByVariant}
          reviewCount={cmsContent.data?.defaultReviewCount || reviewsData.count}
          averageRating={cmsContent.data?.defaultRating || reviewsData.averageRating}
          cmsContent={cmsContent.data}
        />
        
        {/* Product Bundles Section - Always shown */}
        <ProductBundlesSection productId={product.id} />
        <FrequentlyBoughtSection productId={product.id} />

        {/* Render sections in order based on template */}
        {showAll ? (
          // Default order when no template
          <>
            <ProductFeatures />
            <BristlesSection />
            <BrushSection />
            <ConfidenceSection />
            <InteractiveReviewsWrapper productId={product.id} />
          </>
        ) : (
          // Render sections in CMS-defined order
          // In preview mode, show all sections (enabled and disabled)
          (productTemplate?.previewMode 
            ? templateSections
            : templateSections.filter((s: any) => s.is_enabled)
          )
            .sort((a: any, b: any) => a.section_order - b.section_order)
            .map((section: any) => renderSection(section))
        )}
      </main>
      <Footer />
      <CartDrawer />
      <AddToCartNotification />
    </div>
  )
}

