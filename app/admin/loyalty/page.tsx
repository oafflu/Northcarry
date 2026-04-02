'use client'

import { useState, useEffect } from 'react'
import { Award, Gift, Star, Users, TrendingUp, Settings, Plus, Edit, Trash2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import {
  getLoyaltyTiers,
  createLoyaltyTier,
  updateLoyaltyTier,
  deleteLoyaltyTier,
  getLoyaltyRewards,
  createLoyaltyReward,
  updateLoyaltyReward,
  deleteLoyaltyReward,
  getLoyaltySettings,
  updateLoyaltySettings,
  getLoyaltyStats,
  getLoyaltyRecentActivity,
  recalculateLoyaltyForCustomer,
} from '@/app/actions/loyalty-admin'
import { formatDistanceToNow } from 'date-fns'

interface Tier {
  id: string
  name: string
  min_points: number
  points_multiplier: number
  benefits: string[]
  sort_order: number
}

interface Reward {
  id: string
  title: string
  description: string
  points_cost: number
  reward_type: 'discount' | 'free_shipping' | 'free_product'
  reward_value: any
  is_active: boolean
  stock_limit: number | null
  stock_remaining: number | null
}

export default function AdminLoyaltyPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Data
  const [tiers, setTiers] = useState<Tier[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  // Form states
  const [editingTier, setEditingTier] = useState<Tier | null>(null)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [showTierForm, setShowTierForm] = useState(false)
  const [showRewardForm, setShowRewardForm] = useState(false)
  const [backfillIdentifier, setBackfillIdentifier] = useState('')
  const [backfillDryRun, setBackfillDryRun] = useState(true)
  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillResult, setBackfillResult] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tiersResult, rewardsResult, settingsResult, statsResult, activityResult] = await Promise.all([
        getLoyaltyTiers(),
        getLoyaltyRewards(),
        getLoyaltySettings(),
        getLoyaltyStats(),
        getLoyaltyRecentActivity(10),
      ])

      if (tiersResult.success) setTiers(tiersResult.data)
      if (rewardsResult.success) setRewards(rewardsResult.data)
      if (settingsResult.success) setSettings(settingsResult.data)
      if (statsResult.success) setStats(statsResult.data)
      if (activityResult.success) setRecentActivity(activityResult.data)
    } catch (error: any) {
      console.error('Error loading data:', error)
      toast.error('Failed to load loyalty data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const result = await updateLoyaltySettings(settings)
      if (result.success) {
        toast.success('Settings saved successfully')
        await loadData()
      } else {
        toast.error(result.error || 'Failed to save settings')
      }
    } catch (error: any) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTier = async (tierData: Partial<Tier>) => {
    setSaving(true)
    try {
      const result = editingTier
        ? await updateLoyaltyTier(editingTier.id, tierData)
        : await createLoyaltyTier(tierData as any)

      if (result.success) {
        toast.success(editingTier ? 'Tier updated successfully' : 'Tier created successfully')
        setEditingTier(null)
        setShowTierForm(false)
        await loadData()
      } else {
        toast.error(result.error || 'Failed to save tier')
      }
    } catch (error: any) {
      toast.error('Failed to save tier')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this tier? This action cannot be undone.')) {
      return
    }

    setSaving(true)
    try {
      const result = await deleteLoyaltyTier(tierId)
      if (result.success) {
        toast.success('Tier deleted successfully')
        await loadData()
      } else {
        toast.error(result.error || 'Failed to delete tier')
      }
    } catch (error: any) {
      toast.error('Failed to delete tier')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveReward = async (rewardData: Partial<Reward>) => {
    setSaving(true)
    try {
      const result = editingReward
        ? await updateLoyaltyReward(editingReward.id, rewardData)
        : await createLoyaltyReward(rewardData as any)

      if (result.success) {
        toast.success(editingReward ? 'Reward updated successfully' : 'Reward created successfully')
        setEditingReward(null)
        setShowRewardForm(false)
        await loadData()
      } else {
        toast.error(result.error || 'Failed to save reward')
      }
    } catch (error: any) {
      toast.error('Failed to save reward')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteReward = async (rewardId: string) => {
    if (!confirm('Are you sure you want to delete this reward? This action cannot be undone.')) {
      return
    }

    setSaving(true)
    try {
      const result = await deleteLoyaltyReward(rewardId)
      if (result.success) {
        toast.success('Reward deleted successfully')
        await loadData()
      } else {
        toast.error(result.error || 'Failed to delete reward')
      }
    } catch (error: any) {
      toast.error('Failed to delete reward')
    } finally {
      setSaving(false)
    }
  }

  const handleBackfill = async () => {
    const value = backfillIdentifier.trim()
    if (!value) {
      toast.error('Enter a customer email or user ID')
      return
    }

    setBackfillRunning(true)
    setBackfillResult(null)
    try {
      const isEmail = value.includes('@')
      const result = await recalculateLoyaltyForCustomer({
        email: isEmail ? value : undefined,
        userId: isEmail ? undefined : value,
        dryRun: backfillDryRun,
      })

      if (!result.success) {
        toast.error(result.error || 'Backfill failed')
        return
      }

      setBackfillResult(result.data)
      toast.success(backfillDryRun ? 'Backfill preview ready' : 'Backfill completed')
      await loadData()
    } catch (error: any) {
      console.error('Backfill error:', error)
      toast.error(error.message || 'Backfill failed')
    } finally {
      setBackfillRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading loyalty program...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loyalty Program</h1>
          <p className="text-gray-600 mt-1">Manage customer rewards and loyalty tiers</p>
        </div>
        {settings && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="program-enabled">Program Enabled</Label>
              <Switch
                id="program-enabled"
                checked={settings.enabled === true}
                disabled={saving}
                onCheckedChange={async (checked) => {
                  const newSettings = { ...settings, enabled: checked }
                  setSettings(newSettings)
                  setSaving(true)
                  try {
                    const result = await updateLoyaltySettings({ enabled: checked })
                    if (result.success) {
                      toast.success(checked ? 'Loyalty program enabled' : 'Loyalty program disabled')
                      await loadData()
                    } else {
                      toast.error(result.error || 'Failed to update settings')
                      // Revert on error
                      setSettings(settings)
                    }
                  } catch (error: any) {
                    toast.error('Failed to update settings')
                    // Revert on error
                    setSettings(settings)
                  } finally {
                    setSaving(false)
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="point-rules">Point Rules</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recalculate Customer Loyalty</CardTitle>
              <CardDescription>
                Backfill missing purchase points from historical paid orders for one customer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
                <div>
                  <Label htmlFor="backfill-identifier">Customer Email or User ID</Label>
                  <Input
                    id="backfill-identifier"
                    value={backfillIdentifier}
                    onChange={(e) => setBackfillIdentifier(e.target.value)}
                    placeholder="customer@email.com or UUID"
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch
                    id="backfill-dry-run"
                    checked={backfillDryRun}
                    onCheckedChange={setBackfillDryRun}
                    disabled={backfillRunning}
                  />
                  <Label htmlFor="backfill-dry-run">Dry run</Label>
                </div>
                <Button onClick={handleBackfill} disabled={backfillRunning}>
                  {backfillRunning ? 'Running...' : backfillDryRun ? 'Preview Backfill' : 'Run Backfill'}
                </Button>
              </div>

              {backfillResult && (
                <div className="rounded-lg border border-gray-200 p-4 text-sm space-y-1">
                  <p><span className="font-medium">Customer:</span> {backfillResult.customerName || backfillResult.customerEmail}</p>
                  <p><span className="font-medium">Scanned paid orders:</span> {backfillResult.scannedOrders}</p>
                  <p><span className="font-medium">Missing loyalty transactions:</span> {backfillResult.missingOrders}</p>
                  <p><span className="font-medium">Points per $1:</span> {backfillResult.pointsPerDollar}</p>
                  <p><span className="font-medium">Total points in scope:</span> {backfillResult.pointsToAward}</p>
                  {!backfillResult.dryRun && (
                    <>
                      <p><span className="font-medium">Orders awarded:</span> {backfillResult.awardedOrders}</p>
                      <p><span className="font-medium">Points awarded:</span> {backfillResult.awardedPoints}</p>
                    </>
                  )}
                  {Array.isArray(backfillResult.errors) && backfillResult.errors.length > 0 && (
                    <div className="mt-2 rounded-md bg-red-50 border border-red-100 p-2">
                      <p className="font-medium text-red-700">Some orders could not be processed:</p>
                      <ul className="list-disc list-inside text-red-700">
                        {backfillResult.errors.slice(0, 5).map((err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Members</p>
                      <p className="text-2xl font-bold">{stats.totalMembers}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Points Awarded</p>
                      <p className="text-2xl font-bold">{stats.totalPointsAwarded.toLocaleString()}</p>
                    </div>
                    <Star className="h-8 w-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Rewards Redeemed</p>
                      <p className="text-2xl font-bold">{stats.totalRedemptions}</p>
                    </div>
                    <Gift className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Active Rewards</p>
                      <p className="text-2xl font-bold">{rewards.filter((r) => r.is_active).length}</p>
                    </div>
                    <Award className="h-8 w-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tiers Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Loyalty Tiers</CardTitle>
                <CardDescription>Current tier structure</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tiers.length === 0 ? (
                    <p className="text-sm text-gray-500">No tiers configured</p>
                  ) : (
                    tiers.map((tier) => (
                      <div key={tier.id} className="rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold">{tier.name}</h4>
                            <p className="text-sm text-gray-600">
                              {tier.min_points} points • {tier.points_multiplier}x multiplier
                            </p>
                            {stats?.tierCounts && (
                              <p className="text-xs text-gray-500 mt-1">
                                {stats.tierCounts[tier.name] || 0} members
                              </p>
                            )}
                          </div>
                          <Award className="h-8 w-8 text-yellow-500" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest loyalty program activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-gray-500">No recent activity</p>
                  ) : (
                    recentActivity.map((activity: any) => {
                      const member = activity.loyalty_members
                      const profile = member?.profiles
                      const customerName = profile
                        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
                        : 'Unknown'

                      return (
                        <div key={activity.id} className="flex items-start gap-4 border-b border-gray-100 pb-4 last:border-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Star className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{customerName}</p>
                            <p className="text-sm text-gray-600">
                              {activity.points_change > 0 ? 'Earned' : 'Redeemed'} {Math.abs(activity.points_change)} points
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              activity.points_change > 0
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {activity.points_change > 0 ? '+' : ''}
                            {activity.points_change}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tiers Tab */}
        <TabsContent value="tiers" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Loyalty Tiers</h2>
              <p className="text-gray-600 mt-1">Configure membership tiers and benefits</p>
            </div>
            <Button
              onClick={() => {
                setEditingTier(null)
                setShowTierForm(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tier
            </Button>
          </div>

          {showTierForm && (
            <TierForm
              tier={editingTier}
              onSave={handleSaveTier}
              onCancel={() => {
                setShowTierForm(false)
                setEditingTier(null)
              }}
              saving={saving}
            />
          )}

          <div className="grid gap-4">
            {tiers.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                memberCount={stats?.tierCounts?.[tier.name] || 0}
                onEdit={() => {
                  setEditingTier(tier)
                  setShowTierForm(true)
                }}
                onDelete={() => handleDeleteTier(tier.id)}
                saving={saving}
              />
            ))}
          </div>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Rewards Catalog</h2>
              <p className="text-gray-600 mt-1">Manage available rewards for redemption</p>
            </div>
            <Button
              onClick={() => {
                setEditingReward(null)
                setShowRewardForm(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Reward
            </Button>
          </div>

          {showRewardForm && (
            <RewardForm
              reward={editingReward}
              onSave={handleSaveReward}
              onCancel={() => {
                setShowRewardForm(false)
                setEditingReward(null)
              }}
              saving={saving}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                onEdit={() => {
                  setEditingReward(reward)
                  setShowRewardForm(true)
                }}
                onDelete={() => handleDeleteReward(reward.id)}
                saving={saving}
              />
            ))}
          </div>
        </TabsContent>

        {/* Point Rules Tab */}
        <TabsContent value="point-rules" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Point Earning Rules</h2>
            <p className="text-gray-600 mt-1">Configure how customers earn loyalty points</p>
          </div>

          {settings && (
            <Card>
              <CardHeader>
                <CardTitle>Earning Rules</CardTitle>
                <CardDescription>Set points awarded for different actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Purchase Points */}
                <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Purchase Points</Label>
                      <p className="text-sm text-gray-600">Points earned per dollar spent</p>
                    </div>
                    <Switch
                      checked={settings.point_rules?.purchase?.enabled !== false}
                      onCheckedChange={(checked) => {
                        setSettings({
                          ...settings,
                          point_rules: {
                            ...settings.point_rules,
                            purchase: { ...settings.point_rules?.purchase, enabled: checked },
                          },
                        })
                      }}
                    />
                  </div>
                  {settings.point_rules?.purchase?.enabled !== false && (
                    <div className="space-y-2">
                      <Label>Points per Dollar</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={settings.point_rules?.purchase?.points_per_dollar || 1}
                        onChange={(e) => {
                          setSettings({
                            ...settings,
                            point_rules: {
                              ...settings.point_rules,
                              purchase: {
                                ...settings.point_rules?.purchase,
                                points_per_dollar: parseFloat(e.target.value) || 1,
                              },
                            },
                          })
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Review Points */}
                <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Review Points</Label>
                      <p className="text-sm text-gray-600">Points for submitting a product review</p>
                    </div>
                    <Switch
                      checked={settings.point_rules?.review?.enabled !== false}
                      onCheckedChange={(checked) => {
                        setSettings({
                          ...settings,
                          point_rules: {
                            ...settings.point_rules,
                            review: { ...settings.point_rules?.review, enabled: checked },
                          },
                        })
                      }}
                    />
                  </div>
                  {settings.point_rules?.review?.enabled !== false && (
                    <div className="space-y-2">
                      <Label>Points Awarded</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settings.point_rules?.review?.points || 50}
                        onChange={(e) => {
                          setSettings({
                            ...settings,
                            point_rules: {
                              ...settings.point_rules,
                              review: {
                                ...settings.point_rules?.review,
                                points: parseInt(e.target.value) || 50,
                              },
                            },
                          })
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Referral Points */}
                <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Referral Points</Label>
                      <p className="text-sm text-gray-600">Points for referring a friend</p>
                    </div>
                    <Switch
                      checked={settings.point_rules?.referral?.enabled !== false}
                      onCheckedChange={(checked) => {
                        setSettings({
                          ...settings,
                          point_rules: {
                            ...settings.point_rules,
                            referral: { ...settings.point_rules?.referral, enabled: checked },
                          },
                        })
                      }}
                    />
                  </div>
                  {settings.point_rules?.referral?.enabled !== false && (
                    <div className="space-y-2">
                      <Label>Points Awarded</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settings.point_rules?.referral?.points || 200}
                        onChange={(e) => {
                          setSettings({
                            ...settings,
                            point_rules: {
                              ...settings.point_rules,
                              referral: {
                                ...settings.point_rules?.referral,
                                points: parseInt(e.target.value) || 200,
                              },
                            },
                          })
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Birthday Points */}
                <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Birthday Bonus</Label>
                      <p className="text-sm text-gray-600">Points awarded on customer birthday</p>
                    </div>
                    <Switch
                      checked={settings.point_rules?.birthday?.enabled !== false}
                      onCheckedChange={(checked) => {
                        setSettings({
                          ...settings,
                          point_rules: {
                            ...settings.point_rules,
                            birthday: { ...settings.point_rules?.birthday, enabled: checked },
                          },
                        })
                      }}
                    />
                  </div>
                  {settings.point_rules?.birthday?.enabled !== false && (
                    <div className="space-y-2">
                      <Label>Points Awarded</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settings.point_rules?.birthday?.points || 100}
                        onChange={(e) => {
                          setSettings({
                            ...settings,
                            point_rules: {
                              ...settings.point_rules,
                              birthday: {
                                ...settings.point_rules?.birthday,
                                points: parseInt(e.target.value) || 100,
                              },
                            },
                          })
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Rules'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Loyalty Program Settings</h2>
            <p className="text-gray-600 mt-1">Configure program visibility and behavior</p>
          </div>

          {settings && (
            <Card>
              <CardHeader>
                <CardTitle>Program Settings</CardTitle>
                <CardDescription>Control program availability and customer visibility</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Enable Loyalty Program</Label>
                    <p className="text-sm text-gray-600">
                      When disabled, customers cannot earn or redeem points
                    </p>
                  </div>
                  <Switch
                    checked={settings.enabled === true}
                    disabled={saving}
                    onCheckedChange={(checked) => {
                      setSettings({ ...settings, enabled: checked })
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Show in Customer Account</Label>
                    <p className="text-sm text-gray-600">
                      Show "Rewards" link in customer account sidebar
                    </p>
                  </div>
                  <Switch
                    checked={settings.show_in_account === true}
                    disabled={saving}
                    onCheckedChange={(checked) => {
                      setSettings({ ...settings, show_in_account: checked })
                    }}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveSettings} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Tier Card Component
function TierCard({
  tier,
  memberCount,
  onEdit,
  onDelete,
  saving,
}: {
  tier: Tier
  memberCount: number
  onEdit: () => void
  onDelete: () => void
  saving: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Award className="h-8 w-8 text-yellow-500" />
              <div>
                <h3 className="text-xl font-bold">{tier.name}</h3>
                <p className="text-sm text-gray-600">
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Minimum Points:</span> {tier.min_points}
              </p>
              <p>
                <span className="font-medium">Points Multiplier:</span> {tier.points_multiplier}x
              </p>
              {tier.benefits && tier.benefits.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium mb-1">Benefits:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600">
                    {tier.benefits.map((benefit, idx) => (
                      <li key={idx}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={onEdit} disabled={saving}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onDelete} disabled={saving}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Reward Card Component
function RewardCard({
  reward,
  onEdit,
  onDelete,
  saving,
}: {
  reward: Reward
  onEdit: () => void
  onDelete: () => void
  saving: boolean
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-6 w-6 text-primary" />
              <h3 className="text-lg font-bold">{reward.title}</h3>
              {!reward.is_active && (
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                  Inactive
                </span>
              )}
            </div>
            {reward.description && (
              <p className="text-sm text-gray-600 mb-2">{reward.description}</p>
            )}
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Cost:</span> {reward.points_cost} points
              </p>
              <p>
                <span className="font-medium">Type:</span>{' '}
                {reward.reward_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </p>
              {reward.stock_limit !== null && (
                <p>
                  <span className="font-medium">Stock:</span> {reward.stock_remaining || 0} / {reward.stock_limit}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={onEdit} disabled={saving}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onDelete} disabled={saving}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Tier Form Component
function TierForm({
  tier,
  onSave,
  onCancel,
  saving,
}: {
  tier: Tier | null
  onSave: (data: Partial<Tier>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [formData, setFormData] = useState({
    name: tier?.name || '',
    min_points: tier?.min_points || 0,
    points_multiplier: tier?.points_multiplier || 1,
    benefits: tier?.benefits?.join('\n') || '',
    sort_order: tier?.sort_order || 0,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      benefits: formData.benefits.split('\n').filter((b) => b.trim()),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tier ? 'Edit Tier' : 'Create New Tier'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tier-name">Tier Name</Label>
            <Input
              id="tier-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Bronze, Silver, Gold"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="min-points">Minimum Points</Label>
              <Input
                id="min-points"
                type="number"
                min="0"
                value={formData.min_points}
                onChange={(e) => setFormData({ ...formData, min_points: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Label htmlFor="multiplier">Points Multiplier</Label>
              <Input
                id="multiplier"
                type="number"
                min="0"
                step="0.1"
                value={formData.points_multiplier}
                onChange={(e) =>
                  setFormData({ ...formData, points_multiplier: parseFloat(e.target.value) || 1 })
                }
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="benefits">Benefits (one per line)</Label>
            <Textarea
              id="benefits"
              value={formData.benefits}
              onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
              placeholder="1 point per $1&#10;Birthday reward&#10;Early sale access"
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="sort-order">Sort Order</Label>
            <Input
              id="sort-order"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Tier'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// Reward Form Component
function RewardForm({
  reward,
  onSave,
  onCancel,
  saving,
}: {
  reward: Reward | null
  onSave: (data: Partial<Reward>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [formData, setFormData] = useState({
    title: reward?.title || '',
    description: reward?.description || '',
    points_cost: reward?.points_cost || 0,
    reward_type: reward?.reward_type || 'discount',
    reward_value: reward?.reward_value || {},
    is_active: reward?.is_active !== false,
    stock_limit: reward?.stock_limit || null,
    stock_remaining: reward?.stock_remaining ?? reward?.stock_limit ?? null,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Build reward_value based on type
    let rewardValue: any = {}
    if (formData.reward_type === 'discount') {
      rewardValue = { amount: parseFloat((document.getElementById('discount-amount') as HTMLInputElement)?.value || '0') }
    } else if (formData.reward_type === 'free_product') {
      rewardValue = { product_id: (document.getElementById('product-id') as HTMLInputElement)?.value || '' }
    }

    onSave({
      ...formData,
      reward_value: rewardValue,
      stock_limit: formData.stock_limit ? parseInt(String(formData.stock_limit)) : null,
      stock_remaining: formData.stock_remaining ? parseInt(String(formData.stock_remaining)) : null,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{reward ? 'Edit Reward' : 'Create New Reward'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="reward-title">Reward Title</Label>
            <Input
              id="reward-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., $5 Off, Free Shipping"
              required
            />
          </div>
          <div>
            <Label htmlFor="reward-description">Description</Label>
            <Textarea
              id="reward-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this reward offers"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="points-cost">Points Cost</Label>
              <Input
                id="points-cost"
                type="number"
                min="0"
                value={formData.points_cost}
                onChange={(e) => setFormData({ ...formData, points_cost: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Label htmlFor="reward-type">Reward Type</Label>
              <Select
                value={formData.reward_type}
                onValueChange={(value: any) => setFormData({ ...formData, reward_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="free_shipping">Free Shipping</SelectItem>
                  <SelectItem value="free_product">Free Product</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reward Type Specific Fields */}
          {formData.reward_type === 'discount' && (
            <div>
              <Label htmlFor="discount-amount">Discount Amount ($)</Label>
              <Input
                id="discount-amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={formData.reward_value?.amount || 0}
                placeholder="5.00"
              />
            </div>
          )}

          {formData.reward_type === 'free_product' && (
            <div>
              <Label htmlFor="product-id">Product ID</Label>
              <Input
                id="product-id"
                defaultValue={formData.reward_value?.product_id || ''}
                placeholder="Enter product UUID"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is-active">Active</Label>
              <p className="text-sm text-gray-600">Make this reward available for redemption</p>
            </div>
            <Switch
              id="is-active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="stock-limit">Stock Limit (optional)</Label>
              <Input
                id="stock-limit"
                type="number"
                min="0"
                value={formData.stock_limit || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stock_limit: e.target.value ? parseInt(e.target.value) : null,
                    stock_remaining: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Leave empty for unlimited"
              />
            </div>
            {formData.stock_limit && (
              <div>
                <Label htmlFor="stock-remaining">Stock Remaining</Label>
                <Input
                  id="stock-remaining"
                  type="number"
                  min="0"
                  value={formData.stock_remaining || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, stock_remaining: e.target.value ? parseInt(e.target.value) : null })
                  }
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Reward'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
