"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import {
  DollarSign,
  TrendingUp,
  Link2,
  Users,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Zap,
  Shield,
  Clock,
  Gift,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export default function AffiliateLandingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  const handleGetStarted = () => {
    if (user) {
      // Check if user is already an affiliate
      router.push("/account/affiliate")
    } else {
      // Redirect to dedicated affiliate registration page
      router.push("/affiliate/register")
    }
  }

  const features = [
    {
      icon: DollarSign,
      title: "Earn Commissions",
      description: "Get paid for every sale you refer. Competitive commission rates that grow with your performance.",
      color: "text-green-500",
      bgColor: "bg-green-50",
    },
    {
      icon: TrendingUp,
      title: "Track Performance",
      description: "Real-time dashboard to monitor clicks, conversions, and earnings. Know exactly how you're performing.",
      color: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      icon: Link2,
      title: "Easy Link Sharing",
      description: "Generate unique affiliate links for products, categories, or your homepage. Share anywhere, anytime.",
      color: "text-purple-500",
      bgColor: "bg-purple-50",
    },
    {
      icon: Users,
      title: "Build Your Network",
      description: "Grow your audience while earning. Perfect for influencers, bloggers, and content creators.",
      color: "text-orange-500",
      bgColor: "bg-orange-50",
    },
    {
      icon: BarChart3,
      title: "Detailed Analytics",
      description: "Comprehensive reports on traffic, conversions, and revenue. Make data-driven decisions.",
      color: "text-indigo-500",
      bgColor: "bg-indigo-50",
    },
    {
      icon: Zap,
      title: "Fast Payouts",
      description: "Get paid quickly and securely. Multiple payment methods available including PayPal and bank transfer.",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50",
    },
  ]

  const benefits = [
    "No upfront costs or fees",
    "30-day cookie tracking window",
    "Dedicated affiliate support team",
    "Marketing materials and resources",
    "Tier-based commission structure",
    "Real-time earnings tracking",
  ]

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-teal-50 via-white to-blue-50 py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-100 rounded-full text-teal-700 text-sm font-medium mb-6">
              <Gift className="w-4 h-4" />
              <span>Join Our Affiliate Program</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Earn Money by Sharing
              <span className="block text-teal-600">What You Love</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join BREVI's affiliate program and earn competitive commissions for every customer you refer. 
              Perfect for influencers, bloggers, and anyone passionate about premium oral care.
            </p>
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 max-w-xl mx-auto mb-6">
              <p className="text-sm text-gray-700">
                <strong>Note:</strong> This is a separate registration from customer accounts. 
                Affiliates register specifically to promote and earn commissions, not to shop.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-6 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                onClick={() => {
                  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })
                }}
                variant="outline"
                size="lg"
                className="px-8 py-6 text-lg font-semibold border-2 border-gray-300 hover:border-teal-600 hover:text-teal-600 transition-all duration-300"
              >
                Learn More
              </Button>
            </div>
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span>Free to Join</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span>No Minimum Sales</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span>30-Day Cookie Window</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-teal-600 mb-2">10%+</div>
              <div className="text-gray-600">Commission Rate</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-teal-600 mb-2">30</div>
              <div className="text-gray-600">Day Cookie Window</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-teal-600 mb-2">24/7</div>
              <div className="text-gray-600">Support Available</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-teal-600 mb-2">Fast</div>
              <div className="text-gray-600">Payout Processing</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Join BREVI Affiliates?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to succeed as an affiliate partner
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
                  onMouseEnter={() => setHoveredFeature(index)}
                  onMouseLeave={() => setHoveredFeature(null)}
                >
                  <div className={`w-14 h-14 ${feature.bgColor} rounded-lg flex items-center justify-center mb-6 transition-transform duration-300 ${hoveredFeature === index ? 'scale-110' : ''}`}>
                    <Icon className={`w-7 h-7 ${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Start earning in just three simple steps
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-teal-600">1</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Sign Up</h3>
                <p className="text-gray-600">
                  Create your free affiliate account. Get approved quickly and start earning.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-teal-600">2</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Share Your Links</h3>
                <p className="text-gray-600">
                  Generate unique affiliate links and share them with your audience.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-teal-600">3</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Earn Commissions</h3>
                <p className="text-gray-600">
                  Get paid for every sale. Track your earnings in real-time and withdraw easily.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-br from-teal-50 to-blue-50">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                Program Benefits
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-teal-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-teal-600 to-blue-600 text-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to Start Earning?</h2>
            <p className="text-xl mb-8 text-teal-50">
              Join thousands of successful affiliates already earning with BREVI. 
              Sign up today and start building your passive income stream.
            </p>
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-white text-teal-600 hover:bg-gray-100 px-10 py-6 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              Join Now - It's Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="mt-6 text-sm text-teal-50">
              Already have an affiliate account?{" "}
              <Link href="/account/affiliate" className="underline font-semibold hover:text-white">
                Access your dashboard
              </Link>
              {" • "}
              <Link href="/login?redirect=/account/affiliate" className="underline font-semibold hover:text-white">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

