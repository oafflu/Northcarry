"use client"
import Link from "next/link"
import { ImageIcon, MenuIcon, Type, Layout, FileText, CreditCard, Scale, HelpCircle, Mail } from "lucide-react"

export default function CMSPage() {
  const sections = [
    {
      title: "Hero Banners",
      description: "Manage homepage hero banners and promotional content",
      icon: ImageIcon,
      href: "/admin/cms/hero",
      count: 1,
    },
    {
      title: "Navigation Menu",
      description: "Edit menu items and navigation structure",
      icon: MenuIcon,
      href: "/admin/cms/menu",
      count: 3,
    },
    {
      title: "Top Bar",
      description: "Update announcement bar and promotional messages",
      icon: Type,
      href: "/admin/cms/topbar",
      count: 1,
    },
    {
      title: "Logo & Branding",
      description: "Upload and manage site logos",
      icon: Layout,
      href: "/admin/cms/branding",
      count: 2,
    },
    {
      title: "Home Page Template",
      description: "Edit home page sections and layout",
      icon: Layout,
      href: "/admin/cms/home-template",
      count: 1,
    },
    {
      title: "Homepage Visual Editor",
      description: "Visual page builder - edit homepage content visually",
      icon: Layout,
      href: "/admin/cms/homepage-editor",
      count: 1,
    },
    {
      title: "Product Page Template",
      description: "Configure unified product page layout and sections",
      icon: FileText,
      href: "/admin/cms/product-template",
      count: 1,
    },
    {
      title: "Product Page Settings",
      description: "Edit product page elements: sale banner, rating, payment icons, variant display",
      icon: FileText,
      href: "/admin/cms/product-page",
      count: 1,
    },
    {
      title: "Footer",
      description: "Edit footer content and links",
      icon: Layout,
      href: "/admin/cms/footer",
      count: 1,
    },
    {
      title: "About Page",
      description: "Manage about page content",
      icon: FileText,
      href: "/admin/cms/about",
      count: 1,
    },
    {
      title: "Checkout Content",
      description: "Customize checkout page text and elements",
      icon: CreditCard,
      href: "/admin/cms/checkout",
      count: 1,
    },
    {
      title: "Privacy Policy",
      description: "Manage privacy policy page content",
      icon: Scale,
      href: "/admin/cms/privacy",
      count: 1,
    },
    {
      title: "Terms of Service",
      description: "Manage terms of service page content",
      icon: Scale,
      href: "/admin/cms/terms",
      count: 1,
    },
    {
      title: "Refund Policy",
      description: "Manage refund policy page content",
      icon: Scale,
      href: "/admin/cms/refund",
      count: 1,
    },
    {
      title: "FAQ",
      description: "Manage frequently asked questions",
      icon: HelpCircle,
      href: "/admin/cms/faq",
      count: 1,
    },
    {
      title: "Contact Page",
      description: "Manage contact page content and form",
      icon: Mail,
      href: "/admin/cms/contact",
      count: 1,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">CMS Management</h1>
        <p className="text-gray-600 mt-1">Manage all website content and layouts</p>
      </div>

      {/* CMS sections grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:border-teal-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                <section.icon className="w-6 h-6 text-teal-600" />
              </div>
              <span className="text-sm text-gray-500">
                {section.count} item{section.count !== 1 ? "s" : ""}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{section.title}</h3>
            <p className="text-sm text-gray-600">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
