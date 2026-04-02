"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Plus, GripVertical, Trash2, Save, X } from "lucide-react"
import { getMenuItems, saveMenuItems } from "@/app/actions/cms"
import { toast } from "sonner"
import { MenuLinkAutocomplete } from "@/components/admin/menu-link-autocomplete"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface MenuItem {
  id: number
  label: string
  url: string
  order: number
  badge?: {
    text: string
    color: string // e.g., 'red', 'green', 'blue', 'orange', 'purple', 'teal'
    bgColor?: string // Optional custom background color
    textColor?: string // Optional custom text color
  }
}

export default function MenuManagementPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadMenuItems()
  }, [])

  const loadMenuItems = async () => {
    setLoading(true)
    try {
      const result = await getMenuItems()
      if (result.error) {
        toast.error('Failed to load menu items')
        // Use defaults
        setMenuItems([
          { id: 1, label: "Home", url: "/", order: 1 },
          { id: 2, label: "Shop Now", url: "/product", order: 2 },
          { id: 3, label: "About Us", url: "#", order: 3 },
        ])
      } else {
        setMenuItems(result.data?.items || [])
      }
    } catch (error) {
      console.error('Error loading menu items:', error)
      toast.error('Failed to load menu items')
    } finally {
      setLoading(false)
    }
  }

  const addMenuItem = () => {
    const newOrder = menuItems.length > 0 
      ? Math.max(...menuItems.map(item => item.order)) + 1 
      : 1
    setMenuItems([...menuItems, { id: Date.now(), label: "New Item", url: "/", order: newOrder }])
  }

  const updateMenuItem = (id: number, field: string, value: string | any) => {
    setMenuItems(menuItems.map((item) => {
      if (item.id === id) {
        if (field.startsWith('badge.')) {
          const badgeField = field.split('.')[1]
          return {
            ...item,
            badge: {
              ...(item.badge || { text: '', color: 'red' }),
              [badgeField]: value
            }
          }
        }
        return { ...item, [field]: value }
      }
      return item
    }))
  }

  const toggleBadge = (id: number) => {
    setMenuItems(menuItems.map((item) => {
      if (item.id === id) {
        if (item.badge) {
          // Remove badge
          const { badge, ...rest } = item
          return rest
        } else {
          // Add default badge
          return {
            ...item,
            badge: { text: 'New', color: 'red' }
          }
        }
      }
      return item
    }))
  }

  const removeMenuItem = (id: number) => {
    setMenuItems(menuItems.filter((item) => item.id !== id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setMenuItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Update order based on current array index
      const itemsWithOrder = menuItems.map((item, index) => ({
        ...item,
        order: index + 1
      }))

      const result = await saveMenuItems(itemsWithOrder)
      if (result.success) {
        toast.success('Menu items saved successfully')
        // Reload to get the saved data
        await loadMenuItems()
      } else {
        toast.error(result.error || 'Failed to save menu items')
      }
    } catch (error) {
      console.error('Error saving menu items:', error)
      toast.error('Failed to save menu items')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading menu items...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Navigation Menu</h1>
          <p className="text-gray-600 mt-1">Manage header menu items</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Menu Items</h2>
          <button
            onClick={addMenuItem}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        {menuItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No menu items. Click "Add Item" to create one.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={menuItems.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {menuItems.map((item) => (
                  <SortableMenuItem
                    key={item.id}
                    item={item}
                    onUpdate={(field, value) => updateMenuItem(item.id, field, value)}
                    onRemove={() => removeMenuItem(item.id)}
                    onToggleBadge={() => toggleBadge(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

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

function SortableMenuItem({
  item,
  onUpdate,
  onRemove,
  onToggleBadge,
}: {
  item: MenuItem
  onUpdate: (field: string, value: string | any) => void
  onRemove: () => void
  onToggleBadge: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg bg-white hover:border-teal-300 transition-colors"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-5 h-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={item.label}
        onChange={(e) => onUpdate("label", e.target.value)}
        placeholder="Menu label"
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
      />
      <div className="flex-1">
        <MenuLinkAutocomplete
          value={item.url}
          onChange={(url) => onUpdate("url", url)}
        />
      </div>
      
      {/* Badge Configuration */}
      <div className="flex items-center gap-2 border-l pl-3">
        <button
          onClick={onToggleBadge}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            item.badge
              ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {item.badge ? 'Badge' : 'Add Badge'}
        </button>
        {item.badge && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={item.badge.text}
              onChange={(e) => onUpdate("badge.text", e.target.value)}
              placeholder="Badge text"
              className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-teal-500"
            />
            <select
              value={item.badge.color}
              onChange={(e) => onUpdate("badge.color", e.target.value)}
              className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-teal-500"
            >
              <option value="red">Red</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="orange">Orange</option>
              <option value="purple">Purple</option>
              <option value="teal">Teal</option>
              <option value="yellow">Yellow</option>
              <option value="pink">Pink</option>
            </select>
            <button
              onClick={onToggleBadge}
              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
              title="Remove badge"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onRemove}
        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  )
}
