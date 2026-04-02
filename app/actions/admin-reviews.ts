'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface Review {
  id: string
  product_id: string
  user_id: string | null
  rating: number
  title: string | null
  comment: string
  is_verified_purchase: boolean
  is_approved: boolean
  is_hidden: boolean
  helpful_count: number
  created_at: string
  updated_at: string
  product?: {
    id: string
    title: string
    slug: string
  }
  user?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  }
  review_images?: Array<{
    id: string
    image_url: string
  }>
}

// Get all reviews with filters
export async function getReviews(filters?: {
  productId?: string
  userId?: string
  rating?: number
  isApproved?: boolean
  isHidden?: boolean
  search?: string
  sortBy?: 'recent' | 'oldest' | 'highest' | 'lowest' | 'helpful'
  limit?: number
  offset?: number
}) {
  const supabase = createAdminSupabaseClient()

  let query = supabase
    .from('reviews')
    .select(`
      *,
      products (
        id,
        title,
        slug
      ),
      profiles (
        id,
        first_name,
        last_name,
        email
      ),
      review_images (
        id,
        image_url
      )
    `)

  if (filters?.productId) {
    query = query.eq('product_id', filters.productId)
  }

  if (filters?.userId) {
    query = query.eq('user_id', filters.userId)
  }

  if (filters?.rating) {
    query = query.eq('rating', filters.rating)
  }

  if (filters?.isApproved !== undefined) {
    query = query.eq('is_approved', filters.isApproved)
  }

  if (filters?.isHidden !== undefined) {
    query = query.eq('is_hidden', filters.isHidden)
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,comment.ilike.%${filters.search}%`)
  }

  // Apply sorting
  if (filters?.sortBy === 'recent') {
    query = query.order('created_at', { ascending: false })
  } else if (filters?.sortBy === 'oldest') {
    query = query.order('created_at', { ascending: true })
  } else if (filters?.sortBy === 'highest') {
    query = query.order('rating', { ascending: false })
  } else if (filters?.sortBy === 'lowest') {
    query = query.order('rating', { ascending: true })
  } else if (filters?.sortBy === 'helpful') {
    query = query.order('helpful_count', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching reviews:', error)
    return { data: [], error: error.message }
  }

  return { data: (data || []) as Review[], error: null }
}

// Get review statistics
export async function getReviewStats() {
  const supabase = createAdminSupabaseClient()

  const { data: allReviews, error } = await supabase
    .from('reviews')
    .select('rating, is_approved, is_hidden')

  if (error) {
    return { 
      total: 0, 
      approved: 0, 
      pending: 0, 
      hidden: 0,
      averageRating: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      error: error.message 
    }
  }

  const reviews = allReviews || []
  const total = reviews.length
  const approved = reviews.filter(r => r.is_approved && !r.is_hidden).length
  const pending = reviews.filter(r => !r.is_approved).length
  const hidden = reviews.filter(r => r.is_hidden).length
  
  const approvedReviews = reviews.filter(r => r.is_approved && !r.is_hidden)
  const averageRating = approvedReviews.length > 0
    ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length
    : 0

  const ratingDistribution = {
    5: reviews.filter(r => r.rating === 5).length,
    4: reviews.filter(r => r.rating === 4).length,
    3: reviews.filter(r => r.rating === 3).length,
    2: reviews.filter(r => r.rating === 2).length,
    1: reviews.filter(r => r.rating === 1).length,
  }

  return {
    total,
    approved,
    pending,
    hidden,
    averageRating: Math.round(averageRating * 10) / 10,
    ratingDistribution,
    error: null
  }
}

// Approve review
export async function approveReview(reviewId: string) {
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('reviews')
    .update({ 
      is_approved: true,
      is_hidden: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', reviewId)

  if (error) {
    console.error('Error approving review:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reviews')
  return { success: true }
}

// Hide review
export async function hideReview(reviewId: string) {
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('reviews')
    .update({ 
      is_hidden: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', reviewId)

  if (error) {
    console.error('Error hiding review:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reviews')
  return { success: true }
}

// Show review (unhide)
export async function showReview(reviewId: string) {
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('reviews')
    .update({ 
      is_hidden: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', reviewId)

  if (error) {
    console.error('Error showing review:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reviews')
  return { success: true }
}

// Delete review
export async function deleteReview(reviewId: string) {
  const supabase = createAdminSupabaseClient()

  // First, delete review images
  const { data: reviewImages } = await supabase
    .from('review_images')
    .select('image_url')
    .eq('review_id', reviewId)

  if (reviewImages) {
    // Delete from storage
    for (const image of reviewImages) {
      const path = image.image_url.split('/').slice(-2).join('/')
      await supabase.storage
        .from('review-images')
        .remove([path])
    }

    // Delete from database
    await supabase
      .from('review_images')
      .delete()
      .eq('review_id', reviewId)
  }

  // Delete review
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)

  if (error) {
    console.error('Error deleting review:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reviews')
  return { success: true }
}

// Manually add review
export async function addReviewManually(data: {
  productId: string
  userId?: string
  customerName: string
  customerEmail?: string
  rating: number
  title?: string
  comment: string
  isVerifiedPurchase?: boolean
  isApproved?: boolean
}) {
  const supabase = createAdminSupabaseClient()

  // If userId is provided, use it; otherwise create or find user by email
  let userId = data.userId

  if (!userId && data.customerEmail) {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', data.customerEmail)
      .single()

    if (existingUser) {
      userId = existingUser.id
    } else {
      // Create a placeholder user if email provided but user doesn't exist
      // For now, we'll allow null user_id for manually added reviews
      userId = null
    }
  }

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      product_id: data.productId,
      user_id: userId,
      rating: data.rating,
      title: data.title || null,
      comment: data.comment,
      is_verified_purchase: data.isVerifiedPurchase || false,
      is_approved: data.isApproved !== undefined ? data.isApproved : true,
      is_hidden: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding review:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reviews')
  return { success: true, data: review }
}

// Bulk actions
export async function bulkApproveReviews(reviewIds: string[]) {
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('reviews')
    .update({ 
      is_approved: true,
      is_hidden: false,
      updated_at: new Date().toISOString()
    })
    .in('id', reviewIds)

  if (error) {
    console.error('Error bulk approving reviews:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reviews')
  return { success: true }
}

export async function bulkHideReviews(reviewIds: string[]) {
  const supabase = createAdminSupabaseClient()

  const { error } = await supabase
    .from('reviews')
    .update({ 
      is_hidden: true,
      updated_at: new Date().toISOString()
    })
    .in('id', reviewIds)

  if (error) {
    console.error('Error bulk hiding reviews:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reviews')
  return { success: true }
}

export async function bulkDeleteReviews(reviewIds: string[]) {
  const supabase = createAdminSupabaseClient()

  // Delete review images first
  const { data: reviewImages } = await supabase
    .from('review_images')
    .select('review_id, image_url')
    .in('review_id', reviewIds)

  if (reviewImages) {
    for (const image of reviewImages) {
      const path = image.image_url.split('/').slice(-2).join('/')
      await supabase.storage
        .from('review-images')
        .remove([path])
    }

    await supabase
      .from('review_images')
      .delete()
      .in('review_id', reviewIds)
  }

  // Delete reviews
  const { error } = await supabase
    .from('reviews')
    .delete()
    .in('id', reviewIds)

  if (error) {
    console.error('Error bulk deleting reviews:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/admin/reviews')
  return { success: true }
}

