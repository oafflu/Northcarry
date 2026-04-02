import { Truck, RotateCcw, DollarSign, Award, Heart } from "lucide-react"

const features = [
  {
    icon: Truck,
    title: "FREE Worldwide Express Shipping",
    description: "",
  },
  {
    icon: RotateCcw,
    title: "24/7 Dedicated Customer Service",
    description: "",
  },
  {
    icon: DollarSign,
    title: "Premium Quality Guaranteed - 5 Days Replacement",
    description: "",
  },
  {
    icon: Award,
    title: "Your purchase will be delivered in 5-10 business days",
    description: "",
  },
  {
    icon: Heart,
    title: "We Guarantee 100% you will absolutely love it!",
    description: "",
  },
]

export function ProductFeatures() {
  return (
    <section className="py-8 border-t border-b">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-gray-300 flex items-center justify-center">
                  <feature.icon className="w-8 h-8 text-gray-700" />
                </div>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{feature.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
