"use client"

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { loginAction, registerAction, logoutAction, updateProfileAction } from "@/app/actions/auth"

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  role?: string
  avatarUrl?: string
  createdAt: string
  needsPasswordChange?: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // All hooks must be called unconditionally and in the same order every render
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  
  // Memoize Supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), [])
  
  // Use refs to track mounted state and prevent stale closures
  const isMountedRef = useRef(true)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const authCheckDoneRef = useRef(false)

  // Ensure we only run client-side code after mount to prevent hydration mismatches
  useEffect(() => {
    // Set mounted immediately - useEffect only runs on client
    setMounted(true)
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // Don't run auth checks until component is mounted (client-side only)
    if (!mounted || authCheckDoneRef.current) return

    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
      loadingTimeoutRef.current = null
    }

    // Safety timeout to prevent infinite loading - reduced from 30s to 5s for faster UX
    // Set timeout regardless of current loading state to ensure it's always set
    loadingTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && loading) {
        console.warn('Auth loading timeout - setting loading to false')
        setUser(null)
        setLoading(false)
        authCheckDoneRef.current = true
      }
    }, 5000) // 5 second timeout - faster failover

    // Helper function to load user profile from Supabase
    const loadUserProfile = async (userId: string, email: string, createdAt: string) => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, role, phone, avatar_url')
          .eq('id', userId)
          .single()

        if (error || !profile) {
          console.error('Error loading profile:', error)
          // Return a minimal user object if profile query fails
          if (!isMountedRef.current) return null
          return {
            id: userId,
            email,
            firstName: '',
            lastName: '',
            phone: undefined,
            role: 'customer',
            avatarUrl: undefined,
            createdAt,
          }
        }

        return {
          id: userId,
          email,
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          phone: profile.phone || undefined,
          role: profile.role || 'customer',
          avatarUrl: profile.avatar_url,
          createdAt,
        }
      } catch (error: any) {
        console.error('Error in loadUserProfile:', error)
        // Return a minimal user object on error to prevent infinite loading
        if (!isMountedRef.current) return null
        return {
          id: userId,
          email,
          firstName: '',
          lastName: '',
          phone: undefined,
          role: 'customer',
          avatarUrl: undefined,
          createdAt,
        }
      }
    }

    // Check for existing session with timeout protection
    const checkSession = async () => {
      try {
        // Use Promise.race to ensure we don't hang indefinitely
        const getUserPromise = supabase.auth.getUser()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth check timeout')), 3000)
        )

        let userResult
        try {
          userResult = await Promise.race([getUserPromise, timeoutPromise]) as any
        } catch (userError: any) {
          console.warn('Error getting user:', userError)
          // If user check fails or times out, assume no session
          if (isMountedRef.current) {
            // Clear timeout
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current)
              loadingTimeoutRef.current = null
            }
            setLoading(false)
            authCheckDoneRef.current = true
          }
          return
        }

        const { data: { user: authUser }, error: userError } = userResult || { data: { user: null }, error: null }
        
        if (userError || !authUser) {
          if (isMountedRef.current) {
            // Clear timeout
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current)
              loadingTimeoutRef.current = null
            }
            setUser(null)
            setLoading(false)
            authCheckDoneRef.current = true
          }
          return
        }

        // Load user profile with timeout protection
        const profilePromise = loadUserProfile(
          authUser.id,
          authUser.email!,
          authUser.created_at
        )
        const profileTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile load timeout')), 2000)
        )

        let userData
        try {
          userData = await Promise.race([profilePromise, profileTimeoutPromise]) as any
        } catch (profileError) {
          console.warn('Error loading profile:', profileError)
          // Return minimal user object on timeout/error
          userData = {
            id: authUser.id,
            email: authUser.email!,
            firstName: '',
            lastName: '',
            phone: undefined,
            role: 'customer',
            avatarUrl: undefined,
            createdAt: authUser.created_at,
          }
        }

        if (isMountedRef.current && userData) {
          // Clear timeout since we successfully loaded
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current)
            loadingTimeoutRef.current = null
          }
          setUser(userData)
          setLoading(false)
          authCheckDoneRef.current = true
        } else if (isMountedRef.current) {
          // Clear timeout
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current)
            loadingTimeoutRef.current = null
          }
          setUser(null)
          setLoading(false)
          authCheckDoneRef.current = true
        }
      } catch (error: any) {
        console.error('Error checking session:', error)
        // If error, still set loading to false to prevent infinite loading
        // Don't throw - just log and continue
        if (isMountedRef.current) {
          // Clear timeout
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current)
            loadingTimeoutRef.current = null
          }
          setUser(null)
          setLoading(false)
          authCheckDoneRef.current = true
        }
      }
    }

    checkSession()

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null
    
    try {
      // Note: We ignore the session parameter to avoid the warning
      // We always verify with getUser() instead
      const authStateChange = supabase.auth.onAuthStateChange(async (event) => {
        if (!isMountedRef.current) return

        try {
          if (event === 'SIGNED_IN') {
            // Verify user with getUser() for security (authenticates with server)
            // Don't use session.user directly - always verify with getUser()
            // Note: This might be called after login() already set the user
            // So we check if user is already set to avoid duplicate updates
            if (isMountedRef.current && user) {
              // User already set by login() - just update loading state
              setLoading(false)
              return
            }
            
            try {
              const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser()
              
              if (verifyError || !verifiedUser) {
                console.warn('User verification failed after sign in:', verifyError)
                if (isMountedRef.current) {
                  setLoading(false)
                }
                return
              }

              // Load user profile after sign in
              const userData = await loadUserProfile(
                verifiedUser.id,
                verifiedUser.email!,
                verifiedUser.created_at
              )
              
              if (isMountedRef.current && userData) {
                setUser(userData)
                setLoading(false)
              } else if (isMountedRef.current) {
                setLoading(false)
              }
            } catch (error) {
              console.error('Error loading user after sign in:', error)
              // Always set loading to false even on error
              if (isMountedRef.current) {
                setLoading(false)
              }
            }
          } else if (event === 'SIGNED_OUT') {
            if (isMountedRef.current) {
              setUser(null)
              setLoading(false)
            }
          } else if (event === 'TOKEN_REFRESHED') {
            // Verify user with getUser() for security
            // Don't use session.user directly - always verify with getUser()
            try {
              const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser()
              
              if (verifyError || !verifiedUser) {
                console.warn('User verification failed after token refresh:', verifyError)
                return
              }

              // Refresh user data on token refresh
              const userData = await loadUserProfile(
                verifiedUser.id,
                verifiedUser.email!,
                verifiedUser.created_at
              )
              
              if (isMountedRef.current && userData) {
                setUser(userData)
              }
            } catch (error) {
              console.error('Error loading user after token refresh:', error)
              // Don't throw - just log
            }
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error)
          // Always set loading to false on error to prevent infinite loading
          if (isMountedRef.current) {
            setLoading(false)
          }
        }
      })
      
      subscription = authStateChange.data.subscription
    } catch (error) {
      console.error('Error setting up auth state change listener:', error)
      // Don't throw - just log
      if (isMountedRef.current) {
        setLoading(false)
      }
    }

    return () => {
      isMountedRef.current = false
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
      if (subscription) {
        try {
          subscription.unsubscribe()
        } catch (error) {
          console.error('Error unsubscribing from auth state changes:', error)
        }
      }
    }
  }, [supabase, mounted]) // Removed 'loading' from dependencies to prevent re-runs during hydration

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await loginAction(email, password)
      if (result.success && result.user) {
        setUser(result.user)
        // Don't call router.refresh() here - let the login page handle navigation
        return result.user // Return user so login page can check role
      } else {
        throw new Error(result.error || 'Login failed')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      throw error
    }
  }, [])

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const result = await registerAction(email, password, firstName, lastName)
      if (result.success && result.user) {
        setUser(result.user)
        // Don't call router.refresh() - let the page handle navigation
      } else {
        throw new Error(result.error || 'Registration failed')
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutAction()
      setUser(null)
      // Clear user state - let the component handle navigation
      // This prevents hydration issues from using router in context provider
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Still clear user state and redirect on error
      setUser(null)
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    }
  }, [])

  const updateProfile = useCallback(async (data: Partial<User>) => {
    const result = await updateProfileAction({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      avatarUrl: data.avatarUrl,
    })
    
    if (result.success) {
      setUser((prevUser) => {
        if (!prevUser) return prevUser
        return { ...prevUser, ...data }
      })
      // Don't call router.refresh() - state update is sufficient
    } else {
      throw new Error(result.error || 'Update failed')
    }
  }, [])

  // During SSR or before mount, always show loading to prevent hydration mismatch
  // This ensures server and client render the same initial state
  // The context value is stable and doesn't change structure between renders
  // Note: login, register, logout, updateProfile are wrapped in useCallback so they're stable
  // IMPORTANT: Always return the same structure to prevent hydration mismatches
  // On server, mounted will be false, so we return null user and true loading
  // On client initial render, mounted will also be false, so we match server
  // Use a ref to track if we've done the initial hydration to prevent Chrome-specific race conditions
  const hydrationCompleteRef = useRef(false)
  const [hydrationComplete, setHydrationComplete] = useState(false)
  
  useEffect(() => {
    // Mark hydration as complete after React has finished the initial render
    // This prevents Chrome from updating state too quickly during hydration
    // Use requestAnimationFrame to ensure we're after the initial paint
    const rafId = requestAnimationFrame(() => {
      // Use another requestAnimationFrame to ensure we're after hydration
      requestAnimationFrame(() => {
        hydrationCompleteRef.current = true
        setHydrationComplete(true)
      })
    })
    
    return () => cancelAnimationFrame(rafId)
  }, [mounted])
  
  const contextValue = useMemo(() => {
    // During initial hydration (before mounted or before hydration complete), always return consistent values
    // This prevents Chrome from causing hydration mismatches due to faster state updates
    // Only show actual user/loading state after hydration is complete
    const isHydrating = !mounted || !hydrationComplete
    
    // Always return the same object structure
    return {
      user: isHydrating ? null : user, // Always null during hydration
      loading: isHydrating ? true : loading, // Always true during hydration
      login,
      register,
      logout,
      updateProfile,
    }
  }, [mounted, hydrationComplete, user, loading, login, register, logout, updateProfile])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
