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

async function addRoleColumn() {
  console.log('Adding role column to profiles table...\n')

  try {
    // Add role column using SQL
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE profiles 
        ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin'));
      `,
    })

    if (alterError) {
      // If RPC doesn't work, try direct SQL execution
      console.log('RPC method failed, trying alternative approach...')
      
      // For now, we'll update the admin user directly if we can find them
      const { data: adminUser } = await supabase.auth.admin.listUsers()
      const admin = adminUser?.users.find((u) => u.email === 'admin@brevibrushes.com')
      
      if (admin) {
        // Try to update profile with role using upsert
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', admin.id)

        if (updateError) {
          console.log('Note: Could not add role column automatically.')
          console.log('Please run this SQL in your Supabase dashboard:')
          console.log(`
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin'));

UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@brevibrushes.com';
          `)
          return
        }
        
        console.log('✓ Updated admin user role')
      }
    } else {
      console.log('✓ Role column added successfully')
      
      // Update admin user
      const { data: adminUser } = await supabase.auth.admin.listUsers()
      const admin = adminUser?.users.find((u) => u.email === 'admin@brevibrushes.com')
      
      if (admin) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', admin.id)

        if (updateError) {
          console.error('Error updating admin role:', updateError.message)
        } else {
          console.log('✓ Admin role set successfully')
        }
      }
    }
  } catch (error: any) {
    console.log('Note: Could not add role column automatically.')
    console.log('Please run this SQL in your Supabase dashboard:')
    console.log(`
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin'));

UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@brevibrushes.com';
    `)
  }
}

addRoleColumn()

