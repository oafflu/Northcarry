'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface ReviewData {
  productId: string
  rating: number
  title?: string
  comment: string
  images?: File[]
}

export async function submitReview(reviewData: ReviewData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { success: false, error: 'Must be logged in to submit a review' }
  }

  // Check if user already reviewed this product
  const { data: existingReview } = await supabase
    .from('reviews')
    .select('id')
    .eq('product_id', reviewData.productId)
    .eq('user_id', user.id)
    .single()

  if (existingReview) {
    return { success: false, error: 'You have already reviewed this product' }
  }

  // Check if user purchased this product (for verified purchase badge)
  // First get order IDs for this user
  const { data: userOrders } = await supabase
    .from('orders')
    .select('id')
    .eq('user_id', user.id)
  
  const orderIds = userOrders?.map(o => o.id) || []
  
  const { data: hasPurchased } = await supabase
    .from('order_items')
    .select('id')
    .eq('product_id', reviewData.productId)
    .in('order_id', orderIds)
    .limit(1)

  // Insert review
  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .insert({
      product_id: reviewData.productId,
      user_id: user.id,
      rating: reviewData.rating,
      title: reviewData.title || null,
      comment: reviewData.comment,
      is_verified_purchase: (hasPurchased?.length || 0) > 0,
      is_approved: true, // Auto-approve for now, can be changed to require admin approval
    })
    .select()
    .single()

  if (reviewError || !review) {
    console.error('Error submitting review:', reviewError)
    return { success: false, error: reviewError?.message || 'Failed to submit review' }
  }

  // Upload images if provided
  if (reviewData.images && reviewData.images.length > 0) {
    for (const image of reviewData.images) {
      const fileName = `${review.id}/${Date.now()}-${image.name}`
      const arrayBuffer = await image.arrayBuffer()
      const { data: upload, error: uploadError } = await supabase.storage
        .from('review-images')
        .upload(fileName, arrayBuffer, {
          contentType: image.type,
        })
      
      if (!uploadError && upload) {
        const { data: { publicUrl } } = supabase.storage
          .from('review-images')
          .getPublicUrl(upload.path)

        await supabase.from('review_images').insert({
          review_id: review.id,
          image_url: publicUrl,
        })
      }
    }
  }

  // Award loyalty points for review (50 points)
  if (hasPurchased && hasPurchased.length > 0) {
    // Award points via loyalty system
    const { data: member } = await supabase
      .from('loyalty_members')
      .select('id, points_balance')
      .eq('user_id', user.id)
      .single()

    if (member) {
      const newBalance = member.points_balance + 50
      await supabase
        .from('loyalty_members')
        .update({ points_balance: newBalance })
        .eq('id', member.id)

      await supabase.from('loyalty_transactions').insert({
        member_id: member.id,
        points_change: 50,
        transaction_type: 'review',
        reference_id: review.id,
        balance_after: newBalance,
        description: 'Product review',
      })
    }
  }

  revalidatePath(`/product`)
  return { success: true, reviewId: review.id }
}

export async function getProductReviews(productId: string, filters?: {
  rating?: number
  sortBy?: 'recent' | 'highest' | 'lowest' | 'helpful'
  limit?: number
  offset?: number
}) {
  if (!productId || typeof productId !== 'string' || productId.trim() === '') {
    return { data: [], error: null }
  }
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('reviews')
    .select(`
      id,
      rating,
      title,
      comment,
      is_verified_purchase,
      created_at,
      profiles (
        first_name,
        last_name
      ),
      review_images (
        image_url
      )
    `)
    .eq('product_id', productId)
    .eq('is_approved', true)
    .eq('is_hidden', false) // Only show non-hidden reviews

  if (filters?.rating) {
    query = query.eq('rating', filters.rating)
  }

  // Apply sorting
  if (filters?.sortBy === 'recent') {
    query = query.order('created_at', { ascending: false })
  } else if (filters?.sortBy === 'highest') {
    query = query.order('rating', { ascending: false })
  } else if (filters?.sortBy === 'lowest') {
    query = query.order('rating', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching reviews:', error)
    return { data: [], error: error.message }
  }

  return { data: data || [], error: null }
}

// Get all reviews across all products (for homepage)
export async function getAllReviews(filters?: {
  limit?: number
  sortBy?: 'recent' | 'highest' | 'lowest' | 'helpful'
  minRating?: number
}) {
  const supabase = await createServerSupabaseClient()

  let query = supabase
    .from('reviews')
    .select(`
      id,
      rating,
      title,
      comment,
      is_verified_purchase,
      created_at,
      helpful_count,
      user_id,
      products (
        id,
        title,
        slug
      ),
      profiles (
        first_name,
        last_name
      ),
      review_images (
        image_url
      )
    `)
    .eq('is_approved', true)
    .eq('is_hidden', false)

  if (filters?.minRating) {
    query = query.gte('rating', filters.minRating)
  }

  // Apply sorting
  if (filters?.sortBy === 'recent') {
    query = query.order('created_at', { ascending: false })
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

  const { data, error } = await query

  if (error) {
    console.error('Error fetching all reviews:', error)
    return { data: [], error: error.message }
  }

  // Log for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`[getAllReviews] Fetched ${data?.length || 0} reviews`)
  }

  return { data: data || [], error: null }
}

// Get review statistics across all products
export async function getReviewStatistics() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('reviews')
    .select('rating, helpful_count')
    .eq('is_approved', true)
    .eq('is_hidden', false)

  if (error) {
    console.error('Error fetching review statistics:', error)
    return { 
      totalReviews: 0, 
      averageRating: 0, 
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    }
  }

  if (!data || data.length === 0) {
    return { 
      totalReviews: 0, 
      averageRating: 0, 
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    }
  }

  const totalReviews = data.length
  const averageRating = data.reduce((sum, r) => sum + r.rating, 0) / totalReviews
  const ratingDistribution = {
    5: data.filter(r => r.rating === 5).length,
    4: data.filter(r => r.rating === 4).length,
    3: data.filter(r => r.rating === 3).length,
    2: data.filter(r => r.rating === 2).length,
    1: data.filter(r => r.rating === 1).length,
  }

  return { totalReviews, averageRating, ratingDistribution }
}

