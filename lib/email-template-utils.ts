/**
 * Email template variable replacement utilities
 * Handles template syntax like {{variable|default:'value'}}
 */

interface RecipientData {
  email: string
  firstName?: string
  lastName?: string
  name?: string
  [key: string]: any
}

/**
 * Replace template variables in email content
 * Supports syntax: {{variable|default:'value'}} and {{variable}}
 */
export function replaceTemplateVariables(
  content: string,
  recipientData: RecipientData
): string {
  let result = content

  // Extract firstName from name if not provided
  if (!recipientData.firstName && recipientData.name) {
    recipientData.firstName = recipientData.name.split(' ')[0] || ''
  }

  // Handle {{firstName|default:'Hey'}} syntax
  const firstNamePattern = /\{\{firstName\|default:['"]([^'"]+)['"]\}\}/gi
  result = result.replace(firstNamePattern, (match, defaultValue) => {
    const firstName = recipientData.firstName || recipientData.name?.split(' ')[0] || ''
    return firstName || defaultValue || 'there'
  })

  // Handle {{firstName}} (simple syntax)
  if (recipientData.firstName) {
    result = result.replace(/\{\{firstName\}\}/gi, recipientData.firstName)
  } else if (recipientData.name) {
    const firstName = recipientData.name.split(' ')[0]
    result = result.replace(/\{\{firstName\}\}/gi, firstName)
  } else {
    // If no firstName, try to extract from default syntax
    result = result.replace(/\{\{firstName\}\}/gi, 'there')
  }

  // Handle {{name|default:'there'}} syntax
  const namePattern = /\{\{name\|default:['"]([^'"]+)['"]\}\}/gi
  result = result.replace(namePattern, (match, defaultValue) => {
    const name = recipientData.name || `${recipientData.firstName || ''} ${recipientData.lastName || ''}`.trim()
    return name || defaultValue || 'there'
  })

  // Handle {{name}} (simple syntax)
  if (recipientData.name) {
    result = result.replace(/\{\{name\}\}/gi, recipientData.name)
  } else if (recipientData.firstName || recipientData.lastName) {
    const fullName = `${recipientData.firstName || ''} ${recipientData.lastName || ''}`.trim()
    result = result.replace(/\{\{name\}\}/gi, fullName)
  } else {
    result = result.replace(/\{\{name\}\}/gi, 'there')
  }

  // Handle {{email}} variable
  if (recipientData.email) {
    result = result.replace(/\{\{email\}\}/gi, recipientData.email)
  }

  // Handle {{unsubscribe_link}} - replace with actual unsubscribe link
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://brevibrushes.com'
  const unsubscribeLink = `${siteUrl}/unsubscribe?email=${encodeURIComponent(recipientData.email || '')}`
  result = result.replace(/\{\{unsubscribe_link\}\}/gi, unsubscribeLink)

  // Handle {{organizationName}} and {{organizationAddress}}
  result = result.replace(/\{\{organizationName\}\}/gi, 'BREVI™')
  result = result.replace(/\{\{organizationAddress\}\}/gi, 'BREVI™')

  // Handle any other variables with default syntax {{variable|default:'value'}}
  const variablePattern = /\{\{(\w+)\|default:['"]([^'"]+)['"]\}\}/gi
  result = result.replace(variablePattern, (match, variableName, defaultValue) => {
    // Skip if already handled
    if (['firstName', 'name', 'email'].includes(variableName.toLowerCase())) {
      return match
    }
    
    const value = recipientData[variableName] || recipientData[variableName.toLowerCase()]
    return value || defaultValue || ''
  })

  // Handle any remaining simple {{variable}} syntax
  const simpleVariablePattern = /\{\{(\w+)\}\}/gi
  result = result.replace(simpleVariablePattern, (match, variableName) => {
    // Skip if already handled or is a known template variable
    if (['firstName', 'name', 'email', 'unsubscribe_link', 'organizationName', 'organizationAddress'].includes(variableName.toLowerCase())) {
      return match
    }
    
    const value = recipientData[variableName] || recipientData[variableName.toLowerCase()]
    return value || match // Return original if not found
  })

  return result
}

/**
 * Get recipient data (name, email) from email address
 */
export async function getRecipientData(
  email: string,
  supabase: any
): Promise<RecipientData> {
  try {
    // Try to find in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('email', email.toLowerCase())
      .single()

    if (profile) {
      return {
        email: profile.email || email,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.first_name || profile.email || email,
      }
    }

    // Try email_subscribers table
    const { data: subscriber } = await supabase
      .from('email_subscribers')
      .select('email, name')
      .eq('email', email.toLowerCase())
      .single()

    if (subscriber) {
      const nameParts = (subscriber.name || '').split(' ')
      return {
        email: subscriber.email || email,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        name: subscriber.name || email,
      }
    }

    // Fallback: return email only
    return {
      email: email,
      firstName: '',
      lastName: '',
      name: email,
    }
  } catch (error) {
    console.error(`Error fetching recipient data for ${email}:`, error)
    return {
      email: email,
      firstName: '',
      lastName: '',
      name: email,
    }
  }
}
