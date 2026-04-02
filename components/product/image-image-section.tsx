import Image from "next/image"

interface ImageImageSectionProps {
  cmsContent?: {
    image1?: string
    image2?: string
    caption1?: string
    caption2?: string
    link1?: string
    link2?: string
  }
  cmsConfig?: {
    layout?: 'side_by_side' | 'stacked'
    gap?: 'small' | 'medium' | 'large'
    backgroundColor?: string
    imageAspectRatio?: 'square' | 'landscape' | 'portrait' | 'auto'
  }
}

export function ImageImageSection({ cmsContent, cmsConfig }: ImageImageSectionProps = {}) {
  // Support both direct values and check for empty strings
  const image1 = (cmsContent?.image1 && cmsContent.image1.trim() !== '') ? cmsContent.image1 : null
  const image2 = (cmsContent?.image2 && cmsContent.image2.trim() !== '') ? cmsContent.image2 : null
  const caption1 = cmsContent?.caption1 || ""
  const caption2 = cmsContent?.caption2 || ""
  const link1 = cmsContent?.link1
  const link2 = cmsContent?.link2
  
  const layout = cmsConfig?.layout || 'side_by_side'
  const gap = cmsConfig?.gap || 'medium'
  const backgroundColor = cmsConfig?.backgroundColor || '#ffffff'
  const aspectRatio = cmsConfig?.imageAspectRatio || 'auto'

  // If no images, don't render
  if (!image1 && !image2) {
    return null
  }

  const gapClasses = {
    small: 'gap-2',
    medium: 'gap-4',
    large: 'gap-8'
  }

  const aspectRatioClasses = {
    square: 'aspect-square',
    landscape: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: ''
  }
  const imageHeight = cmsConfig?.imageHeight

  const ImageWrapper = ({ image, caption, link, index }: { image: string; caption?: string; link?: string; index: number }) => {
    const content = (
      <div className="relative group">
        <div 
          className={`relative w-full ${aspectRatio === 'auto' ? '' : aspectRatioClasses[aspectRatio]} overflow-hidden rounded-lg`}
          style={aspectRatio === 'auto' && imageHeight ? { height: `${imageHeight}px`, minHeight: `${imageHeight}px` } : aspectRatio === 'auto' ? { height: '384px', minHeight: '384px' } : undefined}
        >
          <Image
            src={image}
            alt={caption || `Image ${index}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        {caption && (
          <div className="mt-2 text-center">
            <p className="text-sm text-gray-600">{caption}</p>
          </div>
        )}
      </div>
    )

    if (link) {
      return (
        <a href={link} className="block">
          {content}
        </a>
      )
    }

    return content
  }

  return (
    <section className="w-full py-8" style={{ backgroundColor }}>
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        {layout === 'side_by_side' ? (
          <div className={`grid md:grid-cols-2 ${gapClasses[gap]}`}>
            {image1 && (
              <ImageWrapper 
                image={image1} 
                caption={caption1} 
                link={link1}
                index={1}
              />
            )}
            {image2 && (
              <ImageWrapper 
                image={image2} 
                caption={caption2} 
                link={link2}
                index={2}
              />
            )}
          </div>
        ) : (
          <div className={`flex flex-col ${gapClasses[gap]}`}>
            {image1 && (
              <ImageWrapper 
                image={image1} 
                caption={caption1} 
                link={link1}
                index={1}
              />
            )}
            {image2 && (
              <ImageWrapper 
                image={image2} 
                caption={caption2} 
                link={link2}
                index={2}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

