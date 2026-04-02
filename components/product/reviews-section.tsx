import Image from "next/image"

export function ReviewsSection() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Don't Just Take Our Word For It</h2>

        {/* Trustpilot Rating */}
        <div className="text-center mb-12">
          <div className="inline-block bg-white p-6 rounded-lg shadow-sm">
            <div className="text-xl font-bold mb-2">Excellent</div>
            <div className="flex text-green-500 text-2xl mb-2">
              {[...Array(5)].map((_, i) => (
                <span key={i}>★</span>
              ))}
            </div>
            <div className="text-sm text-gray-600">
              Based on <span className="font-semibold">207 Reviews</span>
            </div>
            <div className="mt-2">
              <span className="text-xs text-gray-500">⭐ Trustpilot</span>
            </div>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Review 1 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image src="/placeholder.svg?height=48&width=48" alt="Debbie C." fill className="object-cover" />
              </div>
              <div>
                <div className="font-semibold">Debbie C.</div>
                <div className="flex text-green-500 text-sm">
                  {[...Array(5)].map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              This toothbrush was so soft! I thought, "how can this possibly clean my teeth?" Then I brushed my teeth.
              It cleans your teeth! It's so light, and I love the soft bristles. I shared this toothbrush my son and he
              brushes his teeth! So I bought him one of his own. You can also use this on your teeth. Don't hesitate to
              get one! I had fillings done and they are sensitive and it still works without pain!
            </p>
            <div className="relative h-32 rounded-lg overflow-hidden">
              <Image src="/placeholder.svg?height=150&width=200" alt="Review photo" fill className="object-cover" />
            </div>
          </div>

          {/* Review 2 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image src="/placeholder.svg?height=48&width=48" alt="Mary T." fill className="object-cover" />
              </div>
              <div>
                <div className="font-semibold">Mary T.</div>
                <div className="flex text-green-500 text-sm">
                  {[...Array(5)].map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              I love this toothbrush! It is like the one in the pic! OMG is this effective at cleaning your teeth! I
              haven't used my regular toothbrush since I got these and I'm never going back. It feels totally mean what
              they're called the best toothbrush ever created.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative h-32 rounded-lg overflow-hidden">
                <Image src="/placeholder.svg?height=150&width=200" alt="Review photo" fill className="object-cover" />
              </div>
              <div className="relative h-32 rounded-lg overflow-hidden">
                <Image src="/placeholder.svg?height=150&width=200" alt="Review photo" fill className="object-cover" />
              </div>
            </div>
          </div>

          {/* Review 3 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image src="/placeholder.svg?height=48&width=48" alt="Lauren N." fill className="object-cover" />
              </div>
              <div>
                <div className="font-semibold">Lauren N.</div>
                <div className="flex text-green-500 text-sm">
                  {[...Array(5)].map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              I want the hard and I needed a gentler toothbrush. I have had one before and I was thrilled. The bristle
              texture is very soft. It didn't hurt my gums when brushing. It has a thick, easy to hold. My teeth have
              getting really white. Cleans plaque better and bristles didn't irritate.
            </p>
            <div className="relative h-32 rounded-lg overflow-hidden">
              <Image src="/placeholder.svg?height=150&width=200" alt="Review photo" fill className="object-cover" />
            </div>
          </div>
        </div>

        {/* More Reviews */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Review 4 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image src="/placeholder.svg?height=48&width=48" alt="Pauline S." fill className="object-cover" />
              </div>
              <div>
                <div className="font-semibold">Pauline S.</div>
                <div className="flex text-green-500 text-sm">
                  {[...Array(5)].map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Sooo Soooofttttt! I have over sore from very firm bristle brushes toothbrushes in my life. It is by far
              the thickest. As someone who has a sensitive gums and this has made a huge difference for me. I'm not
              kidding. The longer, finer bristles so much better. No more exacerbating brush to get everywhere and
              gentle throughout.
            </p>
            <div className="relative h-32 rounded-lg overflow-hidden">
              <Image src="/placeholder.svg?height=150&width=200" alt="Review photo" fill className="object-cover" />
            </div>
          </div>

          {/* Review 5 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image src="/placeholder.svg?height=48&width=48" alt="Connie J." fill className="object-cover" />
              </div>
              <div>
                <div className="font-semibold">Connie J.</div>
                <div className="flex text-green-500 text-sm">
                  {[...Array(5)].map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              I love this toothbrush. I normally have a harder texture and I was for a softer bristle. I went at the
              dentist and I asked all my tooth brush gone. For a minute I said yeah I got a new one and he felt me that
              my teeth are really healthier now and he never actually said that to me.
            </p>
            <div className="relative h-32 rounded-lg overflow-hidden">
              <Image src="/placeholder.svg?height=150&width=200" alt="Review photo" fill className="object-cover" />
            </div>
          </div>

          {/* Review 6 */}
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image src="/placeholder.svg?height=48&width=48" alt="Customer" fill className="object-cover" />
              </div>
              <div>
                <div className="font-semibold">Customer</div>
                <div className="flex text-green-500 text-sm">
                  {[...Array(5)].map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              Love this toothbrush! The bristles are super soft but still clean really well. My gums feel much better
              and I don't have any bleeding anymore. Highly recommend!
            </p>
            <div className="relative h-32 rounded-lg overflow-hidden">
              <Image src="/placeholder.svg?height=150&width=200" alt="Review photo" fill className="object-cover" />
            </div>
          </div>
        </div>

        {/* Write a Review Button */}
        <div className="text-center mt-8">
          <button className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Write a review
          </button>
        </div>
      </div>
    </section>
  )
}
