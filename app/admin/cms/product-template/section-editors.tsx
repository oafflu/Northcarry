'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Save, Plus, Trash2 } from 'lucide-react'
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

// Product Hero Editor
export function ProductHeroEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
  }, [section.id, section.content])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showRating"
          checked={content.showRating !== false}
          onChange={(e) => setContent({ ...content, showRating: e.target.checked })}
        />
        <Label htmlFor="showRating">Show Rating</Label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showBadges"
          checked={content.showBadges !== false}
          onChange={(e) => setContent({ ...content, showBadges: e.target.checked })}
        />
        <Label htmlFor="showBadges">Show Badges</Label>
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

// Product Features Editor
export function ProductFeaturesEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || { items: [] })
  const [config, setConfig] = useState(section.config || { columns: 4 })
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || { items: [] })
    setConfig(section.config || { columns: 4 })
  }, [section.id, section.content, section.config])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addFeature = () => {
    setContent({
      ...content,
      items: [...(content.items || []), { icon: 'Award', title: 'New Feature', description: '' }]
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
              <Textarea
                value={item.description || ''}
                onChange={(e) => updateFeature(index, { description: e.target.value })}
                placeholder="Feature description"
                rows={2}
              />
              <div className="flex gap-2">
                <select
                  value={item.icon || 'Award'}
                  onChange={(e) => updateFeature(index, { icon: e.target.value })}
                  className="flex-1 border rounded px-2 py-1"
                >
                  <option value="Award">Award</option>
                  <option value="Leaf">Leaf</option>
                  <option value="Heart">Heart</option>
                  <option value="Zap">Zap</option>
                  <option value="Shield">Shield</option>
                  <option value="Star">Star</option>
                </select>
                <Button size="sm" variant="ghost" onClick={() => removeFeature(index)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Background Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            className="w-20"
          />
          <Input
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            placeholder="#e5e7eb"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Default: Light grey (#e5e7eb)</p>
      </div>
      <div>
        <Label>Image Height (px)</Label>
        <div className="space-y-2">
          <Input
            type="number"
            min="200"
            max="1000"
            value={config.imageHeight || ''}
            onChange={(e) => setConfig({ ...config, imageHeight: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Auto (default)"
          />
          <p className="text-xs text-gray-500">Leave empty for auto height. Min: 200px, Max: 1000px</p>
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

// Product Gallery Editor
export function ProductGalleryEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || { images: [] })
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || { images: [] })
    setConfig(section.config || {})
  }, [section.id, section.content, section.config])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addImage = () => {
    setContent({
      ...content,
      images: [...(content.images || []), { image: '', caption: '' }]
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
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Background Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            className="w-20"
          />
          <Input
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            placeholder="#e5e7eb"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Default: Light grey (#e5e7eb)</p>
      </div>
      <div>
        <Label>Image Height (px)</Label>
        <div className="space-y-2">
          <Input
            type="number"
            min="200"
            max="1000"
            value={config.imageHeight || ''}
            onChange={(e) => setConfig({ ...config, imageHeight: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Auto (default)"
          />
          <p className="text-xs text-gray-500">Leave empty for auto height. Min: 200px, Max: 1000px</p>
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

// Product Video Editor
export function ProductVideoEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
  }, [section.id, section.content])

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
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="autoplay"
          checked={content.autoplay || false}
          onChange={(e) => setContent({ ...content, autoplay: e.target.checked })}
        />
        <Label htmlFor="autoplay">Autoplay</Label>
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

// Product Description Editor
export function ProductDescriptionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
  }, [section.id, section.content])

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
          placeholder="Product Description"
        />
      </div>
      <div>
        <Label>Content</Label>
        <Textarea
          value={content.content || ''}
          onChange={(e) => setContent({ ...content, content: e.target.value })}
          placeholder="Add detailed product description here..."
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

// Product Specs Editor
export function ProductSpecsEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || { specs: [] })
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || { specs: [] })
  }, [section.id, section.content])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  const addSpec = () => {
    setContent({
      ...content,
      specs: [...(content.specs || []), { label: '', value: '' }]
    })
  }

  const updateSpec = (index: number, updates: any) => {
    const specs = [...(content.specs || [])]
    specs[index] = { ...specs[index], ...updates }
    setContent({ ...content, specs })
  }

  const removeSpec = (index: number) => {
    const specs = [...(content.specs || [])].filter((_, i) => i !== index)
    setContent({ ...content, specs })
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Section Title</Label>
        <Input
          value={content.title || ''}
          onChange={(e) => setContent({ ...content, title: e.target.value })}
          placeholder="Specifications"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Specifications</Label>
          <Button size="sm" onClick={addSpec}>
            <Plus className="w-3 h-3 mr-1" />
            Add Spec
          </Button>
        </div>
        <div className="space-y-2">
          {(content.specs || []).map((spec: any, index: number) => (
            <div key={index} className="border rounded p-2 flex gap-2">
              <Input
                value={spec.label || ''}
                onChange={(e) => updateSpec(index, { label: e.target.value })}
                placeholder="Label"
                className="flex-1"
              />
              <Input
                value={spec.value || ''}
                onChange={(e) => updateSpec(index, { value: e.target.value })}
                placeholder="Value"
                className="flex-1"
              />
              <Button size="sm" variant="ghost" onClick={() => removeSpec(index)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Background Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            className="w-20"
          />
          <Input
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            placeholder="#e5e7eb"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Default: Light grey (#e5e7eb)</p>
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

// Related Products Editor
export function RelatedProductsEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
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
        <Label>Section Title</Label>
        <Input
          value={content.title || ''}
          onChange={(e) => setContent({ ...content, title: e.target.value })}
          placeholder="You May Also Like"
        />
      </div>
      <div>
        <Label>Subtitle</Label>
        <Input
          value={content.subtitle || ''}
          onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
          placeholder=""
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
              max="12"
              value={config.limit || 4}
              onChange={(e) => setConfig({ ...config, limit: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        Note: Related products will be automatically selected based on product category and tags.
      </p>
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

// Note: TestimonialsEditor, MultiColumnEditor, FAQEditor, TrustBadgesEditor, StatsEditor
// can be imported from homepage-editor/section-editors if needed
// For now, we'll add simple placeholder editors for these

// Image + Image Editor
export function ImageImageEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
    setConfig(section.config || {})
  }, [section.id, section.content, section.config])

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
      
      <div>
        <Label>Image Height (px)</Label>
        <div className="space-y-2">
          <Input
            type="number"
            min="200"
            max="1000"
            value={config.imageHeight || ''}
            onChange={(e) => setConfig({ ...config, imageHeight: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Auto (default)"
          />
          <p className="text-xs text-gray-500">Leave empty for auto height. Min: 200px, Max: 1000px</p>
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

export function ImageTextEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
    setConfig(section.config || {})
  }, [section.id, section.content, section.config])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addContentParagraph = () => {
    const paragraphs = content.content || []
    setContent({
      ...content,
      content: [...paragraphs, '']
    })
  }

  const updateContentParagraph = (index: number, value: string) => {
    const paragraphs = [...(content.content || [])]
    paragraphs[index] = value
    setContent({ ...content, content: paragraphs })
  }

  const removeContentParagraph = (index: number) => {
    const paragraphs = [...(content.content || [])].filter((_, i) => i !== index)
    setContent({ ...content, content: paragraphs })
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
        <div className="flex items-center justify-between mb-2">
          <Label>Content Paragraphs</Label>
          <Button size="sm" onClick={addContentParagraph}>
            <Plus className="w-3 h-3 mr-1" />
            Add Paragraph
          </Button>
        </div>
        <div className="space-y-2">
          {(content.content || []).map((paragraph: string, index: number) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <Textarea
                value={paragraph}
                onChange={(e) => updateContentParagraph(index, e.target.value)}
                placeholder="Paragraph content"
                rows={3}
              />
              <Button size="sm" variant="ghost" onClick={() => removeContentParagraph(index)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
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
      <div>
        <Label>Background Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={config.backgroundColor || '#e5e7eb'}
            onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
            className="w-20"
          />
          <Input
            value={config.backgroundColor || '#e5e7eb'}
            onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
            placeholder="#e5e7eb"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Default: Light grey (#e5e7eb)</p>
      </div>
      <div>
        <Label>Image Height (px)</Label>
        <div className="space-y-2">
          <Input
            type="number"
            min="200"
            max="1000"
            value={config.imageHeight || ''}
            onChange={(e) => setConfig({ ...config, imageHeight: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Auto (default)"
          />
          <p className="text-xs text-gray-500">Leave empty for auto height. Min: 200px, Max: 1000px</p>
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

// Bristles Section Editor
export function BristlesSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
    setConfig(section.config || {})
  }, [section.id, section.content, section.config])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addContentParagraph = () => {
    const paragraphs = content.content || []
    setContent({
      ...content,
      content: [...paragraphs, '']
    })
  }

  const updateContentParagraph = (index: number, value: string) => {
    const paragraphs = [...(content.content || [])]
    paragraphs[index] = value
    setContent({ ...content, content: paragraphs })
  }

  const removeContentParagraph = (index: number) => {
    const paragraphs = [...(content.content || [])].filter((_, i) => i !== index)
    setContent({ ...content, content: paragraphs })
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
        <Label>Image</Label>
        <ImagePicker
          value={content.image || ''}
          onChange={(url) => setContent({ ...content, image: url })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Content Paragraphs</Label>
          <Button size="sm" onClick={addContentParagraph}>
            <Plus className="w-3 h-3 mr-1" />
            Add Paragraph
          </Button>
        </div>
        <div className="space-y-2">
          {(content.content || []).map((paragraph: string, index: number) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <Textarea
                value={paragraph}
                onChange={(e) => updateContentParagraph(index, e.target.value)}
                placeholder="Paragraph content"
                rows={3}
              />
              <Button size="sm" variant="ghost" onClick={() => removeContentParagraph(index)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Background Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            className="w-20"
          />
          <Input
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            placeholder="#e5e7eb"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Default: Light grey (#e5e7eb)</p>
      </div>
      <div>
        <Label>Image Height (px)</Label>
        <div className="space-y-2">
          <Input
            type="number"
            min="200"
            max="1000"
            value={config.imageHeight || ''}
            onChange={(e) => setConfig({ ...config, imageHeight: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Auto (default)"
          />
          <p className="text-xs text-gray-500">Leave empty for auto height. Min: 200px, Max: 1000px</p>
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

// Brush Section Editor
export function BrushSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
    setConfig(section.config || {})
  }, [section.id, section.content, section.config])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addContentParagraph = () => {
    const paragraphs = content.content || []
    setContent({
      ...content,
      content: [...paragraphs, '']
    })
  }

  const updateContentParagraph = (index: number, value: string) => {
    const paragraphs = [...(content.content || [])]
    paragraphs[index] = value
    setContent({ ...content, content: paragraphs })
  }

  const removeContentParagraph = (index: number) => {
    const paragraphs = [...(content.content || [])].filter((_, i) => i !== index)
    setContent({ ...content, content: paragraphs })
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
        <Label>Image</Label>
        <ImagePicker
          value={content.image || ''}
          onChange={(url) => setContent({ ...content, image: url })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Content Paragraphs</Label>
          <Button size="sm" onClick={addContentParagraph}>
            <Plus className="w-3 h-3 mr-1" />
            Add Paragraph
          </Button>
        </div>
        <div className="space-y-2">
          {(content.content || []).map((paragraph: string, index: number) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <Textarea
                value={paragraph}
                onChange={(e) => updateContentParagraph(index, e.target.value)}
                placeholder="Paragraph content"
                rows={3}
              />
              <Button size="sm" variant="ghost" onClick={() => removeContentParagraph(index)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Image Height (px)</Label>
        <div className="space-y-2">
          <Input
            type="number"
            min="200"
            max="1000"
            value={config.imageHeight || ''}
            onChange={(e) => setConfig({ ...config, imageHeight: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Auto (default)"
          />
          <p className="text-xs text-gray-500">Leave empty for auto height. Min: 200px, Max: 1000px</p>
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

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
    setConfig(section.config || {})
  }, [section.id, section.content, section.config])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addContentParagraph = () => {
    const paragraphs = content.content || []
    setContent({
      ...content,
      content: [...paragraphs, '']
    })
  }

  const updateContentParagraph = (index: number, value: string) => {
    const paragraphs = [...(content.content || [])]
    paragraphs[index] = value
    setContent({ ...content, content: paragraphs })
  }

  const removeContentParagraph = (index: number) => {
    const paragraphs = [...(content.content || [])].filter((_, i) => i !== index)
    setContent({ ...content, content: paragraphs })
  }

  return (
    <div className="space-y-4">
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
          placeholder="Section Title"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Content Paragraphs</Label>
          <Button size="sm" onClick={addContentParagraph}>
            <Plus className="w-3 h-3 mr-1" />
            Add Paragraph
          </Button>
        </div>
        <div className="space-y-2">
          {(content.content || []).map((paragraph: string, index: number) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <Textarea
                value={paragraph}
                onChange={(e) => updateContentParagraph(index, e.target.value)}
                placeholder="Paragraph content"
                rows={3}
              />
              <Button size="sm" variant="ghost" onClick={() => removeContentParagraph(index)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Video Position</Label>
        <select
          value={config.layout || 'video_left'}
          onChange={(e) => setConfig({ ...config, layout: e.target.value })}
          className="w-full border rounded px-3 py-2"
        >
          <option value="video_left">Video Left</option>
          <option value="video_right">Video Right</option>
        </select>
      </div>
      <div>
        <Label>Background Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={config.backgroundColor || '#e5e7eb'}
            onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
            className="w-20"
          />
          <Input
            value={config.backgroundColor || '#e5e7eb'}
            onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
            placeholder="#e5e7eb"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Default: Light grey (#e5e7eb)</p>
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

// Compare Section Editor
export function CompareSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
  }, [section.id, section.content])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content })
    setSaving(false)
  }

  const addLeftContentParagraph = () => {
    const paragraphs = content.leftContent || []
    setContent({
      ...content,
      leftContent: [...paragraphs, '']
    })
  }

  const updateLeftContentParagraph = (index: number, value: string) => {
    const paragraphs = [...(content.leftContent || [])]
    paragraphs[index] = value
    setContent({ ...content, leftContent: paragraphs })
  }

  const removeLeftContentParagraph = (index: number) => {
    const paragraphs = [...(content.leftContent || [])].filter((_, i) => i !== index)
    setContent({ ...content, leftContent: paragraphs })
  }

  const addRightContentParagraph = () => {
    const paragraphs = content.rightContent || []
    setContent({
      ...content,
      rightContent: [...paragraphs, '']
    })
  }

  const updateRightContentParagraph = (index: number, value: string) => {
    const paragraphs = [...(content.rightContent || [])]
    paragraphs[index] = value
    setContent({ ...content, rightContent: paragraphs })
  }

  const removeRightContentParagraph = (index: number) => {
    const paragraphs = [...(content.rightContent || [])].filter((_, i) => i !== index)
    setContent({ ...content, rightContent: paragraphs })
  }

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h3 className="font-semibold mb-4">Left Block</h3>
        <div className="space-y-4">
          <div>
            <Label>Left Image</Label>
            <ImagePicker
              value={content.leftImage || ''}
              onChange={(url) => setContent({ ...content, leftImage: url })}
            />
          </div>
          <div>
            <Label>Left Title</Label>
            <Input
              value={content.leftTitle || ''}
              onChange={(e) => setContent({ ...content, leftTitle: e.target.value })}
              placeholder="Left Block Title"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Left Content Paragraphs</Label>
              <Button size="sm" onClick={addLeftContentParagraph}>
                <Plus className="w-3 h-3 mr-1" />
                Add Paragraph
              </Button>
            </div>
            <div className="space-y-2">
              {(content.leftContent || []).map((paragraph: string, index: number) => (
                <div key={index} className="border rounded p-3 space-y-2">
                  <Textarea
                    value={paragraph}
                    onChange={(e) => updateLeftContentParagraph(index, e.target.value)}
                    placeholder="Paragraph content"
                    rows={3}
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeLeftContentParagraph(index)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Left Background Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={content.leftBackgroundColor || '#e5e7eb'}
                onChange={(e) => setContent({ ...content, leftBackgroundColor: e.target.value })}
                className="w-20"
              />
              <Input
                value={content.leftBackgroundColor || '#e5e7eb'}
                onChange={(e) => setContent({ ...content, leftBackgroundColor: e.target.value })}
                placeholder="#e5e7eb"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Default: Light grey (#e5e7eb)</p>
          </div>
        </div>
      </div>

      <div className="border-b pb-4">
        <h3 className="font-semibold mb-4">Right Block</h3>
        <div className="space-y-4">
          <div>
            <Label>Right Image</Label>
            <ImagePicker
              value={content.rightImage || ''}
              onChange={(url) => setContent({ ...content, rightImage: url })}
            />
          </div>
          <div>
            <Label>Right Title</Label>
            <Input
              value={content.rightTitle || ''}
              onChange={(e) => setContent({ ...content, rightTitle: e.target.value })}
              placeholder="Right Block Title"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Right Content Paragraphs</Label>
              <Button size="sm" onClick={addRightContentParagraph}>
                <Plus className="w-3 h-3 mr-1" />
                Add Paragraph
              </Button>
            </div>
            <div className="space-y-2">
              {(content.rightContent || []).map((paragraph: string, index: number) => (
                <div key={index} className="border rounded p-3 space-y-2">
                  <Textarea
                    value={paragraph}
                    onChange={(e) => updateRightContentParagraph(index, e.target.value)}
                    placeholder="Paragraph content"
                    rows={3}
                  />
                  <Button size="sm" variant="ghost" onClick={() => removeRightContentParagraph(index)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Right Background Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={content.rightBackgroundColor || '#e5e7eb'}
                onChange={(e) => setContent({ ...content, rightBackgroundColor: e.target.value })}
                className="w-20"
              />
              <Input
                value={content.rightBackgroundColor || '#e5e7eb'}
                onChange={(e) => setContent({ ...content, rightBackgroundColor: e.target.value })}
                placeholder="#e5e7eb"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Default: Light grey (#e5e7eb)</p>
          </div>
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

// Confidence Section Editor
export function ConfidenceSectionEditor({ section, onSave, onCancel }: { section: Section; onSave: (updates: any) => void; onCancel: () => void }) {
  const [content, setContent] = useState(section.content || {})
  const [config, setConfig] = useState(section.config || {})
  const [saving, setSaving] = useState(false)

  // Update state when section prop changes (important for multiple sections of same type)
  useEffect(() => {
    setContent(section.content || {})
    setConfig(section.config || {})
  }, [section.id, section.content, section.config])

  const handleSave = async () => {
    setSaving(true)
    await onSave({ content, config })
    setSaving(false)
  }

  const addContentParagraph = () => {
    const paragraphs = content.content || []
    setContent({
      ...content,
      content: [...paragraphs, '']
    })
  }

  const updateContentParagraph = (index: number, value: string) => {
    const paragraphs = [...(content.content || [])]
    paragraphs[index] = value
    setContent({ ...content, content: paragraphs })
  }

  const removeContentParagraph = (index: number) => {
    const paragraphs = [...(content.content || [])].filter((_, i) => i !== index)
    setContent({ ...content, content: paragraphs })
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
        <Label>Image</Label>
        <ImagePicker
          value={content.image || ''}
          onChange={(url) => setContent({ ...content, image: url })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Content Paragraphs</Label>
          <Button size="sm" onClick={addContentParagraph}>
            <Plus className="w-3 h-3 mr-1" />
            Add Paragraph
          </Button>
        </div>
        <div className="space-y-2">
          {(content.content || []).map((paragraph: string, index: number) => (
            <div key={index} className="border rounded p-3 space-y-2">
              <Textarea
                value={paragraph}
                onChange={(e) => updateContentParagraph(index, e.target.value)}
                placeholder="Paragraph content"
                rows={3}
              />
              <Button size="sm" variant="ghost" onClick={() => removeContentParagraph(index)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label>Background Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            className="w-20"
          />
          <Input
            value={content.backgroundColor || '#e5e7eb'}
            onChange={(e) => setContent({ ...content, backgroundColor: e.target.value })}
            placeholder="#e5e7eb"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Default: Light grey (#e5e7eb)</p>
      </div>
      <div>
        <Label>Image Height (px)</Label>
        <div className="space-y-2">
          <Input
            type="number"
            min="200"
            max="1000"
            value={config.imageHeight || ''}
            onChange={(e) => setConfig({ ...config, imageHeight: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Auto (default)"
          />
          <p className="text-xs text-gray-500">Leave empty for auto height. Min: 200px, Max: 1000px</p>
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

