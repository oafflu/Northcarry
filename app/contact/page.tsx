'use client'

import { useState } from 'react'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { submitContactForm } from "@/app/actions/contact"
import { toast } from "sonner"

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const result = await submitContactForm(formData)
      if (result.success) {
        toast.success(result.message || 'Thank you for contacting us! We\'ll get back to you soon.')
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: '',
        })
      } else {
        toast.error(result.error || 'Failed to send message. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting contact form:', error)
      toast.error('An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Contact Us</h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get In Touch</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Email</h3>
                <a href="mailto:hello@brevibrushes.com" className="text-teal-600 hover:text-teal-700">
                  hello@brevibrushes.com
                </a>
                <p className="text-sm text-gray-500 mt-1">Send us an email and we'll get back to you as soon as possible.</p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Live Chat</h3>
                <p className="text-gray-600">
                  Use our live chat feature for instant support. Look for the chat icon in the bottom right corner of the page.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">Address</h3>
                <p className="text-gray-600">
                  Brevi Brush Limited<br />
                  10685-B Hazelhurst Dr. #34479<br />
                  Houston, TX 77043, USA
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Send Us a Message</h2>
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
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
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
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
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
                ></textarea>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 bg-teal-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Business Hours</h3>
          <p className="text-gray-600">
            Monday - Friday: 9:00 AM - 6:00 PM EST<br />
            Saturday: 10:00 AM - 4:00 PM EST<br />
            Sunday: Closed
          </p>
        </div>
      </div>
      </main>
      <Footer />
    </div>
  )
}

