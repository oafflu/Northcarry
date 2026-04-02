import Image from "next/image"

interface ImageTextSectionProps {
  cmsContent?: {
    image?: string
    title?: string
    content?: string[]
  }
  cmsConfig?: {
    layout?: 'image_left' | 'image_right'
    backgroundColor?: string
    imageHeight?: number
  }
}

export function ImageTextSection({ cmsContent, cmsConfig }: ImageTextSectionProps = {}) {
  const image = cmsContent?.image || ""
  const title = cmsContent?.title || ""
  const content = cmsContent?.content || []
  const layout = cmsConfig?.layout || 'image_left'
  const backgroundColor = cmsConfig?.backgroundColor || "#e5e7eb" // Default to gray-200
  const imageHeight = cmsConfig?.imageHeight
  const isImageRight = layout === 'image_right'

  // If no content, don't render
  if (!title && content.length === 0 && !image) {
    return null
  }

  return (
    <section className="py-8">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor }}>
          <div className="grid md:grid-cols-2 gap-0">
            {isImageRight ? (
              <>
                {/* Content first */}
                <div className="p-8 md:p-12 flex flex-col justify-center">
                  {title && (
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
                  )}
                  {content.map((paragraph, index) => (
                    <p key={index} className="text-gray-700 leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
                {/* Image */}
                {image && (
                  <div 
                    className="relative w-full self-stretch"
                    style={imageHeight ? { height: `${imageHeight}px`, minHeight: `${imageHeight}px`, maxHeight: `${imageHeight}px` } : { height: '100%', minHeight: '256px' }}
                  >
                    <Image
                      src={image}
                      alt={title || "Section Image"}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Image */}
                {image && (
                  <div 
                    className="relative w-full self-stretch"
                    style={imageHeight ? { height: `${imageHeight}px`, minHeight: `${imageHeight}px`, maxHeight: `${imageHeight}px` } : { height: '100%', minHeight: '256px' }}
                  >
                    <Image
                      src={image}
                      alt={title || "Section Image"}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                {/* Content */}
                <div className="p-8 md:p-12 flex flex-col justify-center">
                  {title && (
                    <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
                  )}
                  {content.map((paragraph, index) => (
                    <p key={index} className="text-gray-700 leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

