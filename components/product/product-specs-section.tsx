interface ProductSpecsSectionProps {
  cmsContent?: {
    title?: string
    specs?: Array<{
      label: string
      value: string
    }>
  }
}

export function ProductSpecsSection({ cmsContent }: ProductSpecsSectionProps = {}) {
  const title = cmsContent?.title || 'Specifications'
  const specs = cmsContent?.specs || []

  if (specs.length === 0) {
    return null
  }

  return (
    <section className="w-full py-8 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {title && (
            <h2 className="text-3xl md:text-4xl font-bold mb-8">{title}</h2>
          )}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <tbody>
                {specs.map((spec, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-200">
                      {spec.label}
                    </td>
                    <td className="px-6 py-4 text-gray-700 border-b border-gray-200">
                      {spec.value || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

