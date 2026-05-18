/** Default footer CMS payload; merged with DB so older rows stay valid. */
export type FooterGetInTouch = {
  heading: string
  companyName: string
  addressLine1: string
  addressLine2: string
  email: string
  chatSupportText: string
}

export type FooterLink = { label: string; url: string }

export const DEFAULT_FOOTER_CUSTOMER_SERVICE_LINKS: FooterLink[] = [
  { label: 'FAQ', url: '/faq' },
  { label: 'Contact Us', url: '/contact' },
  { label: 'Affiliate', url: '/affiliate' },
  { label: 'Privacy Policy', url: '/privacy' },
  { label: 'Refund Policy', url: '/refund' },
  { label: 'Terms of Service', url: '/terms' },
]

export type FooterCMSContent = {
  logo: string
  copyright: string
  customerServiceHeading: string
  links: FooterLink[]
  newsletter: {
    enabled: boolean
    title: string
    placeholder: string
  }
  getInTouch: FooterGetInTouch
}

export function defaultFooterCopyright(): string {
  return `© ${new Date().getFullYear()} BREVI. All rights reserved.`
}

export const FOOTER_GET_IN_TOUCH_DEFAULTS: FooterGetInTouch = {
  heading: 'Get In Touch',
  companyName: 'Brevi Brush Limited',
  addressLine1: '10685-B Hazelhurst Dr. #34479',
  addressLine2: 'Houston, TX 77043, USA',
  email: 'hello@brevibrushes.com',
  chatSupportText: 'Use our chat for instant support',
}

export function mergeFooterCMSContent(raw: unknown): FooterCMSContent {
  const saved = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const links = Array.isArray(saved.links)
    ? (saved.links as FooterLink[]).filter(
        (l) => l && typeof l.label === 'string' && typeof l.url === 'string'
      )
    : null
  const newsletter = saved.newsletter && typeof saved.newsletter === 'object'
    ? (saved.newsletter as FooterCMSContent['newsletter'])
    : null
  const git = saved.getInTouch && typeof saved.getInTouch === 'object'
    ? (saved.getInTouch as Partial<FooterGetInTouch>)
    : null

  return {
    logo: typeof saved.logo === "string" ? saved.logo : "",
    customerServiceHeading:
      typeof saved.customerServiceHeading === "string" &&
      saved.customerServiceHeading.trim()
        ? saved.customerServiceHeading
        : "Customer Service",
    copyright:
      typeof saved.copyright === 'string' && saved.copyright.trim()
        ? saved.copyright
        : defaultFooterCopyright(),
    links:
      links && links.length > 0 ? links : DEFAULT_FOOTER_CUSTOMER_SERVICE_LINKS,
    newsletter: {
      enabled: newsletter?.enabled !== false,
      title:
        typeof newsletter?.title === 'string' && newsletter.title.trim()
          ? newsletter.title
          : 'Subscribe to our newsletter',
      placeholder:
        typeof newsletter?.placeholder === 'string' && newsletter.placeholder.trim()
          ? newsletter.placeholder
          : 'Enter your email',
    },
    // When getInTouch exists in CMS, honor string values including "" (cleared in admin).
    // Only fall back to defaults for keys that are missing, not for empty strings.
    getInTouch: git
      ? {
          heading:
            typeof git.heading === 'string'
              ? git.heading
              : FOOTER_GET_IN_TOUCH_DEFAULTS.heading,
          companyName:
            typeof git.companyName === 'string'
              ? git.companyName
              : FOOTER_GET_IN_TOUCH_DEFAULTS.companyName,
          addressLine1:
            typeof git.addressLine1 === 'string'
              ? git.addressLine1
              : FOOTER_GET_IN_TOUCH_DEFAULTS.addressLine1,
          addressLine2:
            typeof git.addressLine2 === 'string'
              ? git.addressLine2
              : FOOTER_GET_IN_TOUCH_DEFAULTS.addressLine2,
          email:
            typeof git.email === 'string'
              ? git.email.trim()
              : FOOTER_GET_IN_TOUCH_DEFAULTS.email,
          chatSupportText:
            typeof git.chatSupportText === 'string'
              ? git.chatSupportText
              : FOOTER_GET_IN_TOUCH_DEFAULTS.chatSupportText,
        }
      : { ...FOOTER_GET_IN_TOUCH_DEFAULTS },
  }
}
