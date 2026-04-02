import { Metadata } from 'next'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { getCMSContent } from "@/app/actions/cms"

export const metadata: Metadata = {
  title: 'Privacy Policy - BREVI',
  description: 'BREVI privacy policy and data protection information',
}

export default async function PrivacyPage() {
  const cmsData = await getCMSContent('privacy')
  const content = cmsData.data || {
    title: "Privacy Policy",
    content: ""
  }

  // Fallback content if CMS content is empty
  const fallbackContent = content.content || `<div>
    <p class="text-sm text-gray-500 mb-4">Last updated: January 2025</p>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">1. Information We Collect</h2>
      <p class="text-gray-600 mb-4">We collect information that you provide directly to us, including:</p>
      <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
        <li>Name, email address, and contact information</li>
        <li>Shipping and billing addresses</li>
        <li>Payment information (processed securely through our payment providers)</li>
        <li>Order history and preferences</li>
        <li>Account credentials and profile information</li>
      </ul>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">2. How We Use Your Information</h2>
      <p class="text-gray-600 mb-4">We use the information we collect to:</p>
      <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
        <li>Process and fulfill your orders</li>
        <li>Send you order confirmations and shipping updates</li>
        <li>Respond to your customer service requests</li>
        <li>Send you marketing communications (with your consent)</li>
        <li>Improve our website and services</li>
        <li>Prevent fraud and ensure security</li>
      </ul>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">3. Information Sharing</h2>
      <p class="text-gray-600">We do not sell your personal information. We may share your information with:</p>
      <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-2">
        <li>Payment processors to complete transactions</li>
        <li>Shipping carriers to deliver your orders</li>
        <li>Service providers who assist in our operations</li>
        <li>Legal authorities when required by law</li>
      </ul>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">4. Data Security</h2>
      <p class="text-gray-600">We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.</p>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">5. Your Rights</h2>
      <p class="text-gray-600 mb-4">You have the right to:</p>
      <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
        <li>Access your personal information</li>
        <li>Correct inaccurate information</li>
        <li>Request deletion of your information</li>
        <li>Opt-out of marketing communications</li>
        <li>Request a copy of your data</li>
      </ul>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">6. Cookies</h2>
      <p class="text-gray-600">We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. You can control cookies through your browser settings.</p>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">7. Contact Us</h2>
      <p class="text-gray-600">If you have questions about this Privacy Policy, please contact us at:</p>
      <p class="text-gray-600 mt-2">Email: <a href="mailto:hello@brevibrushes.com" class="text-teal-600 hover:text-teal-700">hello@brevibrushes.com</a><br />Or use our live chat feature for instant support.</p>
    </section>
  </div>`

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">{content.title || "Privacy Policy"}</h1>
          <div className="bg-white rounded-lg shadow p-8 space-y-6">
            <div dangerouslySetInnerHTML={{ __html: content.content || fallbackContent }} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

