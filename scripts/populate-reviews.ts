import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Product names to find
const PRODUCT_NAMES = [
  'BREVI™ Nordic-Inspired Premium Nano Toothbrush',
  'Brevi™ Nano Sonic Toothbrush',
  'BREVI™ Nordic-Inspired Premium Nano Kids Toothbrush'
]

// Realistic review comments
const REVIEW_COMMENTS = {
  5: [
    'Absolutely love this toothbrush! The bristles are so soft and gentle on my gums. My teeth feel incredibly clean after every use.',
    'Best toothbrush I\'ve ever used! The design is beautiful and it works amazingly well. Highly recommend!',
    'Excellent quality! My dentist noticed a huge improvement in my oral health. The bristles are perfect - not too hard, not too soft.',
    'This is a game changer! My teeth have never felt cleaner. The eco-friendly aspect is a huge bonus too.',
    'Outstanding product! The build quality is exceptional and it cleans my teeth thoroughly. Worth every penny!',
    'I\'ve been using this for months and my teeth are noticeably whiter. The bristles stay in great condition.',
    'Perfect toothbrush! The handle is comfortable and the bristles are just right. My whole family loves it.',
    'Amazing quality! My sensitive gums appreciate how gentle yet effective this brush is. Highly recommend!',
    'This toothbrush exceeded my expectations. My teeth feel smooth and clean, and I love the sustainable design.',
    'Fantastic product! The bristles are perfectly spaced and clean every surface. My oral hygiene has improved significantly.',
    'Love it! The design is sleek and it works incredibly well. My teeth feel amazing after every brush.',
    'Top quality toothbrush! The bristles are soft but effective. My dentist was impressed with the improvement.',
    'Excellent purchase! The brush is well-made and my teeth feel cleaner than ever. Highly satisfied!',
    'This toothbrush is perfect! The bristles are gentle on my gums but still clean thoroughly. Great value!',
    'Amazing! My teeth have never felt this clean. The eco-friendly materials are a huge plus. Highly recommend!',
  ],
  4: [
    'Great toothbrush! Works well and feels good. The bristles are soft and effective. Would recommend.',
    'Good quality product. My teeth feel clean and the brush is comfortable to use. Happy with my purchase.',
    'Nice toothbrush overall. The design is good and it cleans well. Minor improvements could be made but solid product.',
    'Pretty good! The bristles are soft and it does the job. The handle could be slightly more ergonomic but overall satisfied.',
    'Decent toothbrush. Cleans well and feels comfortable. Not perfect but definitely worth the price.',
    'Good value for money. The brush works well and my teeth feel clean. Would buy again.',
    'Solid product. The bristles are effective and the design is nice. Minor gripes but overall happy.',
    'Works well! My teeth feel clean after use. The quality is good though not exceptional. Satisfied customer.',
    'Nice brush! Does what it should. The bristles are soft and effective. Good purchase overall.',
    'Good quality. The toothbrush cleans well and feels comfortable. Some room for improvement but happy with it.',
  ],
  3: [
    'It\'s okay. Works fine but nothing special. The bristles are decent but could be better. Average product.',
    'Decent toothbrush. Does the job but I expected more for the price. The quality is acceptable but not outstanding.',
    'Average quality. It works but I\'ve had better. The bristles are okay but not as soft as I hoped.',
    'It\'s fine. Gets the job done but nothing remarkable. The design is okay but could be improved.',
    'Okay product. Works adequately but doesn\'t stand out. The bristles are acceptable but not exceptional.',
  ],
  2: [
    'Not impressed. The bristles are too hard for my sensitive gums. Expected better quality for the price.',
    'Disappointed. The brush doesn\'t clean as well as I hoped. The bristles feel rough and uncomfortable.',
    'Below expectations. The quality isn\'t what I expected. The bristles are too firm and hurt my gums.',
    'Not great. The toothbrush is okay but the bristles are too hard. Wouldn\'t buy again.',
  ],
  1: [
    'Poor quality. The bristles are way too hard and hurt my gums. Very disappointed with this purchase.',
    'Terrible. The brush broke after a few uses. The quality is unacceptable. Would not recommend.',
    'Very disappointed. The bristles are extremely hard and caused gum bleeding. Poor quality product.',
  ],
}

const REVIEW_TITLES = {
  5: [
    'Amazing toothbrush!',
    'Best purchase ever!',
    'Highly recommend!',
    'Excellent quality!',
    'Love it!',
    'Perfect brush!',
    'Outstanding product!',
    'Game changer!',
    'Fantastic!',
    'Great quality!',
  ],
  4: [
    'Good toothbrush',
    'Solid product',
    'Works well',
    'Nice brush',
    'Good value',
    'Happy with purchase',
    'Decent quality',
  ],
  3: [
    'It\'s okay',
    'Average',
    'Decent',
    'Nothing special',
  ],
  2: [
    'Not great',
    'Disappointed',
    'Below expectations',
  ],
  1: [
    'Poor quality',
    'Very disappointed',
    'Terrible',
  ],
}

// Generate random date between start and end
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

// Generate random integer between min and max (inclusive)
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Get random element from array
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)]
}

async function populateReviews() {
  console.log('Starting review population...\n')

  // Find the three products
  console.log('Finding products...')
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, title, slug')
    .in('title', PRODUCT_NAMES)

  if (productsError) {
    console.error('Error finding products:', productsError)
    process.exit(1)
  }

  if (!products || products.length === 0) {
    console.error('No products found. Please ensure the products exist in the database.')
    process.exit(1)
  }

  if (products.length < 3) {
    console.warn(`Warning: Only found ${products.length} products. Expected 3.`)
  }

  console.log(`Found ${products.length} products:`)
  products.forEach(p => console.log(`  - ${p.title} (${p.id})`))
  console.log()

  // Calculate reviews per product (distribute 323 evenly)
  const totalReviews = 323
  const reviewsPerProduct = Math.floor(totalReviews / products.length)
  const remainder = totalReviews % products.length

  // Date range: 2023-01-01 to today
  const startDate = new Date('2023-01-01')
  const endDate = new Date()

  const reviews: Array<{
    product_id: string
    user_id: string | null
    order_id: string | null
    rating: number
    title: string | null
    comment: string
    is_verified_purchase: boolean
    is_approved: boolean
    is_hidden: boolean
    helpful_count: number
    created_at: string
    updated_at: string
  }> = []

  // Generate reviews for each product
  for (let i = 0; i < products.length; i++) {
    const product = products[i]
    const count = reviewsPerProduct + (i < remainder ? 1 : 0)
    
    console.log(`Generating ${count} reviews for ${product.title}...`)

    for (let j = 0; j < count; j++) {
      // Rating distribution: 70% 5-star, 20% 4-star, 7% 3-star, 2% 2-star, 1% 1-star
      const rand = Math.random()
      let rating: number
      if (rand < 0.70) rating = 5
      else if (rand < 0.90) rating = 4
      else if (rand < 0.97) rating = 3
      else if (rand < 0.99) rating = 2
      else rating = 1

      // 70% verified purchases
      const isVerifiedPurchase = Math.random() < 0.70

      // 90% approved
      const isApproved = Math.random() < 0.90

      // 5% hidden
      const isHidden = Math.random() < 0.05

      // 50% have titles
      const hasTitle = Math.random() < 0.50

      // Helpful count: 0-50, weighted towards lower numbers
      const helpfulCount = Math.floor(Math.random() ** 2 * 50)

      // Random date between 2023-01-01 and today
      const reviewDate = randomDate(startDate, endDate)

      const comment = randomElement(REVIEW_COMMENTS[rating as keyof typeof REVIEW_COMMENTS])
      const title = hasTitle ? randomElement(REVIEW_TITLES[rating as keyof typeof REVIEW_TITLES]) : null

      reviews.push({
        product_id: product.id,
        user_id: null, // Anonymous reviews
        order_id: null,
        rating,
        title,
        comment,
        is_verified_purchase: isVerifiedPurchase,
        is_approved: isApproved,
        is_hidden: isHidden,
        helpful_count: helpfulCount,
        created_at: reviewDate.toISOString(),
        updated_at: reviewDate.toISOString(),
      })
    }
  }

  // Insert reviews in batches of 50
  console.log(`\nInserting ${reviews.length} reviews in batches...`)
  const batchSize = 50
  let inserted = 0
  let failed = 0

  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize)
    const { error } = await supabase
      .from('reviews')
      .insert(batch)

    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error.message)
      failed += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`\rInserted ${inserted}/${reviews.length} reviews...`)
    }
  }

  console.log('\n\n=== Population Summary ===')
  console.log(`Total reviews generated: ${reviews.length}`)
  console.log(`Successfully inserted: ${inserted}`)
  console.log(`Failed: ${failed}`)

  // Show distribution by rating
  const ratingDistribution: Record<number, number> = {}
  reviews.forEach(r => {
    ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1
  })
  console.log('\nRating distribution:')
  Object.entries(ratingDistribution)
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
    .forEach(([rating, count]) => {
      console.log(`  ${rating} stars: ${count} (${((count / reviews.length) * 100).toFixed(1)}%)`)
    })

  // Show other stats
  const verifiedCount = reviews.filter(r => r.is_verified_purchase).length
  const approvedCount = reviews.filter(r => r.is_approved).length
  const hiddenCount = reviews.filter(r => r.is_hidden).length
  const withTitleCount = reviews.filter(r => r.title).length

  console.log('\nOther statistics:')
  console.log(`  Verified purchases: ${verifiedCount} (${((verifiedCount / reviews.length) * 100).toFixed(1)}%)`)
  console.log(`  Approved: ${approvedCount} (${((approvedCount / reviews.length) * 100).toFixed(1)}%)`)
  console.log(`  Hidden: ${hiddenCount} (${((hiddenCount / reviews.length) * 100).toFixed(1)}%)`)
  console.log(`  With titles: ${withTitleCount} (${((withTitleCount / reviews.length) * 100).toFixed(1)}%)`)

  if (inserted === reviews.length) {
    console.log('\n✓ All reviews inserted successfully!')
    process.exit(0)
  } else {
    console.log('\n✗ Some reviews failed to insert')
    process.exit(1)
  }
}

populateReviews()

