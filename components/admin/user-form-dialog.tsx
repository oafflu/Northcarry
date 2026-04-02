'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createUser, updateUser } from '@/app/actions/users'
import { X } from 'lucide-react'

interface UserFormDialogProps {
  user?: any
  onClose: () => void
  onSuccess: () => void
}

export function UserFormDialog({ user, onClose, onSuccess }: UserFormDialogProps) {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    password: '',
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    role: user?.role || 'customer',
    phone: user?.phone || '',
    companyName: user?.company_name || '',
    taxId: user?.tax_id || '',
    contactPerson: user?.contact_person || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEditMode = !!user

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isEditMode) {
        // Update existing user
        const updates: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          phone: formData.phone,
        }

        // Allow email update for all roles (including admin)
        if (formData.email !== user.email) {
          updates.email = formData.email
        }

        if (formData.role === 'supplier') {
          updates.companyName = formData.companyName
          updates.taxId = formData.taxId
          updates.contactPerson = formData.contactPerson
        }

        if (formData.password) {
          updates.password = formData.password
        }

        const result = await updateUser(user.id, updates)
        if (result.success) {
          onSuccess()
        } else {
          setError(result.error || 'Failed to update user')
        }
      } else {
        // Create new user
        if (!formData.password) {
          setError('Password is required for new users')
          setLoading(false)
          return
        }

        const result = await createUser({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role as 'customer' | 'admin' | 'supplier' | 'marketer' | 'support' | 'partner',
          phone: formData.phone || undefined,
          companyName: formData.role === 'supplier' ? (formData.companyName || undefined) : undefined,
          taxId: formData.role === 'supplier' ? (formData.taxId || undefined) : undefined,
          contactPerson: formData.role === 'supplier' ? (formData.contactPerson || undefined) : undefined,
          businessAddress: undefined, // Not collected in form, can be added later
        })

        if (result.success) {
          onSuccess()
        } else {
          setError(result.error || 'Failed to create user')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            {isEditMode ? 'Edit User' : 'Create New User'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              {isEditMode && (
                <p className="text-xs text-gray-500 mt-1">You can update the email address for any user, including admins</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Password {isEditMode ? '(leave blank to keep current)' : '*'}
              </label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!isEditMode}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">First Name *</label>
              <Input
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Last Name *</label>
              <Input
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Role *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              >
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
                <option value="admin">Admin</option>
                <option value="marketer">Marketer</option>
                <option value="support">Support</option>
                <option value="partner">Partner</option>
              </select>
              {formData.role === 'marketer' && (
                <p className="text-xs text-gray-500 mt-1">
                  Marketer: Access to email marketing, customers, products, dashboard, and analytics
                </p>
              )}
              {formData.role === 'support' && (
                <p className="text-xs text-gray-500 mt-1">
                  Support: Access to orders, customers, support system, analytics, and contact messages
                </p>
              )}
              {formData.role === 'partner' && (
                <p className="text-xs text-gray-500 mt-1">
                  Partner: Access to products, orders, customers, suppliers, support, reviews, newsletter, analytics, affiliate marketing, subscriptions (analytics & list), and promos/upsells (dashboard & promo codes). No access to CMS, payments, users, email marketing, or inventory.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Supplier-specific fields */}
          {formData.role === 'supplier' && (
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold text-lg">Supplier Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Company Name</label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tax ID</label>
                  <Input
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Contact Person</label>
                  <Input
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Saving...' : isEditMode ? 'Update User' : 'Create User'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

