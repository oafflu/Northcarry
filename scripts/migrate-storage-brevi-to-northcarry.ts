/**
 * Copy all objects from Brevi Supabase Storage buckets into Northcarry (same bucket names).
 *
 * Prerequisites:
 * - Buckets cms-media, product-media, user-media exist on Northcarry with correct settings.
 * - .env.local has Northcarry: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - Add Brevi source (temporary): MIGRATE_SOURCE_SUPABASE_URL, MIGRATE_SOURCE_SERVICE_ROLE_KEY
 *
 * Run from repo root:
 *   npx tsx scripts/migrate-storage-brevi-to-northcarry.ts
 *
 * Optional env:
 *   MIGRATE_STORAGE_BUCKETS=cms-media,product-media,user-media   (default: all three)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const destUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const destKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const srcUrl = process.env.MIGRATE_SOURCE_SUPABASE_URL!
const srcKey = process.env.MIGRATE_SOURCE_SERVICE_ROLE_KEY!

const DEFAULT_BUCKETS = ['cms-media', 'product-media', 'user-media'] as const

function parseBuckets(): string[] {
  const raw = process.env.MIGRATE_STORAGE_BUCKETS?.trim()
  if (!raw) return [...DEFAULT_BUCKETS]
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function isFolder(entry: { id?: string | null; metadata?: Record<string, unknown> | null }): boolean {
  return entry.metadata == null
}

async function listAllFiles(
  client: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const out: string[] = []
  const limit = 1000
  let offset = 0

  for (;;) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`list ${bucket}/${prefix || '(root)'}: ${error.message}`)
    if (!data?.length) break

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (isFolder(item)) {
        const nested = await listAllFiles(client, bucket, path)
        out.push(...nested)
      } else {
        out.push(path)
      }
    }

    if (data.length < limit) break
    offset += limit
  }

  return out
}

async function copyFile(
  src: SupabaseClient,
  dest: SupabaseClient,
  bucket: string,
  path: string
): Promise<void> {
  const { data: blob, error: dl } = await src.storage.from(bucket).download(path)
  if (dl || !blob) throw new Error(`download ${bucket}/${path}: ${dl?.message ?? 'no blob'}`)

  const { error: up } = await dest.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: blob.type || undefined,
  })
  if (up) throw new Error(`upload ${bucket}/${path}: ${up.message}`)
}

async function main() {
  if (!destUrl || !destKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  if (!srcUrl || !srcKey) {
    console.error(
      'Missing MIGRATE_SOURCE_SUPABASE_URL or MIGRATE_SOURCE_SERVICE_ROLE_KEY in .env.local\n' +
        'Set these to the Brevi project URL and service_role key (Dashboard → Settings → API).'
    )
    process.exit(1)
  }

  const buckets = parseBuckets()
  const src = createClient(srcUrl, srcKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const dest = createClient(destUrl, destKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('Source:', srcUrl)
  console.log('Dest:  ', destUrl)
  console.log('Buckets:', buckets.join(', '))

  let copied = 0
  let failed = 0

  for (const bucket of buckets) {
    console.log(`\n--- ${bucket} ---`)
    const paths = await listAllFiles(src, bucket, '')
    console.log(`Found ${paths.length} files`)
    for (const path of paths) {
      try {
        await copyFile(src, dest, bucket, path)
        copied++
        if (copied % 100 === 0) console.log(`  ... ${copied} files so far`)
      } catch (e: unknown) {
        failed++
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`  FAIL ${bucket}/${path}: ${msg}`)
      }
    }
  }

  console.log(`\nDone. Copied: ${copied}, failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
