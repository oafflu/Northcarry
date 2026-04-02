'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { storefrontPathAbsolute, storefrontProductAbsoluteUrl } from '@/lib/storefront-url'
import { toast } from 'sonner'

export type StorefrontPreviewProduct = {
  slug: string
  title?: string | null
}

export type ContextualPreview = {
  label: string
  path: string
}

type PromoStorefrontActionsProps = {
  /** Primary product page where bundle / quantity break / FBT appears */
  productPreview?: StorefrontPreviewProduct | null
  /** e.g. cart page, thank-you page */
  contextualPreviews?: ContextualPreview[]
  /** Shown under the product URL */
  hint?: string
  className?: string
}

export function PromoStorefrontActions({
  productPreview,
  contextualPreviews,
  hint,
  className = '',
}: PromoStorefrontActionsProps) {
  const [copied, setCopied] = useState(false)

  const productUrl = productPreview?.slug ? storefrontProductAbsoluteUrl(productPreview.slug) : null

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('URL copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy')
    }
  }

  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const hasProduct = Boolean(productUrl)
  const hasContext = Boolean(contextualPreviews?.length)

  if (!hasProduct && !hasContext) {
    return (
      <div className={`rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground ${className}`}>
        Add products to see a storefront preview link.
      </div>
    )
  }

  return (
    <div className={`space-y-3 rounded-md border bg-muted/20 px-3 py-3 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Storefront</p>

      {hasProduct && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Product page{hint ? ` — ${hint}` : ''}
          </p>
          <p className="break-all font-mono text-[11px] leading-snug text-foreground">{productUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8"
              onClick={() => openUrl(productUrl!)}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Preview product
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => copyText(productUrl!)}
            >
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              Copy URL
            </Button>
          </div>
        </div>
      )}

      {hasContext && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs text-muted-foreground">Where this offer appears</p>
          <div className="flex flex-wrap gap-2">
            {contextualPreviews!.map((c) => {
              const url = storefrontPathAbsolute(c.path)
              return (
                <Button
                  key={c.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => openUrl(url)}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Preview {c.label}
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
