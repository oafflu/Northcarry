/**
 * Email Configuration Diagnostic Script
 * 
 * This script checks the email configuration across the project to ensure
 * it's properly set up for Microsoft 365 SMTP.
 * 
 * Run with: npx tsx scripts/check-email-config.ts
 */

import { createAdminSupabaseClient } from '../lib/supabase/admin'
import { getSetting } from '../app/actions/settings'

async function checkEmailConfig() {
  console.log('🔍 Checking Email Configuration...\n')
  
  const issues: string[] = []
  const warnings: string[] = []
  const info: string[] = []

  // 1. Check environment variables
  console.log('1️⃣ Checking Environment Variables:')
  const envVars = {
    EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
    EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
    EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
    EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD ? '***SET***' : undefined,
    EMAIL_FROM: process.env.EMAIL_FROM,
  }

  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      console.log(`   ✅ ${key}: ${value}`)
      info.push(`Environment variable ${key} is set`)
    } else {
      console.log(`   ⚠️  ${key}: Not set (will use database settings)`)
      warnings.push(`Environment variable ${key} is not set`)
    }
  })

  // 2. Check database settings
  console.log('\n2️⃣ Checking Database Settings:')
  try {
    const { data: emailProvider } = await getSetting('email_provider')
    
    if (!emailProvider) {
      console.log('   ❌ email_provider setting not found in database')
      issues.push('Email provider not configured in database')
    } else {
      const config = emailProvider as any
      console.log(`   ✅ Provider: ${config.provider || 'not set'}`)
      
      if (config.provider === 'smtp') {
        console.log(`   ${config.server_host ? '✅' : '❌'} Server Host: ${config.server_host || 'NOT SET'}`)
        console.log(`   ${config.server_port ? '✅' : '❌'} Server Port: ${config.server_port || 'NOT SET'}`)
        console.log(`   ${config.server_user ? '✅' : '❌'} Server User: ${config.server_user || 'NOT SET'}`)
        console.log(`   ${config.server_password ? '✅' : '⚠️ '} Server Password: ${config.server_password ? 'SET' : 'NOT SET'}`)
        console.log(`   ${config.from_email ? '✅' : '⚠️ '} From Email: ${config.from_email || 'NOT SET'}`)
        console.log(`   ${config.from_name ? '✅' : '⚠️ '} From Name: ${config.from_name || 'NOT SET'}`)

        // Check for common issues
        if (!config.server_host) {
          issues.push('SMTP server host is not configured')
        }
        if (!config.server_port) {
          issues.push('SMTP server port is not configured')
        }
        if (!config.server_user) {
          issues.push('SMTP username/email is not configured')
        }
        if (!config.server_password) {
          issues.push('SMTP password is not configured - this will cause authentication failures')
        }
        if (config.server_user && config.from_email && config.server_user !== config.from_email) {
          warnings.push(`From email (${config.from_email}) differs from SMTP user (${config.server_user}). Microsoft 365 may require "Send As" permission.`)
        }
        if (config.server_host && !config.server_host.includes('office365.com') && !config.server_host.includes('outlook.com')) {
          warnings.push(`Server host (${config.server_host}) doesn't appear to be Microsoft 365. Make sure it's correct.`)
        }
        if (config.server_port && config.server_port !== '587' && config.server_port !== '465') {
          warnings.push(`Port ${config.server_port} is not standard for Microsoft 365. Recommended: 587 (STARTTLS) or 465 (SSL)`)
        }
      } else {
        info.push(`Using ${config.provider} provider (not SMTP)`)
      }
    }
  } catch (error: any) {
    console.log(`   ❌ Error reading database settings: ${error.message}`)
    issues.push(`Failed to read database settings: ${error.message}`)
  }

  // 3. Check configuration priority
  console.log('\n3️⃣ Configuration Priority:')
  console.log('   The system uses settings in this order:')
  console.log('   1. Database settings (admin_settings.email_provider)')
  console.log('   2. Environment variables (.env.local)')
  console.log('   3. Default values')

  // 4. Microsoft 365 specific checks
  console.log('\n4️⃣ Microsoft 365 Requirements:')
  const m365Checks = [
    {
      check: 'SMTP AUTH enabled in Microsoft 365 Admin Center',
      status: '⚠️  Manual check required',
      action: 'Go to Microsoft 365 Admin Center > Settings > Mail > POP and IMAP, enable SMTP AUTH'
    },
    {
      check: 'App-Specific Password (if MFA or Security Defaults enabled)',
      status: '⚠️  Manual check required',
      action: 'If authentication fails, create app password at https://account.microsoft.com/security'
    },
    {
      check: 'Account not locked or restricted',
      status: '⚠️  Manual check required',
      action: 'Verify account status in Microsoft 365 Admin Center'
    },
    {
      check: 'From email matches SMTP user or has "Send As" permission',
      status: '⚠️  Manual check required',
      action: 'Ensure From email matches SMTP user email, or grant "Send As" permission'
    }
  ]

  m365Checks.forEach(({ check, status, action }) => {
    console.log(`   ${status} ${check}`)
    console.log(`      → ${action}`)
  })

  // 5. Summary
  console.log('\n📊 Summary:')
  if (issues.length === 0 && warnings.length === 0) {
    console.log('   ✅ Configuration looks good!')
  } else {
    if (issues.length > 0) {
      console.log(`\n   ❌ Critical Issues (${issues.length}):`)
      issues.forEach((issue, i) => {
        console.log(`      ${i + 1}. ${issue}`)
      })
    }
    if (warnings.length > 0) {
      console.log(`\n   ⚠️  Warnings (${warnings.length}):`)
      warnings.forEach((warning, i) => {
        console.log(`      ${i + 1}. ${warning}`)
      })
    }
  }

  // 6. Recommendations
  console.log('\n💡 Recommendations:')
  console.log('   1. Ensure SMTP password is set in database settings (/admin/settings/email)')
  console.log('   2. If authentication fails, try using an App-Specific Password:')
  console.log('      - Go to https://account.microsoft.com/security')
  console.log('      - Sign in with hello@brevibrushes.com')
  console.log('      - Go to "Advanced security options" > "App passwords"')
  console.log('      - Create a new app password for "Mail"')
  console.log('      - Use this password in your email configuration')
  console.log('   3. Verify SMTP AUTH is enabled in Microsoft 365 Admin Center')
  console.log('   4. Test the connection using the "Test Connection" button on /admin/settings/email')
  console.log('   5. Check Microsoft 365 account status and ensure it\'s not locked')

  return {
    issues,
    warnings,
    info,
    hasIssues: issues.length > 0,
  }
}

// Run the check
if (require.main === module) {
  checkEmailConfig()
    .then((result) => {
      process.exit(result.hasIssues ? 1 : 0)
    })
    .catch((error) => {
      console.error('❌ Error running email config check:', error)
      process.exit(1)
    })
}

export { checkEmailConfig }

