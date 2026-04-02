import { Star } from "lucide-react"
import { getAllReviews, getReviewStatistics } from "@/app/actions/reviews"
import { getPageTemplate } from "@/app/actions/cms"
import Link from "next/link"

export async function ReviewsSection() {
  // Get CMS content for reviews section
  let cmsContent: any = null
  try {
    const template = await getPageTemplate('home')
    if (template.data?.sections) {
      const reviewsSection = template.data.sections.find((s: any) => s.section_type === 'reviews' && s.is_enabled)
      if (reviewsSection) {
        cmsContent = reviewsSection.content || {}
      }
    }
  } catch (error) {
    console.error('Error loading CMS content for reviews section:', error)
  }

  // Fetch reviews and statistics
  const [reviewsResult, statsResult] = await Promise.all([
    getAllReviews({
      limit: cmsContent?.numberOfReviews || 8,
      sortBy: cmsContent?.sortBy || 'recent',
      minRating: cmsContent?.minRating || undefined,
    }),
    getReviewStatistics(),
  ])

  const reviews = reviewsResult.data || []
  const stats = statsResult || { totalReviews: 0, averageRating: 0, ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } }

  // Log for debugging
  if (reviewsResult.error) {
    console.error('Error fetching reviews:', reviewsResult.error)
  }

  const title = cmsContent?.title || "Don't Just Take Our Word For It"
  const showImages = cmsContent?.showImages !== false // Default to true

  // Get review images for display (only from reviews that have images)
  const reviewImages = reviews
    .filter((review: any) => review.review_images && review.review_images.length > 0)
    .flatMap((review: any) => review.review_images || [])
    .slice(0, 4)
    .map((img: any) => img.image_url)

  // Only show images grid if we have actual review images, don't fill with placeholders

  return (
    <section className="py-20 px-4 md:px-6 lg:px-8 bg-secondary">
      <div className="container">
        <div className="text-center space-y-8 mb-12">
          <h2 className="text-4xl md:text-5xl font-bold">{title}</h2>

          {(stats.totalReviews > 0 || reviews.length > 0) && (
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                {stats.totalReviews > 0 ? stats.totalReviews : reviews.length}+ Review{(stats.totalReviews > 0 ? stats.totalReviews : reviews.length) !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center justify-center gap-1">
                {[...Array(5)].map((_, i) => {
                  const avgRating = stats.averageRating > 0 ? stats.averageRating : 
                    reviews.length > 0 ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length : 0
                  return (
                    <Star
                      key={i}
                      className={`w-6 h-6 ${
                        i < Math.floor(avgRating)
                          ? 'fill-foreground text-foreground'
                          : i < avgRating
                          ? 'fill-foreground/50 text-foreground/50'
                          : 'text-foreground/30'
                      }`}
                    />
                  )
                })}
              </div>
              <p className="text-xl font-semibold">
                {stats.averageRating > 0 
                  ? stats.averageRating.toFixed(1) 
                  : reviews.length > 0 
                    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
                    : '0.0'
                } rating
              </p>
            </div>
          )}
        </div>

        {/* Reviews Grid */}
        {reviews.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 max-w-6xl mx-auto">
            {reviews.slice(0, 6).map((review: any) => (
              <div
                key={review.id}
                className="bg-background rounded-lg p-6 shadow-sm border"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < review.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  {review.is_verified_purchase && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      Verified
                    </span>
                  )}
                </div>
                {review.title && (
                  <h3 className="font-semibold mb-2">{review.title}</h3>
                )}
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                  {review.comment}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {review.profiles?.first_name || 'Anonymous'}{' '}
                    {review.profiles?.last_name || ''}
                  </span>
                  {review.products && (
                    <Link
                      href={`/product/${review.products.slug}`}
                      className="text-primary hover:underline"
                    >
                      {review.products.title}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Review Images Grid - Only show if we have actual review images */}
        {showImages && reviewImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {reviewImages.map((imageUrl, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden">
                <img
                  src={imageUrl}
                  alt={`Customer review ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Show message if no reviews found */}
        {reviews.length === 0 && stats.totalReviews === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No reviews available yet.</p>
          </div>
        )}
      </div>
    </section>
  )
}
