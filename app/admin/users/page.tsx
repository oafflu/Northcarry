'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search, Edit, Trash2, User, Users, Shield, Building2, Mail, Headphones, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { createUser, deleteUser, getUsers } from '@/app/actions/users'
import { UserFormDialog } from '@/components/admin/user-form-dialog'

export default function UsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  // Exclude customers from users page - they have their own page at /admin/customers
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'supplier' | 'marketer' | 'support'>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)

  useEffect(() => {
    loadUsers()
  }, [filterRole])

  const loadUsers = async () => {
    setLoading(true)
    // Exclude customers - they have their own page at /admin/customers
    // Only fetch admin and supplier users
    const role = filterRole === 'all' ? undefined : filterRole
    const result = await getUsers(role, true) // Pass excludeCustomers flag
    if (result.data) {
      setUsers(result.data)
    }
    setLoading(false)
  }

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) {
      return
    }

    const result = await deleteUser(userId)
    if (result.success) {
      loadUsers()
    } else {
      alert(result.error || 'Failed to delete user')
    }
  }

  const handleCreateSuccess = () => {
    setIsDialogOpen(false)
    setSelectedUser(null)
    loadUsers()
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4" />
      case 'supplier':
        return <Building2 className="w-4 h-4" />
      case 'marketer':
        return <Mail className="w-4 h-4" />
      case 'support':
        return <Headphones className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800'
      case 'supplier':
        return 'bg-blue-100 text-blue-800'
      case 'marketer':
        return 'bg-green-100 text-green-800'
      case 'support':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const roleCounts = {
    all: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    supplier: users.filter(u => u.role === 'supplier').length,
    marketer: users.filter(u => u.role === 'marketer').length,
    support: users.filter(u => u.role === 'support').length,
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-600 mt-1">Manage suppliers and admin users (customers are managed separately)</p>
        </div>
        <Button onClick={() => {
          setSelectedUser(null)
          setIsDialogOpen(true)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold">{roleCounts.all}</p>
            </div>
            <Users className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Suppliers</p>
              <p className="text-2xl font-bold">{roleCounts.supplier}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Admins</p>
              <p className="text-2xl font-bold">{roleCounts.admin}</p>
            </div>
            <Shield className="w-8 h-8 text-purple-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Marketers</p>
              <p className="text-2xl font-bold">{roleCounts.marketer}</p>
            </div>
            <Mail className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Support</p>
              <p className="text-2xl font-bold">{roleCounts.support}</p>
            </div>
            <Headphones className="w-8 h-8 text-orange-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as any)}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Roles</option>
          <option value="supplier">Suppliers</option>
          <option value="admin">Admins</option>
          <option value="marketer">Marketers</option>
          <option value="support">Support</option>
        </select>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading users...</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">User</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Company</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Phone</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-semibold text-sm">
                          {user.first_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium">
                            {user.first_name && user.last_name
                              ? `${user.first_name} ${user.last_name}`
                              : user.email?.split('@')[0] || 'User'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getRoleColor(user.role || 'customer')}`}>
                        {getRoleIcon(user.role || 'customer')}
                        {user.role || 'customer'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {user.company_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {user.phone || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch('/api/admin/impersonate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ targetUserId: user.id }),
                              })
                              const data = await response.json()
                              
                              if (data.success && data.redirectUrl) {
                                toast.success('Switching to user account...')
                                window.location.href = data.redirectUrl
                              } else {
                                toast.error(data.error || 'Failed to impersonate user')
                              }
                            } catch (error) {
                              console.error('Error impersonating user:', error)
                              toast.error('Failed to impersonate user')
                            }
                          }}
                          title="View as this user"
                        >
                          <UserCog className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user)
                            setIsDialogOpen(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id, user.email)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit User Dialog */}
      {isDialogOpen && (
        <UserFormDialog
          user={selectedUser}
          onClose={() => {
            setIsDialogOpen(false)
            setSelectedUser(null)
          }}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  )
}

