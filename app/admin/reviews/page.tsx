'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog'
import { 
  Checkbox 
} from '@/components/ui/checkbox'
import { 
  Star, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  Trash2, 
  Plus, 
  Search, 
  Filter,
  Download,
  CheckSquare,
  Square
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import {
  getReviews,
  getReviewStats,
  approveReview,
  hideReview,
  showReview,
  deleteReview,
  addReviewManually,
  bulkApproveReviews,
  bulkHideReviews,
  bulkDeleteReviews,
  type Review
} from '@/app/actions/admin-reviews'
import { getAllActiveProducts } from '@/app/actions/products'

export default function ReviewsManagementPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedReviews, setSelectedReviews] = useState<string[]>([])
  
  // Filters
  const [ratingFilter, setRatingFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<string>('recent')
  
  // Dialogs
  const [addReviewDialogOpen, setAddReviewDialogOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  
  // Add review form
  const [newReview, setNewReview] = useState({
    productId: '',
    customerName: '',
    customerEmail: '',
    rating: 5,
    title: '',
    comment: '',
    isVerifiedPurchase: false,
    isApproved: true,
  })
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    loadReviews()
    loadStats()
    loadProducts()
  }, [ratingFilter, statusFilter, searchQuery, sortBy])

  const loadReviews = async () => {
    setLoading(true)
    try {
      const filters: any = {
        sortBy: sortBy as any,
        limit: 50,
      }

      if (ratingFilter !== 'all') {
        filters.rating = parseInt(ratingFilter)
      }

      if (statusFilter === 'approved') {
        filters.isApproved = true
        filters.isHidden = false
      } else if (statusFilter === 'pending') {
        filters.isApproved = false
      } else if (statusFilter === 'hidden') {
        filters.isHidden = true
      }

      if (searchQuery) {
        filters.search = searchQuery
      }

      const result = await getReviews(filters)
      if (result.data) {
        setReviews(result.data)
      } else {
        toast.error(result.error || 'Failed to load reviews')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    const result = await getReviewStats()
    if (result.error) {
      console.error('Failed to load stats:', result.error)
    } else {
      setStats(result)
    }
  }

  const loadProducts = async () => {
    const result = await getAllActiveProducts()
    if (result.data) {
      setProducts(result.data.map((p: any) => ({ id: p.id, name: p.title, slug: p.slug })))
    }
  }

  const handleApprove = async (reviewId: string) => {
    const result = await approveReview(reviewId)
    if (result.success) {
      toast.success('Review approved')
      loadReviews()
      loadStats()
    } else {
      toast.error(result.error || 'Failed to approve review')
    }
  }

  const handleHide = async (reviewId: string) => {
    const result = await hideReview(reviewId)
    if (result.success) {
      toast.success('Review hidden')
      loadReviews()
      loadStats()
    } else {
      toast.error(result.error || 'Failed to hide review')
    }
  }

  const handleShow = async (reviewId: string) => {
    const result = await showReview(reviewId)
    if (result.success) {
      toast.success('Review shown')
      loadReviews()
      loadStats()
    } else {
      toast.error(result.error || 'Failed to show review')
    }
  }

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return
    }

    const result = await deleteReview(reviewId)
    if (result.success) {
      toast.success('Review deleted')
      loadReviews()
      loadStats()
    } else {
      toast.error(result.error || 'Failed to delete review')
    }
  }

  const handleAddReview = async () => {
    if (!newReview.productId || !newReview.customerName || !newReview.comment) {
      toast.error('Please fill in all required fields')
      return
    }

    const result = await addReviewManually({
      productId: newReview.productId,
      customerName: newReview.customerName,
      customerEmail: newReview.customerEmail || undefined,
      rating: newReview.rating,
      title: newReview.title || undefined,
      comment: newReview.comment,
      isVerifiedPurchase: newReview.isVerifiedPurchase,
      isApproved: newReview.isApproved,
    })

    if (result.success) {
      toast.success('Review added successfully')
      setAddReviewDialogOpen(false)
      setNewReview({
        productId: '',
        customerName: '',
        customerEmail: '',
        rating: 5,
        title: '',
        comment: '',
        isVerifiedPurchase: false,
        isApproved: true,
      })
      loadReviews()
      loadStats()
    } else {
      toast.error(result.error || 'Failed to add review')
    }
  }

  const handleBulkAction = async (action: 'approve' | 'hide' | 'delete' | 'show') => {
    if (selectedReviews.length === 0) {
      toast.error('Please select at least one review')
      return
    }

    const reviewIds = selectedReviews

    if (action === 'delete' && !confirm(`Are you sure you want to delete ${reviewIds.length} review(s)? This action cannot be undone.`)) {
      return
    }

    let result
    if (action === 'approve') {
      result = await bulkApproveReviews(reviewIds)
    } else if (action === 'hide') {
      result = await bulkHideReviews(reviewIds)
    } else if (action === 'show') {
      // Bulk show (unhide) reviews - use individual calls since we don't have bulkShowReviews
      try {
        const showResults = await Promise.all(reviewIds.map(id => showReview(id)))
        const allSuccess = showResults.every(r => r.success)
        result = { 
          success: allSuccess, 
          error: allSuccess ? undefined : showResults.find(r => !r.success)?.error 
        }
      } catch (error: any) {
        result = { success: false, error: error.message }
      }
    } else {
      result = await bulkDeleteReviews(reviewIds)
    }

    if (result.success) {
      toast.success(`Successfully ${action === 'approve' ? 'approved' : action === 'hide' ? 'hidden' : action === 'show' ? 'shown' : 'deleted'} ${reviewIds.length} review(s)`)
      setSelectedReviews([])
      loadReviews()
      loadStats()
    } else {
      toast.error(result.error || `Failed to ${action} reviews`)
    }
  }

  const toggleSelectReview = (reviewId: string) => {
    setSelectedReviews(prev => 
      prev.includes(reviewId)
        ? prev.filter(id => id !== reviewId)
        : [...prev, reviewId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedReviews.length === reviews.length && reviews.length > 0) {
      setSelectedReviews([])
    } else {
      setSelectedReviews(reviews.map(r => r.id))
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reviews Management</h1>
          <p className="text-gray-600 mt-1">Manage customer reviews and ratings</p>
        </div>
        <Button onClick={() => setAddReviewDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Review
        </Button>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Hidden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.hidden}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Average Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{stats.averageRating}</div>
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Bulk Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search reviews..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ratings</SelectItem>
                <SelectItem value="5">5 Stars</SelectItem>
                <SelectItem value="4">4 Stars</SelectItem>
                <SelectItem value="3">3 Stars</SelectItem>
                <SelectItem value="2">2 Stars</SelectItem>
                <SelectItem value="1">1 Star</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="highest">Highest Rating</SelectItem>
                <SelectItem value="lowest">Lowest Rating</SelectItem>
                <SelectItem value="helpful">Most Helpful</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedReviews.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-gray-600">
                {selectedReviews.length} review(s) selected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('approve')}
              >
                <Check className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('hide')}
              >
                <EyeOff className="w-4 h-4 mr-1" />
                Hide
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('show')}
              >
                <Eye className="w-4 h-4 mr-1" />
                Show
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkAction('delete')}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-2">No reviews found</p>
              <Button variant="outline" onClick={() => setAddReviewDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Review
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {/* Select All Header */}
              <div className="p-4 bg-gray-50 border-b flex items-center gap-4">
                <Checkbox
                  checked={selectedReviews.length === reviews.length && reviews.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium text-gray-700">
                  Select All ({reviews.length} reviews)
                </span>
                {selectedReviews.length > 0 && (
                  <span className="text-sm text-gray-500 ml-auto">
                    {selectedReviews.length} selected
                  </span>
                )}
              </div>
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    selectedReviews.includes(review.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedReviews.includes(review.id)}
                      onCheckedChange={() => toggleSelectReview(review.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {renderStars(review.rating)}
                            {review.is_verified_purchase && (
                              <Badge variant="outline" className="text-xs">
                                Verified Purchase
                              </Badge>
                            )}
                            {!review.is_approved && (
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                                Pending
                              </Badge>
                            )}
                            {review.is_hidden && (
                              <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700">
                                Hidden
                              </Badge>
                            )}
                          </div>
                          {review.title && (
                            <h4 className="font-semibold text-sm mb-1">{review.title}</h4>
                          )}
                          <p className="text-sm text-gray-700 mb-2">{review.comment}</p>
                          {review.review_images && review.review_images.length > 0 && (
                            <div className="flex gap-2 mb-2">
                              {review.review_images.map((img) => (
                                <div
                                  key={img.id}
                                  className="relative w-16 h-16 rounded border overflow-hidden cursor-pointer"
                                  onClick={() => {
                                    setSelectedReview(review)
                                    setViewDialogOpen(true)
                                  }}
                                >
                                  <Image
                                    src={img.image_url}
                                    alt="Review image"
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>
                              {review.user?.first_name || review.user?.last_name
                                ? `${review.user.first_name || ''} ${review.user.last_name || ''}`.trim()
                                : 'Anonymous'}
                            </span>
                            {review.product && (
                              <span className="font-medium">{review.product.title}</span>
                            )}
                            <span>{new Date(review.created_at).toLocaleDateString()}</span>
                            {review.helpful_count > 0 && (
                              <span>{review.helpful_count} helpful</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!review.is_approved && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(review.id)}
                              title="Approve"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          {review.is_hidden ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleShow(review.id)}
                              title="Show"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleHide(review.id)}
                              title="Hide"
                            >
                              <EyeOff className="w-4 h-4 text-gray-600" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(review.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Review Dialog */}
      <Dialog open={addReviewDialogOpen} onOpenChange={setAddReviewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Review Manually</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product *</Label>
              <Select
                value={newReview.productId}
                onValueChange={(value) => setNewReview({ ...newReview, productId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product: any) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name || product.title || 'Unknown Product'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Customer Name *</Label>
              <Input
                value={newReview.customerName}
                onChange={(e) => setNewReview({ ...newReview, customerName: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            <div>
              <Label>Customer Email</Label>
              <Input
                type="email"
                value={newReview.customerEmail}
                onChange={(e) => setNewReview({ ...newReview, customerEmail: e.target.value })}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <Label>Rating *</Label>
              <Select
                value={newReview.rating.toString()}
                onValueChange={(value) => setNewReview({ ...newReview, rating: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={newReview.title}
                onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                placeholder="Review title"
              />
            </div>
            <div>
              <Label>Comment *</Label>
              <Textarea
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                placeholder="Review comment"
                rows={4}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="verifiedPurchase"
                checked={newReview.isVerifiedPurchase}
                onChange={(e) => setNewReview({ ...newReview, isVerifiedPurchase: e.target.checked })}
              />
              <Label htmlFor="verifiedPurchase">Verified Purchase</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isApproved"
                checked={newReview.isApproved}
                onChange={(e) => setNewReview({ ...newReview, isApproved: e.target.checked })}
              />
              <Label htmlFor="isApproved">Approve immediately</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddReview}>Add Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Review Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {renderStars(selectedReview.rating)}
                {selectedReview.is_verified_purchase && (
                  <Badge variant="outline">Verified Purchase</Badge>
                )}
              </div>
              {selectedReview.title && (
                <h3 className="font-semibold text-lg">{selectedReview.title}</h3>
              )}
              <p className="text-gray-700">{selectedReview.comment}</p>
              {selectedReview.review_images && selectedReview.review_images.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                  {selectedReview.review_images.map((img) => (
                    <div key={img.id} className="relative aspect-square rounded border overflow-hidden">
                      <Image
                        src={img.image_url}
                        alt="Review image"
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

