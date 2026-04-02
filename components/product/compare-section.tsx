import Image from "next/image"

interface CompareSectionProps {
  cmsContent?: {
    leftImage?: string
    leftTitle?: string
    leftContent?: string[]
    rightImage?: string
    rightTitle?: string
    rightContent?: string[]
    leftBackgroundColor?: string
    rightBackgroundColor?: string
  }
}

export function CompareSection({ cmsContent }: CompareSectionProps = {}) {
  // Support both new and legacy keys for backward compatibility
  const leftImage = cmsContent?.leftImage || (cmsContent as any)?.image1 || ""
  const leftTitle = cmsContent?.leftTitle || ""
  const leftContent = cmsContent?.leftContent || []
  const rightImage = cmsContent?.rightImage || (cmsContent as any)?.image2 || ""
  const rightTitle = cmsContent?.rightTitle || ""
  const rightContent = cmsContent?.rightContent || []
  const leftBackgroundColor = cmsContent?.leftBackgroundColor || "#e5e7eb" // Default to gray-200
  const rightBackgroundColor = cmsContent?.rightBackgroundColor || "#e5e7eb" // Default to gray-200

  // If no content, don't render
  if ((!leftTitle && leftContent.length === 0 && !leftImage) && 
      (!rightTitle && rightContent.length === 0 && !rightImage)) {
    return null
  }

  return (
    <section className="py-8">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left Block */}
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: leftBackgroundColor }}>
            <div className="grid md:grid-cols-1 gap-0">
              {leftImage && (
                <div className="relative h-64 md:h-96">
                  <Image
                    src={leftImage}
                    alt={leftTitle || "Left Image"}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-8 md:p-12 flex flex-col justify-center">
                {leftTitle && (
                  <h2 className="text-3xl md:text-4xl font-bold mb-6">{leftTitle}</h2>
                )}
                {leftContent.map((paragraph, index) => (
                  <p key={index} className="text-gray-700 leading-relaxed mb-4">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Right Block */}
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: rightBackgroundColor }}>
            <div className="grid md:grid-cols-1 gap-0">
              {rightImage && (
                <div className="relative h-64 md:h-96">
                  <Image
                    src={rightImage}
                    alt={rightTitle || "Right Image"}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-8 md:p-12 flex flex-col justify-center">
                {rightTitle && (
                  <h2 className="text-3xl md:text-4xl font-bold mb-6">{rightTitle}</h2>
                )}
                {rightContent.map((paragraph, index) => (
                  <p key={index} className="text-gray-700 leading-relaxed mb-4">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

