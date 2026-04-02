"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Star, X } from "lucide-react"
import { submitReview } from "@/app/actions/reviews"
import { toast } from "sonner"

interface ReviewFormProps {
  productId: string
  onClose: () => void
  onSubmit: () => void
}

export function ReviewForm({ productId, onClose, onSubmit }: ReviewFormProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [title, setTitle] = useState("")
  const [review, setReview] = useState("")
  const [images, setImages] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center">
          <h3 className="mb-4 text-xl font-bold">Sign in to leave a review</h3>
          <p className="mb-6 text-gray-600">You need to be signed in to write a review</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 py-2 font-medium transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => router.push("/login")}
              className="flex-1 rounded-md bg-black py-2 font-medium text-white transition-colors hover:bg-gray-800"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files).slice(0, 5 - images.length)
      setImages([...images, ...newImages])
    }
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) {
      toast.error("Please select a rating")
      return
    }

    if (!review.trim()) {
      toast.error("Please write a review")
      return
    }

    setSubmitting(true)
    try {
      const result = await submitReview({
        productId,
        rating,
        title: title.trim() || undefined,
        comment: review.trim(),
        images: images,
      })

      if (result.success) {
        toast.success("Review submitted successfully!")
        onSubmit()
      } else {
        toast.error(result.error || "Failed to submit review")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit review")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-2xl font-bold">Write a Review</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Rating *</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Review Title */}
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-medium text-gray-700">
              Review Title *
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Summarize your experience"
              className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          {/* Review Content */}
          <div>
            <label htmlFor="review" className="mb-2 block text-sm font-medium text-gray-700">
              Review *
            </label>
            <textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              required
              rows={5}
              placeholder="Share your experience with this product"
              className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
            <p className="mt-1 text-sm text-gray-500">{review.length} / 500 characters</p>
          </div>

          {/* Images */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Add Photos (Optional)</label>
            <div className="space-y-3">
              {images.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {images.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(image) || "/placeholder.svg"}
                        alt={`Preview ${index + 1}`}
                        className="h-20 w-20 rounded-md object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white transition-colors hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {images.length < 5 && (
                <label className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-gray-300 py-8 transition-colors hover:border-gray-400">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Add up to 5 photos</p>
                    <p className="text-xs text-gray-500">JPG, PNG up to 5MB each</p>
                  </div>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 py-3 font-semibold transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-black py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
