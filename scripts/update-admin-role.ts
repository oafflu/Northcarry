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

async function updateAdminRole() {
  console.log('Updating admin user role...\n')

  try {
    // Find admin user by email
    const { data: adminUser } = await supabase.auth.admin.listUsers()
    const admin = adminUser?.users.find((u) => u.email === 'admin@brevibrushes.com')
    
    if (!admin) {
      console.error('Admin user not found')
      return
    }

    // Try to update profile - this will work if role column exists
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', admin.id)

    if (updateError) {
      if (updateError.message.includes('role') || updateError.message.includes('column')) {
        console.log('⚠ Role column does not exist in profiles table.')
        console.log('Please run the SQL migration in your Supabase dashboard:')
        console.log('\n' + '='.repeat(60))
        console.log('Run this SQL in Supabase SQL Editor:')
        console.log('='.repeat(60))
        const fs = await import('fs')
        const sql = fs.readFileSync(resolve(process.cwd(), 'scripts/add-role-column.sql'), 'utf-8')
        console.log(sql)
        console.log('='.repeat(60) + '\n')
      } else {
        console.error('Error updating admin role:', updateError.message)
      }
    } else {
      console.log('✓ Admin role updated successfully!')
    }
  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

updateAdminRole()

