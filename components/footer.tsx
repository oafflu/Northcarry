"use client"

import { Mail, MessageCircle, ChevronUp } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { subscribeToNewsletter } from "@/app/actions/newsletter"
import { getCMSContent } from "@/app/actions/cms"
import { toast } from "sonner"
import {
  mergeFooterCMSContent,
  type FooterCMSContent,
} from "@/lib/footer-cms-defaults"
import { mergeBrandingCMSContent } from "@/lib/branding-cms-defaults"

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const [firstName, setFirstName] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [footerCms, setFooterCms] = useState<FooterCMSContent>(() =>
    mergeFooterCMSContent(null)
  )
  const [headerLogo, setHeaderLogo] = useState("")
  const [siteName, setSiteName] = useState("BREVI")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [footerResult, brandingResult] = await Promise.all([
          getCMSContent("footer"),
          getCMSContent("branding"),
        ])
        if (!cancelled) {
          setFooterCms(mergeFooterCMSContent(footerResult.data))
          const branding = mergeBrandingCMSContent(brandingResult.data)
          setHeaderLogo(branding.logo)
          setSiteName(branding.siteName)
        }
      } catch {
        if (!cancelled) setFooterCms(mergeFooterCMSContent(null))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const touch = footerCms.getInTouch
  const footerLogo = footerCms.logo.trim() || headerLogo

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setSubmitting(true)
    try {
      const result = await subscribeToNewsletter(email, firstName || undefined)
      if (result.success) {
        toast.success(result.message || 'Successfully subscribed to our newsletter!')
        setFirstName("")
        setEmail("")
      } else {
        toast.error(result.error || 'Failed to subscribe. Please try again.')
      }
    } catch (error) {
      console.error('Error subscribing to newsletter:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <footer className="bg-[#2A2A2A] text-white py-16 px-4 md:px-6 lg:px-8 relative">
      <div className="container mb-12">
        <div className="flex flex-col items-center">
          <div className="w-32 h-px bg-white mb-4"></div>
          <Link href="/" className="flex items-center justify-center">
            {footerLogo ? (
              <Image
                src={footerLogo}
                alt={siteName}
                width={160}
                height={56}
                className="h-12 sm:h-14 w-auto brightness-0 invert"
              />
            ) : (
              <span className="text-3xl font-bold tracking-widest">{siteName}</span>
            )}
          </Link>
          <div className="w-32 h-px bg-white mt-4"></div>
        </div>
      </div>

      {/* Main Footer Content - Three Columns */}
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Get In Touch */}
          <div>
            <h3 className="text-xl font-semibold mb-6">{touch.heading}</h3>
            <div className="space-y-4 text-sm">
              {touch.companyName.trim() ? <p>{touch.companyName}</p> : null}
              {touch.addressLine1.trim() ? <p>{touch.addressLine1}</p> : null}
              {touch.addressLine2.trim() ? <p>{touch.addressLine2}</p> : null}

              {touch.email.trim() ? (
                <div className="flex items-center gap-2 pt-4">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a
                    href={`mailto:${touch.email.trim()}`}
                    className="hover:text-gray-300 transition-colors underline break-all"
                  >
                    {touch.email.trim()}
                  </a>
                </div>
              ) : null}

              {touch.chatSupportText.trim() ? (
                <div className="flex items-center gap-2 pt-2">
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{touch.chatSupportText}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-xl font-semibold mb-6">Customer Service</h3>
            <nav className="space-y-3 text-sm">
              <Link href="/faq" className="block hover:text-gray-300 transition-colors">
                FAQ
              </Link>
              <Link href="/contact" className="block hover:text-gray-300 transition-colors">
                Contact Us
              </Link>
              <Link href="/affiliate" className="block hover:text-gray-300 transition-colors">
                Affiliate
              </Link>
              <Link href="/privacy" className="block hover:text-gray-300 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/refund" className="block hover:text-gray-300 transition-colors">
                Refund Policy
              </Link>
              <Link href="/terms" className="block hover:text-gray-300 transition-colors">
                Terms of Service
              </Link>
            </nav>
          </div>

          {/* Newsletter Signup */}
          <div>
            <h3 className="text-xl font-semibold mb-4">Do you want 10% off your order today?</h3>
            <p className="text-sm mb-6">Subscriber to our newsletter to unlock this exclusive offer.</p>

            <form onSubmit={handleNewsletterSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded bg-[#4A4A4A] text-white placeholder:text-gray-400 border-none focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              <input
                type="email"
                placeholder="Your Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded bg-[#4A4A4A] text-white placeholder:text-gray-400 border-none focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-3 rounded bg-white text-black font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-8 border-t border-gray-700">
          {/* Copyright */}
          <div className="flex flex-col md:flex-row items-center gap-4">
            <p className="text-sm">{footerCms.copyright}</p>
            {/* Powered by OAFFLU */}
            <Link 
              href="https://oafflu.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <span>Powered by</span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block">
                  <rect width="24" height="24" fill="#000000"/>
                  <path d="M0 0 L0 12 A12 12 0 0 1 12 0 Z" fill="#FF6B35"/>
                </svg>
                <span className="font-medium">OAFFLU</span>
              </span>
            </Link>
          </div>

          {/* Payment Icons */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <div className="w-10 h-6 bg-[#006FCF] rounded flex items-center justify-center text-white text-[8px] font-bold">
              AMEX
            </div>
            <div className="w-10 h-6 bg-black rounded flex items-center justify-center text-white text-[10px] font-bold"></div>
            <div className="w-10 h-6 bg-white rounded flex items-center justify-center text-[10px] font-bold">DC</div>
            <div className="w-10 h-6 bg-[#FF6000] rounded flex items-center justify-center text-white text-[8px] font-bold">
              DISC
            </div>
            <div className="w-10 h-6 bg-white rounded flex items-center justify-center text-[10px] font-bold">
              G Pay
            </div>
            <div className="w-10 h-6 bg-[#0066CB] rounded flex items-center justify-center text-white text-[10px] font-bold">
              M
            </div>
            <div className="w-10 h-6 bg-[#EB001B] rounded flex items-center justify-center">
              <div className="w-3 h-3 bg-[#EB001B] rounded-full"></div>
              <div className="w-3 h-3 bg-[#FF5F00] rounded-full -ml-1.5"></div>
            </div>
            <div className="w-10 h-6 bg-[#0070BA] rounded flex items-center justify-center text-white text-[8px] font-bold">
              PayPal
            </div>
            <div className="w-10 h-6 bg-[#5A31F4] rounded flex items-center justify-center text-white text-[8px] font-bold">
              SHOP
            </div>
            <div className="w-10 h-6 bg-[#1A1F71] rounded flex items-center justify-center text-white text-[10px] font-bold">
              VISA
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className="absolute bottom-8 right-1/2 transform translate-x-1/2 md:transform-none md:right-8 md:bottom-8 bg-white text-black p-3 rounded shadow-lg hover:bg-gray-100 transition-colors"
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </footer>
  )
}

export default Footer
