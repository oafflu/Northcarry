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
  Images,
  Film,
  Mail,
  Star,
  Quote,
  List,
  Sliders,
  Zap,
  Users,
  Award,
  TrendingUp,
  Package,
  Monitor,
  Smartphone
} from 'lucide-react'
import { toast } from 'sonner'
import { getPageTemplate, updateTemplateSection, createTemplateSection, deleteTemplateSection, reorderSections } from '@/app/actions/cms'
import { ImagePicker } from '@/components/admin/image-picker'
import { MenuLinkAutocomplete } from '@/components/admin/menu-link-autocomplete'
import {
  ImageBannerEditor,
  CarouselEditor,
  ImageGalleryEditor,
  ProductGridEditor,
  VideoEditor,
  VideoWithTextEditor,
  TestimonialsEditor,
  MultiColumnEditor,
  NewsletterEditor,
  ImageImageEditor
} from './section-editors'
// Note: We'll use an iframe to show the actual page since sections are server components

interface Section {
  id: string
  section_type: string
  section_order: number
  is_enabled: boolean
  config: any
  content: any
}

export default function HomepageEditorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [template, setTemplate] = useState<any>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(true)
  const [showAddSection, setShowAddSection] = useState(false)
  const [draggedSection, setDraggedSection] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [adminSidebarCollapsed, setAdminSidebarCollapsed] = useState(false)

  const availableSectionTypes = [
    // Homepage-specific sections
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
    { type: 'reviews', label: 'Reviews', icon: MessageSquare, description: 'Customer reviews section' },
    { type: 'text', label: 'Text Block', icon: Type, description: 'Rich text content' },
    { type: 'image_text', label: 'Image + Text', icon: Columns, description: 'Two column layout' },
    { type: 'image_image', label: 'Image + Image', icon: Images, description: 'Two images side by side' },
    { type: 'multi_column', label: 'Multi Column', icon: Columns, description: 'Multiple column layout with images/text' },
    { type: 'newsletter', label: 'Newsletter Signup', icon: Mail, description: 'Email signup form section' },
    { type: 'countdown', label: 'Countdown Timer', icon: Zap, description: 'Countdown timer for sales/events' },
    { type: 'trust_badges', label: 'Trust Badges', icon: Award, description: 'Trust badges and certifications' },
    { type: 'stats', label: 'Statistics', icon: TrendingUp, description: 'Statistics and numbers section' },
    { type: 'faq', label: 'FAQ Section', icon: List, description: 'Frequently asked questions' },
    { type: 'team', label: 'Team Section', icon: Users, description: 'Team members showcase' },
    // Product sections (can be used on homepage too)
    { type: 'product_features', label: 'Product Features', icon: Grid3x3, description: 'Key product features grid' },
    { type: 'product_gallery', label: 'Product Gallery', icon: Images, description: 'Image gallery for product' },
    { type: 'product_video', label: 'Product Video', icon: Film, description: 'Product demonstration video' },
    { type: 'product_description', label: 'Product Description', icon: Type, description: 'Rich text product description' },
    { type: 'product_specs', label: 'Product Specifications', icon: List, description: 'Technical specifications table' },
    { type: 'bristles_section', label: 'Bristles Section', icon: Package, description: 'Bristles detail section' },
    { type: 'brush_section', label: 'Brush Section', icon: ShoppingBag, description: 'Brush detail section' },
    { type: 'confidence_section', label: 'Confidence Section', icon: Award, description: 'Confidence/trust section' },
    { type: 'related_products', label: 'Related Products', icon: ShoppingBag, description: 'Related products grid' },
  ]

  useEffect(() => {
    loadTemplate()
  }, [])

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

  const loadTemplate = async () => {
    setLoading(true)
    try {
      // Include disabled sections for the editor so admins can see and re-enable them
      const result = await getPageTemplate('home', undefined, true)
      if (result.error) {
        toast.error('Failed to load template')
        return
      }
      setTemplate(result.data)
      const sortedSections = (result.data?.sections || []).sort((a: Section, b: Section) => a.section_order - b.section_order)
      setSections(sortedSections)
    } catch (error) {
      console.error('Error loading template:', error)
      toast.error('Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSection = async (sectionId: string, updates: { config?: any; content?: any }) => {
    setSaving(true)
    try {
      // Debug logging
      console.log('[HomepageEditor] Saving section:', {
        sectionId,
        updates,
        contentProductIds: updates.content?.productIds
      })
      
      const result = await updateTemplateSection(sectionId, updates)
      if (result.success) {
        // Reload template to get fresh data from server
        await loadTemplate()
        toast.success('Section saved successfully')
        setEditingSection(null)
        // Refresh preview after a short delay to allow cache to clear
        setTimeout(() => refreshPreview(), 1000)
      } else {
        toast.error(result.error || 'Failed to save section')
      }
    } catch (error) {
      console.error('Error saving section:', error)
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
    if (!template?.id) return
    
    // Check if a section of this type already exists
    const existingSection = sections.find(s => s.section_type === sectionType)
    
    if (existingSection) {
      // If section exists but is disabled, enable it instead of creating a duplicate
      if (!existingSection.is_enabled) {
        const result = await updateTemplateSection(existingSection.id, { 
          is_enabled: true,
          config: getDefaultConfig(sectionType),
          content: getDefaultContent(sectionType),
        })
        if (result.success) {
          toast.success('Section enabled successfully')
          await loadTemplate()
          setShowAddSection(false)
          setEditingSection(existingSection.id)
        } else {
          toast.error(result.error || 'Failed to enable section')
        }
      } else {
        // Section already exists and is enabled
        toast.info('This section already exists and is enabled')
        setShowAddSection(false)
        setEditingSection(existingSection.id)
      }
      return
    }
    
    // Section doesn't exist, create a new one
    const nextOrder = sections.length > 0 
      ? Math.max(...sections.map(s => s.section_order)) + 1 
      : 1

    const result = await createTemplateSection(template.id, {
      section_type: sectionType,
      section_order: nextOrder,
      is_enabled: true,
      config: getDefaultConfig(sectionType),
      content: getDefaultContent(sectionType),
    })

    if (result.success) {
      toast.success('Section added successfully')
      await loadTemplate()
      setShowAddSection(false)
      if (result.data) {
        setEditingSection(result.data.id)
      }
    } else {
      // Check if error is due to duplicate key constraint
      if (result.error?.includes('duplicate key') || result.error?.includes('unique constraint')) {
        toast.error('This section type already exists. Please enable it from the sections list instead.')
    } else {
      toast.error(result.error || 'Failed to add section')
      }
    }
  }

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return

    const result = await deleteTemplateSection(sectionId)
    if (result.success) {
      toast.success('Section deleted')
      await loadTemplate()
      if (editingSection === sectionId) {
        setEditingSection(null)
      }
    } else {
      toast.error(result.error || 'Failed to delete section')
    }
  }

  const handleReorder = async (sectionId: string, targetOrder: number) => {
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
      loadTemplate()
    }
  }

  const getDefaultConfig = (type: string) => {
    switch (type) {
      case 'features':
        return { columns: 4 }
      case 'image_text':
        return { layout: 'image_left' }
      case 'carousel':
        return { autoplay: true, autoplaySpeed: 5000, showDots: true, showArrows: true }
      case 'image_gallery':
        return { columns: 3, spacing: 'medium' }
      case 'multi_column':
        return { columns: 3, layout: 'equal' }
      case 'product_grid':
        return { columns: 4, limit: 8 }
      case 'video_with_text':
        return { layout: 'video_left' }
      case 'testimonials':
        return { autoplay: true, autoplaySpeed: 6000, showDots: true }
      case 'countdown':
        return { format: 'days_hours_minutes', showLabels: true }
      case 'trust_badges':
        return { columns: 5, layout: 'horizontal' }
      case 'stats':
        return { columns: 4, animation: true }
      case 'faq':
        return { layout: 'accordion', allowMultiple: false }
      case 'team':
        return { columns: 4, showSocial: true }
      default:
        return {}
    }
  }

  const getDefaultContent = (type: string) => {
    switch (type) {
      case 'hero':
        return {
          heroImage: '/images/brevi_banner_web.png',
          heading: '50% OFF',
          subheading: 'FOR A LIMITED TIME',
          buttonText: 'Shop Now',
          buttonLink: '/product',
          showRating: true,
        }
      case 'image_banner':
        return {
          image: '',
          overlayText: '',
          overlayPosition: 'center',
          buttonText: '',
          buttonLink: '',
        }
      case 'carousel':
        return {
          slides: []
        }
      case 'image_gallery':
        return {
          images: []
        }
      case 'features':
        return {
          items: [
            { icon: 'Award', title: 'Premium Quality' },
            { icon: 'Wallet', title: 'Wallet Friendly' },
            { icon: 'Leaf', title: 'Eco Safe' },
            { icon: 'Heart', title: 'Organic' },
          ]
        }
      case 'product_grid':
        return {
          title: 'Featured Products',
          subtitle: 'Shop our best sellers',
          productIds: [],
        }
      case 'video':
        return {
          videoUrl: '',
          thumbnail: '',
          autoplay: false,
          loop: false,
          muted: false,
        }
      case 'video_with_text':
        return {
          videoUrl: '',
          thumbnail: '',
          title: '',
          content: [],
        }
      case 'testimonials':
        return {
          testimonials: []
        }
      case 'text':
        return {
          title: '',
          content: '',
        }
      case 'image_text':
        return {
          image: '',
          title: '',
          content: [],
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
      case 'compare_section':
        return {
          leftImage: '',
          leftTitle: '',
          leftContent: [],
          rightImage: '',
          rightTitle: '',
          rightContent: []
        }
      case 'image_image':
        return {
          image1: '',
          image2: '',
          caption1: '',
          caption2: '',
          link1: '',
          link2: '',
        }
      case 'multi_column':
        return {
          columns: []
        }
      case 'newsletter':
        return {
          title: 'Subscribe to Our Newsletter',
          subtitle: 'Get the latest updates and exclusive offers',
          placeholder: 'Enter your email',
          buttonText: 'Subscribe',
        }
      case 'countdown':
        return {
          title: 'Sale Ends In',
          targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          message: 'Don\'t miss out on this amazing deal!',
        }
      case 'trust_badges':
        return {
          badges: []
        }
      case 'stats':
        return {
          stats: []
        }
      case 'faq':
        return {
          title: '',
          items: []
        }
      case 'team':
        return {
          title: '',
          members: []
        }
      default:
        return {}
    }
  }

  // Refresh iframe after saving
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  const refreshPreview = () => {
    if (iframeRef.current) {
      // Add cache-busting parameter to force refresh
      const currentSrc = iframeRef.current.src
      const separator = currentSrc.includes('?') ? '&' : '?'
      iframeRef.current.src = `${currentSrc}${separator}_t=${Date.now()}`
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading page editor...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 -m-4 sm:-m-6">
      {/* Header */}
      <div className={`flex items-center justify-between bg-white p-4 sm:p-6 border-b sticky top-0 z-30 transition-all ${editMode ? 'lg:ml-80' : ''}`}>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/cms')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Homepage Editor</h1>
            <p className="text-gray-600 mt-1 text-sm">Manage content visually</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.open('/', '_blank')}>
            <Eye className="w-4 h-4 mr-2" />
            View Live
          </Button>
          <Button onClick={() => setEditMode(!editMode)}>
            {editMode ? 'Preview Mode' : 'Edit Mode'}
          </Button>
        </div>
      </div>

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
              <div className="border rounded-lg p-4 mb-4 space-y-2">
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
          {/* Preview Controls */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Preview Mode:</span>
              <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
                <Button
                  variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                  className="h-8 px-3"
                >
                  <Monitor className="w-4 h-4 mr-1" />
                  Desktop
                </Button>
                <Button
                  variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                  className="h-8 px-3"
                >
                  <Smartphone className="w-4 h-4 mr-1" />
                  Mobile
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshPreview}
              className="text-sm"
            >
              Refresh Preview
            </Button>
          </div>
          
          {/* Preview Frame - Use iframe to show actual page */}
          <div className="flex items-center justify-center bg-gray-100 p-4 sm:p-8">
            <div 
              className="bg-white border-4 border-gray-300 rounded-lg shadow-2xl overflow-hidden transition-all"
              style={{
                width: previewMode === 'mobile' ? '375px' : '100%',
                maxWidth: previewMode === 'mobile' ? '375px' : '100%',
                height: previewMode === 'mobile' ? '667px' : 'calc(100vh - 300px)',
                minHeight: previewMode === 'mobile' ? '667px' : '600px',
              }}
            >
              <iframe
                ref={iframeRef}
                src="/"
                className="w-full h-full border-0"
                title="Homepage Preview"
                style={{
                  transform: previewMode === 'mobile' ? 'scale(1)' : 'scale(1)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section Editor Sidebar */}
      {editingSection && (
        <div className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-96 bg-white border-l shadow-xl z-50 overflow-y-auto hidden lg:block">
          {sections.map(section => {
            if (editingSection !== section.id) return null
            return (
              <div key={section.id} className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Edit Section</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditingSection(null)}>
              <XIcon className="w-4 h-4" />
            </Button>
          </div>

          {section.section_type === 'hero' && (
            <HeroSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'features' && (
            <FeaturesSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'product_showcase' && (
            <ProductShowcaseEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'reviews' && (
            <ReviewsSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'text' && (
            <TextSectionEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'image_text' && (
            <ImageTextSectionEditor 
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

                {section.section_type === 'image_banner' && (
                  <ImageBannerEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'carousel' && (
            <CarouselEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'image_gallery' && (
            <ImageGalleryEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'product_grid' && (
            <ProductGridEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'video' && (
            <VideoEditor 
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

          {section.section_type === 'newsletter' && (
            <NewsletterEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'countdown' && (
            <CountdownEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'trust_badges' && (
            <TrustBadgesEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'stats' && (
            <StatsEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'faq' && (
            <FAQEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}

          {section.section_type === 'team' && (
            <TeamEditor 
              section={section} 
              onSave={(updates) => handleSaveSection(section.id, updates)}
              onCancel={() => setEditingSection(null)}
            />
          )}
      </div>
    )
          })}
              </div>
            )}
    </div>
  )
}

// Section Editor Components
function HeroSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Hero Image (Desktop)</Label>
        <ImagePicker
          value={content.heroImage || ''}
          onChange={(url) => setContent({ ...content, heroImage: url })}
        />
      </div>
      <div>
        <Label>Hero Image (Mobile)</Label>
        <ImagePicker
          value={content.mobileHeroImage || content.heroImage || ''}
          onChange={(url) => setContent({ ...content, mobileHeroImage: url })}
        />
      </div>
      <div>
        <Label>Heading</Label>
        <Input
          value={content.heading || ''}
          onChange={(e) => setContent({ ...content, heading: e.target.value })}
          placeholder="50% OFF"
        />
      </div>
      <div>
        <Label>Subheading</Label>
        <Input
          value={content.subheading || ''}
          onChange={(e) => setContent({ ...content, subheading: e.target.value })}
          placeholder="FOR A LIMITED TIME"
        />
      </div>
      <div>
        <Label>Button Text</Label>
        <Input
          value={content.buttonText || ''}
          onChange={(e) => setContent({ ...content, buttonText: e.target.value })}
          placeholder="Shop Now"
        />
      </div>
      <div>
        <Label>Button Link</Label>
        <MenuLinkAutocomplete
          value={content.buttonLink || ''}
          onChange={(url) => setContent({ ...content, buttonLink: url })}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showRating"
          checked={content.showRating !== false}
          onChange={(e) => setContent({ ...content, showRating: e.target.checked })}
        />
        <Label htmlFor="showRating">Show Rating</Label>
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

function FeaturesSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || { items: [] })
  const [config, setConfig] = useState(section.config || { columns: 4 })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addFeature = () => {
    setContent({
      ...content,
      items: [...(content.items || []), { icon: 'Award', title: 'New Feature' }]
    })
  }

  const updateFeature = (index: number, updates: any) => {
    const items = [...(content.items || [])]
    items[index] = { ...items[index], ...updates }
    setContent({ ...content, items })
  }

  const removeFeature = (index: number) => {
    const items = [...(content.items || [])].filter((_, i) => i !== index)
    setContent({ ...content, items })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Columns</Label>
        <Input
          type="number"
          min="1"
          max="6"
          value={config.columns || 4}
          onChange={(e) => setConfig({ ...config, columns: parseInt(e.target.value) })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Features</Label>
          <Button size="sm" onClick={addFeature}>
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {(content.items || []).map((item: any, index: number) => (
            <div key={index} className="border rounded p-2 space-y-2">
              <Input
                value={item.title || ''}
                onChange={(e) => updateFeature(index, { title: e.target.value })}
                placeholder="Feature title"
              />
              <div className="flex gap-2">
                <select
                  value={item.icon || 'Award'}
                  onChange={(e) => updateFeature(index, { icon: e.target.value })}
                  className="flex-1 border rounded px-2 py-1"
                >
                  <option value="Award">Award</option>
                  <option value="Wallet">Wallet</option>
                  <option value="Leaf">Leaf</option>
                  <option value="Heart">Heart</option>
                  <option value="Users">Users</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => removeFeature(index)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
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

function ProductShowcaseEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {
    productSection: {
      image: '/black-toothbrush-bristles-closeup.jpg',
      title: 'Brevi Ultra-Soft Bristles',
      paragraphs: [
        'Experience the perfect balance of gentleness and effectiveness with Brevi\'s Ultra-Soft bristles. Designed to care for your enamel, reduce gum irritation, and provide a superior clean, these bristles redefine your daily oral hygiene routine.',
        'Engineered with precision, each bristle bends with the finest cleaning technology to glide effortlessly across your teeth and gums. Say goodbye to aggressive brushing and hello to a softer, smarter approach to dental care.',
        'The ultra-fine bristles are crafted to reach even the most difficult areas, ensuring comprehensive coverage while remaining incredibly gentle on sensitive gums. Whether you have delicate teeth or just prefer a softer touch, Brevi\'s Ultra-Soft bristles deliver exceptional results without compromise.',
        'Make the switch to a brush that truly cares for your smile. With Brevi, you\'re not just brushing—you\'re embracing a revolution in oral wellness. Feel the difference with every stroke and enjoy the confidence of a healthier, brighter smile.'
      ]
    },
    sensitiveSection: {
      image: '/mint-teal-toothbrush-on-soft-background.jpg',
      badge: 'SENSITIVE',
      title: 'The Brevi Brush',
      paragraphs: [
        'Introducing Brevi\'s Sensitive toothbrush, a specially designed oral care solution for those with delicate gums and teeth. Our innovative bristle technology offers an unparalleled brushing experience that\'s as gentle as it is effective.',
        'Crafted with care, the Brevi Brush features ultra-soft bristles that protect your enamel while delivering a deep, refreshing clean. Whether you\'re dealing with sensitivity issues or simply prefer a softer touch, this brush adapts to your needs with precision and comfort.',
        'The ergonomic handle ensures a secure grip, while the thoughtfully engineered brush head reaches every corner of your mouth with ease. Experience brushing without discomfort and discover why thousands have made Brevi their trusted choice for sensitive oral care.'
      ]
    },
    bambooSection: {
      image: '/bamboo-toothbrushes-natural-wood-texture.jpg',
      title: 'Brevi Bamboo Toothbrush: A Step Towards A Greener Tomorrow',
      subtitle: 'Brevi Bamboo Toothbrush: A Step Towards A Greener Tomorrow',
      paragraphs: [
        'Make a conscious choice for the planet with Brevi\'s Bamboo Toothbrush. Designed with sustainability at its core, this eco-friendly toothbrush combines exceptional oral care with environmental responsibility. Crafted from 100% biodegradable bamboo, it\'s the perfect alternative to traditional plastic brushes.',
        'Bamboo is one of nature\'s most renewable resources, growing rapidly without the need for pesticides or fertilizers. By choosing Brevi\'s Bamboo Toothbrush, you\'re reducing plastic waste and supporting a healthier planet for future generations.',
        'But sustainability doesn\'t mean compromising on quality. Our bamboo handles are naturally antimicrobial and water-resistant, while the soft, BPA-free bristles provide a gentle yet thorough clean. The ergonomic design ensures comfortable handling, making your daily routine both effective and environmentally conscious.',
        'Every Brevi Bamboo Toothbrush is carefully crafted to minimize environmental impact. From the biodegradable packaging to the compostable handle, we\'ve thought of every detail. When it\'s time for a replacement, simply remove the bristles and compost the handle—it\'s that simple.',
        'Join the movement towards greener living. Choose Brevi Bamboo and take pride in knowing that every brush contributes to a cleaner, more sustainable future. Together, we can make a difference—one brush at a time.'
      ]
    }
  })
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'product' | 'sensitive' | 'bamboo'>('product')

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  const updateProductSection = (updates: any) => {
    setContent({
      ...content,
      productSection: { ...content.productSection, ...updates }
    })
  }

  const updateSensitiveSection = (updates: any) => {
    setContent({
      ...content,
      sensitiveSection: { ...content.sensitiveSection, ...updates }
    })
  }

  const updateBambooSection = (updates: any) => {
    setContent({
      ...content,
      bambooSection: { ...content.bambooSection, ...updates }
    })
  }

  return (
    <div className="space-y-4">
      <div className="border-b">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'product' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('product')}
          >
            Product Section
          </Button>
          <Button
            variant={activeTab === 'sensitive' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('sensitive')}
          >
            Sensitive Section
          </Button>
          <Button
            variant={activeTab === 'bamboo' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('bamboo')}
          >
            Bamboo Section
          </Button>
        </div>
      </div>

      {activeTab === 'product' && (
        <div className="space-y-4">
          <div>
            <Label>Image</Label>
            <ImagePicker
              value={content.productSection?.image || ''}
              onChange={(url) => updateProductSection({ image: url })}
            />
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={content.productSection?.title || ''}
              onChange={(e) => updateProductSection({ title: e.target.value })}
              placeholder="Brevi Ultra-Soft Bristles"
            />
          </div>
          <div>
            <Label>Content Paragraphs (one per line)</Label>
            <Textarea
              value={(content.productSection?.paragraphs || []).join('\n\n')}
              onChange={(e) => updateProductSection({ paragraphs: e.target.value.split('\n\n').filter(p => p.trim()) })}
              rows={8}
              placeholder="Enter paragraphs separated by blank lines"
            />
          </div>
        </div>
      )}

      {activeTab === 'sensitive' && (
        <div className="space-y-4">
          <div>
            <Label>Image</Label>
            <ImagePicker
              value={content.sensitiveSection?.image || ''}
              onChange={(url) => updateSensitiveSection({ image: url })}
            />
          </div>
          <div>
            <Label>Badge Text</Label>
            <Input
              value={content.sensitiveSection?.badge || ''}
              onChange={(e) => updateSensitiveSection({ badge: e.target.value })}
              placeholder="SENSITIVE"
            />
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={content.sensitiveSection?.title || ''}
              onChange={(e) => updateSensitiveSection({ title: e.target.value })}
              placeholder="The Brevi Brush"
            />
          </div>
          <div>
            <Label>Content Paragraphs (one per line)</Label>
            <Textarea
              value={(content.sensitiveSection?.paragraphs || []).join('\n\n')}
              onChange={(e) => updateSensitiveSection({ paragraphs: e.target.value.split('\n\n').filter(p => p.trim()) })}
              rows={6}
              placeholder="Enter paragraphs separated by blank lines"
            />
          </div>
        </div>
      )}

      {activeTab === 'bamboo' && (
        <div className="space-y-4">
          <div>
            <Label>Image</Label>
            <ImagePicker
              value={content.bambooSection?.image || ''}
              onChange={(url) => updateBambooSection({ image: url })}
            />
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={content.bambooSection?.title || ''}
              onChange={(e) => updateBambooSection({ title: e.target.value })}
              placeholder="Brevi Bamboo Toothbrush: A Step Towards A Greener Tomorrow"
            />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input
              value={content.bambooSection?.subtitle || ''}
              onChange={(e) => updateBambooSection({ subtitle: e.target.value })}
              placeholder="Brevi Bamboo Toothbrush: A Step Towards A Greener Tomorrow"
            />
          </div>
          <div>
            <Label>Content Paragraphs (one per line)</Label>
            <Textarea
              value={(content.bambooSection?.paragraphs || []).join('\n\n')}
              onChange={(e) => updateBambooSection({ paragraphs: e.target.value.split('\n\n').filter(p => p.trim()) })}
              rows={10}
              placeholder="Enter paragraphs separated by blank lines"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save All Sections
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function ReviewsSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {
    title: "Don't Just Take Our Word For It",
    numberOfReviews: 8,
    sortBy: 'recent',
    minRating: undefined,
    showImages: true,
  })
  const [saving, setSaving] = useState(false)

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
            placeholder="Don't Just Take Our Word For It"
          />
        </div>

        <div>
          <Label>Number of Reviews to Display</Label>
          <Input
            type="number"
            min="1"
            max="20"
            value={content.numberOfReviews || 8}
            onChange={(e) => setContent({ ...content, numberOfReviews: parseInt(e.target.value) || 8 })}
          />
          <p className="text-xs text-gray-500 mt-1">Number of reviews to show in the section (1-20)</p>
        </div>

        <div>
          <Label>Sort By</Label>
          <select
            value={content.sortBy || 'recent'}
            onChange={(e) => setContent({ ...content, sortBy: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="recent">Most Recent</option>
            <option value="highest">Highest Rating</option>
            <option value="lowest">Lowest Rating</option>
            <option value="helpful">Most Helpful</option>
          </select>
        </div>

        <div>
          <Label>Minimum Rating (Optional)</Label>
          <select
            value={content.minRating || ''}
            onChange={(e) => setContent({ ...content, minRating: e.target.value ? parseInt(e.target.value) : undefined })}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars Only</option>
            <option value="4">4+ Stars</option>
            <option value="3">3+ Stars</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Only show reviews with this minimum rating</p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showImages"
            checked={content.showImages !== false}
            onChange={(e) => setContent({ ...content, showImages: e.target.checked })}
            className="rounded border-gray-300"
          />
          <Label htmlFor="showImages">Show Review Images Grid</Label>
        </div>
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

function TextSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
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
          value={content.content || ''}
          onChange={(e) => setContent({ ...content, content: e.target.value })}
          placeholder="Section content..."
          rows={10}
        />
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

function ImageTextSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
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
        <Label>Image</Label>
        <ImagePicker
          value={content.image || ''}
          onChange={(url) => setContent({ ...content, image: url })}
        />
      </div>
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
          value={content.content || ''}
          onChange={(e) => setContent({ ...content, content: e.target.value })}
          placeholder="Section content..."
          rows={6}
        />
      </div>
      <div>
        <Label>Image Position</Label>
        <select
          value={config.layout || 'image_left'}
          onChange={(e) => setConfig({ ...config, layout: e.target.value })}
          className="w-full border rounded px-3 py-2"
        >
          <option value="image_left">Image Left</option>
          <option value="image_right">Image Right</option>
        </select>
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

// Placeholder editors for sections that don't have full implementations yet
function CountdownEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Countdown editor coming soon.</p>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function TrustBadgesEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Trust badges editor coming soon.</p>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function StatsEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Stats editor coming soon.</p>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function FAQEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">FAQ editor coming soon.</p>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function TeamEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Team editor coming soon.</p>
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

