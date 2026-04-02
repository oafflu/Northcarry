'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Plus, Trash2, Check } from 'lucide-react'
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

// Image Banner Editor
export function ImageBannerEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
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
        <Label>Banner Image</Label>
        <ImagePicker
          value={content.image || ''}
          onChange={(url) => setContent({ ...content, image: url })}
        />
      </div>
      <div>
        <Label>Overlay Text</Label>
        <Input
          value={content.overlayText || ''}
          onChange={(e) => setContent({ ...content, overlayText: e.target.value })}
          placeholder="Optional text overlay"
        />
      </div>
      <div>
        <Label>Text Position</Label>
        <select
          value={content.overlayPosition || 'center'}
          onChange={(e) => setContent({ ...content, overlayPosition: e.target.value })}
          className="w-full border rounded px-3 py-2"
        >
          <option value="center">Center</option>
          <option value="top-left">Top Left</option>
          <option value="top-right">Top Right</option>
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
        </select>
      </div>
      <div>
        <Label>Button Text (Optional)</Label>
        <Input
          value={content.buttonText || ''}
          onChange={(e) => setContent({ ...content, buttonText: e.target.value })}
          placeholder="Shop Now"
        />
      </div>
      {content.buttonText && (
        <div>
          <Label>Button Link</Label>
          <MenuLinkAutocomplete
            value={content.buttonLink || ''}
            onChange={(url) => setContent({ ...content, buttonLink: url })}
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

// Carousel Editor
export function CarouselEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || { slides: [] })
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addSlide = () => {
    setContent({
      ...content,
      slides: [...(content.slides || []), { image: '', title: '', description: '', buttonText: '', buttonLink: '' }]
    })
  }

  const updateSlide = (index: number, updates: any) => {
    const slides = [...(content.slides || [])]
    slides[index] = { ...slides[index], ...updates }
    setContent({ ...content, slides })
  }

  const removeSlide = (index: number) => {
    const slides = [...(content.slides || [])].filter((_, i) => i !== index)
    setContent({ ...content, slides })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Carousel Settings</Label>
        <div className="space-y-2 mt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoplay"
              checked={config.autoplay !== false}
              onChange={(e) => setConfig({ ...config, autoplay: e.target.checked })}
            />
            <Label htmlFor="autoplay">Autoplay</Label>
          </div>
          {config.autoplay !== false && (
            <div>
              <Label>Autoplay Speed (ms)</Label>
              <Input
                type="number"
                value={config.autoplaySpeed || 5000}
                onChange={(e) => setConfig({ ...config, autoplaySpeed: parseInt(e.target.value) })}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showDots"
              checked={config.showDots !== false}
              onChange={(e) => setConfig({ ...config, showDots: e.target.checked })}
            />
            <Label htmlFor="showDots">Show Dots</Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showArrows"
              checked={config.showArrows !== false}
              onChange={(e) => setConfig({ ...config, showArrows: e.target.checked })}
            />
            <Label htmlFor="showArrows">Show Arrows</Label>
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Slides</Label>
          <Button size="sm" onClick={addSlide}>
            <Plus className="w-3 h-3 mr-1" />
            Add Slide
          </Button>
        </div>
        <div className="space-y-4">
          {(content.slides || []).map((slide: any, index: number) => (
            <div key={index} className="border rounded p-4 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Slide {index + 1}</span>
                <Button size="sm" variant="ghost" onClick={() => removeSlide(index)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div>
                <Label>Image</Label>
                <ImagePicker
                  value={slide.image || ''}
                  onChange={(url) => updateSlide(index, { image: url })}
                />
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={slide.title || ''}
                  onChange={(e) => updateSlide(index, { title: e.target.value })}
                  placeholder="Slide title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={slide.description || ''}
                  onChange={(e) => updateSlide(index, { description: e.target.value })}
                  placeholder="Slide description"
                  rows={2}
                />
              </div>
              <div>
                <Label>Button Text</Label>
                <Input
                  value={slide.buttonText || ''}
                  onChange={(e) => updateSlide(index, { buttonText: e.target.value })}
                  placeholder="Shop Now"
                />
              </div>
              {slide.buttonText && (
                <div>
                  <Label>Button Link</Label>
                  <MenuLinkAutocomplete
                    value={slide.buttonLink || ''}
                    onChange={(url) => updateSlide(index, { buttonLink: url })}
                  />
                </div>
              )}
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

// Image Gallery Editor
export function ImageGalleryEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || { images: [] })
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addImage = () => {
    setContent({
      ...content,
      images: [...(content.images || []), { image: '', caption: '', link: '' }]
    })
  }

  const updateImage = (index: number, updates: any) => {
    const images = [...(content.images || [])]
    images[index] = { ...images[index], ...updates }
    setContent({ ...content, images })
  }

  const removeImage = (index: number) => {
    const images = [...(content.images || [])].filter((_, i) => i !== index)
    setContent({ ...content, images })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Gallery Settings</Label>
        <div className="space-y-2 mt-2">
          <div>
            <Label>Columns</Label>
            <Input
              type="number"
              min="1"
              max="6"
              value={config.columns || 3}
              onChange={(e) => setConfig({ ...config, columns: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <Label>Spacing</Label>
            <select
              value={config.spacing || 'medium'}
              onChange={(e) => setConfig({ ...config, spacing: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Images</Label>
          <Button size="sm" onClick={addImage}>
            <Plus className="w-3 h-3 mr-1" />
            Add Image
          </Button>
        </div>
        <div className="space-y-3">
          {(content.images || []).map((img: any, index: number) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Image {index + 1}</span>
                <Button size="sm" variant="ghost" onClick={() => removeImage(index)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div>
                <ImagePicker
                  value={img.image || ''}
                  onChange={(url) => updateImage(index, { image: url })}
                />
              </div>
              <div>
                <Label>Caption</Label>
                <Input
                  value={img.caption || ''}
                  onChange={(e) => updateImage(index, { caption: e.target.value })}
                  placeholder="Image caption"
                />
              </div>
              <div>
                <Label>Link (Optional)</Label>
                <MenuLinkAutocomplete
                  value={img.link || ''}
                  onChange={(url) => updateImage(index, { link: url })}
                />
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

// Product Grid Editor
export function ProductGridEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Array<{ id: string; title: string; hasSubscription: boolean }>>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(content.productIds || [])
  const [productSelectionMode, setProductSelectionMode] = useState<'manual' | 'automatic'>(
    content.productIds && Array.isArray(content.productIds) && content.productIds.length > 0 ? 'manual' : 'automatic'
  )

  useEffect(() => {
    loadProducts()
  }, [])

  // Sync selectedProductIds when section.content changes (but only if we don't have local selections)
  useEffect(() => {
    if (section.content?.productIds && Array.isArray(section.content.productIds) && section.content.productIds.length > 0) {
      // Only update if we don't have local selections (to avoid overwriting user selections)
      if (selectedProductIds.length === 0) {
        console.log('[ProductGridEditor] Syncing from section prop:', {
          productIds: section.content.productIds,
          productIdsLength: section.content.productIds.length
        })
        setSelectedProductIds(section.content.productIds)
        setProductSelectionMode('manual')
      }
    }
  }, [section.content?.productIds])

  // Debug: Log state changes
  useEffect(() => {
    console.log('[ProductGridEditor] State updated:', {
      selectedProductIds,
      selectedProductIdsLength: selectedProductIds.length,
      productSelectionMode,
      contentProductIds: content.productIds
    })
  }, [selectedProductIds, productSelectionMode])

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      // Use API route to bypass RLS and get all products with subscription info
      const response = await fetch('/api/admin/products')
      const result = await response.json()
      
      if (result.data && Array.isArray(result.data)) {
        setProducts(result.data)
      } else {
        console.error('Unexpected response format:', result)
        setProducts([])
      }
    } catch (error) {
      console.error('Error loading products:', error)
      setProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleProductToggle = (productId: string) => {
    setSelectedProductIds(prev => {
      const newIds = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
      
      console.log('[ProductGridEditor] Product toggled:', {
        productId,
        wasSelected: prev.includes(productId),
        newIds,
        newIdsLength: newIds.length
      })
      
      return newIds
    })
  }

  const handleSave = async () => {
    setSaving(true)
    
    // Capture current state values to avoid stale closures
    const currentSelectedIds = selectedProductIds
    const currentMode = productSelectionMode
    
    // Final state check before saving
    console.log('[ProductGridEditor] Pre-save state check:', {
      productSelectionMode: currentMode,
      selectedProductIds: currentSelectedIds,
      selectedProductIdsLength: currentSelectedIds.length,
      selectedProductIdsType: typeof currentSelectedIds,
      selectedProductIdsIsArray: Array.isArray(currentSelectedIds),
      contentProductIds: content.productIds
    })
    
    const updatedContent = {
      ...content,
      // Always include productIds - empty array for automatic mode, array of IDs for manual mode
      productIds: currentMode === 'manual' ? currentSelectedIds : []
    }
    
    // Debug logging
    console.log('[ProductGridEditor] Saving:', {
      productSelectionMode: currentMode,
      selectedProductIds: currentSelectedIds,
      selectedProductIdsLength: currentSelectedIds.length,
      updatedContent,
      updatedContentProductIds: updatedContent.productIds,
      updatedContentProductIdsLength: updatedContent.productIds?.length,
      config
    })
    
    await onSave({ content: updatedContent, config })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Section Title</Label>
        <Input
          value={content.title || ''}
          onChange={(e) => setContent({ ...content, title: e.target.value })}
          placeholder="Featured Products"
        />
      </div>
      <div>
        <Label>Subtitle</Label>
        <Input
          value={content.subtitle || ''}
          onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
          placeholder="Shop our best sellers"
        />
      </div>
      <div>
        <Label>Grid Settings</Label>
        <div className="space-y-2 mt-2">
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
            <Label>Product Limit</Label>
            <Input
              type="number"
              min="1"
              max="24"
              value={config.limit || 8}
              onChange={(e) => setConfig({ ...config, limit: parseInt(e.target.value) })}
              disabled={productSelectionMode === 'manual'}
            />
            <p className="text-xs text-gray-500 mt-1">
              {productSelectionMode === 'automatic' 
                ? 'Maximum number of products to display (only used in automatic mode)'
                : 'Limit is ignored when products are manually selected'}
            </p>
          </div>
        </div>
      </div>
      <div>
        <Label>Product Selection</Label>
        <div className="space-y-2 mt-2">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="productMode"
                checked={productSelectionMode === 'automatic'}
                onChange={() => {
                  console.log('[ProductGridEditor] Switching to automatic mode, clearing selections')
                  setProductSelectionMode('automatic')
                  setSelectedProductIds([])
                }}
                className="w-4 h-4"
              />
              <span>Automatic (use limit)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="productMode"
                checked={productSelectionMode === 'manual'}
                onChange={() => {
                  console.log('[ProductGridEditor] Switching to manual mode, current selections:', selectedProductIds)
                  setProductSelectionMode('manual')
                }}
                className="w-4 h-4"
              />
              <span>Manual Selection</span>
            </label>
          </div>
          {productSelectionMode === 'manual' && (
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              {loadingProducts ? (
                <p className="text-sm text-gray-500">Loading products...</p>
              ) : products.length === 0 ? (
                <p className="text-sm text-gray-500">No products available.</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Select products to display ({selectedProductIds.length} selected)
                    </p>
                    {selectedProductIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedProductIds([])}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {products.map((product) => {
                      const isSelected = selectedProductIds.includes(product.id)
                      return (
                        <label
                          key={product.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-teal-50 border border-teal-200' 
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleProductToggle(product.id)}
                            className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                          />
                          <span className={`flex-1 text-sm ${isSelected ? 'font-medium' : ''}`}>
                            {product.title}
                          </span>
                          {product.hasSubscription && (
                            <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                              Subscribe
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                  {selectedProductIds.length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ No products selected. The section will not display any products.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
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

// Video Editor
export function VideoEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
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
        <Label>Video URL (YouTube, Vimeo, or direct link)</Label>
        <Input
          value={content.videoUrl || ''}
          onChange={(e) => setContent({ ...content, videoUrl: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </div>
      <div>
        <Label>Thumbnail Image</Label>
        <ImagePicker
          value={content.thumbnail || ''}
          onChange={(url) => setContent({ ...content, thumbnail: url })}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoplay"
            checked={content.autoplay || false}
            onChange={(e) => setContent({ ...content, autoplay: e.target.checked })}
          />
          <Label htmlFor="autoplay">Autoplay</Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="loop"
            checked={content.loop || false}
            onChange={(e) => setContent({ ...content, loop: e.target.checked })}
          />
          <Label htmlFor="loop">Loop</Label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="muted"
            checked={content.muted || false}
            onChange={(e) => setContent({ ...content, muted: e.target.checked })}
          />
          <Label htmlFor="muted">Muted</Label>
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

// Video With Text Editor
export function VideoWithTextEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
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
        <Label>Layout</Label>
        <select
          value={config.layout || 'video_left'}
          onChange={(e) => setConfig({ ...config, layout: e.target.value })}
          className="w-full border rounded px-3 py-2"
        >
          <option value="video_left">Video Left</option>
          <option value="video_right">Video Right</option>
          <option value="video_top">Video Top</option>
        </select>
      </div>
      <div>
        <Label>Video URL</Label>
        <Input
          value={content.videoUrl || ''}
          onChange={(e) => setContent({ ...content, videoUrl: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </div>
      <div>
        <Label>Thumbnail Image</Label>
        <ImagePicker
          value={content.thumbnail || ''}
          onChange={(url) => setContent({ ...content, thumbnail: url })}
        />
      </div>
      <div>
        <Label>Title</Label>
        <Input
          value={content.title || ''}
          onChange={(e) => setContent({ ...content, title: e.target.value })}
          placeholder="Watch Our Story"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Content Paragraphs</Label>
          <Button size="sm" onClick={() => {
            const paragraphs = content.content || []
            setContent({ ...content, content: Array.isArray(paragraphs) ? [...paragraphs, ''] : [''] })
          }}>
            <Plus className="w-3 h-3 mr-1" />
            Add Paragraph
          </Button>
        </div>
        <div className="space-y-2">
          {(Array.isArray(content.content) ? content.content : content.content ? [content.content] : []).map((paragraph: string, index: number) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <Textarea
                value={paragraph}
                onChange={(e) => {
                  const paragraphs = Array.isArray(content.content) ? [...content.content] : content.content ? [content.content] : []
                  paragraphs[index] = e.target.value
                  setContent({ ...content, content: paragraphs })
                }}
                placeholder="Paragraph content"
                rows={3}
              />
              <Button size="sm" variant="ghost" onClick={() => {
                const paragraphs = Array.isArray(content.content) ? [...content.content] : content.content ? [content.content] : []
                paragraphs.splice(index, 1)
                setContent({ ...content, content: paragraphs })
              }}>
                <Trash2 className="w-3 h-3" />
              </Button>
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

// Testimonials Editor
export function TestimonialsEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || { testimonials: [] })
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addTestimonial = () => {
    setContent({
      ...content,
      testimonials: [...(content.testimonials || []), { name: '', role: '', image: '', quote: '', rating: 5 }]
    })
  }

  const updateTestimonial = (index: number, updates: any) => {
    const testimonials = [...(content.testimonials || [])]
    testimonials[index] = { ...testimonials[index], ...updates }
    setContent({ ...content, testimonials })
  }

  const removeTestimonial = (index: number) => {
    const testimonials = [...(content.testimonials || [])].filter((_, i) => i !== index)
    setContent({ ...content, testimonials })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Carousel Settings</Label>
        <div className="space-y-2 mt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoplay"
              checked={config.autoplay !== false}
              onChange={(e) => setConfig({ ...config, autoplay: e.target.checked })}
            />
            <Label htmlFor="autoplay">Autoplay</Label>
          </div>
          {config.autoplay !== false && (
            <div>
              <Label>Autoplay Speed (ms)</Label>
              <Input
                type="number"
                value={config.autoplaySpeed || 6000}
                onChange={(e) => setConfig({ ...config, autoplaySpeed: parseInt(e.target.value) })}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showDots"
              checked={config.showDots !== false}
              onChange={(e) => setConfig({ ...config, showDots: e.target.checked })}
            />
            <Label htmlFor="showDots">Show Dots</Label>
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Testimonials</Label>
          <Button size="sm" onClick={addTestimonial}>
            <Plus className="w-3 h-3 mr-1" />
            Add Testimonial
          </Button>
        </div>
        <div className="space-y-3">
          {(content.testimonials || []).map((testimonial: any, index: number) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Testimonial {index + 1}</span>
                <Button size="sm" variant="ghost" onClick={() => removeTestimonial(index)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div>
                <Label>Customer Image</Label>
                <ImagePicker
                  value={testimonial.image || ''}
                  onChange={(url) => updateTestimonial(index, { image: url })}
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={testimonial.name || ''}
                  onChange={(e) => updateTestimonial(index, { name: e.target.value })}
                  placeholder="Customer Name"
                />
              </div>
              <div>
                <Label>Role/Title</Label>
                <Input
                  value={testimonial.role || ''}
                  onChange={(e) => updateTestimonial(index, { role: e.target.value })}
                  placeholder="Verified Buyer"
                />
              </div>
              <div>
                <Label>Quote</Label>
                <Textarea
                  value={testimonial.quote || ''}
                  onChange={(e) => updateTestimonial(index, { quote: e.target.value })}
                  placeholder="Great product!"
                  rows={3}
                />
              </div>
              <div>
                <Label>Rating (1-5)</Label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={testimonial.rating || 5}
                  onChange={(e) => updateTestimonial(index, { rating: parseInt(e.target.value) })}
                />
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

// Multi Column Editor
export function MultiColumnEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || { columns: [] })
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addColumn = () => {
    setContent({
      ...content,
      columns: [...(content.columns || []), { image: '', title: '', content: '' }]
    })
  }

  const updateColumn = (index: number, updates: any) => {
    const columns = [...(content.columns || [])]
    columns[index] = { ...columns[index], ...updates }
    setContent({ ...content, columns })
  }

  const removeColumn = (index: number) => {
    const columns = [...(content.columns || [])].filter((_, i) => i !== index)
    setContent({ ...content, columns })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Layout Settings</Label>
        <div className="space-y-2 mt-2">
          <div>
            <Label>Number of Columns</Label>
            <Input
              type="number"
              min="2"
              max="6"
              value={config.columns || 3}
              onChange={(e) => setConfig({ ...config, columns: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <Label>Layout Type</Label>
            <select
              value={config.layout || 'equal'}
              onChange={(e) => setConfig({ ...config, layout: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="equal">Equal Width</option>
              <option value="wide-narrow">Wide-Narrow</option>
              <option value="narrow-wide">Narrow-Wide</option>
            </select>
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Columns</Label>
          <Button size="sm" onClick={addColumn}>
            <Plus className="w-3 h-3 mr-1" />
            Add Column
          </Button>
        </div>
        <div className="space-y-3">
          {(content.columns || []).map((column: any, index: number) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">Column {index + 1}</span>
                <Button size="sm" variant="ghost" onClick={() => removeColumn(index)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div>
                <Label>Image</Label>
                <ImagePicker
                  value={column.image || ''}
                  onChange={(url) => updateColumn(index, { image: url })}
                />
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={column.title || ''}
                  onChange={(e) => updateColumn(index, { title: e.target.value })}
                  placeholder="Column title"
                />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea
                  value={column.content || ''}
                  onChange={(e) => updateColumn(index, { content: e.target.value })}
                  placeholder="Column content"
                  rows={4}
                />
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

// Newsletter Editor
// Image + Image Editor
export function ImageImageEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
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
        <Label>Image 1</Label>
        <ImagePicker
          value={content.image1 || ''}
          onChange={(url) => setContent({ ...content, image1: url })}
        />
      </div>
      {content.image1 && (
        <div>
          <Label>Image 1 Caption (Optional)</Label>
          <Input
            value={content.caption1 || ''}
            onChange={(e) => setContent({ ...content, caption1: e.target.value })}
            placeholder="Caption for image 1"
          />
        </div>
      )}
      {content.image1 && (
        <div>
          <Label>Image 1 Link (Optional)</Label>
          <MenuLinkAutocomplete
            value={content.link1 || ''}
            onChange={(url) => setContent({ ...content, link1: url })}
          />
        </div>
      )}
      
      <div>
        <Label>Image 2</Label>
        <ImagePicker
          value={content.image2 || ''}
          onChange={(url) => setContent({ ...content, image2: url })}
        />
      </div>
      {content.image2 && (
        <div>
          <Label>Image 2 Caption (Optional)</Label>
          <Input
            value={content.caption2 || ''}
            onChange={(e) => setContent({ ...content, caption2: e.target.value })}
            placeholder="Caption for image 2"
          />
        </div>
      )}
      {content.image2 && (
        <div>
          <Label>Image 2 Link (Optional)</Label>
          <MenuLinkAutocomplete
            value={content.link2 || ''}
            onChange={(url) => setContent({ ...content, link2: url })}
          />
        </div>
      )}
      
      <div>
        <Label>Layout</Label>
        <select
          value={config.layout || 'side_by_side'}
          onChange={(e) => setConfig({ ...config, layout: e.target.value })}
          className="w-full border rounded px-3 py-2"
        >
          <option value="side_by_side">Side by Side</option>
          <option value="stacked">Stacked</option>
        </select>
      </div>
      
      <div>
        <Label>Gap Size</Label>
        <select
          value={config.gap || 'medium'}
          onChange={(e) => setConfig({ ...config, gap: e.target.value })}
          className="w-full border rounded px-3 py-2"
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>
      
      <div>
        <Label>Image Aspect Ratio</Label>
        <select
          value={config.imageAspectRatio || 'auto'}
          onChange={(e) => setConfig({ ...config, imageAspectRatio: e.target.value })}
          className="w-full border rounded px-3 py-2"
        >
          <option value="auto">Auto</option>
          <option value="square">Square</option>
          <option value="landscape">Landscape (16:9)</option>
          <option value="portrait">Portrait (3:4)</option>
        </select>
      </div>
      
      <div>
        <Label>Background Color</Label>
        <Input
          type="color"
          value={config.backgroundColor || '#ffffff'}
          onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
          className="w-full h-10"
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

export function NewsletterEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
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
          placeholder="Subscribe to Our Newsletter"
        />
      </div>
      <div>
        <Label>Subtitle</Label>
        <Input
          value={content.subtitle || ''}
          onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
          placeholder="Get the latest updates and exclusive offers"
        />
      </div>
      <div>
        <Label>Email Placeholder</Label>
        <Input
          value={content.placeholder || ''}
          onChange={(e) => setContent({ ...content, placeholder: e.target.value })}
          placeholder="Enter your email"
        />
      </div>
      <div>
        <Label>Button Text</Label>
        <Input
          value={content.buttonText || ''}
          onChange={(e) => setContent({ ...content, buttonText: e.target.value })}
          placeholder="Subscribe"
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

// Additional editors: CountdownEditor, TrustBadgesEditor, StatsEditor, FAQEditor, TeamEditor
// These can be added in a follow-up update if needed

