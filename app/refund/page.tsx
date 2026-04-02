import { Metadata } from 'next'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { getCMSContent } from "@/app/actions/cms"

export const metadata: Metadata = {
  title: 'Refund Policy - BREVI',
  description: 'BREVI refund and return policy',
}

export default async function RefundPage() {
  const cmsData = await getCMSContent('refund')
  const content = cmsData.data || {
    title: "Refund Policy",
    content: ""
  }

  // Fallback content if CMS content is empty
  const fallbackContent = content.content || `<div>
    <p class="text-sm text-gray-500 mb-4">Last updated: January 2025</p>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">5 Days Replacement Policy</h2>
      <p class="text-gray-600">We stand behind the quality of our products. If you receive a defective or damaged Brevi brush, you can request a replacement within 5 days of delivery. We will arrange for a replacement to be sent to you at no additional cost.</p>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">Replacement Eligibility</h2>
      <p class="text-gray-600 mb-4">To be eligible for a replacement:</p>
      <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
        <li>Item must be defective or damaged upon arrival</li>
        <li>Replacement request must be initiated within 5 days of delivery</li>
        <li>Original proof of purchase is required</li>
        <li>Photos of the defect or damage may be required</li>
      </ul>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">How to Request a Replacement</h2>
      <ol class="list-decimal list-inside text-gray-600 space-y-2 ml-4">
        <li>Contact us at hello@brevibrushes.com or use our live chat within 5 days of delivery</li>
        <li>Provide your order number and describe the issue</li>
        <li>Send photos of the defect or damage if requested</li>
        <li>We will review your request and arrange for a replacement to be shipped</li>
        <li>You will receive tracking information once the replacement is dispatched</li>
      </ol>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">Replacement Processing</h2>
      <p class="text-gray-600 mb-4">Once we approve your replacement request:</p>
      <ul class="list-disc list-inside text-gray-600 space-y-2 ml-4">
        <li>Replacement will be shipped within 2-3 business days</li>
        <li>You will receive tracking information via email</li>
        <li>Replacement shipping is free of charge</li>
        <li>You may be asked to return the defective item (return shipping will be provided)</li>
      </ul>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">Defective or Damaged Items</h2>
      <p class="text-gray-600">If you receive a defective or damaged Brevi brush, please contact us immediately at <a href="mailto:hello@brevibrushes.com" class="text-teal-600 hover:text-teal-700"> hello@brevibrushes.com</a> or use our live chat feature. We will arrange for a replacement to be sent to you, including return shipping costs if needed.</p>
    </section>
    <section>
      <h2 class="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
      <p class="text-gray-600">For questions about returns or refunds, please contact us:</p>
      <p class="text-gray-600 mt-2">Email: <a href="mailto:hello@brevibrushes.com" class="text-teal-600 hover:text-teal-700">hello@brevibrushes.com</a><br />Or use our live chat feature for instant support.</p>
    </section>
  </div>`

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">{content.title || "Refund Policy"}</h1>
          <div className="bg-white rounded-lg shadow p-8 space-y-6">
            <div dangerouslySetInnerHTML={{ __html: content.content || fallbackContent }} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

