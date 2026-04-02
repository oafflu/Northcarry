'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { getLanguages, saveLanguage, deleteLanguage } from '@/app/actions/settings'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export default function LanguagesSettingsPage() {
  const [languages, setLanguages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLanguage, setEditingLanguage] = useState<any>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    native_name: '',
    is_active: true,
    is_default: false,
    sort_order: 0,
  })

  useEffect(() => {
    loadLanguages()
  }, [])

  const loadLanguages = async () => {
    setLoading(true)
    const result = await getLanguages()
    if (result.data) {
      setLanguages(result.data)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    const result = await saveLanguage({
      ...formData,
      id: editingLanguage?.id,
    })
    if (result.success) {
      toast.success(editingLanguage ? 'Language updated!' : 'Language added!')
      setIsDialogOpen(false)
      setEditingLanguage(null)
      loadLanguages()
    } else {
      toast.error(result.error || 'Failed to save language')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this language?')) return
    const result = await deleteLanguage(id)
    if (result.success) {
      toast.success('Language deleted!')
      loadLanguages()
    } else {
      toast.error(result.error || 'Failed to delete language')
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Languages</h1>
          <p className="text-gray-600 mt-1">Manage available languages for your store</p>
        </div>
        <Button onClick={() => {
          setEditingLanguage(null)
          setFormData({
            code: '',
            name: '',
            native_name: '',
            is_active: true,
            is_default: false,
            sort_order: 0,
          })
          setIsDialogOpen(true)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Language
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Native Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading languages...</TableCell>
                </TableRow>
              ) : languages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">No languages found</TableCell>
                </TableRow>
              ) : (
                languages.map((language) => (
                  <TableRow key={language.id}>
                    <TableCell className="font-mono">{language.code}</TableCell>
                    <TableCell>{language.name}</TableCell>
                    <TableCell>{language.native_name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${language.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {language.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {language.is_default && <span className="text-teal-600 font-medium">Default</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingLanguage(language)
                          setFormData(language)
                          setIsDialogOpen(true)
                        }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(language.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLanguage ? 'Edit Language' : 'Add Language'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Language Code (ISO 639-1)</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase() })}
                placeholder="en"
                maxLength={2}
                disabled={!!editingLanguage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Language Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="English"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="native_name">Native Name</Label>
              <Input
                id="native_name"
                value={formData.native_name}
                onChange={(e) => setFormData({ ...formData, native_name: e.target.value })}
                placeholder="English"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_default">Default Language</Label>
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

