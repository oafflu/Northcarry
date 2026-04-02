"use client"

import { useState, useEffect } from "react"
import { Star } from "lucide-react"
import { ReviewForm } from "./review-form"
import { getProductReviews } from "@/app/actions/reviews"

interface Review {
  id: string
  rating: number
  title: string | null
  comment: string
  is_verified_purchase: boolean
  created_at: string
  helpful_count?: number
  profiles?: {
    first_name: string | null
    last_name: string | null
  }
  review_images?: Array<{
    image_url: string
  }>
}

interface InteractiveReviewsProps {
  productId: string
  initialReviews: Review[]
  averageRating: number
  totalReviews: number
  ratingDistribution: Array<{
    stars: number
    count: number
    percentage: number
  }>
  cmsContent?: {
    title?: string
    showRatingBreakdown?: boolean
    showReviewForm?: boolean
    defaultSort?: 'recent' | 'helpful' | 'highest' | 'lowest'
    numberOfReviews?: number
    reviewType?: 'all' | 'verified' | 'with_images' | '5_star' | '4_5_star'
  }
}

export function InteractiveReviews({
  productId,
  initialReviews,
  averageRating: initialAverageRating,
  totalReviews: initialTotalReviews,
  ratingDistribution: initialRatingDistribution,
  cmsContent,
}: InteractiveReviewsProps) {
  const [showForm, setShowForm] = useState(false)
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [filter, setFilter] = useState("all")
  const [sortBy, setSortBy] = useState<"recent" | "helpful" | "highest" | "lowest">(cmsContent?.defaultSort || "recent")
  const [loading, setLoading] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Update reviews when filter or sort changes (but skip initial mount if we have initial reviews)
  useEffect(() => {
    // Skip initial fetch if we haven't initialized yet and have initial reviews
    // This prevents unnecessary refetch on mount
    if (!hasInitialized && initialReviews.length > 0) {
      setHasInitialized(true)
      return
    }
    
    setHasInitialized(true)
    const fetchFilteredReviews = async () => {
      setLoading(true)
      try {
        // Get the limit from CMS content, default to 10 if not specified
        const limit = cmsContent?.numberOfReviews || 10
        
        // Fetch reviews with limit
        const result = await getProductReviews(productId, {
          rating: filter === "all" ? undefined : parseInt(filter),
          sortBy: sortBy,
          limit: limit, // Apply CMS limit
        })
        
        if (result.data) {
          let filtered = result.data as Review[]
          
          // Apply reviewType filter if specified in CMS
          if (cmsContent?.reviewType) {
            switch (cmsContent.reviewType) {
              case 'verified':
                filtered = filtered.filter(r => r.is_verified_purchase)
                break
              case 'with_images':
                filtered = filtered.filter(r => r.review_images && r.review_images.length > 0)
                break
              case '5_star':
                filtered = filtered.filter(r => r.rating === 5)
                break
              case '4_5_star':
                filtered = filtered.filter(r => r.rating >= 4)
                break
              default:
                // 'all' - no additional filtering
                break
            }
          }
          
          // Ensure we don't exceed the limit
          setReviews(filtered.slice(0, limit))
        }
      } catch (error) {
        console.error("Error fetching filtered reviews:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchFilteredReviews()
  }, [productId, filter, sortBy, cmsContent?.numberOfReviews, cmsContent?.reviewType])

  const handleReviewSubmit = () => {
    setShowForm(false)
    // Refresh reviews
    window.location.reload()
  }

  const filteredReviews = reviews

  const sectionTitle = cmsContent?.title || "Customer Reviews"
  const showRatingBreakdown = cmsContent?.showRatingBreakdown !== false
  const showReviewForm = cmsContent?.showReviewForm !== false

  return (
    <section className="bg-white py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">{sectionTitle}</h2>
          <div className="flex items-center justify-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-6 w-6 ${
                    i < Math.floor(initialAverageRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="text-2xl font-bold">{initialAverageRating.toFixed(1)}</span>
            <span className="text-gray-600">({initialTotalReviews} reviews)</span>
          </div>
        </div>

        <div className={`grid gap-8 ${showRatingBreakdown ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
          {/* Rating Breakdown */}
          {showRatingBreakdown && (
            <div className="lg:col-span-1">
              <div className="rounded-lg border border-gray-200 p-6">
                <h3 className="mb-4 font-bold">Rating Distribution</h3>
                <div className="space-y-3">
                  {initialRatingDistribution.map((dist) => (
                    <div key={dist.stars} className="flex items-center gap-3">
                      <div className="flex w-12 items-center gap-1">
                        <span className="text-sm font-medium">{dist.stars}</span>
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      </div>
                      <div className="flex-1">
                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div className="h-2 rounded-full bg-yellow-400" style={{ width: `${dist.percentage}%` }} />
                        </div>
                      </div>
                      <span className="w-12 text-right text-sm text-gray-600">{dist.count}</span>
                    </div>
                  ))}
                </div>

                {showReviewForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-6 w-full rounded-md bg-black py-3 font-semibold text-white transition-colors hover:bg-gray-800"
                  >
                    Write a Review
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className={showRatingBreakdown ? "lg:col-span-2" : "lg:col-span-1"}>
            {/* Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value="recent">Most Recent</option>
                <option value="helpful">Most Helpful</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>

            {/* Reviews */}
            <div className="space-y-6">
              {loading ? (
                <div className="text-center py-8 text-gray-600">Loading reviews...</div>
              ) : filteredReviews.length === 0 ? (
                <div className="text-center py-8 text-gray-600">No reviews found matching your filters.</div>
              ) : (
                filteredReviews.map((review) => {
                  const authorName = review.profiles
                    ? `${review.profiles.first_name || ''} ${review.profiles.last_name || ''}`.trim() || 'Anonymous'
                    : 'Anonymous'

                  return (
                    <div key={review.id} className="rounded-lg border border-gray-200 p-6">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-semibold">{authorName}</span>
                            {review.is_verified_purchase && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                Verified Purchase
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-gray-600">
                              {new Date(review.created_at).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {review.title && <h4 className="mb-2 font-semibold">{review.title}</h4>}
                      <p className="mb-4 text-gray-700">{review.comment}</p>

                      {review.review_images && review.review_images.length > 0 && (
                        <div className="mb-4 flex gap-2">
                          {review.review_images.map((img, idx) => (
                            <img
                              key={idx}
                              src={img.image_url || "/placeholder.svg"}
                              alt={`Review ${idx + 1}`}
                              className="h-20 w-20 rounded-md object-cover"
                            />
                          ))}
                        </div>
                      )}

                      <button className="text-sm text-gray-600 hover:text-black">
                        Helpful ({review.helpful_count || 0})
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showForm && <ReviewForm productId={productId} onClose={() => setShowForm(false)} onSubmit={handleReviewSubmit} />}
    </section>
  )
}
