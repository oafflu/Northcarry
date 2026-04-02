"use client"

import { useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"

function AffiliateTrackerInner() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const affiliateCode = searchParams.get("ref")
    
    if (affiliateCode) {
      // Track the affiliate click
      fetch(`/api/affiliate/track?ref=${encodeURIComponent(affiliateCode)}`, {
        method: "GET",
        credentials: "include",
      }).catch((error) => {
        console.error("Error tracking affiliate click:", error)
      })
    }
  }, [searchParams])

  return null // This component doesn't render anything
}

export function AffiliateTracker() {
  return (
    <Suspense fallback={null}>
      <AffiliateTrackerInner />
    </Suspense>
  )
}

