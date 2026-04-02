import { getPageTemplate } from "@/app/actions/cms"

export async function SensitiveSection() {
  // Try to load CMS content, fallback to default if not available
  let cmsContent = null
  try {
    const template = await getPageTemplate('home')
    const productSection = template.data?.sections?.find((s: any) => s.section_type === 'product_showcase' && s.is_enabled)
    if (productSection?.content?.sensitiveSection) {
      cmsContent = productSection.content.sensitiveSection
    }
  } catch (error) {
    // Fallback to default content
    console.error('Error loading CMS content:', error)
  }

  const defaultImage = '/mint-teal-toothbrush-on-soft-background.jpg'
  const defaultBadge = 'SENSITIVE'
  const defaultTitle = 'The Brevi Brush'
  const defaultParagraphs = [
    'Introducing Brevi\'s Sensitive toothbrush, a specially designed oral care solution for those with delicate gums and teeth. Our innovative bristle technology offers an unparalleled brushing experience that\'s as gentle as it is effective.',
    'Crafted with care, the Brevi Brush features ultra-soft bristles that protect your enamel while delivering a deep, refreshing clean. Whether you\'re dealing with sensitivity issues or simply prefer a softer touch, this brush adapts to your needs with precision and comfort.',
    'The ergonomic handle ensures a secure grip, while the thoughtfully engineered brush head reaches every corner of your mouth with ease. Experience brushing without discomfort and discover why thousands have made Brevi their trusted choice for sensitive oral care.'
  ]

  const image = cmsContent?.image || defaultImage
  const badge = cmsContent?.badge || defaultBadge
  const title = cmsContent?.title || defaultTitle
  const paragraphs = cmsContent?.paragraphs || defaultParagraphs

  return (
    <section className="py-20 px-4 md:px-6 lg:px-8 bg-accent text-accent-foreground">
      <div className="container">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 order-2 md:order-1">
            <div className="inline-block">
              <span className="text-sm font-bold tracking-[0.3em] px-4 py-2 border-2 border-accent-foreground">
                {badge}
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-balance">{title}</h2>

            <div className="space-y-4 leading-relaxed opacity-95">
              {paragraphs.map((paragraph: string, index: number) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="relative aspect-square order-1 md:order-2">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
