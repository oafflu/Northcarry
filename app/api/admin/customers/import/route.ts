import { createAdminSupabaseClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

// Vercel Pro has 60-second limit, so we process in chunks
export const maxDuration = 60
export const dynamic = 'force-dynamic'

interface ShopifyCustomerRow {
  "Customer ID": string
  "First Name": string
  "Last Name": string
  "Email": string
  "Accepts Email Marketing": string
  "Default Address Company": string
  "Default Address Address1": string
  "Default Address Address2": string
  "Default Address City": string
  "Default Address Province Code": string
  "Default Address Country Code": string
  "Default Address Zip": string
  "Default Address Phone": string
  "Phone": string
  "Accepts SMS Marketing": string
  "Total Spent": string
  "Total Orders": string
  "Note": string
  "Tax Exempt": string
  "Tags": string
  "Country (customer.metafields.custom.country)": string
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      values.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  // Add last field
  values.push(current.trim())

  return values
}

function parseCSV(csvText: string): ShopifyCustomerRow[] {
  const lines = csvText.split("\n").filter((line) => line.trim())
  if (lines.length < 2) {
    console.log("Not enough lines in CSV:", lines.length)
    return []
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map((h) => h.trim())
  console.log("Parsed headers:", headers.slice(0, 10), "... (showing first 10)")
  
  // Find header indices (case-insensitive partial match)
  const getHeaderIndex = (name: string) => {
    const lowerName = name.toLowerCase()
    const index = headers.findIndex((h) => h.toLowerCase().includes(lowerName))
    if (index < 0) {
      console.warn(`Header not found: ${name}. Available headers:`, headers)
    }
    return index >= 0 ? index : -1
  }

  const customerIdIdx = getHeaderIndex("Customer ID")
  const firstNameIdx = getHeaderIndex("First Name")
  const lastNameIdx = getHeaderIndex("Last Name")
  const emailIdx = getHeaderIndex("Email")
  const acceptsEmailIdx = getHeaderIndex("Accepts Email Marketing")
  const address1Idx = getHeaderIndex("Default Address Address1")
  const address2Idx = getHeaderIndex("Default Address Address2")
  const cityIdx = getHeaderIndex("Default Address City")
  const stateIdx = getHeaderIndex("Default Address Province Code")
  const countryIdx = getHeaderIndex("Default Address Country Code")
  const zipIdx = getHeaderIndex("Default Address Zip")
  const addressPhoneIdx = getHeaderIndex("Default Address Phone")
  const phoneIdx = getHeaderIndex("Phone")
  const totalSpentIdx = getHeaderIndex("Total Spent")
  const totalOrdersIdx = getHeaderIndex("Total Orders")
  const tagsIdx = getHeaderIndex("Tags")

  // Validate required indices
  if (emailIdx < 0) {
    console.error("Email column not found in CSV headers")
    return []
  }

  const rows: ShopifyCustomerRow[] = []
  let skippedRows = 0

  // Parse rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Remove leading single quote if present (Shopify export format)
    const cleanLine = line.startsWith("'") ? line.slice(1) : line
    
    const values = parseCSVLine(cleanLine)
    if (values.length < headers.length) {
      // Pad with empty strings if needed
      while (values.length < headers.length) {
        values.push("")
      }
    }

    const email = values[emailIdx]?.trim()
    if (!email || !email.includes("@")) {
      skippedRows++
      if (skippedRows <= 5) {
        console.log(`Skipping row ${i + 1}: Invalid email - ${email}`)
      }
      continue
    }

    const getValue = (idx: number) => {
      if (idx < 0 || idx >= values.length) return ""
      return values[idx]?.trim() || ""
    }

    rows.push({
      "Customer ID": getValue(customerIdIdx),
      "First Name": getValue(firstNameIdx),
      "Last Name": getValue(lastNameIdx),
      "Email": email.toLowerCase(),
      "Accepts Email Marketing": getValue(acceptsEmailIdx),
      "Default Address Company": getValue(getHeaderIndex("Default Address Company")),
      "Default Address Address1": getValue(address1Idx),
      "Default Address Address2": getValue(address2Idx),
      "Default Address City": getValue(cityIdx),
      "Default Address Province Code": getValue(stateIdx),
      "Default Address Country Code": getValue(countryIdx),
      "Default Address Zip": getValue(zipIdx),
      "Default Address Phone": getValue(addressPhoneIdx),
      "Phone": getValue(phoneIdx),
      "Accepts SMS Marketing": getValue(getHeaderIndex("Accepts SMS Marketing")),
      "Total Spent": getValue(totalSpentIdx),
      "Total Orders": getValue(totalOrdersIdx),
      "Note": getValue(getHeaderIndex("Note")),
      "Tax Exempt": getValue(getHeaderIndex("Tax Exempt")),
      "Tags": getValue(tagsIdx),
      "Country (customer.metafields.custom.country)": getValue(getHeaderIndex("Country")),
    })
  }

  console.log(`Parsed ${rows.length} valid rows, skipped ${skippedRows} rows`)
  return rows
}

function cleanPhone(phone: string): string | null {
  if (!phone) return null
  // Remove common phone formatting characters
  const cleaned = phone.replace(/[^\d+]/g, "")
  return cleaned.length > 0 ? cleaned : null
}

// Process a chunk of customers (optimized for speed)
async function processCustomerChunk(
  rows: ShopifyCustomerRow[],
  startIndex: number,
  endIndex: number
): Promise<{ imported: number; updated: number; errors: number; errorMessages: string[]; userIds: string[] }> {
  const supabase = createAdminSupabaseClient()
  let imported = 0
  let updated = 0
  let errors = 0
  const errorMessages: string[] = []
  const userIds: string[] = []

  // Process sequentially for reliability (smaller batches)
  const batchSize = 3 // Very small batches to avoid timeout
  const chunk = rows.slice(startIndex, endIndex)
  
  const startTime = Date.now()
  const MAX_PROCESSING_TIME = 45 // Stop processing if we're approaching 45 seconds
  console.log(`Starting chunk processing: ${chunk.length} customers, starting at index ${startIndex}`)

  for (let i = 0; i < chunk.length; i += batchSize) {
    const batch = chunk.slice(i, i + batchSize)
    const batchIndex = startIndex + i

    for (const row of batch) {
      try {
        const email = row.Email.toLowerCase().trim()
        if (!email) {
          errors++
          errorMessages.push(`Row ${batchIndex + batch.indexOf(row) + 2}: Missing email`)
          continue
        }

        // Check if customer already exists
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, email")
          .eq("email", email)
          .maybeSingle()

        let userId: string

        if (existingProfile) {
          // Customer already exists - update their profile
          userId = existingProfile.id
          const updateData: any = {}
          if (row["First Name"]) updateData.first_name = row["First Name"].trim()
          if (row["Last Name"]) updateData.last_name = row["Last Name"].trim()
          const phone = cleanPhone(row["Phone"] || row["Default Address Phone"])
          if (phone) updateData.phone = phone

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase.from("profiles").update(updateData).eq("id", userId)
            if (updateError) {
              errors++
              errorMessages.push(`Row ${batchIndex + batch.indexOf(row) + 2}: ${updateError.message}`)
              continue
            }
          }
          updated++
          userIds.push(userId)
        } else {
          // Create new auth user and profile
          const tempPassword = `Temp${Math.random().toString(36).slice(-12)}!${Date.now()}`
          
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: true,
          })

          if (authError || !authData.user) {
            errors++
            const rowNum = batchIndex + batch.indexOf(row) + 2
            errorMessages.push(`Row ${rowNum}: ${authError?.message || "Failed to create user"}`)
            if (errorMessages.length <= 20) {
              console.error(`Failed to create user for ${email}:`, authError)
            }
            continue
          }

          userId = authData.user.id

          // Create profile
          const phone = cleanPhone(row["Phone"] || row["Default Address Phone"])
          const { error: profileError } = await supabase.from("profiles").insert({
            id: userId,
            email: email,
            first_name: row["First Name"]?.trim() || null,
            last_name: row["Last Name"]?.trim() || null,
            phone: phone,
            role: "customer",
          })

          if (profileError) {
            errors++
            const rowNum = batchIndex + batch.indexOf(row) + 2
            errorMessages.push(`Row ${rowNum}: ${profileError.message}`)
            // Clean up auth user if profile creation fails
            try {
              await supabase.auth.admin.deleteUser(userId)
            } catch (deleteError) {
              console.error("Failed to cleanup auth user:", deleteError)
            }
            continue
          }

          imported++
          userIds.push(userId)
        }

        // Create/update address if address data exists
        if (row["Default Address Address1"] || row["Default Address City"]) {
          const addressData: any = {
            user_id: userId,
            type: "shipping",
            is_default: true,
            address_line1: row["Default Address Address1"]?.trim() || "",
            address_line2: row["Default Address Address2"]?.trim() || null,
            city: row["Default Address City"]?.trim() || "",
            state: row["Default Address Province Code"]?.trim() || null,
            country: row["Default Address Country Code"]?.trim() || "US",
            postal_code: row["Default Address Zip"]?.trim() || null,
            phone: cleanPhone(row["Default Address Phone"]) || null,
          }

          // Check if address already exists for this user
          const { data: existingAddress } = await supabase
            .from("addresses")
            .select("id")
            .eq("user_id", userId)
            .eq("type", "shipping")
            .eq("is_default", true)
            .limit(1)
            .single()

          if (existingAddress) {
            // Update existing address
            const { error: updateError } = await supabase
              .from("addresses")
              .update(addressData)
              .eq("id", existingAddress.id)
            
            if (updateError) {
              console.error(`Error updating address for user ${userId}:`, updateError)
            }
          } else {
            // Insert new address
            const { error: insertError } = await supabase
              .from("addresses")
              .insert(addressData)
            
            if (insertError) {
              console.error(`Error inserting address for user ${userId}:`, insertError)
            }
          }
        }

        // Create/update email subscriber if accepts email marketing (use upsert)
        if (row["Accepts Email Marketing"]?.toLowerCase() === "yes") {
          const tags: string[] = []
          if (row["Tags"]) {
            const tagList = row["Tags"].split(",").map((t) => t.trim()).filter(Boolean)
            tags.push(...tagList)
          }

          // Use upsert (more efficient)
          const { error: subscriberError } = await supabase
            .from("email_subscribers")
            .upsert({
              email: email,
              user_id: userId,
              status: "active",
              tags: tags.length > 0 ? tags : null,
            }, {
              onConflict: "email",
            })
          
          if (subscriberError) {
            // If upsert fails, continue (non-critical)
            console.error(`Error upserting email subscriber for ${email}:`, subscriberError)
          }
        }
      } catch (error: any) {
        errors++
        const rowNum = batchIndex + batch.indexOf(row) + 2
        errorMessages.push(`Row ${rowNum}: ${error.message || "Unknown error"}`)
        console.error("Error processing customer row:", error)
      }
    }

    // Minimal delay between batches (only if not last batch)
    if (i + batchSize < chunk.length) {
      await new Promise((resolve) => setTimeout(resolve, 10)) // Reduced delay
    }
    
    // Check if we're approaching timeout (stop early to return results)
    const elapsed = (Date.now() - startTime) / 1000
    if (elapsed > MAX_PROCESSING_TIME) {
      console.warn(`Chunk processing taking too long (${elapsed}s), stopping early at batch ${i / batchSize + 1}`)
      break
    }
  }

  const elapsed = (Date.now() - startTime) / 1000
  console.log(`Chunk completed in ${elapsed}s: ${imported} imported, ${updated} updated, ${errors} errors`)
  
  return { imported, updated, errors, errorMessages, userIds }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const chunkIndex = parseInt(formData.get("chunkIndex") as string || "0")
    const csvData = formData.get("csvData") as string // Base64 encoded CSV for subsequent chunks
    const segmentName = formData.get("segmentName") as string | null
    const importStartTime = formData.get("importStartTime") as string | null // ISO timestamp from first chunk

    if (!file && chunkIndex === 0) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    
    // Track import start time for segment creation (only on first chunk)
    const currentTime = new Date().toISOString()
    const importStartTimestamp = chunkIndex === 0 ? currentTime : (importStartTime || currentTime)
    
    // Parse CSV - either from file (first chunk) or from stored data (subsequent chunks)
    let allRows: ShopifyCustomerRow[] = []
    let csvText: string

    if (chunkIndex === 0) {
      // First chunk: read from file
      csvText = await file.text()
    } else if (csvData) {
      // Subsequent chunks: decode from base64
      csvText = Buffer.from(csvData, 'base64').toString('utf-8')
    } else {
      return NextResponse.json({ 
        success: false, 
        error: "CSV data required for chunk processing" 
      }, { status: 400 })
    }

    allRows = parseCSV(csvText)
    
    if (allRows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "No valid customer data found in CSV. Please check that the CSV has the correct format with headers: Customer ID, First Name, Last Name, Email, etc." 
      }, { status: 400 })
    }

    console.log(`Parsed ${allRows.length} rows from CSV`)

    // Process in chunks of 50 rows max (to stay well under 60s limit)
    // Vercel Pro has 60s limit, so we use 50 rows per chunk for safety
    // This ensures we can complete even with slow database operations
    const CHUNK_SIZE = 50
    const startIndex = chunkIndex * CHUNK_SIZE
    const endIndex = Math.min(startIndex + CHUNK_SIZE, allRows.length)

    if (startIndex >= allRows.length) {
      return NextResponse.json({
        success: true,
        imported: 0,
        updated: 0,
        errors: 0,
        total: allRows.length,
        processed: allRows.length,
        completed: true,
        message: "Import completed",
      })
    }

    console.log(`Processing chunk ${chunkIndex + 1}: rows ${startIndex + 1} to ${endIndex} of ${allRows.length}`)

    const result = await processCustomerChunk(allRows, startIndex, endIndex)

    const hasMore = endIndex < allRows.length

    // If this is the last chunk and segment name is provided, create the segment
    // Use time-based query instead of passing user IDs to avoid payload size limits
    let segmentId: string | null = null
    if (!hasMore && segmentName && segmentName.trim()) {
      try {
        // Calculate time window: from import start time to now (with 5 minute buffer for processing)
        const importStart = new Date(importStartTimestamp)
        importStart.setSeconds(importStart.getSeconds() - 10) // Subtract 10 seconds to account for any timing differences
        const importEnd = new Date()
        importEnd.setMinutes(importEnd.getMinutes() + 5) // Add buffer for processing time
        
        // Query for customers created or updated during the import window
        // This includes both newly imported and updated customers
        // We need to check both created_at and updated_at fields
        const { data: importedCustomers, error: queryError } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "customer")
          .not("email", "is", null)
          .like("email", "%@%")
          .gte("created_at", importStart.toISOString())
          .lte("created_at", importEnd.toISOString())
        
        // Also get customers that were updated (not just created)
        const { data: updatedCustomers } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "customer")
          .not("email", "is", null)
          .like("email", "%@%")
          .gte("updated_at", importStart.toISOString())
          .lte("updated_at", importEnd.toISOString())
          .lt("created_at", importStart.toISOString()) // Only get existing customers that were updated
        
        // Combine and deduplicate
        const allCustomerIds = new Set<string>()
        importedCustomers?.forEach(c => c.id && allCustomerIds.add(c.id))
        updatedCustomers?.forEach(c => c.id && allCustomerIds.add(c.id))
        const validUserIds = Array.from(allCustomerIds)
        
        if (queryError) {
          console.error("Error querying imported customers:", queryError)
        } else {
          if (validUserIds.length === 0) {
            console.log(`No customers with valid emails found for segment "${segmentName}" in time window`)
          } else {
            // Create segment with condition matching only customers with valid emails
            const segmentData = {
              name: segmentName.trim(),
              description: `Auto-generated segment for imported customers with email addresses (${validUserIds.length} customers)`,
              conditions: [
                {
                  field: "user_id",
                  operator: "in",
                  value: validUserIds,
                },
              ],
              subscriber_count: validUserIds.length,
            }

            const { data: segment, error: segmentError } = await supabase
              .from("email_segments")
              .insert(segmentData)
              .select()
              .single()

            if (segmentError) {
              console.error("Error creating segment:", segmentError)
            } else {
              segmentId = segment.id
              console.log(`Created segment "${segmentName}" with ${validUserIds.length} customers (with valid emails)`)
            }
          }
        }
      } catch (error: any) {
        console.error("Error creating segment:", error)
      }
    }

    return NextResponse.json({
      success: true,
      imported: result.imported,
      updated: result.updated,
      errors: result.errors,
      total: allRows.length,
      processed: endIndex,
      remaining: allRows.length - endIndex,
      hasMore,
      chunkIndex: chunkIndex + 1,
      csvData: hasMore ? Buffer.from(csvText).toString('base64') : undefined, // Return CSV data for next chunk
      importStartTime: importStartTimestamp, // Return import start time for next chunk
      segmentId: segmentId || undefined, // Return segment ID if created
      errorMessages: result.errorMessages.slice(0, 10),
      message: hasMore 
        ? `Processed ${endIndex} of ${allRows.length} customers. ${result.imported} imported, ${result.updated} updated, ${result.errors} errors.`
        : `Import completed: ${result.imported} imported, ${result.updated} updated, ${result.errors} errors out of ${allRows.length} total rows${segmentId ? `. Segment "${segmentName}" created with customers who have valid email addresses.` : ''}`,
    })
  } catch (error: any) {
    console.error("Error importing customers:", error)
    const errorMessage = error.message || "Failed to import customers"
    return NextResponse.json(
      { success: false, error: errorMessage },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )
  }
}
