import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductHero } from "@/components/product/product-hero"
import { ProductFeatures } from "@/components/product/product-features"
import { BristlesSection } from "@/components/product/bristles-section"
import { BrushSection } from "@/components/product/brush-section"
import { ConfidenceSection } from "@/components/product/confidence-section"
import { CartDrawer } from "@/components/cart-drawer"
import { AddToCartNotification } from "@/components/add-to-cart-notification"
import { InteractiveReviewsWrapper } from "@/components/product/interactive-reviews-wrapper"
import { getProductWithVariants } from "@/app/actions/products"
import { getProductReviews } from "@/app/actions/reviews"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export default async function ProductPage() {
  // Default product slug - can be made dynamic later
  const productSlug = "brevi-nordic-inspired-premium-nano-toothbrush"
  
  // Fetch product data in parallel
  const [productData, reviewsData] = await Promise.all([
    getProductWithVariants(productSlug),
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
  ])

  // Use default data if product not found (backward compatibility)
  const product = productData.data?.product
  const variants = productData.data?.variants || []
  const images = productData.data?.images || []
  const subscriptions = productData.data?.subscriptions || []
  const subscriptionsByVariant = productData.data?.subscriptionsByVariant || {}
  const inventoryByVariant = productData.data?.inventoryByVariant || {}

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <ProductHero 
          product={product}
          variants={variants}
          images={images}
          subscriptions={subscriptions}
          subscriptionsByVariant={subscriptionsByVariant}
          inventoryByVariant={inventoryByVariant}
          reviewCount={reviewsData.count}
          averageRating={reviewsData.averageRating}
        />
        <ProductFeatures />
        <BristlesSection />
        <BrushSection />
        <ConfidenceSection />
        <InteractiveReviewsWrapper productId={product?.id || ''} />
      </main>
      <Footer />
      <CartDrawer />
      <AddToCartNotification />
    </div>
  )
}
