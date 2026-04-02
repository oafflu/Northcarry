"use client"

import { useState } from "react"
import { Search, BarChart3, ShoppingBag, Settings, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GoogleMarketingPage() {
  const [connecting, setConnecting] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Google Marketing</h1>
        <p className="text-gray-600 mt-1">Manage your Google Ads, Analytics, and Commerce Platform integrations</p>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Google Account</h2>
            <p className="text-sm text-gray-600">Connect your Google account for Analytics, Google Ads, and Merchant Center</p>
          </div>
          <Button
            onClick={() => setConnecting(true)}
            disabled={connecting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Connect Account
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center mb-4">
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Google Analytics</h3>
          <p className="text-sm text-gray-600">Track website traffic, user behavior, and conversion data</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Google Ads</h3>
          <p className="text-sm text-gray-600">Manage campaigns, track performance, and optimize ad spend</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center mb-4">
            <ShoppingBag className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Merchant Center</h3>
          <p className="text-sm text-gray-600">Sync products and manage Google Shopping listings</p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Coming Soon:</strong> Full Google integration including Analytics 4, Google Ads API, and Merchant Center sync.
        </p>
      </div>
    </div>
  )
}

