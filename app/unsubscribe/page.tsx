"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"

function UnsubscribeInner() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") || ""
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"unknown" | "active" | "unsubscribed">("unknown")

  useEffect(() => {
    if (initialEmail && initialEmail.includes("@")) {
      fetchStatus(initialEmail)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail])

  const fetchStatus = async (target: string) => {
    try {
      const res = await fetch(`/api/unsubscribe?email=${encodeURIComponent(target)}`)
      const data = await res.json()
      if (res.ok && data.success) {
        setStatus(data.status === "unsubscribed" ? "unsubscribed" : "active")
      }
    } catch (e) {
      console.error("Failed to fetch status", e)
    }
  }

  const handleUnsubscribe = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("You have been unsubscribed from marketing emails.")
        setStatus("unsubscribed")
      } else {
        toast.error(data.error || "Failed to unsubscribe. Please try again.")
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to unsubscribe. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Unsubscribe</CardTitle>
          <CardDescription>
            Enter your email to stop receiving marketing emails. You can re-subscribe at any time from our website.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button onClick={handleUnsubscribe} disabled={loading} className="w-full">
            {loading ? "Processing..." : "Unsubscribe"}
          </Button>
          {status !== "unknown" && (
            <p className="text-sm text-gray-600 text-center">
              Status: {status === "unsubscribed" ? "Unsubscribed" : "Subscribed"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>}>
      <UnsubscribeInner />
    </Suspense>
  )
}
