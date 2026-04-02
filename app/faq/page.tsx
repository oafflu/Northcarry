import { Metadata } from 'next'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { getCMSContent } from "@/app/actions/cms"

export const metadata: Metadata = {
  title: 'FAQ - BREVI',
  description: 'Frequently asked questions about BREVI products and services',
}

export default async function FAQPage() {
  const cmsData = await getCMSContent('faq')
  const content = cmsData.data || {
    title: "Frequently Asked Questions",
    questions: []
  }

  // Group questions by category
  const questionsByCategory: { [key: string]: Array<{ question: string; answer: string }> } = {}
  if (content.questions && Array.isArray(content.questions)) {
    content.questions.forEach((q: any) => {
      const category = q.category || 'General'
      if (!questionsByCategory[category]) {
        questionsByCategory[category] = []
      }
      questionsByCategory[category].push({ question: q.question, answer: q.answer })
    })
  }

  // Fallback content if CMS content is empty
  const fallbackCategories = {
    'Shipping & Delivery': [
      { question: 'How long does shipping take?', answer: 'Standard shipping typically takes 5-7 business days. Express shipping is available for 2-3 business day delivery.' },
      { question: 'Do you ship internationally?', answer: 'Currently, we ship within the United States. International shipping options are coming soon.' }
    ],
    'Returns & Refunds': [
      { question: 'What is your return policy?', answer: 'We offer a 5-day replacement policy for defective or damaged Brevi brushes. If you receive a defective item, contact us within 5 days of delivery and we\'ll send you a replacement at no cost.' },
      { question: 'How do I request a replacement?', answer: 'Contact our customer service team at hello@brevibrushes.com or use our live chat feature within 5 days of delivery. Provide your order number and photos of the defect or damage, and we\'ll arrange for a replacement.' }
    ],
    'Product Information': [
      { question: 'Are your toothbrushes eco-friendly?', answer: 'Yes! Our bamboo toothbrushes are made from sustainable bamboo and biodegradable materials. We\'re committed to environmental sustainability.' },
      { question: 'How often should I replace my toothbrush?', answer: 'Dentists recommend replacing your toothbrush every 3-4 months, or sooner if the bristles become frayed.' }
    ],
    'Orders & Payments': [
      { question: 'What payment methods do you accept?', answer: 'We accept all major credit cards, PayPal, and other secure payment methods through our checkout system.' },
      { question: 'Can I track my order?', answer: 'Yes! Once your order ships, you\'ll receive a tracking number via email. You can also track your order in your account dashboard.' }
    ]
  }

  const displayCategories = Object.keys(questionsByCategory).length > 0 ? questionsByCategory : fallbackCategories

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">{content.title || "Frequently Asked Questions"}</h1>
          
          <div className="space-y-8">
            {Object.entries(displayCategories).map(([category, questions]) => (
              <div key={category} className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">{category}</h2>
                <div className="space-y-4">
                  {questions.map((item, index) => (
                    <div key={index}>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">{item.question}</h3>
                      <p className="text-gray-600">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-teal-50 rounded-lg p-6 text-center">
            <p className="text-gray-700 mb-4">Still have questions?</p>
            <a href="/contact" className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
              Contact Us
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

