import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getHeroBanner } from "@/app/actions/cms"
import Link from "next/link"
import Image from "next/image"

export async function HeroSection() {
  // Force dynamic rendering to ensure fresh data
  const result = await getHeroBanner()
  const heroData = result.data

  // Validate and sanitize data to prevent invalid values
  const desktopImage = heroData?.heroImage && typeof heroData.heroImage === 'string' && !heroData.heroImage.includes('/admin/')
    ? heroData.heroImage 
    : "/images/brevi_banner_web.png"
  const mobileImage = heroData?.mobileHeroImage && typeof heroData.mobileHeroImage === 'string' && !heroData.mobileHeroImage.includes('/admin/')
    ? heroData.mobileHeroImage 
    : desktopImage
  
  // Allow empty strings - only use fallback if value is null/undefined
  // If heading/subheading is an empty string, it will be saved and not displayed
  const heading = heroData?.heading !== undefined && heroData?.heading !== null 
    ? (typeof heroData.heading === 'string' && !heroData.heading.includes('/admin/') ? heroData.heading : "50% OFF")
    : "50% OFF"
  const subheading = heroData?.subheading !== undefined && heroData?.subheading !== null
    ? (typeof heroData.subheading === 'string' && !heroData.subheading.includes('/admin/') ? heroData.subheading : "FOR A LIMITED TIME")
    : "FOR A LIMITED TIME"
  const buttonText = heroData?.buttonText && typeof heroData.buttonText === 'string'
    ? heroData.buttonText 
    : "Shop Now"
  const buttonLink = heroData?.buttonLink && typeof heroData.buttonLink === 'string'
    ? heroData.buttonLink 
    : "/product"
  const showRating = heroData?.showRating !== false

  return (
    <section className="relative w-full overflow-hidden h-[600px] md:h-[700px]">
      {/* Desktop Image */}
      <div className="absolute inset-0 hidden md:block">
        <Image
          src={desktopImage}
          alt="BREVI Toothbrushes - 50% OFF"
          fill
          className="object-cover"
          priority
        />
      </div>
      
      {/* Mobile Image */}
      <div className="absolute inset-0 block md:hidden">
        <Image
          src={mobileImage}
          alt="BREVI Toothbrushes - 50% OFF"
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className="relative container h-full flex flex-col items-center justify-center text-center px-4 md:px-6 lg:px-8">
        <div className="max-w-3xl space-y-6">
          {(heading || subheading) && (
            <div className="space-y-4">
              {heading && (
                <h1 className="text-4xl md:text-6xl font-bold text-white">{heading}</h1>
              )}
              {subheading && (
                <p className="text-xl md:text-2xl text-white font-medium">{subheading}</p>
              )}
            </div>
          )}
          {showRating && (
            <div className="flex items-center justify-center gap-2">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-white text-white" />
                ))}
              </div>
              <span className="text-white">(323)</span>
            </div>
          )}
          <Link href={buttonLink}>
            <Button size="lg" className="bg-white hover:bg-white/90 text-black font-semibold mt-4 px-8 py-6 text-lg">
              {buttonText}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
