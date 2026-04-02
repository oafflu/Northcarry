"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Plus, Search, Filter, Edit, Trash2, Eye } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { deleteProduct } from "@/app/actions/products"
import { toast } from "sonner"

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    try {
      // Fetch products with variant counts and primary images
      const { data: productsData, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (id, image_url),
          product_images!product_id (
            id,
            image_url,
            is_primary,
            sort_order,
            variant_id
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading products:', error)
      } else {
        // Transform data to include variant count and slug
        const transformedProducts = (productsData || []).map(product => {
          // Get primary image from product_images (Shopify-like logic)
          // Priority: primary image from product_images > product.image_url > first variant image
          const productImages = product.product_images || []
          const primaryImage = productImages
            .filter((img: any) => img.is_primary && !img.variant_id)
            .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))[0]
          
          const imageUrl = primaryImage?.image_url || 
            product.image_url || 
            product.product_variants?.[0]?.image_url || 
            "/placeholder.svg"
          
          return {
            id: product.id,
            title: product.title,
            slug: product.slug,
            image: imageUrl,
            variants: product.product_variants?.length || 0,
            price: parseFloat(product.base_price?.toString() || '0'),
            stock: 0, // Calculate from variants if needed
            status: product.status || 'active',
          }
        })
        setProducts(transformedProducts)
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(product =>
    product.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = async (productId: string, productTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${productTitle}"? This action cannot be undone.`)) {
      return
    }

    try {
      const result = await deleteProduct(productId)
      if (result.success) {
        toast.success('Product deleted successfully')
        loadProducts()
      } else {
        toast.error(result.error || 'Failed to delete product')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Failed to delete product')
    }
  }

  const handlePreview = (slug: string) => {
    window.open(`/product/${slug}?preview=true`, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">Manage your product catalog</p>
          <p className="text-sm text-gray-500 mt-1">
            Note: Products are created by admins and linked to supplier inventory. To see supplier inventory items, visit <Link href="/admin/inventory" className="text-teal-600 hover:underline">Inventory Management</Link>.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>
      </div>

      {/* Products table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading products...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image
                          src={product.image || "/placeholder.svg"}
                          alt={product.title}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{product.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.variants} variants</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${product.price}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.stock} in stock</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700">
                      {product.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {product.slug && (
                        <button
                          onClick={() => handlePreview(product.slug)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Preview Product"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="p-1.5 text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded"
                        title="Edit Product"
                      >
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button 
                        onClick={() => handleDelete(product.id, product.title)}
                        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
