"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { submitContactForm } from "@/app/actions/contact"
import { toast } from "sonner"
import type { ContactCMSContent } from "@/lib/contact-cms-defaults"

interface ContactPageContentProps {
  content: ContactCMSContent
}

export function ContactPageContent({ content }: ContactPageContentProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const addressLines = content.address
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const businessHoursLines = content.businessHours
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const result = await submitContactForm(formData)
      if (result.success) {
        toast.success(
          result.message || "Thank you for contacting us! We'll get back to you soon."
        )
        setFormData({ name: "", email: "", subject: "", message: "" })
      } else {
        toast.error(result.error || "Failed to send message. Please try again.")
      }
    } catch (error) {
      console.error("Error submitting contact form:", error)
      toast.error("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1
            className={`text-4xl font-bold text-gray-900 ${
              content.subtitle.trim() ? "mb-2" : "mb-8"
            }`}
          >
            {content.title}
          </h1>
          {content.subtitle.trim() ? (
            <p className="text-lg text-gray-600 mb-8">{content.subtitle}</p>
          ) : null}

          <div
            className={`grid gap-8 ${
              content.formEnabled ? "md:grid-cols-2" : "md:grid-cols-1 max-w-xl"
            }`}
          >
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {content.getInTouchHeading}
              </h2>
              <div className="space-y-4">
                {content.email.trim() ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Email</h3>
                    <a
                      href={`mailto:${content.email.trim()}`}
                      className="text-teal-600 hover:text-teal-700"
                    >
                      {content.email.trim()}
                    </a>
                    {content.emailDescription.trim() ? (
                      <p className="text-sm text-gray-500 mt-1">{content.emailDescription}</p>
                    ) : null}
                  </div>
                ) : null}

                {content.liveChatDescription.trim() ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">
                      {content.liveChatTitle}
                    </h3>
                    <p className="text-gray-600">{content.liveChatDescription}</p>
                  </div>
                ) : null}

                {addressLines.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Address</h3>
                    <p className="text-gray-600">
                      {addressLines.map((line, i) => (
                        <span key={i}>
                          {line}
                          {i < addressLines.length - 1 ? <br /> : null}
                        </span>
                      ))}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {content.formEnabled ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  {content.formHeading}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="subject"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Subject
                    </label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Sending..." : "Send Message"}
                  </button>
                </form>
              </div>
            ) : null}
          </div>

          {businessHoursLines.length > 0 ? (
            <div className="mt-8 bg-teal-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {content.businessHoursTitle}
              </h3>
              <p className="text-gray-600">
                {businessHoursLines.map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < businessHoursLines.length - 1 ? <br /> : null}
                  </span>
                ))}
              </p>
            </div>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  )
}
