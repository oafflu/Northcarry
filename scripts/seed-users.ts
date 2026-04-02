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

async function createUser(email: string, password: string, firstName: string, lastName: string, isAdmin = false) {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    })

    if (authError) {
      console.error(`Error creating auth user for ${email}:`, authError.message)
      return { success: false, error: authError.message }
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create user' }
    }

    // Create profile - try with role first, fallback without if column doesn't exist
    let profileData: any = {
      id: authData.user.id,
      email: authData.user.email!,
      first_name: firstName,
      last_name: lastName,
    }
    
    if (isAdmin) {
      profileData.role = 'admin'
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profileData)

    if (profileError) {
      // If role column doesn't exist, try without it and log warning
      if (profileError.message.includes('role') || profileError.message.includes('column')) {
        console.warn(`Warning: Role column may not exist. Attempting without role field for ${email}`)
        const { error: retryError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: authData.user.email!,
            first_name: firstName,
            last_name: lastName,
          })
        
        if (retryError) {
          console.error(`Error creating profile for ${email}:`, retryError.message)
          await supabase.auth.admin.deleteUser(authData.user.id)
          return { success: false, error: retryError.message }
        }
        console.warn(`Note: Admin role not set - role column may need to be added to profiles table`)
      } else {
        console.error(`Error creating profile for ${email}:`, profileError.message)
        await supabase.auth.admin.deleteUser(authData.user.id)
        return { success: false, error: profileError.message }
      }
    }

    // Create loyalty member for customer
    if (!isAdmin) {
      const { data: bronzeTier } = await supabase
        .from('loyalty_tiers')
        .select('id')
        .eq('name', 'Bronze')
        .single()

      const referralCode = `REF-${authData.user.id.substring(0, 8).toUpperCase()}`

      await supabase.from('loyalty_members').insert({
        user_id: authData.user.id,
        tier_id: bronzeTier?.id || null,
        points_balance: 0,
        lifetime_points: 0,
        referral_code: referralCode,
      })
    }

    console.log(`✓ Created ${isAdmin ? 'admin' : 'customer'} user: ${email}`)
    return { success: true, userId: authData.user.id }
  } catch (error: any) {
    console.error(`Error creating user ${email}:`, error.message)
    return { success: false, error: error.message }
  }
}

async function seedUsers() {
  console.log('Starting user seed...\n')

  // Create customer
  const customerResult = await createUser(
    'customer@brevibrushes.com',
    'customer123',
    'John',
    'Doe',
    false
  )

  // Create admin
  const adminResult = await createUser(
    'admin@brevibrushes.com',
    'admin123',
    'Admin',
    'User',
    true
  )

  console.log('\n=== Seed Summary ===')
  console.log(`Customer: ${customerResult.success ? '✓ Created' : '✗ Failed - ' + customerResult.error}`)
  console.log(`Admin: ${adminResult.success ? '✓ Created' : '✗ Failed - ' + adminResult.error}`)

  if (customerResult.success && adminResult.success) {
    console.log('\n✓ All users created successfully!')
    process.exit(0)
  } else {
    console.log('\n✗ Some users failed to create')
    process.exit(1)
  }
}

seedUsers()

