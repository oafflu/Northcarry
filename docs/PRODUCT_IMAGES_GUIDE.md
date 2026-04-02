# Product Images, Variants, and Gallery System Guide

## Overview

The BREVI e-commerce platform uses a sophisticated image management system that supports:
- **Product Images**: Multiple images per product with primary image support
- **Variant Images**: Images linked to specific product variants (colors)
- **Image Gallery**: Dynamic image display that changes based on variant selection
- **Primary Image**: Always used as the default preview image

## Database Structure

### Tables

#### `product_images`
Stores all product images with the following structure:
```sql
- id (UUID, Primary Key)
- product_id (UUID, Foreign Key → products.id)
- variant_id (UUID, Nullable, Foreign Key → product_variants.id)
- image_url (TEXT, Required)
- alt_text (TEXT, Nullable)
- is_primary (BOOLEAN, Default: false)
- sort_order (INTEGER, Default: 0)
```

**Key Fields:**
- `variant_id`: Links image to a specific variant. If `NULL`, image is a general product image.
- `is_primary`: Marks the primary/default image. Only one should be `true` per product.
- `sort_order`: Controls display order (lower numbers appear first).

#### `product_variants`
Stores product variants (colors) with optional image references:
```sql
- id (UUID, Primary Key)
- product_id (UUID, Foreign Key → products.id)
- color (TEXT, Required)
- price (DECIMAL, Required)
- sku (TEXT, Required)
- image_url (TEXT, Nullable) - Legacy field, prefer product_images table
- color_image_url (TEXT, Nullable) - Separate image for color selection swatch
```

## Image Loading Priority

When a variant is selected, images are loaded in this priority order:

1. **Variant-Specific Images** (`variant_id` matches selected variant)
   - Images explicitly linked to the selected variant
   - Highest priority

2. **Color-Matched Images** (via `alt_text`)
   - Images without `variant_id` but `alt_text` contains variant color name
   - Example: Image with `alt_text="black"` for "Black" variant

3. **Variant's `image_url`** (legacy field)
   - Fallback to variant's own `image_url` field if not already included

4. **Main Gallery Images** (no `variant_id`)
   - General product images available for all variants
   - Sorted by: Primary first, then `sort_order`

5. **Placeholder** (if no images available)
   - Default placeholder image shown

## How It Works

### 1. Image Fetching (`app/actions/products.ts`)

```typescript
// Images are fetched with variants
const [variants, images] = await Promise.all([
  supabase.from('product_variants').select('*').eq('product_id', product.id),
  supabase.from('product_images').select('*').eq('product_id', product.id)
    .order('sort_order', { ascending: true })
])
```

**Key Points:**
- Images are sorted by `sort_order` in ascending order
- Primary images should have `sort_order = 0` or lowest value
- All images for a product are fetched at once

### 2. Image Processing (`components/product/product-hero.tsx`)

The `colorVariants` useMemo hook processes images for each variant:

```typescript
const colorVariants = useMemo(() => {
  // Sort images: primary first, then by sort_order
  const sortedImages = [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return (a.sort_order ?? 999) - (b.sort_order ?? 999)
  })

  // For each variant, build image list with priority
  return variants.map((variant) => {
    // 1. Variant-specific images
    const variantSpecificImages = sortedImages
      .filter(img => img.variant_id === variant.id)
      .map(img => img.image_url)

    // 2. Color-matched images
    const colorMatchedImages = sortedImages
      .filter(img => !img.variant_id && 
        img.alt_text?.toLowerCase().includes(variant.color.toLowerCase()))
      .map(img => img.image_url)

    // 3. Main gallery images
    const mainGalleryImages = sortedImages
      .filter(img => !img.variant_id)
      .map(img => img.image_url)

    // Build final list (removing duplicates)
    const imageSet = new Set<string>()
    const validVariantImages: string[] = []
    
    // Add in priority order, avoiding duplicates
    variantSpecificImages.forEach(img => {
      if (img?.trim() && !imageSet.has(img)) {
        imageSet.add(img)
        validVariantImages.push(img)
      }
    })
    // ... continue with other priorities

    return {
      name: variant.color,
      variantId: variant.id,
      images: validVariantImages.length > 0 
        ? validVariantImages 
        : [fallbackImage]
    }
  })
}, [variants, images])
```

### 3. Variant Selection & Image Switching

When a user selects a variant:

```typescript
const [selectedColor, setSelectedColor] = useState(colorVariants[0])
const [selectedImageIndex, setSelectedImageIndex] = useState(0)

// Reset to first image when variant changes
useEffect(() => {
  setSelectedImageIndex(0)
}, [selectedColor.variantId])

// Current images for selected variant
const currentImages = selectedColor.images
```

**Behavior:**
- Selecting a variant automatically switches to that variant's image set
- Image index resets to 0 (first image) when variant changes
- User can still navigate through images using thumbnails

### 4. Primary Image Logic

**Primary Image Rules:**
1. Only one image per product should have `is_primary = true`
2. Primary image always appears first in the gallery
3. Primary image is used as the default preview image
4. If no primary is set, first image by `sort_order` is used

**Setting Primary Image:**
```typescript
// In admin edit page
const setPrimaryImage = (imageId: string) => {
  setProductImages(prev => {
    const updated = prev.map(img => ({
      ...img,
      is_primary: img.id === imageId
    }))
    
    // Sort: primary first, then by sort_order
    updated.sort((a, b) => {
      const primaryDiff = (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
      if (primaryDiff !== 0) return primaryDiff
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
    
    // Re-assign sort_order
    return updated.map((img, idx) => ({
      ...img,
      sort_order: idx
    }))
  })
}
```

## Admin Interface

### Adding Images (`app/admin/products/[id]/edit-page.tsx`)

**Methods to Add Images:**

1. **Upload New Image:**
   ```typescript
   const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files[0]
     const result = await uploadMediaFile(file, 'product-media', {
       folder: 'products',
       altText: image.alt_text,
       associatedType: 'product'
     })
     // Add to productImages state
   }
   ```

2. **Select from Media Library:**
   ```typescript
   const handleMediaSelect = (mediaFile: MediaFile) => {
     const newImage: ProductImage = {
       id: `new-img-${Date.now()}`,
       url: mediaFile.url,
       alt_text: mediaFile.alt_text || "",
       variant_id: undefined, // or specific variant ID
       is_primary: false,
       sort_order: productImages.length
     }
     setProductImages([...productImages, newImage])
   }
   ```

3. **Link Image to Variant:**
   ```typescript
   const handleVariantMediaSelect = (mediaFile: MediaFile, variantId: string) => {
     const newImage: ProductImage = {
       id: `new-img-${Date.now()}`,
       url: mediaFile.url,
       variant_id: variantId, // Link to specific variant
       is_primary: false,
       sort_order: productImages.length
     }
     setProductImages([...productImages, newImage])
   }
   ```

### Image Management Features

- **Drag & Drop Reordering**: Change `sort_order` by dragging images
- **Set Primary**: Click star icon to set primary image
- **Link to Variant**: Assign images to specific variants
- **Delete**: Remove images from product
- **Alt Text**: Add descriptive alt text for accessibility

## Product Gallery Section (CMS)

The `ProductGallerySection` component displays images configured via CMS:

```typescript
// CMS Configuration
{
  images: [
    { image: "url1", caption: "Caption 1", link: "optional-link" },
    { image: "url2", caption: "Caption 2" }
  ],
  config: {
    columns: 3, // 2, 3, or 4
    spacing: 'medium' // 'small', 'medium', 'large'
  }
}
```

**Features:**
- Grid layout (responsive)
- Optional captions
- Optional clickable links
- Configurable columns and spacing

## Best Practices

### 1. Image Organization

- **Set Primary Image**: Always mark one image as primary
- **Use Sort Order**: Set `sort_order` to control display sequence
- **Variant-Specific Images**: Link variant-specific images using `variant_id`
- **General Images**: Leave `variant_id` NULL for images available to all variants

### 2. Image Quality

- Use high-resolution images (minimum 1200x1200px)
- Optimize images before upload (WebP format recommended)
- Maintain consistent aspect ratios
- Use descriptive alt text for accessibility

### 3. Variant Images

- **Color Swatches**: Use `color_image_url` on variant for color selection UI
- **Product Images**: Use `product_images` table with `variant_id` for full product images
- **Fallback Logic**: Always provide fallback images for variants without specific images

### 4. Performance

- Images are lazy-loaded using Next.js Image component
- Images are optimized automatically
- Use CDN for image delivery (Supabase Storage)

## Troubleshooting

### Issue: Primary image not showing first

**Solution:**
1. Check `is_primary` flag is set correctly
2. Verify `sort_order` is 0 or lowest value
3. Ensure image sorting logic is applied

### Issue: Variant images not switching

**Solution:**
1. Verify `variant_id` is correctly linked in `product_images`
2. Check variant selection state updates
3. Ensure `useEffect` resets image index on variant change

### Issue: Images not loading

**Solution:**
1. Verify image URLs are valid and accessible
2. Check Supabase Storage permissions
3. Ensure images are uploaded to correct folder
4. Check for CORS issues

### Issue: Duplicate images in gallery

**Solution:**
1. Review image deduplication logic
2. Check for duplicate entries in database
3. Verify `imageSet` is working correctly

## Code Locations

- **Image Fetching**: `app/actions/products.ts` - `getProductWithVariants()`
- **Image Display**: `components/product/product-hero.tsx` - `ProductHero`
- **Admin Image Management**: `app/admin/products/[id]/edit-page.tsx`
- **Gallery Section**: `components/product/product-gallery-section.tsx`
- **CMS Gallery Editor**: `app/admin/cms/product-template/section-editors.tsx` - `ProductGalleryEditor`

## Migration Notes

### Legacy `image_url` Field

The `product_variants.image_url` field is maintained for backward compatibility but should not be used for new products. Instead:

- Use `product_images` table with `variant_id` for variant-specific images
- Use `product_images` table without `variant_id` for general images
- `variant.image_url` is only used as a fallback in the image priority chain

### Updating Existing Products

To migrate existing products:
1. Create entries in `product_images` table
2. Link variant-specific images using `variant_id`
3. Set `is_primary = true` for the primary image
4. Set appropriate `sort_order` values
5. Keep `variant.image_url` for backward compatibility

## Summary

The product image system provides:
- ✅ Flexible image organization (general and variant-specific)
- ✅ Primary image support with automatic prioritization
- ✅ Dynamic image switching based on variant selection
- ✅ Drag-and-drop reordering in admin
- ✅ CMS-configurable gallery sections
- ✅ Fallback logic for missing images
- ✅ Performance optimization with Next.js Image

For questions or issues, refer to the code comments in the files listed above or contact the development team.

