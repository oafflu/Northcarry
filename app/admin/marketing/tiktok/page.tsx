"use client"

import { useState } from "react"
import { Music, BarChart3, Video, Settings, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function TikTokMarketingPage() {
  const [connecting, setConnecting] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">TikTok Marketing</h1>
        <p className="text-gray-600 mt-1">Manage your TikTok advertising campaigns and track performance</p>
      </div>

      {/* Connection Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">TikTok Business Account</h2>
            <p className="text-sm text-gray-600">Connect your TikTok Ads Manager account to track campaigns and conversions</p>
          </div>
          <Button
            onClick={() => setConnecting(true)}
            disabled={connecting}
            className="bg-black hover:bg-gray-800 text-white"
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Music className="mr-2 h-4 w-4" />
                Connect Account
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
            <BarChart3 className="w-6 h-6 text-gray-900" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign Management</h3>
          <p className="text-sm text-gray-600">Create, manage, and optimize TikTok ad campaigns</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
            <Video className="w-6 h-6 text-gray-900" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Creative Tools</h3>
          <p className="text-sm text-gray-600">Access TikTok's creative tools and video ad templates</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
            <Settings className="w-6 h-6 text-gray-900" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Pixel & Events</h3>
          <p className="text-sm text-gray-600">Install TikTok Pixel and track conversion events</p>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Coming Soon:</strong> Full TikTok Ads Manager integration including campaign management, pixel tracking, and performance analytics.
        </p>
      </div>
    </div>
  )
}

