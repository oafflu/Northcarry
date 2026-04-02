"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react"
import { getCMSContent, saveCMSContent } from "@/app/actions/cms"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export default function FAQManagementPage() {
  const [content, setContent] = useState({
    title: "Frequently Asked Questions",
    questions: [
      { category: "General", question: "", answer: "" },
    ],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadFAQ()
  }, [])

  const loadFAQ = async () => {
    setLoading(true)
    try {
      const result = await getCMSContent('faq')
      if (result.data) {
        // Ensure questions array exists and has proper structure
        const data = result.data
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          // Ensure each question has a category field
          const questions = data.questions.map((q: any) => ({
            category: q.category || "General",
            question: q.question || "",
            answer: q.answer || ""
          }))
          setContent({ ...data, questions })
        } else {
          // If no questions, set default structure
          setContent({
            title: data.title || "Frequently Asked Questions",
            questions: [{ category: "General", question: "", answer: "" }]
          })
        }
      }
    } catch (error) {
      console.error('Error loading FAQ:', error)
      toast.error('Failed to load FAQ')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveCMSContent('faq', content)
      if (result.success) {
        toast.success('FAQ saved successfully')
      } else {
        toast.error(result.error || 'Failed to save FAQ')
      }
    } catch (error) {
      console.error('Error saving FAQ:', error)
      toast.error('Failed to save FAQ')
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = () => {
    setContent({
      ...content,
      questions: [...content.questions, { category: "General", question: "", answer: "" }],
    })
  }

  const removeQuestion = (index: number) => {
    setContent({
      ...content,
      questions: content.questions.filter((_, i) => i !== index),
    })
  }

  const updateQuestion = (index: number, field: 'category' | 'question' | 'answer', value: string) => {
    const newQuestions = [...content.questions]
    newQuestions[index] = { ...newQuestions[index], [field]: value }
    setContent({ ...content, questions: newQuestions })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading FAQ...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/cms" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">FAQ</h1>
          <p className="text-gray-600 mt-1">Manage frequently asked questions</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Page Title</label>
          <input
            type="text"
            value={content.title}
            onChange={(e) => setContent({ ...content, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">Questions & Answers</label>
            <Button onClick={addQuestion} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>
          </div>
          <div className="space-y-4">
            {content.questions.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Question {index + 1}</span>
                  {content.questions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <select
                  value={item.category || "General"}
                  onChange={(e) => updateQuestion(index, 'category', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="Shipping & Delivery">Shipping & Delivery</option>
                  <option value="Returns & Refunds">Returns & Refunds</option>
                  <option value="Product Information">Product Information</option>
                  <option value="Orders & Payments">Orders & Payments</option>
                  <option value="General">General</option>
                </select>
                <input
                  type="text"
                  value={item.question || ""}
                  onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                  placeholder="Enter question..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
                <textarea
                  value={item.answer || ""}
                  onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                  placeholder="Enter answer..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link
            href="/admin/cms"
            className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </Link>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

