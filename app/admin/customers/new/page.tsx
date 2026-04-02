'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createUser } from '@/app/actions/users'
import { toast } from 'sonner'

export default function NewCustomerPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const result = await createUser({
        email: formData.email.trim(),
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        role: 'customer',
        phone: formData.phone.trim() || undefined,
      })

      if (result.success && result.userId) {
        toast.success('Customer created successfully')
        router.push(`/admin/customers/${result.userId}`)
        return
      }
      setError(result.error || 'Failed to create customer')
    } catch (err: any) {
      setError(err?.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Customers
      </Link>

      <h1 className="text-3xl font-bold mb-2">Create Customer</h1>
      <p className="text-gray-600 mb-6">
        Add a new customer account. They will be able to log in and manage their profile and orders.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last name *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="password">Password *</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            minLength={6}
            className="mt-1"
            placeholder="Min 6 characters"
          />
          <p className="text-xs text-gray-500 mt-1">You can send a password reset link from the customer profile if needed.</p>
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="mt-1"
          />
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/customers">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Customer'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
