import { getProductReviews } from "@/app/actions/reviews"
import { InteractiveReviews } from "./interactive-reviews"

interface InteractiveReviewsWrapperProps {
  productId: string // Current product ID (for fallback)
  cmsContent?: {
    title?: string
    numberOfReviews?: number
    reviewType?: 'all' | 'verified' | 'with_images' | '5_star' | '4_5_star'
    showRatingBreakdown?: boolean
    showReviewForm?: boolean
    defaultSort?: 'recent' | 'helpful' | 'highest' | 'lowest'
    productId?: string // Specific product ID or 'current'
  }
}

export async function InteractiveReviewsWrapper({ productId, cmsContent }: InteractiveReviewsWrapperProps) {
  // Determine which product's reviews to fetch
  const targetProductId = cmsContent?.productId && cmsContent.productId !== 'current' 
    ? cmsContent.productId 
    : productId

  // Get the limit from CMS content, default to 10 if not specified
  const numberOfReviews = cmsContent?.numberOfReviews || 10
  
  // Fetch all reviews for statistics calculation (we need all for accurate stats)
  const { data: allReviews } = await getProductReviews(targetProductId, {
    sortBy: cmsContent?.defaultSort || 'recent',
    // Don't limit here - we need all reviews for statistics
  })

  if (!allReviews || allReviews.length === 0) {
    return (
      <section className="bg-white py-8">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">{cmsContent?.title || "Customer Reviews"}</h2>
            <p className="text-gray-600">No reviews yet. Be the first to review this product!</p>
          </div>
        </div>
      </section>
    )
  }

  // Filter reviews based on reviewType
  let filteredReviews = allReviews
  if (cmsContent?.reviewType) {
    switch (cmsContent.reviewType) {
      case 'verified':
        filteredReviews = allReviews.filter(r => r.is_verified_purchase)
        break
      case 'with_images':
        filteredReviews = allReviews.filter(r => r.review_images && r.review_images.length > 0)
        break
      case '5_star':
        filteredReviews = allReviews.filter(r => r.rating === 5)
        break
      case '4_5_star':
        filteredReviews = allReviews.filter(r => r.rating >= 4)
        break
      default:
        filteredReviews = allReviews
    }
  }

  // Limit to numberOfReviews for initial display
  const displayedReviews = filteredReviews.slice(0, numberOfReviews)

  // Calculate statistics from all reviews (not just filtered)
  const totalReviews = allReviews.length
  const averageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
  
  const ratingDistribution = {
    5: allReviews.filter(r => r.rating === 5).length,
    4: allReviews.filter(r => r.rating === 4).length,
    3: allReviews.filter(r => r.rating === 3).length,
    2: allReviews.filter(r => r.rating === 2).length,
    1: allReviews.filter(r => r.rating === 1).length,
  }

  // Calculate percentages
  const ratingDistributionWithPercentages = [
    { stars: 5, count: ratingDistribution[5], percentage: Math.round((ratingDistribution[5] / totalReviews) * 100) },
    { stars: 4, count: ratingDistribution[4], percentage: Math.round((ratingDistribution[4] / totalReviews) * 100) },
    { stars: 3, count: ratingDistribution[3], percentage: Math.round((ratingDistribution[3] / totalReviews) * 100) },
    { stars: 2, count: ratingDistribution[2], percentage: Math.round((ratingDistribution[2] / totalReviews) * 100) },
    { stars: 1, count: ratingDistribution[1], percentage: Math.round((ratingDistribution[1] / totalReviews) * 100) },
  ]

  return (
    <InteractiveReviews
      productId={productId}
      initialReviews={displayedReviews}
      averageRating={averageRating}
      totalReviews={totalReviews}
      ratingDistribution={ratingDistributionWithPercentages}
      cmsContent={cmsContent}
    />
  )
}

