"use client"

import { useState } from 'react'
import {
  Star,
  TrendingUp,
  Gift,
  Clock,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Award
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import { usePoints, useAdjustPoints } from '@/hooks/use-points'

interface PointsRewardsSectionProps {
  userId: string
}

export function PointsRewardsSection({ userId }: PointsRewardsSectionProps) {
  const { data: pointsData, isLoading } = usePoints(userId)
  const adjustPoints = useAdjustPoints(userId)
  const [showHistory, setShowHistory] = useState(false)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const handleAdjust = async () => {
    const points = parseInt(adjustAmount)
    if (!points || !adjustReason.trim()) return

    await adjustPoints.mutateAsync({
      points,
      reason: adjustReason,
      type: 'manual_adjustment',
    })

    setShowAdjustDialog(false)
    setAdjustAmount('')
    setAdjustReason('')
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </Card>
    )
  }

  if (!pointsData) {
    return (
      <Card className="p-4">
        <div className="text-center text-sm text-muted-foreground">
          <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No points data available</p>
        </div>
      </Card>
    )
  }

  const { balance, tier, stats, history } = pointsData

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <h3 className="font-semibold text-sm">Points & Rewards</h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAdjustDialog(true)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Points Balance */}
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 rounded-lg p-4 mb-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Available Points</p>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {balance.current.toLocaleString()}
            </p>
            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>Total: {balance.total.toLocaleString()}</span>
              <span>Used: {balance.used.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Expiring Points Warning */}
        {balance.expiringSoon > 0 && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-md p-2 mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-orange-500" />
              <p className="text-xs text-orange-700 dark:text-orange-400">
                {balance.expiringSoon} points expiring in 30 days
              </p>
            </div>
          </div>
        )}

        {/* Membership Tier */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Award className={cn(
                "h-4 w-4",
                tier.current === 'platinum' ? "text-purple-500" :
                  tier.current === 'gold' ? "text-yellow-500" :
                    tier.current === 'silver' ? "text-gray-500" :
                      "text-orange-700"
              )} />
              <span className="text-sm font-medium capitalize">{tier.name} Member</span>
            </div>
            {tier.nextTier && (
              <span className="text-xs text-muted-foreground">
                {tier.pointsToNextTier} to {tier.nextTier}
              </span>
            )}
          </div>

          {/* Progress to Next Tier */}
          {tier.nextTier && (
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all"
                style={{ width: `${tier.progress}%` }}
              />
            </div>
          )}

          {/* Tier Benefits */}
          <div className="mt-2 space-y-1">
            {tier.benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Gift className="h-3 w-3" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-secondary/50 rounded-md p-2">
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-sm font-semibold">
              ฿{stats.totalSpent.toLocaleString()}
            </p>
          </div>
          <div className="bg-secondary/50 rounded-md p-2">
            <p className="text-xs text-muted-foreground">Orders</p>
            <p className="text-sm font-semibold">{stats.orderCount}</p>
          </div>
        </div>

        {/* Points History Toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setShowHistory(!showHistory)}
        >
          <span className="text-xs">Points History</span>
          {showHistory ? (
            <ChevronUp className="h-3 w-3 ml-2" />
          ) : (
            <ChevronDown className="h-3 w-3 ml-2" />
          )}
        </Button>

        {/* Points History */}
        {showHistory && history && history.length > 0 && (
          <ScrollArea className="h-48 mt-2">
            <div className="space-y-2">
              {history.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-start justify-between text-xs border-b pb-2"
                >
                  <div className="flex-1">
                    <p className="font-medium">{transaction.description}</p>
                    <p className="text-muted-foreground">
                      {formatDate(transaction.createdAt)}
                    </p>
                  </div>
                  <div className={cn(
                    "font-semibold",
                    transaction.points > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {transaction.points > 0 ? '+' : ''}{transaction.points}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* Adjust Points Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Points</DialogTitle>
            <DialogDescription>
              Manually add or deduct points for this customer
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="points">Points Amount</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjustAmount(prev => {
                    const current = parseInt(prev) || 0
                    return (current - 100).toString()
                  })}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  id="points"
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Enter points (+ or -)"
                  className="text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjustAmount(prev => {
                    const current = parseInt(prev) || 0
                    return (current + 100).toString()
                  })}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Compensation for issue"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAdjustDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={!adjustAmount || !adjustReason.trim() || adjustPoints.isPending}
            >
              {adjustPoints.isPending ? 'Adjusting...' : 'Adjust Points'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
