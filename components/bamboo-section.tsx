import { getPageTemplate } from "@/app/actions/cms"
import { showcaseSectionStyle } from "@/lib/showcase-section-styles"

export async function BambooSection() {
  // Try to load CMS content, fallback to default if not available
  let cmsContent = null
  try {
    const template = await getPageTemplate('home')
    const productSection = template.data?.sections?.find((s: any) => s.section_type === 'product_showcase' && s.is_enabled)
    if (productSection?.content?.bambooSection) {
      cmsContent = productSection.content.bambooSection
    }
  } catch (error) {
    // Fallback to default content
    console.error('Error loading CMS content:', error)
  }

  const defaultImage = '/bamboo-toothbrushes-natural-wood-texture.jpg'
  const defaultTitle = 'Brevi Bamboo Toothbrush: A Step Towards A Greener Tomorrow'
  const defaultSubtitle = 'Brevi Bamboo Toothbrush: A Step Towards A Greener Tomorrow'
  const defaultParagraphs = [
    'Make a conscious choice for the planet with Brevi\'s Bamboo Toothbrush. Designed with sustainability at its core, this eco-friendly toothbrush combines exceptional oral care with environmental responsibility. Crafted from 100% biodegradable bamboo, it\'s the perfect alternative to traditional plastic brushes.',
    'Bamboo is one of nature\'s most renewable resources, growing rapidly without the need for pesticides or fertilizers. By choosing Brevi\'s Bamboo Toothbrush, you\'re reducing plastic waste and supporting a healthier planet for future generations.',
    'But sustainability doesn\'t mean compromising on quality. Our bamboo handles are naturally antimicrobial and water-resistant, while the soft, BPA-free bristles provide a gentle yet thorough clean. The ergonomic design ensures comfortable handling, making your daily routine both effective and environmentally conscious.',
    'Every Brevi Bamboo Toothbrush is carefully crafted to minimize environmental impact. From the biodegradable packaging to the compostable handle, we\'ve thought of every detail. When it\'s time for a replacement, simply remove the bristles and compost the handle—it\'s that simple.',
    'Join the movement towards greener living. Choose Brevi Bamboo and take pride in knowing that every brush contributes to a cleaner, more sustainable future. Together, we can make a difference—one brush at a time.'
  ]

  const image = cmsContent?.image || defaultImage
  const title = cmsContent?.title || defaultTitle
  const subtitle = cmsContent?.subtitle || defaultSubtitle
  const paragraphs = cmsContent?.paragraphs || defaultParagraphs
  const { className: sectionClass, style: sectionStyle } = showcaseSectionStyle(cmsContent)
  const hasCustomTextColor = Boolean(cmsContent?.textColor?.trim())

  return (
    <section
      className={`${sectionClass} ${!cmsContent?.backgroundColor?.trim() ? "bg-background" : ""}`}
      style={sectionStyle}
    >
      <div className="container">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative aspect-square">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>

          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-balance">
              {title}
            </h2>

            {subtitle && subtitle !== title && (
              <h3 className="text-2xl font-bold">{subtitle}</h3>
            )}

            <div
              className={`space-y-4 leading-relaxed ${
                hasCustomTextColor ? "" : "text-muted-foreground"
              }`}
            >
              {paragraphs.map((paragraph: string, index: number) => {
                // Check if paragraph should be bold (starts with "Sustainable Brushing" or similar)
                const isBold = paragraph.includes('Sustainable Brushing') || paragraph.startsWith('**')
                return (
                  <p key={index} className={isBold ? 'font-semibold' : ''}>
                    {paragraph.replace(/\*\*/g, '')}
                  </p>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
