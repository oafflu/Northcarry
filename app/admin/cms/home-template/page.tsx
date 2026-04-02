'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  getPageTemplate, 
  getTemplateSections, 
  updateTemplateSection,
  createTemplateSection,
  reorderSections 
} from '@/app/actions/cms'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  GripVertical, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  ChevronUp,
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Image as ImageIcon,
  Type,
  Layout,
  ShoppingBag,
  MessageSquare,
  Video,
  FileText,
  Grid3x3,
  Columns
} from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { ImagePicker } from '@/components/admin/image-picker'
import { MenuLinkAutocomplete } from '@/components/admin/menu-link-autocomplete'

interface Section {
  id: string
  section_type: string
  section_order: number
  is_enabled: boolean
  config: any
  content: any
}

export default function HomeTemplatePage() {
  const router = useRouter()
  const [template, setTemplate] = useState<any>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAddSection, setShowAddSection] = useState(false)

  // Available section types (Shopify-style)
  const availableSectionTypes = [
    { type: 'hero', label: 'Hero Banner', icon: ImageIcon, description: 'Large banner with image and CTA' },
    { type: 'features', label: 'Features', icon: Layout, description: 'Feature badges or highlights' },
    { type: 'product_grid', label: 'Product Grid', icon: ShoppingBag, description: 'Grid of featured products' },
    { type: 'image_banner', label: 'Image Banner', icon: ImageIcon, description: 'Full-width image banner' },
    { type: 'text_block', label: 'Text Block', icon: Type, description: 'Rich text content block' },
    { type: 'video', label: 'Video', icon: Video, description: 'Video embed section' },
    { type: 'testimonials', label: 'Testimonials', icon: MessageSquare, description: 'Customer testimonials' },
    { type: 'reviews', label: 'Reviews', icon: MessageSquare, description: 'Product reviews section' },
    { type: 'newsletter', label: 'Newsletter', icon: FileText, description: 'Email signup form' },
    { type: 'image_gallery', label: 'Image Gallery', icon: Grid3x3, description: 'Gallery of images' },
    { type: 'two_column', label: 'Two Column', icon: Columns, description: 'Two column layout' },
  ]

  useEffect(() => {
    loadTemplate()
  }, [])

  const loadTemplate = async () => {
    setLoading(true)
    try {
      const result = await getPageTemplate('home')
      if (result.error) {
        toast.error('Failed to load template')
        return
      }
      setTemplate(result.data)
      setSections(result.data?.sections || [])
      if (result.data?.sections?.length > 0) {
        setExpandedSection(result.data.sections[0].id)
      }
    } catch (error) {
      console.error('Error loading template:', error)
      toast.error('Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSection = async (sectionId: string, enabled: boolean) => {
    const result = await updateTemplateSection(sectionId, { is_enabled: enabled })
    if (result.success) {
      setSections(sections.map(s => s.id === sectionId ? { ...s, is_enabled: enabled } : s))
      toast.success(enabled ? 'Section enabled' : 'Section disabled')
    } else {
      toast.error(result.error || 'Failed to update section')
    }
  }

  const handleUpdateSection = async (sectionId: string, updates: { config?: any; content?: any }) => {
    setSaving(true)
    try {
      const result = await updateTemplateSection(sectionId, updates)
      if (result.success) {
        setSections(sections.map(s => 
          s.id === sectionId 
            ? { ...s, ...updates }
            : s
        ))
        toast.success('Section updated')
      } else {
        toast.error(result.error || 'Failed to update section')
      }
    } catch (error) {
      toast.error('Failed to update section')
    } finally {
      setSaving(false)
    }
  }

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'hero': return ImageIcon
      case 'features': return Layout
      default: return Type
    }
  }

  const getSectionTitle = (type: string) => {
    const section = availableSectionTypes.find(s => s.type === type)
    return section?.label || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const handleAddSection = async (sectionType: string) => {
    if (!template?.id) return
    
    const nextOrder = sections.length > 0 
      ? Math.max(...sections.map(s => s.section_order)) + 1 
      : 1

    const result = await createTemplateSection(template.id, {
      section_type: sectionType,
      section_order: nextOrder,
      is_enabled: true,
      config: {},
      content: {},
    })

    if (result.success) {
      toast.success('Section added successfully')
      await loadTemplate()
      setShowAddSection(false)
      if (result.data) {
        setExpandedSection(result.data.id)
      }
    } else {
      toast.error(result.error || 'Failed to add section')
    }
  }

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return

    const result = await deleteTemplateSection(sectionId)
    if (result.success) {
      toast.success('Section deleted')
      await loadTemplate()
      if (expandedSection === sectionId) {
        setExpandedSection(null)
      }
    } else {
      toast.error(result.error || 'Failed to delete section')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading template...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/cms')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Home Page Template</h1>
            <p className="text-gray-600 mt-1">Customize your home page sections and content</p>
          </div>
        </div>
      </div>

      {/* Preview Toggle */}
      <div className="bg-white border rounded-lg p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Live Preview</h3>
          <p className="text-sm text-gray-600">See how your changes look on the store</p>
        </div>
        <Button variant="outline" onClick={() => window.open('/', '_blank')}>
          <Eye className="w-4 h-4 mr-2" />
          View Store
        </Button>
      </div>

      {/* Add Section Button */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Sections</h3>
            <p className="text-sm text-gray-600">Add and manage page sections</p>
          </div>
          <div className="relative">
            <Button onClick={() => setShowAddSection(!showAddSection)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Section
            </Button>
            
            {showAddSection && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowAddSection(false)}
                />
                <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <h4 className="font-semibold p-2 text-sm">Choose a section type</h4>
                    <div className="space-y-1">
                      {availableSectionTypes.map((sectionType) => {
                        const Icon = sectionType.icon
                        return (
                          <button
                            key={sectionType.type}
                            onClick={() => handleAddSection(sectionType.type)}
                            className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg text-left transition-colors"
                          >
                            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-5 h-5 text-teal-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{sectionType.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{sectionType.description}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-4">
        {sections.map((section, index) => {
          const Icon = getSectionIcon(section.section_type)
          const isExpanded = expandedSection === section.id
          
          return (
            <div key={section.id} className="bg-white border rounded-lg overflow-hidden">
              {/* Section Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3 flex-1">
                  <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    section.is_enabled ? 'bg-teal-50' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${section.is_enabled ? 'text-teal-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{getSectionTitle(section.section_type)}</h3>
                    <p className="text-sm text-gray-500">Section {index + 1}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleSection(section.id, !section.is_enabled)}
                  >
                    {section.is_enabled ? (
                      <Eye className="w-4 h-4 text-green-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSection(section.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Section Editor */}
              {isExpanded && (
                <div className="p-6 border-t bg-gray-50">
                  {section.section_type === 'hero' && (
                    <HeroSectionEditor
                      section={section}
                      onUpdate={(updates) => handleUpdateSection(section.id, updates)}
                      saving={saving}
                    />
                  )}
                  {section.section_type === 'features' && (
                    <FeaturesSectionEditor
                      section={section}
                      onUpdate={(updates) => handleUpdateSection(section.id, updates)}
                      saving={saving}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HeroSectionEditor({ section, onUpdate, saving }: { section: Section; onUpdate: (updates: any) => void; saving: boolean }) {
  const [content, setContent] = useState(section.content || {})
  const [config, setConfig] = useState(section.config || {})

  const handleSave = () => {
    onUpdate({ content, config })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <ImagePicker
            value={content.image || ''}
            onChange={(url) => setContent({ ...content, image: url })}
            label="Hero Image"
            bucket="cms-media"
            recommendedSize="1920x800px"
            previewWidth={300}
            previewHeight={150}
          />
        </div>
        <div>
          <Label>Button Text</Label>
          <Input
            value={content.buttonText || 'Shop Now'}
            onChange={(e) => setContent({ ...content, buttonText: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Button Link</Label>
          <div className="mt-1">
            <MenuLinkAutocomplete
              value={content.buttonLink || '/product'}
              onChange={(url) => setContent({ ...content, buttonLink: url })}
            />
          </div>
        </div>
        <div>
          <Label>Section Height</Label>
          <Input
            value={config.height || '600px'}
            onChange={(e) => setConfig({ ...config, height: e.target.value })}
            placeholder="600px"
            className="mt-1"
          />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  )
}

function FeaturesSectionEditor({ section, onUpdate, saving }: { section: Section; onUpdate: (updates: any) => void; saving: boolean }) {
  const [content, setContent] = useState(section.content || {})
  const [config, setConfig] = useState(section.config || {})

  const features = content.items || [
    { icon: 'Award', title: 'Premium Quality' },
    { icon: 'Wallet', title: 'Wallet Friendly' },
    { icon: 'Leaf', title: 'Eco Safe' },
    { icon: 'Heart', title: 'Organic' },
  ]

  const handleUpdateFeature = (index: number, field: string, value: string) => {
    const newItems = [...features]
    newItems[index] = { ...newItems[index], [field]: value }
    setContent({ ...content, items: newItems })
  }

  const handleSave = () => {
    onUpdate({ content, config })
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>Number of Columns</Label>
        <Input
          type="number"
          value={config.columns || 4}
          onChange={(e) => setConfig({ ...config, columns: parseInt(e.target.value) || 4 })}
          className="mt-1"
          min={1}
          max={6}
        />
      </div>
      <div className="space-y-4">
        <Label>Feature Items</Label>
        {features.map((feature: any, index: number) => (
          <div key={index} className="border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Icon Name</Label>
                <Input
                  value={feature.icon || ''}
                  onChange={(e) => handleUpdateFeature(index, 'icon', e.target.value)}
                  placeholder="Award"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input
                  value={feature.title || ''}
                  onChange={(e) => handleUpdateFeature(index, 'title', e.target.value)}
                  placeholder="Premium Quality"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  )
}

