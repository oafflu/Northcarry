import { Metadata } from 'next'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { getCMSContent } from "@/app/actions/cms"

export const metadata: Metadata = {
  title: 'Terms of Service - BREVI',
  description: 'BREVI terms of service and user agreement',
}

export default async function TermsPage() {
  const cmsData = await getCMSContent('terms')
  const content = cmsData.data || {
    title: "Terms of Service",
    content: ""
  }

  // Fallback content if CMS content is empty
  const fallbackContent = content.content || `<div>
    <p class="text-sm text-gray-500 mb-4">Last updated: January 2025</p>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
      <p class="text-gray-600">By accessing and using the BREVI website, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our website.</p>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">2. Use License</h2>
      <p class="text-gray-600 mb-4">Permission is granted to temporarily access the materials on BREVI's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
      <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
        <li>Modify or copy the materials</li>
        <li>Use the materials for any commercial purpose</li>
        <li>Attempt to decompile or reverse engineer any software</li>
        <li>Remove any copyright or other proprietary notations</li>
      </ul>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">3. Product Information</h2>
      <p class="text-gray-600">We strive to provide accurate product descriptions and pricing. However, we do not warrant that product descriptions or other content on this site is accurate, complete, reliable, current, or error-free. Prices and availability are subject to change without notice.</p>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">4. Orders and Payment</h2>
      <p class="text-gray-600 mb-4">By placing an order, you agree to provide accurate and complete information. We reserve the right to refuse or cancel any order for any reason, including:</p>
      <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
        <li>Product availability</li>
        <li>Errors in pricing or product information</li>
        <li>Fraudulent or illegal transactions</li>
        <li>Technical errors</li>
      </ul>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">5. User Accounts</h2>
      <p class="text-gray-600">You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">6. Limitation of Liability</h2>
      <p class="text-gray-600">BREVI shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.</p>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">7. Governing Law</h2>
      <p class="text-gray-600">These terms shall be governed by and construed in accordance with the laws of the State of Texas, United States, without regard to its conflict of law provisions.</p>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">8. Contact Information</h2>
      <p class="text-gray-600">If you have any questions about these Terms of Service, please contact us:</p>
      <p class="text-gray-600 mt-2">Email: <a href="mailto:hello@brevibrushes.com" class="text-teal-600 hover:text-teal-700">hello@brevibrushes.com</a><br />Or use our live chat feature for instant support.</p>
    </section>
  </div>`

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">{content.title || "Terms of Service"}</h1>
          <div className="bg-white rounded-lg shadow p-8 space-y-6">
            <div dangerouslySetInnerHTML={{ __html: content.content || fallbackContent }} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

