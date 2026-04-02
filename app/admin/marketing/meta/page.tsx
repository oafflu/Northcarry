"use client"

import { useState } from "react"
import { Facebook, Link2, BarChart3, Settings, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function MetaMarketingPage() {
  const [connecting, setConnecting] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Meta Marketing</h1>
        <p className="text-gray-600 mt-1">Manage your Meta (Facebook & Instagram) advertising campaigns</p>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Meta Business Account</h2>
            <p className="text-sm text-gray-600">Connect your Meta Business account to track campaigns, pixels, and catalog</p>
          </div>
          <Button
            onClick={() => setConnecting(true)}
            disabled={connecting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Facebook className="mr-2 h-4 w-4" />
                Connect Account
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign Tracking</h3>
          <p className="text-sm text-gray-600">Track and manage your Meta ad campaigns, performance metrics, and ROI</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
            <Link2 className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Meta Pixel</h3>
          <p className="text-sm text-gray-600">Install and configure Meta Pixel for conversion tracking and retargeting</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
            <Settings className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Catalog Management</h3>
          <p className="text-sm text-gray-600">Sync your product catalog with Meta for dynamic ads and shopping campaigns</p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Coming Soon:</strong> Full Meta Business integration including campaign management, pixel configuration, and catalog sync.
        </p>
      </div>
    </div>
  )
}

