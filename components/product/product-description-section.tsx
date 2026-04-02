interface ProductDescriptionSectionProps {
  cmsContent?: {
    title?: string
    content?: string
  }
}

export function ProductDescriptionSection({ cmsContent }: ProductDescriptionSectionProps = {}) {
  const title = cmsContent?.title || 'Product Description'
  const content = cmsContent?.content || ''

  if (!content) {
    return null
  }

  return (
    <section className="w-full py-8">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {title && (
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{title}</h2>
          )}
          <div 
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </div>
    </section>
  )
}

