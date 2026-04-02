"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Lock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function ChangePasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isForced, setIsForced] = useState(false)

  useEffect(() => {
    // Check if this is a forced password change
    const force = searchParams.get('force')
    if (force === 'true') {
      setIsForced(true)
    }

    // If user is not logged in, redirect to login
    if (!user) {
      router.push('/login')
    }
  }, [user, searchParams, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setError(null)

    // Validation
    if (!isForced && !currentPassword) {
      setError('Current password is required')
      return
    }

    if (!newPassword) {
      setError('New password is required')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    // For non-forced changes, verify current password
    if (!isForced && currentPassword) {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        
        // Try to sign in with current password to verify it
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user?.email || '',
          password: currentPassword,
        })

        if (signInError) {
          setError('Current password is incorrect')
          setLoading(false)
          return
        }
      } catch (err: any) {
        console.error('Error verifying password:', err)
        setError('Failed to verify current password')
        setLoading(false)
        return
      }
    }

    setLoading(true)

    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        console.error('Error updating password:', updateError)
        setError(updateError.message || 'Failed to update password')
        setLoading(false)
      } else {
        // If this was a forced password change, clear the flag
        if (isForced) {
          try {
            const { createAdminSupabaseClient } = await import('@/lib/supabase/admin')
            const adminSupabase = createAdminSupabaseClient()
            
            // Get current user metadata
            const { data: authUser } = await adminSupabase.auth.admin.getUserById(user?.id || '')
            const currentMetadata = authUser?.user?.user_metadata || {}
            
            // Remove force_password_change flag
            await adminSupabase.auth.admin.updateUserById(user?.id || '', {
              user_metadata: {
                ...currentMetadata,
                force_password_change: false,
              }
            })
          } catch (metadataError) {
            console.error('Error clearing force password change flag:', metadataError)
            // Don't fail the password change if this fails
          }
        }

        setSuccess(true)
        toast.success('Password updated successfully')
        
        // Redirect after 2 seconds
        setTimeout(() => {
          if (isForced) {
            // Redirect to account page after forced change
            router.push('/account')
          } else {
            // Redirect back to profile
            router.push('/account/profile')
          }
        }, 2000)
      }
    } catch (error: any) {
      console.error('Error in password change:', error)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">Loading...</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 bg-gray-50 py-16">
          <div className="max-w-md mx-auto px-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Updated</h1>
              <p className="text-gray-600 mb-6">
                Your password has been successfully updated.
              </p>
              <p className="text-sm text-gray-500">Redirecting...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-16">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            {isForced && (
              <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                  <p className="text-sm text-yellow-800 font-medium">
                    You must change your temporary password before continuing.
                  </p>
                </div>
              </div>
            )}
            
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {isForced ? 'Change Your Password' : 'Change Password'}
              </h1>
              <p className="text-gray-600">
                {isForced 
                  ? 'Please set a new password for your account.'
                  : 'Update your account password to keep it secure.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isForced && (
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required={!isForced}
                    className="w-full"
                  />
                </div>
              )}

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters long</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loading ? (
                  <>
                    <Lock className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Update Password
                  </>
                )}
              </Button>

              {!isForced && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/account/profile')}
                  className="w-full"
                >
                  Cancel
                </Button>
              )}
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

