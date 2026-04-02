"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Star, Gift, Award, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  getLoyaltyMember,
  getAvailableRewards,
  getLoyaltyTransactions,
  getNextTier,
  redeemReward,
  getPointRules,
  isLoyaltyProgramEnabled,
} from "@/app/actions/loyalty"
import { formatDistanceToNow } from "date-fns"

export default function CustomerLoyaltyPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState<any>(null)
  const [rewards, setRewards] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [nextTier, setNextTier] = useState<any>(null)
  const [pointRules, setPointRules] = useState<any>(null)
  const [programEnabled, setProgramEnabled] = useState(false)
  const [redeeming, setRedeeming] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadLoyaltyData()
    }
  }, [user])

  const loadLoyaltyData = async () => {
    setLoading(true)
    try {
      // Check if program is enabled
      const status = await isLoyaltyProgramEnabled()
      setProgramEnabled(status.enabled)

      if (!status.enabled) {
        setLoading(false)
        return
      }

      // Load all data in parallel
      const [memberData, rewardsData, transactionsData, rulesData] = await Promise.all([
        user ? getLoyaltyMember(user.id) : Promise.resolve(null),
        getAvailableRewards(),
        user ? (async () => {
          const member = await getLoyaltyMember(user.id)
          return member ? getLoyaltyTransactions(member.id) : Promise.resolve({ data: [] })
        })() : Promise.resolve({ data: [] }),
        getPointRules(),
      ])

      setMember(memberData)
      if (rewardsData.success) {
        setRewards(rewardsData.data)
      }
      if (transactionsData.data) {
        setTransactions(transactionsData.data)
      }
      setPointRules(rulesData)

      // Get next tier
      if (memberData) {
        const next = await getNextTier(memberData.points_balance)
        setNextTier(next)
      }
    } catch (error: any) {
      console.error('Error loading loyalty data:', error)
      toast.error('Failed to load loyalty data')
    } finally {
      setLoading(false)
    }
  }

  const handleRedeem = async (rewardId: string) => {
    if (!member) {
      toast.error('You must be logged in to redeem rewards')
      return
    }

    setRedeeming(rewardId)
    try {
      const result = await redeemReward(member.id, rewardId)
      if (result.success) {
        toast.success(`Reward redeemed! Code: ${result.redemptionCode}`)
        await loadLoyaltyData()
      } else {
        toast.error(result.error || 'Failed to redeem reward')
      }
    } catch (error: any) {
      toast.error('Failed to redeem reward')
    } finally {
      setRedeeming(null)
    }
  }

  if (loading) {
    return (
      <div className="lg:col-span-2 flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading rewards...</p>
        </div>
      </div>
    )
  }

  if (!programEnabled) {
    return (
      <div className="lg:col-span-2 text-center py-12">
        <Gift className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Loyalty Program Unavailable</h2>
        <p className="text-gray-600">The loyalty program is currently disabled.</p>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="lg:col-span-2 text-center py-12">
        <Gift className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Join the Loyalty Program</h2>
        <p className="text-gray-600 mb-4">Make your first purchase to start earning points!</p>
      </div>
    )
  }

  const userPoints = member.points_balance || 0
  const currentTier = member.loyalty_tiers
  const tierProgress = nextTier
    ? Math.min(100, Math.round(((userPoints - (currentTier?.min_points || 0)) / (nextTier.min_points - (currentTier?.min_points || 1))) * 100))
    : 100
  const pointsToNextTier = nextTier ? nextTier.min_points - userPoints : 0

  return (
    <div className="lg:col-span-2">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Rewards & Loyalty</h1>
        <p className="mt-1 text-gray-600">Earn points and unlock exclusive rewards</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Points Summary */}
        <div className="lg:col-span-1">
          <div className="rounded-lg bg-gradient-to-br from-primary to-primary/70 p-8 text-white shadow-lg">
            <div className="mb-6">
              <p className="mb-2 text-sm opacity-90">Your Points Balance</p>
              <p className="text-5xl font-bold">{userPoints.toLocaleString()}</p>
            </div>
            {nextTier && pointsToNextTier > 0 && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Progress to {nextTier.name}</span>
                  <span>{tierProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/20">
                  <div className="h-2 rounded-full bg-white" style={{ width: `${tierProgress}%` }} />
                </div>
                <p className="mt-2 text-xs opacity-90">
                  {pointsToNextTier} more points to reach {nextTier.name}
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg bg-white/10 p-3">
              <Award className="h-5 w-5" />
              <span className="text-sm font-medium">{currentTier?.name || 'Bronze'} Member</span>
            </div>
          </div>

          {/* Ways to Earn */}
          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-bold">Ways to Earn Points</h3>
            <div className="space-y-3 text-sm">
              {pointRules?.purchase?.enabled !== false && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Make a purchase</span>
                  <span className="font-medium">{pointRules?.purchase?.points_per_dollar || 1}pt/$1</span>
                </div>
              )}
              {pointRules?.review?.enabled !== false && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Write a review</span>
                  <span className="font-medium">{pointRules?.review?.points || 50}pts</span>
                </div>
              )}
              {pointRules?.referral?.enabled !== false && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Refer a friend</span>
                  <span className="font-medium">{pointRules?.referral?.points || 200}pts</span>
                </div>
              )}
              {pointRules?.birthday?.enabled !== false && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Birthday bonus</span>
                  <span className="font-medium">{pointRules?.birthday?.points || 100}pts</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rewards & History */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {/* Available Rewards */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-xl font-bold">Available Rewards</h2>
              {rewards.length === 0 ? (
                <p className="text-gray-600">No rewards available at this time.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {rewards.map((reward) => {
                    const canRedeem = userPoints >= reward.points_cost
                    const outOfStock = reward.stock_limit !== null && (reward.stock_remaining || 0) <= 0

                    return (
                      <div
                        key={reward.id}
                        className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-primary"
                      >
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <Gift className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="mb-1 font-bold">{reward.title}</h3>
                        <p className="mb-3 text-sm text-gray-600">{reward.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-sm font-medium text-primary">
                            <Star className="h-4 w-4" />
                            {reward.points_cost} points
                          </span>
                          <Button
                            disabled={!canRedeem || outOfStock || redeeming === reward.id}
                            onClick={() => handleRedeem(reward.id)}
                            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:bg-gray-300"
                          >
                            {redeeming === reward.id
                              ? 'Redeeming...'
                              : outOfStock
                              ? 'Out of Stock'
                              : canRedeem
                              ? 'Redeem'
                              : 'Locked'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Points History */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-6 text-xl font-bold">Points History</h2>
              {transactions.length === 0 ? (
                <p className="text-gray-600">No transaction history yet.</p>
              ) : (
                <div className="space-y-4">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <TrendingUp className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium capitalize">{transaction.transaction_type.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-gray-600">
                            {formatDistanceToNow(new Date(transaction.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-semibold ${
                          transaction.points_change > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {transaction.points_change > 0 ? "+" : ""}
                        {transaction.points_change}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
