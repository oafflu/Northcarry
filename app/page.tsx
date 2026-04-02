import { HeaderWrapper } from "@/components/header-wrapper"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { ProductSection } from "@/components/product-section"
import { SensitiveSection } from "@/components/sensitive-section"
import { BambooSection } from "@/components/bamboo-section"
import { ReviewsSection } from "@/components/reviews-section"
import { ProductGridSection } from "@/components/product-grid-section"
import { Footer } from "@/components/footer"
import { getPageTemplate } from "@/app/actions/cms"

// Force dynamic rendering since we use cookies for CMS data
export const dynamic = 'force-dynamic'
export const revalidate = 0 // Disable caching for this page

export default async function Home() {
  // Load CMS template to check which sections are enabled
  let enabledSections: string[] = []
  let templateData: any = null
  let orderedSections: any[] = []
  
  try {
    const template = await getPageTemplate('home')
    templateData = template.data
    if (template.data?.sections) {
      // Get enabled sections and maintain their order
      orderedSections = template.data.sections
        .filter((s: any) => s.is_enabled)
        .sort((a: any, b: any) => a.section_order - b.section_order)
      
      enabledSections = orderedSections.map((s: any) => s.section_type)
    }
  } catch (error) {
    // If CMS fails, show all sections (default behavior)
    enabledSections = ['hero', 'features', 'product_showcase', 'reviews']
  }

  // Default: show all sections if CMS is not configured
  const showAll = enabledSections.length === 0

  // Create a map of section types to their data for easy lookup
  const sectionMap = new Map()
  orderedSections.forEach((s: any) => {
    sectionMap.set(s.section_type, s)
  })

  // Render sections in order based on section_order
  const renderSection = (sectionType: string) => {
    const section = sectionMap.get(sectionType)
    
    switch (sectionType) {
      case 'hero':
        return <HeroSection key="hero" />
      case 'features':
        return <FeaturesSection key="features" />
      case 'product_showcase':
        return (
          <div key="product_showcase">
            <ProductSection />
            <SensitiveSection />
            <BambooSection />
          </div>
        )
      case 'reviews':
        return <ReviewsSection key="reviews" />
      case 'product_grid':
        // Debug logging
        console.log('[HomePage] Product Grid Section:', {
          sectionExists: !!section,
          content: section?.content,
          contentKeys: section?.content ? Object.keys(section.content) : [],
          productIds: section?.content?.productIds,
          config: section?.config
        })
        return (
          <ProductGridSection 
            key="product_grid"
            cmsContent={section?.content || {}} 
            cmsConfig={section?.config || {}} 
          />
        )
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen">
      <HeaderWrapper />
      {showAll ? (
        // Default order when no CMS is configured
        <>
          <HeroSection />
          <FeaturesSection />
          <div>
            <ProductSection />
            <SensitiveSection />
            <BambooSection />
          </div>
          <ReviewsSection />
        </>
      ) : (
        // Render sections in CMS-defined order
        orderedSections.map((section: any) => renderSection(section.section_type))
      )}
      <Footer />
    </main>
  )
}
