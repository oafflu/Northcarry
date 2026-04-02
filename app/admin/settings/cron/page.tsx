'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Play, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { runCronJob } from '@/app/actions/cron'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function CronJobsSettingsPage() {
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<{
    success: boolean
    message: string
    processed?: number
    errors?: string[]
    timestamp: Date
  } | null>(null)

  const handleRunSubscriptionOrders = async () => {
    setRunning(true)
    try {
      const result = await runCronJob('subscription-orders')
      
      if (result.success) {
        setLastRun({
          success: true,
          message: result.message || 'Cron job completed successfully',
          processed: result.processed,
          errors: result.errors,
          timestamp: new Date(),
        })
        toast.success(result.message || 'Cron job completed successfully')
      } else {
        setLastRun({
          success: false,
          message: result.error || 'Cron job failed',
          timestamp: new Date(),
        })
        toast.error(result.error || 'Cron job failed')
      }
    } catch (error: any) {
      setLastRun({
        success: false,
        message: error.message || 'An unexpected error occurred',
        timestamp: new Date(),
      })
      toast.error(error.message || 'An unexpected error occurred')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Cron Jobs</h1>
        <p className="text-gray-600 mt-2">
          Manually trigger scheduled tasks and view execution history
        </p>
      </div>

      <div className="space-y-6">
        {/* Subscription Orders Cron Job */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Subscription Orders
                </CardTitle>
                <CardDescription className="mt-2">
                  Creates orders for subscription cycles that are due for shipment.
                  This job runs automatically daily at 2:00 AM UTC via Vercel Cron.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">What this job does:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Finds active subscriptions with <code className="bg-white px-1 rounded">next_shipment_date &lt;= today</code></li>
                <li>Creates orders for each subscription cycle</li>
                <li>Assigns orders to suppliers automatically</li>
                <li>Updates subscription dates for the next cycle</li>
                <li>Decrements prepaid cycles remaining (for prepaid subscriptions)</li>
                <li>Marks subscriptions as completed when cycles are exhausted</li>
              </ul>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={handleRunSubscriptionOrders}
                disabled={running}
                className="flex items-center gap-2"
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Now
                  </>
                )}
              </Button>
              
              {lastRun && (
                <div className="flex items-center gap-2 text-sm">
                  {lastRun.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-gray-600">
                    Last run: {lastRun.timestamp.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {lastRun && (
              <Alert className={lastRun.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-semibold">
                      {lastRun.success ? '✓ Success' : '✗ Failed'}
                    </div>
                    <div>{lastRun.message}</div>
                    {lastRun.processed !== undefined && (
                      <div className="text-sm">
                        Processed: <strong>{lastRun.processed}</strong> subscription(s)
                      </div>
                    )}
                    {lastRun.errors && lastRun.errors.length > 0 && (
                      <div className="mt-2">
                        <div className="font-semibold text-sm mb-1">Errors:</div>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {lastRun.errors.map((error, index) => (
                            <li key={index} className="text-red-700">{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-gray-500 pt-4 border-t">
              <p><strong>Schedule:</strong> Daily at 2:00 AM UTC (configured in <code className="bg-gray-100 px-1 rounded">vercel.json</code>)</p>
              <p className="mt-1"><strong>Endpoint:</strong> <code className="bg-gray-100 px-1 rounded">/api/cron/subscription-orders</code></p>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">About Cron Jobs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p>
              Cron jobs are automated tasks that run on a schedule. This interface allows you to manually trigger them for testing or immediate execution.
            </p>
            <p>
              <strong>Note:</strong> Manual execution uses the same logic as scheduled runs, but results may vary if run outside the normal schedule.
            </p>
            <p>
              For production, cron jobs are automatically managed by Vercel and run according to the schedule defined in <code className="bg-blue-100 px-1 rounded">vercel.json</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

