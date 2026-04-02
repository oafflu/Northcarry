import Image from "next/image"

interface ProductGallerySectionProps {
  cmsContent?: {
    images?: Array<{
      image: string
      caption?: string
      link?: string
    }>
  }
  cmsConfig?: {
    columns?: number
    spacing?: 'small' | 'medium' | 'large'
  }
}

export function ProductGallerySection({ cmsContent, cmsConfig }: ProductGallerySectionProps = {}) {
  const images = cmsContent?.images || []
  const columns = cmsConfig?.columns || 3
  const spacing = cmsConfig?.spacing || 'medium'

  if (images.length === 0) {
    return null
  }

  const spacingClasses = {
    small: 'gap-2',
    medium: 'gap-4',
    large: 'gap-8'
  }

  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }[columns] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'

  return (
    <section className="w-full py-8">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className={`grid ${gridCols} ${spacingClasses[spacing]}`}>
          {images.map((item, index) => {
            const content = (
              <div className="relative group">
                <div className="relative aspect-square overflow-hidden rounded-lg">
                  <Image
                    src={item.image}
                    alt={item.caption || `Gallery image ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                {item.caption && (
                  <div className="mt-2 text-center">
                    <p className="text-sm text-gray-600">{item.caption}</p>
                  </div>
                )}
              </div>
            )

            if (item.link) {
              return (
                <a key={index} href={item.link} className="block">
                  {content}
                </a>
              )
            }

            return <div key={index}>{content}</div>
          })}
        </div>
      </div>
    </section>
  )
}

