import { getPageTemplate } from "@/app/actions/cms"
import { showcaseSectionStyle } from "@/lib/showcase-section-styles"

export async function ProductSection() {
  // Try to load CMS content, fallback to default if not available
  let cmsContent = null
  try {
    const template = await getPageTemplate('home')
    const productSection = template.data?.sections?.find((s: any) => s.section_type === 'product_showcase' && s.is_enabled)
    if (productSection?.content?.productSection) {
      cmsContent = productSection.content.productSection
    }
  } catch (error) {
    // Fallback to default content
    console.error('Error loading CMS content:', error)
  }

  const defaultImage = '/black-toothbrush-bristles-closeup.jpg'
  const defaultTitle = 'Brevi Ultra-Soft Bristles'
  const defaultParagraphs = [
    'Experience the perfect balance of gentleness and effectiveness with Brevi\'s Ultra-Soft bristles. Designed to care for your enamel, reduce gum irritation, and provide a superior clean, these bristles redefine your daily oral hygiene routine.',
    'Engineered with precision, each bristle bends with the finest cleaning technology to glide effortlessly across your teeth and gums. Say goodbye to aggressive brushing and hello to a softer, smarter approach to dental care.',
    'The ultra-fine bristles are crafted to reach even the most difficult areas, ensuring comprehensive coverage while remaining incredibly gentle on sensitive gums. Whether you have delicate teeth or just prefer a softer touch, Brevi\'s Ultra-Soft bristles deliver exceptional results without compromise.',
    'Make the switch to a brush that truly cares for your smile. With Brevi, you\'re not just brushing—you\'re embracing a revolution in oral wellness. Feel the difference with every stroke and enjoy the confidence of a healthier, brighter smile.'
  ]

  const image = cmsContent?.image || defaultImage
  const title = cmsContent?.title || defaultTitle
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
            <h2 className="text-4xl md:text-5xl font-bold text-balance">{title}</h2>

            <div
              className={`space-y-4 leading-relaxed ${
                hasCustomTextColor ? "" : "text-muted-foreground"
              }`}
            >
              {paragraphs.map((paragraph: string, index: number) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
