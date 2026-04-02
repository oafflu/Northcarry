"use client"

import React from "react"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    // Log to console for debugging but don't crash the app
    // The error is already handled by getDerivedStateFromError
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-gray-900">Something went wrong</h1>
            <p className="mb-4 text-gray-600">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = "/"
              }}
              className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

