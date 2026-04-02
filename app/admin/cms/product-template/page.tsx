'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Edit, 
  Plus, 
  Trash2, 
  GripVertical,
  X,
  Image as ImageIcon,
  Type,
  Layout,
  ShoppingBag,
  MessageSquare,
  Video,
  FileText,
  Grid3x3,
  Columns,
  Check,
  X as XIcon,
  Package,
  Star,
  HelpCircle,
  Users,
  TrendingUp,
  Zap,
  Award,
  List,
  Quote,
  Images,
  Film,
  Sliders,
  Mail
} from 'lucide-react'
import { toast } from 'sonner'
import { 
  getProductTemplateById, 
  getAllProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  deleteProductTemplate,
  updateTemplateSection, 
  createTemplateSection, 
  deleteTemplateSection, 
  reorderSections 
} from '@/app/actions/cms'
import { ImagePicker } from '@/components/admin/image-picker'
import { MenuLinkAutocomplete } from '@/components/admin/menu-link-autocomplete'
import {
  ProductHeroEditor,
  ProductFeaturesEditor,
  ProductGalleryEditor,
  ProductVideoEditor,
  ProductDescriptionEditor,
  ProductSpecsEditor,
  RelatedProductsEditor,
  ImageTextEditor,
  ImageImageEditor,
  BristlesSectionEditor,
  BrushSectionEditor,
  ConfidenceSectionEditor,
  VideoWithTextEditor,
  CompareSectionEditor
} from './section-editors'
import {
  TestimonialsEditor,
  MultiColumnEditor
} from '../homepage-editor/section-editors'

interface Section {
  id: string
  section_type: string
  section_order: number
  is_enabled: boolean
  config: any
  content: any
}

export default function ProductTemplatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(true)
  const [showAddSection, setShowAddSection] = useState(false)
  const [showCreateTemplate, setShowCreateTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [adminSidebarCollapsed, setAdminSidebarCollapsed] = useState(false)
  const [draggedSection, setDraggedSection] = useState<string | null>(null)
  const [previewProductSlug, setPreviewProductSlug] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const availableSectionTypes = [
    // Product-specific sections
    { type: 'product_hero', label: 'Product Hero', icon: ImageIcon, description: 'Main product image and details' },
    { type: 'product_features', label: 'Product Features', icon: Grid3x3, description: 'Key product features grid' },
    { type: 'product_gallery', label: 'Product Gallery', icon: Images, description: 'Image gallery for product' },
    { type: 'product_video', label: 'Product Video', icon: Film, description: 'Product demonstration video' },
    { type: 'product_description', label: 'Product Description', icon: Type, description: 'Rich text product description' },
    { type: 'product_specs', label: 'Product Specifications', icon: List, description: 'Technical specifications table' },
    { type: 'bristles_section', label: 'Bristles Section', icon: Package, description: 'Bristles detail section' },
    { type: 'brush_section', label: 'Brush Section', icon: ShoppingBag, description: 'Brush detail section' },
    { type: 'confidence_section', label: 'Confidence Section', icon: Award, description: 'Confidence/trust section' },
    { type: 'related_products', label: 'Related Products', icon: ShoppingBag, description: 'Related products grid' },
    // Shared sections
    { type: 'hero', label: 'Hero Banner', icon: ImageIcon, description: 'Full-width banner with image and text' },
    { type: 'image_banner', label: 'Image Banner', icon: ImageIcon, description: 'Full-width image banner with optional overlay text' },
    { type: 'carousel', label: 'Image Carousel', icon: Sliders, description: 'Sliding image carousel with multiple images' },
    { type: 'image_gallery', label: 'Image Gallery', icon: Images, description: 'Grid gallery of images' },
    { type: 'features', label: 'Features', icon: Grid3x3, description: 'Grid of feature icons and text' },
    { type: 'product_showcase', label: 'Product Showcase', icon: ShoppingBag, description: 'Product highlight sections' },
    { type: 'product_grid', label: 'Product Grid', icon: Package, description: 'Grid of featured products' },
    { type: 'video', label: 'Video Section', icon: Film, description: 'Video embed section' },
    { type: 'video_with_text', label: 'Video + Text', icon: Video, description: 'Video with accompanying text content' },
    { type: 'testimonials', label: 'Testimonials', icon: Quote, description: 'Customer testimonials carousel' },
    { type: 'reviews', label: 'Reviews', icon: Star, description: 'Product reviews section' },
    { type: 'text', label: 'Text Block', icon: Type, description: 'Rich text content' },
    { type: 'image_text', label: 'Image + Text', icon: Columns, description: 'Two column layout' },
    { type: 'image_image', label: 'Image + Image', icon: Images, description: 'Two images side by side' },
    { type: 'compare_section', label: 'Compare', icon: Columns, description: 'Two images/text blocks side by side' },
    { type: 'multi_column', label: 'Multi Column', icon: Columns, description: 'Multiple column layout' },
    { type: 'newsletter', label: 'Newsletter Signup', icon: Mail, description: 'Email signup form section' },
    { type: 'countdown', label: 'Countdown Timer', icon: Zap, description: 'Countdown timer for sales/events' },
    { type: 'trust_badges', label: 'Trust Badges', icon: Award, description: 'Trust badges and certifications' },
    { type: 'stats', label: 'Statistics', icon: TrendingUp, description: 'Statistics and numbers' },
    { type: 'faq', label: 'FAQ Section', icon: HelpCircle, description: 'Frequently asked questions' },
    { type: 'team', label: 'Team Section', icon: Users, description: 'Team members showcase' },
  ]

  useEffect(() => {
    loadTemplates()
    loadPreviewProduct()
  }, [])

  const loadPreviewProduct = async () => {
    try {
      const { getAllActiveProducts } = await import('@/app/actions/products')
      const result = await getAllActiveProducts(true) // Use admin client
      if (result.data && result.data.length > 0) {
        // Use the first active product for preview
        setPreviewProductSlug(result.data[0].slug)
      }
    } catch (error) {
      console.error('Error loading preview product:', error)
    }
  }

  useEffect(() => {
    if (selectedTemplate?.id) {
      loadTemplate(selectedTemplate.id)
    } else {
      setSections([])
      setEditingSection(null)
    }
  }, [selectedTemplate?.id])

  // Detect admin sidebar collapse state
  useEffect(() => {
    const checkSidebarState = () => {
      const savedPreference = localStorage.getItem('admin-sidebar-hide-icons')
      setAdminSidebarCollapsed(savedPreference === 'true')
    }

    // Check on mount
    checkSidebarState()

    // Listen for storage changes (when sidebar is toggled)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin-sidebar-hide-icons') {
        checkSidebarState()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Also listen for custom event (for same-tab updates)
    const handleCustomStorageChange = () => {
      checkSidebarState()
    }
    window.addEventListener('admin-sidebar-toggle', handleCustomStorageChange)

    // Poll for changes (fallback for same-tab updates)
    const interval = setInterval(checkSidebarState, 100)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('admin-sidebar-toggle', handleCustomStorageChange)
      clearInterval(interval)
    }
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const result = await getAllProductTemplates()
      if (result.error) {
        toast.error('Failed to load templates')
        return
      }
      setTemplates(result.data || [])
      if (result.data && result.data.length > 0) {
        const activeTemplate = result.data.find((t: any) => t.is_active) || result.data[0]
        setSelectedTemplate(activeTemplate)
      }
    } catch (error) {
      console.error('Error loading templates:', error)
      toast.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const loadTemplate = async (templateId: string) => {
    setLoading(true)
    try {
      const result = await getProductTemplateById(templateId)
      if (result.error) {
        toast.error('Failed to load template')
        setSections([])
        return
      }
      // Only update selectedTemplate if it's different to avoid re-render loops
      if (selectedTemplate?.id !== result.data?.id) {
      setSelectedTemplate(result.data)
      }
      const sortedSections = (result.data?.sections || []).sort((a: Section, b: Section) => a.section_order - b.section_order)
      setSections(sortedSections)
      
      // Refresh preview when template changes
      setTimeout(() => refreshPreview(), 500)
    } catch (error) {
      console.error('Error loading template:', error)
      toast.error('Failed to load template')
      setSections([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Template name is required')
      return
    }

    const result = await createProductTemplate(newTemplateName.trim())
    if (result.success) {
      toast.success('Template created successfully')
      setShowCreateTemplate(false)
      setNewTemplateName('')
      await loadTemplates()
      if (result.data) {
        setSelectedTemplate(result.data)
      }
    } else {
      toast.error(result.error || 'Failed to create template')
    }
  }

  const handleActivateTemplate = async (templateId: string) => {
    if (!confirm('Set this template as the default? This will make it the fallback template for products without an assigned template. Products with assigned templates will continue using their assigned templates.')) {
      return
    }
    const result = await updateProductTemplate(templateId, { is_active: true })
    if (result.success) {
      toast.success('Template set as default')
      await loadTemplates()
    } else {
      toast.error(result.error || 'Failed to set default template')
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) return

    const result = await deleteProductTemplate(templateId)
    if (result.success) {
      toast.success('Template deleted')
      await loadTemplates()
      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null)
        setSections([])
      }
    } else {
      toast.error(result.error || 'Failed to delete template')
    }
  }

  const handleSaveSection = async (sectionId: string, updates: { config?: any; content?: any }) => {
    setSaving(true)
    try {
      const result = await updateTemplateSection(sectionId, updates)
      if (result.success) {
        // Reload the template to get the latest data from database
        // This ensures all sections have their correct, separate content
        const currentEditingSection = editingSection // Preserve editing state
        await loadTemplate(selectedTemplate!.id)
        // Restore editing state after reload
        setEditingSection(currentEditingSection)
        toast.success('Section saved successfully')
        setTimeout(() => refreshPreview(), 1000)
      } else {
        toast.error(result.error || 'Failed to save section')
      }
    } catch (error) {
      toast.error('Failed to save section')
    } finally {
      setSaving(false)
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

  const handleAddSection = async (sectionType: string) => {
    if (!selectedTemplate?.id) return
    
    // Allow multiple instances of the same section type - just create a new one
    const nextOrder = sections.length > 0 
      ? Math.max(...sections.map(s => s.section_order)) + 1 
      : 1

    const result = await createTemplateSection(selectedTemplate.id, {
      section_type: sectionType,
      section_order: nextOrder,
      is_enabled: true,
      config: getDefaultConfig(sectionType),
      content: getDefaultContent(sectionType),
    })

    if (result.success) {
      toast.success('Section added successfully')
      await loadTemplate(selectedTemplate.id)
      setShowAddSection(false)
      if (result.data) {
        setEditingSection(result.data.id)
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
      await loadTemplate(selectedTemplate!.id)
      if (editingSection === sectionId) {
        setEditingSection(null)
      }
    } else {
      toast.error(result.error || 'Failed to delete section')
    }
  }

  const handleReorder = async (sectionId: string, targetOrder: number) => {
    if (!selectedTemplate?.id) return

    // Find the dragged section
    const draggedIndex = sections.findIndex(s => s.id === sectionId)
    if (draggedIndex === -1) return

    // targetOrder is 1-based (the desired position)
    // Convert to 0-based index for array operations
    const targetIndex = targetOrder - 1

    // If dropped in the same position, do nothing
    if (draggedIndex === targetIndex) {
      return
    }

    // Create new array with reordered sections
    const newSections = [...sections]
    const [draggedSection] = newSections.splice(draggedIndex, 1)
    
    // Calculate the correct insertion index
    // If moving down (targetIndex > draggedIndex), we need to adjust because we already removed the item
    // If moving up (targetIndex < draggedIndex), we can insert directly at targetIndex
    const insertIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex
    newSections.splice(insertIndex, 0, draggedSection)

    // Update all orders based on new positions (1-based)
    const reorderData = newSections.map((s, index) => ({
      id: s.id,
      order: index + 1
    }))

    // Optimistically update UI immediately with new orders
    const updatedSections = newSections.map((s, index) => ({
      ...s,
      section_order: index + 1
    }))
    setSections(updatedSections)

    // Save to server
    const result = await reorderSections(reorderData)
    if (result.success) {
      toast.success('Sections reordered')
      // Don't reload - the optimistic update is already in place
      // The sections state is already updated with the new order
    } else {
      toast.error(result.error || 'Failed to reorder sections')
      // Reload to restore original order
      if (selectedTemplate?.id) {
        loadTemplate(selectedTemplate.id)
      }
    }
  }

  const getDefaultConfig = (type: string) => {
    switch (type) {
      case 'product_features':
        return { columns: 4 }
      case 'product_gallery':
        return { columns: 3, spacing: 'medium' }
      case 'image_text':
        return { layout: 'image_left' }
      case 'video_with_text':
        return { layout: 'video_left' }
      case 'image_image':
        return { layout: 'side_by_side', gap: 'medium', imageAspectRatio: 'auto', backgroundColor: '#ffffff' }
      case 'multi_column':
        return { columns: 3, layout: 'equal' }
      case 'related_products':
        return { columns: 4, limit: 4 }
      case 'testimonials':
        return { autoplay: true, autoplaySpeed: 6000, showDots: true }
      case 'faq':
        return { layout: 'accordion', allowMultiple: false }
      case 'trust_badges':
        return { columns: 5, layout: 'horizontal' }
      case 'stats':
        return { columns: 4, animation: true }
      default:
        return {}
    }
  }

  const getDefaultContent = (type: string) => {
    switch (type) {
      case 'product_hero':
        return {
          showRating: true,
          showBadges: true,
        }
      case 'product_features':
        return {
          items: [
            { icon: 'Truck', title: 'FREE Worldwide Express Shipping', description: '' },
            { icon: 'RotateCcw', title: '24/7 Dedicated Customer Service', description: '' },
            { icon: 'DollarSign', title: 'Premium Quality Guaranteed - 5 Days Replacement', description: '' },
            { icon: 'Award', title: 'Your purchase will be delivered in 5-10 business days', description: '' },
            { icon: 'Heart', title: 'We Guarantee 100% you will absolutely love it!', description: '' },
          ]
        }
      case 'product_gallery':
        return {
          images: []
        }
      case 'product_video':
        return {
          videoUrl: '',
          thumbnail: '',
          autoplay: false,
        }
      case 'product_description':
        return {
          title: 'Product Description',
          content: 'Add detailed product description here...',
        }
      case 'product_specs':
        return {
          title: 'Specifications',
          specs: [
            { label: 'Material', value: '' },
            { label: 'Dimensions', value: '' },
            { label: 'Weight', value: '' },
          ]
        }
      case 'bristles_section':
        return {
          title: '',
          image: '',
          content: []
        }
      case 'brush_section':
        return {
          title: '',
          image: '',
          content: []
        }
      case 'confidence_section':
        return {
          title: '',
          image: '',
          content: []
        }
      case 'video_with_text':
        return {
          videoUrl: '',
          thumbnail: '',
          title: '',
          content: []
        }
      case 'compare_section':
        return {
          leftImage: '',
          leftTitle: '',
          leftContent: [],
          rightImage: '',
          rightTitle: '',
          rightContent: []
        }
      case 'image_text':
        return {
          image: '',
          title: '',
          content: []
        }
      case 'brush_section_old':
        return {
          title: 'The Brush',
          leftContent: [
            {
              title: 'Lightweight & Ergonomic Design -',
              content: 'BREVI toothbrush is specially designed for ease of use. The longer it felt like the brush for righteous brushing and it is a very light and flexible structure giving users peace of mind when brushing their teeth.'
            },
            {
              title: 'High-End Safe Materials -',
              content: 'Made of which free bristles with well-cleaned at handles and efficient toothbrushes use to take a very light but flexible structure. Free from harmful chemicals which is certified by CE, FDA, and RoHS.'
            }
          ],
          rightTitle: 'SENSITIVE',
          rightImage: '/placeholder.svg?height=400&width=200',
          leftBgColor: '#C8D5C0',
          rightBgGradient: 'from-[#98D8C8] to-[#B8E8DD]'
        }
      case 'confidence_section':
        return {
          title: '',
          image: '',
          content: []
        }
      case 'testimonials':
        return {
          testimonials: []
        }
      case 'reviews':
        return {
          title: 'Customer Reviews',
          showRatingBreakdown: true,
          showReviewForm: true,
          defaultSort: 'recent',
          numberOfReviews: 10,
          reviewType: 'all',
          productId: 'current',
        }
      case 'related_products':
        return {
          title: 'You May Also Like',
          subtitle: '',
        }
      case 'faq':
        return {
          title: 'Frequently Asked Questions',
          items: []
        }
      case 'image_text':
        return {
          image: '',
          title: '',
          paragraphs: [],
        }
      case 'image_image':
        return {
          image1: '/placeholder.jpg',
          image2: '/placeholder.jpg',
          caption1: '',
          caption2: '',
          link1: '',
          link2: '',
        }
      case 'multi_column':
        return {
          columns: []
        }
      case 'trust_badges':
        return {
          badges: []
        }
      case 'stats':
        return {
          stats: []
        }
      default:
        return {}
    }
  }

  const refreshPreview = () => {
    if (iframeRef.current && selectedTemplate?.id && previewProductSlug) {
      // Update iframe src with template_id parameter for preview and cache-busting timestamp
      const timestamp = Date.now()
      const previewUrl = `/product/${previewProductSlug}?preview=true&template_id=${selectedTemplate.id}&_t=${timestamp}`
      iframeRef.current.src = previewUrl
    } else if (iframeRef.current) {
      // Fallback: just refresh current src with cache-busting
      const currentSrc = iframeRef.current.src
      const separator = currentSrc.includes('?') ? '&' : '?'
      iframeRef.current.src = `${currentSrc}${separator}_t=${Date.now()}`
    }
  }

  const renderSectionEditor = (section: Section) => {
    if (editingSection !== section.id) return null

    return (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Edit Section</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>
              <XIcon className="w-4 h-4" />
            </Button>
          </div>

          {section.section_type === 'product_hero' && (
            <ProductHeroEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'product_features' && (
            <ProductFeaturesEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'product_gallery' && (
            <ProductGalleryEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'product_video' && (
            <ProductVideoEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'product_description' && (
            <ProductDescriptionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'product_specs' && (
            <ProductSpecsEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'related_products' && (
            <RelatedProductsEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'image_text' && (
            <ImageTextEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'image_image' && (
            <ImageImageEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'testimonials' && (
            <TestimonialsEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'multi_column' && (
            <MultiColumnEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'reviews' && (
            <ProductReviewsSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'bristles_section' && (
            <BristlesSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'brush_section' && (
            <BrushSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'confidence_section' && (
            <ConfidenceSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'video_with_text' && (
            <VideoWithTextEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'compare_section' && (
            <CompareSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {['faq', 'trust_badges', 'stats'].includes(section.section_type) && (
            <GenericSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}
      </div>
    )
  }

  if (loading && !selectedTemplate) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading templates...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex items-center justify-between transition-all ${editMode ? 'lg:ml-80' : ''}`}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/cms')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Product Page Templates</h1>
            <p className="text-gray-600 mt-1">Create and manage product page templates</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.open('/product', '_blank')}>
            <Eye className="w-4 h-4 mr-2" />
            View Live
          </Button>
          <Button onClick={() => setEditMode(!editMode)}>
            {editMode ? 'Preview Mode' : 'Edit Mode'}
          </Button>
        </div>
      </div>

      {/* Template Selector */}
      <div className={`bg-white border rounded-lg p-4 transition-all ${editMode ? 'lg:ml-80' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Select Template</h3>
          <Button size="sm" onClick={() => setShowCreateTemplate(!showCreateTemplate)}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>

        {showCreateTemplate && (
          <div className="border rounded-lg p-4 mb-4 space-y-2">
            <Label>Template Name</Label>
            <div className="flex gap-2">
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Premium Template, Simple Template"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTemplate()}
              />
              <Button onClick={handleCreateTemplate}>Create</Button>
              <Button variant="outline" onClick={() => {
                setShowCreateTemplate(false)
                setNewTemplateName('')
              }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedTemplate?.id === template.id ? 'border-teal-500 bg-teal-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">{template.template_name}</h4>
                {template.is_active && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Active</span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Created {new Date(template.created_at).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-500 mb-2">
                {template.is_active ? 'Default template (used for products without assigned template)' : 'Assigned to specific products'}
              </p>
              <div className="flex gap-2">
                {!template.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleActivateTemplate(template.id)
                    }}
                    title="Set as default template for products without assigned templates"
                  >
                    Set as Default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteTemplate(template.id)
                  }}
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedTemplate && (
        <>
          {/* Sections List Sidebar */}
          {editMode && (
            <div className="fixed top-0 h-full w-80 bg-white border-r shadow-lg z-40 overflow-y-auto hidden lg:block pt-16" style={{ left: adminSidebarCollapsed ? '64px' : '256px' }}>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Page Sections</h3>
                  <Button size="sm" onClick={() => setShowAddSection(!showAddSection)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>

                {showAddSection && (
                  <div className="border rounded-lg p-4 mb-4 space-y-2 max-h-96 overflow-y-auto">
                    <h4 className="font-semibold text-sm mb-2">Add New Section</h4>
                    {availableSectionTypes.map((type) => (
                      <Button
                        key={type.type}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleAddSection(type.type)}
                      >
                        <type.icon className="w-4 h-4 mr-2" />
                        {type.label}
                      </Button>
                    ))}
                  </div>
                )}

                {sections.map((section, index) => {
                  const isDragging = draggedSection === section.id
                  
                  return (
                  <div
                    key={section.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedSection(section.id)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/html', section.id)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        e.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (draggedSection && draggedSection !== section.id) {
                          // Drop on this section means insert at this position (before this section)
                          handleReorder(draggedSection, index + 1)
                        }
                        setDraggedSection(null)
                      }}
                      onDragEnd={() => {
                        setDraggedSection(null)
                      }}
                      className={`border rounded-lg p-4 cursor-move transition-all ${
                      editingSection === section.id ? 'border-teal-500 bg-teal-50' : ''
                      } ${
                        isDragging ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                        <span className="font-medium text-sm">
                          {availableSectionTypes.find(t => t.type === section.section_type)?.label || section.section_type}
                          {/* Show section number to help distinguish multiple instances of the same type */}
                          {sections.filter(s => s.section_type === section.section_type).length > 1 && (
                            <span className="text-xs text-gray-500 ml-1">
                              #{sections.filter(s => s.section_type === section.section_type && s.section_order <= section.section_order).length}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSection(section.id)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleSection(section.id, !section.is_enabled)}
                        >
                          {section.is_enabled ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3 opacity-50" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSection(section.id)}
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    {!section.is_enabled && (
                      <p className="text-xs text-gray-500">Hidden</p>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Main Preview Area */}
          <div className={`${editMode ? 'lg:ml-80' : ''} ${editingSection ? 'lg:mr-96' : ''} transition-all`}>
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="w-full" style={{ height: 'calc(100vh - 200px)' }}>
                {previewProductSlug && selectedTemplate?.id ? (
                  <iframe
                    ref={iframeRef}
                    src={`/product/${previewProductSlug}?preview=true&template_id=${selectedTemplate.id}&_t=${Date.now()}`}
                    className="w-full h-full border-0"
                    title="Product Page Preview"
                    key={`preview-${selectedTemplate.id}-${Date.now()}`} // Force reload when template changes
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    {loading ? 'Loading preview...' : 'No product available for preview'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section Editor Sidebar */}
          {editingSection && (
            <div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-96 bg-white border-l shadow-xl z-50 overflow-y-auto hidden lg:block">
              {sections.map(section => (
                <div key={section.id}>
                  {renderSectionEditor(section)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Product Reviews Section Editor
function ProductReviewsSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {
    title: "Customer Reviews",
    showRatingBreakdown: true,
    showReviewForm: true,
    defaultSort: 'recent',
    numberOfReviews: 10,
    reviewType: 'all',
    productId: 'current', // 'current' means use the current product, or a specific product ID
  })
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const { getAllActiveProducts } = await import('@/app/actions/products')
      const result = await getAllActiveProducts()
      if (result.data) {
        setProducts(result.data.map((p: any) => ({ id: p.id, title: p.title })))
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div>
          <Label>Section Title</Label>
          <Input
            value={content.title || ''}
            onChange={(e) => setContent({ ...content, title: e.target.value })}
            placeholder="Customer Reviews"
          />
        </div>

        <div>
          <Label>Number of Reviews to Display</Label>
          <Input
            type="number"
            min="1"
            max="50"
            value={content.numberOfReviews || 10}
            onChange={(e) => setContent({ ...content, numberOfReviews: parseInt(e.target.value) || 10 })}
            placeholder="10"
          />
          <p className="text-xs text-gray-500 mt-1">Maximum number of reviews to show initially (1-50)</p>
        </div>

        <div>
          <Label>Product to Show Reviews From</Label>
          <select
            value={content.productId || 'current'}
            onChange={(e) => setContent({ ...content, productId: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            disabled={loadingProducts}
          >
            <option value="current">Current Product (Product being viewed)</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {loadingProducts ? 'Loading products...' : 'Select which product\'s reviews to display. "Current Product" will show reviews for the product being viewed.'}
          </p>
        </div>

        <div>
          <Label>Review Type Filter</Label>
          <select
            value={content.reviewType || 'all'}
            onChange={(e) => setContent({ ...content, reviewType: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="all">All Reviews</option>
            <option value="verified">Verified Purchases Only</option>
            <option value="with_images">Reviews with Images</option>
            <option value="5_star">5 Star Reviews Only</option>
            <option value="4_5_star">4-5 Star Reviews</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Filter which reviews to display for this product template</p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showRatingBreakdown"
            checked={content.showRatingBreakdown !== false}
            onChange={(e) => setContent({ ...content, showRatingBreakdown: e.target.checked })}
            className="rounded border-gray-300"
          />
          <Label htmlFor="showRatingBreakdown">Show Rating Breakdown</Label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showReviewForm"
            checked={content.showReviewForm !== false}
            onChange={(e) => setContent({ ...content, showReviewForm: e.target.checked })}
            className="rounded border-gray-300"
          />
          <Label htmlFor="showReviewForm">Show Review Form Button</Label>
        </div>

        <div>
          <Label>Default Sort</Label>
          <select
            value={content.defaultSort || 'recent'}
            onChange={(e) => setContent({ ...content, defaultSort: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="recent">Most Recent</option>
            <option value="helpful">Most Helpful</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
          </select>
        </div>

        <p className="text-sm text-gray-600">
          Note: Reviews are automatically fetched from the database for the product. This section will display approved, non-hidden reviews based on your filter settings.
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// Generic Section Editor for sections without specific editors
function GenericSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Title</Label>
        <Input
          value={content.title || ''}
          onChange={(e) => setContent({ ...content, title: e.target.value })}
          placeholder="Section Title"
        />
      </div>
      <div>
        <Label>Content</Label>
        <Textarea
          value={content.content || content.description || ''}
          onChange={(e) => setContent({ ...content, content: e.target.value, description: e.target.value })}
          placeholder="Section content..."
          rows={8}
        />
      </div>
      {(section.section_type === 'bristles_section' || section.section_type === 'brush_section' || section.section_type === 'confidence_section') && (
        <div>
          <Label>Image</Label>
          <ImagePicker
            value={content.image || ''}
            onChange={(url) => setContent({ ...content, image: url })}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
