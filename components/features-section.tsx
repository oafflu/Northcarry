import { Award, Wallet, Leaf, Heart, Users } from "lucide-react"
import { getPageTemplate } from "@/app/actions/cms"

const iconMap: Record<string, any> = {
  Award,
  Wallet,
  Leaf,
  Heart,
  Users,
}

export async function FeaturesSection() {
  // Try to load CMS content, fallback to default if not available
  let cmsContent = null
  let cmsConfig = null
  try {
    const template = await getPageTemplate('home')
    const featuresSection = template.data?.sections?.find((s: any) => s.section_type === 'features' && s.is_enabled)
    if (featuresSection) {
      cmsContent = featuresSection.content
      cmsConfig = featuresSection.config
    }
  } catch (error) {
    // Fallback to default content
    console.error('Error loading CMS content:', error)
  }

  const defaultFeatures = [
    { icon: Award, title: "Premium Quality" },
    { icon: Wallet, title: "Wallet Friendly" },
    { icon: Leaf, title: "Eco Safe" },
    { icon: Heart, title: "Organic" },
  ]

  const features = cmsContent?.items?.map((item: any) => ({
    icon: iconMap[item.icon] || Award,
    title: item.title || "Feature",
  })) || defaultFeatures

  const columns = cmsConfig?.columns || 4
  const gridColsClass = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
  }[columns] || 'md:grid-cols-4'

  return (
    <section className="py-20 px-4 md:px-6 lg:px-8">
      <div className="container">
        <div className={`grid grid-cols-2 ${gridColsClass} gap-8 md:gap-12 mb-12`}>
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full border-2 border-foreground p-8 w-32 h-32 flex items-center justify-center">
                <feature.icon className="w-12 h-12" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium">{feature.title}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center text-center space-y-4 pt-8">
          <div className="rounded-full border-2 border-foreground p-8 w-32 h-32 flex items-center justify-center">
            <Users className="w-12 h-12" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium">People Welcome</p>
        </div>
      </div>
    </section>
  )
}
