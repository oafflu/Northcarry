'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { getCountries, getSetting, saveSetting } from '@/app/actions/settings'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  parseTaxExemptions,
  type TaxExemptionEntry,
  TAX_EXEMPTIONS_SETTING_KEY,
} from '@/lib/tax'
import { US_STATE_OPTIONS } from '@/lib/us-states'

const SETTING_CATEGORY = 'taxes'

export default function TaxesSettingsPage() {
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([])
  const [exemptions, setExemptions] = useState<TaxExemptionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formCountry, setFormCountry] = useState('')
  /** Empty string = entire country; otherwise US state code */
  const [formStateScope, setFormStateScope] = useState<'all' | string>('all')
  const [formActive, setFormActive] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [countriesRes, settingRes] = await Promise.all([
      getCountries(),
      getSetting(TAX_EXEMPTIONS_SETTING_KEY),
    ])
    if (countriesRes.data?.length) {
      setCountries(
        countriesRes.data.map((c: { code: string; name: string }) => ({
          code: c.code,
          name: c.name,
        }))
      )
    }
    setExemptions(parseTaxExemptions(settingRes.data))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const persist = async (next: TaxExemptionEntry[]) => {
    setSaving(true)
    const result = await saveSetting(
      TAX_EXEMPTIONS_SETTING_KEY,
      { exemptions: next },
      SETTING_CATEGORY,
      'Tax-exempt shipping regions (checkout uses shipping address country/state)'
    )
    setSaving(false)
    if (result.success) {
      setExemptions(next)
      toast.success('Tax settings saved')
      setDialogOpen(false)
      setEditingId(null)
    } else {
      toast.error(result.error || 'Failed to save')
    }
  }

  const openAdd = () => {
    setEditingId(null)
    const defaultCode = countries[0]?.code || 'US'
    setFormCountry(defaultCode)
    setFormStateScope(defaultCode === 'US' ? 'all' : 'all')
    setFormActive(true)
    setDialogOpen(true)
  }

  const openEdit = (row: TaxExemptionEntry) => {
    setEditingId(row.id)
    setFormCountry(row.countryCode)
    if (row.countryCode === 'US' && row.stateCode) {
      setFormStateScope(row.stateCode)
    } else {
      setFormStateScope('all')
    }
    setFormActive(row.active)
    setDialogOpen(true)
  }

  const handleSaveRow = () => {
    const code = formCountry.trim().toUpperCase()
    if (!code) {
      toast.error('Select a country')
      return
    }
    let stateCode: string | null = null
    if (code === 'US' && formStateScope !== 'all') {
      stateCode = formStateScope.toUpperCase()
    }

    const row: TaxExemptionEntry = {
      id: editingId || crypto.randomUUID(),
      countryCode: code,
      stateCode,
      active: formActive,
    }

    let next: TaxExemptionEntry[]
    if (editingId) {
      next = exemptions.map((e) => (e.id === editingId ? row : e))
    } else {
      const dup = exemptions.some(
        (e) =>
          e.countryCode === row.countryCode &&
          (e.stateCode || null) === (row.stateCode || null)
      )
      if (dup) {
        toast.error('A rule for this country and state already exists')
        return
      }
      next = [...exemptions, row]
    }
    if (editingId) {
      const dupOther = next.some(
        (e) =>
          e.id !== editingId &&
          e.countryCode === row.countryCode &&
          (e.stateCode || null) === (row.stateCode || null)
      )
      if (dupOther) {
        toast.error('A rule for this country and state already exists')
        return
      }
    }
    persist(next)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Remove this tax exemption rule?')) return
    persist(exemptions.filter((e) => e.id !== id))
  }

  const toggleActive = (row: TaxExemptionEntry) => {
    persist(
      exemptions.map((e) => (e.id === row.id ? { ...e, active: !e.active } : e))
    )
  }

  const regionLabel = (e: TaxExemptionEntry) => {
    if (!e.stateCode) {
      return 'Entire country'
    }
    if (e.countryCode === 'US') {
      const st = US_STATE_OPTIONS.find((s) => s.code === e.stateCode)
      return st ? `${st.code} — ${st.name}` : e.stateCode
    }
    return e.stateCode
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Taxes</h1>
        <p className="text-gray-600 mt-1">
          Define regions where customers are not charged sales tax at checkout. Matching uses the
          customer&apos;s <strong>shipping address</strong> (country and, for the United States,
          state). The standard rate elsewhere is 8% on the discounted merchandise subtotal.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Tax-exempt regions</CardTitle>
            <CardDescription>
              Only <strong>active</strong> rules apply. Inactive rules are kept for reference.
            </CardDescription>
          </div>
          <Button onClick={openAdd} disabled={loading || countries.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            Add exemption
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : exemptions.length === 0 ? (
            <p className="text-sm text-gray-500">
              No exemptions yet. Add a country (or US state) to skip tax for those shipments.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exemptions.map((e) => {
                  const cname = countries.find((c) => c.code === e.countryCode)?.name
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.countryCode}
                        {cname ? ` — ${cname}` : ''}
                      </TableCell>
                      <TableCell>{regionLabel(e)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={e.active}
                          onCheckedChange={() => toggleActive(e)}
                          disabled={saving}
                        />
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(e)}
                          disabled={saving}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(e.id)}
                          disabled={saving}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit exemption' : 'Add exemption'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={formCountry} onValueChange={setFormCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formCountry.toUpperCase() === 'US' && (
              <div className="space-y-2">
                <Label>United States scope</Label>
                <Select
                  value={formStateScope}
                  onValueChange={setFormStateScope}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Entire country (all states)</SelectItem>
                    {US_STATE_OPTIONS.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code} — {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-gray-500">When off, checkout still charges tax here.</p>
              </div>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} type="button">
              Cancel
            </Button>
            <Button onClick={handleSaveRow} disabled={saving} type="button">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
