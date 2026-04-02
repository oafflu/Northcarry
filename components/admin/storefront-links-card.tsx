'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export type StorefrontLinkRow = { id: string; title: string; slug: string; url: string }

export function StorefrontLinksCard({ links }: { links: StorefrontLinkRow[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (!links.length) return null

  const copy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      toast.success('URL copied')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storefront links</CardTitle>
        <CardDescription>
          Copy public product URLs for email campaigns or sharing. Bundles and upsells appear on these
          product pages when active.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {links.map((l) => (
          <div
            key={l.id}
            className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">{l.title}</p>
              <p className="break-all font-mono text-xs text-muted-foreground">{l.url}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => window.open(l.url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="mr-1 h-4 w-4" />
                Preview
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copy(l.url, l.id)}
              >
                {copiedId === l.id ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
