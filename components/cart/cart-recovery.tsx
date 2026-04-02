"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

export default function CartRecovery() {
  const searchParams = useSearchParams()
  const recoverToken = searchParams.get("recover")

  useEffect(() => {
    // If recovery token is present, restore the session_id cookie
    if (recoverToken) {
      try {
        // Decode the recovery token to get session_id
        // Use atob for base64url decoding in browser
        const sessionId = atob(recoverToken.replace(/-/g, '+').replace(/_/g, '/'))
        
        // Set the session_id cookie
        document.cookie = `session_id=${sessionId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
        
        // Reload the page to load the cart with restored session
        window.location.href = "/cart"
      } catch (error) {
        console.error("Error recovering cart:", error)
        // If recovery fails, just continue to show the cart page
      }
    }
  }, [recoverToken])

  return null
}

