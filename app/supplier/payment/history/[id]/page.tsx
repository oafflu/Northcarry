"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, FileText, Calendar, CreditCard, Landmark, Download } from "lucide-react"
import { getSupplierInvoiceByIdForSupplier } from "@/app/actions/payments"
import { downloadSupplierInvoice } from "@/lib/invoice-utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useTranslation } from "@/lib/translations/supplier/context"

export default function SupplierInvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as string
  const { user } = useAuth()
  const { t } = useTranslation()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (invoiceId && user?.id) {
      loadInvoice()
    }
  }, [invoiceId, user?.id])

  const loadInvoice = async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const result = await getSupplierInvoiceByIdForSupplier(invoiceId, user.id)
      
      if (result.error || !result.data) {
        toast.error(t('payment.failedToLoadInvoices') || 'Failed to load invoice', {
          description: result.error || "Invoice not found",
        })
        router.push('/supplier/payment/history')
      } else {
        setInvoice(result.data)
      }
    } catch (error: any) {
      console.error('Error loading invoice:', error)
      toast.error("Failed to load invoice", {
        description: error.message || "An unexpected error occurred",
      })
      router.push('/supplier/payment/history')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const handleDownloadInvoice = () => {
    if (!invoice) return
    try {
      downloadSupplierInvoice(invoice)
      toast.success(t('payment.invoiceDownloaded') || 'Invoice downloaded')
    } catch (error: any) {
      toast.error(t('payment.failedToDownloadInvoice') || 'Failed to download invoice', {
        description: error.message,
      })
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">{t('payment.invoiceNotFound') || 'Invoice not found'}</p>
          <Link href="/supplier/payment/history" className="text-teal-600 hover:text-teal-700 mt-4 inline-block">
            {t('payment.backToPaymentHistory') || 'Back to Payment History'}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/supplier/payment/history" className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('payment.backToPaymentHistory') || 'Back to Payment History'}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('payment.invoice') || 'Invoice'} {invoice.invoiceNumber}</h1>
            <p className="text-gray-600 mt-1">{t('payment.invoiceDetails') || 'Invoice details'}</p>
          </div>
          <Button
            onClick={handleDownloadInvoice}
            variant="outline"
            className="border-teal-300 text-teal-600 hover:bg-teal-50"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('payment.downloadInvoice') || 'Download Invoice'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">{t('payment.invoiceInformation') || 'Invoice Information'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">{t('payment.invoiceNumber') || 'Invoice Number'}</p>
                <p className="font-medium">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('payment.invoiceDate') || 'Invoice Date'}</p>
                <p className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">{t('payment.status') || 'Status'}</p>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    invoice.status === "paid"
                      ? "bg-green-50 text-green-700"
                      : invoice.status === "pending" || invoice.status === "sent"
                        ? "bg-yellow-50 text-yellow-700"
                        : invoice.status === "cancelled"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {invoice.status || "draft"}
                </span>
              </div>
              {invoice.paidAt && (
                <div>
                  <p className="text-sm text-gray-600">{t('payment.paidDate') || 'Paid Date'}</p>
                  <p className="font-medium">{new Date(invoice.paidAt).toLocaleDateString()}</p>
                </div>
              )}
              {invoice.receiptUrl && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600 mb-2">{t('payment.paymentReceipt') || 'Payment Receipt'}</p>
                  <a
                    href={invoice.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 underline"
                  >
                    <FileText className="w-4 h-4" />
                    {t('payment.viewReceipt') || 'View Receipt'}
                  </a>
                </div>
              )}
              {invoice.notes && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600 mb-1">{t('payment.paymentNotes') || 'Payment Notes'}</p>
                  <p className="text-sm font-medium whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Numbers */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">{t('payment.orderNumbers') || 'Order Numbers'}</h2>
            <div className="space-y-2">
              {invoice.orderNumbers && invoice.orderNumbers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {invoice.orderNumbers.map((orderNumber: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-md bg-gray-100 text-gray-800 text-sm font-mono"
                    >
                      {orderNumber}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">{t('payment.noOrders') || 'No orders found'}</p>
              )}
            </div>
          </div>

          {/* Supplier Company Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">{t('payment.companyInformation') || 'Company Information'}</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">{t('payment.companyName') || 'Company Name'}</p>
                  <p className="font-medium">{invoice.companyName || '-'}</p>
                </div>
                {invoice.taxId && (
                  <div>
                    <p className="text-sm text-gray-600">{t('payment.taxId') || 'Tax ID'}</p>
                    <p className="font-medium">{invoice.taxId}</p>
                  </div>
                )}
                {invoice.businessRegistrationNumber && (
                  <div>
                    <p className="text-sm text-gray-600">{t('payment.businessRegistrationNumber') || 'Business Registration Number'}</p>
                    <p className="font-medium">{invoice.businessRegistrationNumber}</p>
                  </div>
                )}
              </div>
              {invoice.companyAddress && (
                <div>
                  <p className="text-sm text-gray-600">{t('payment.address') || 'Address'}</p>
                  <p className="font-medium">{invoice.companyAddress}</p>
                  {invoice.country && (
                    <p className="text-sm text-gray-500 mt-1">{invoice.country}</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {invoice.email && (
                  <div>
                    <p className="text-sm text-gray-600">{t('payment.email') || 'Email'}</p>
                    <p className="font-medium">{invoice.email}</p>
                  </div>
                )}
                {invoice.contactNumber && (
                  <div>
                    <p className="text-sm text-gray-600">{t('payment.contactNumber') || 'Contact Number'}</p>
                    <p className="font-medium">{invoice.contactNumber}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">{t('payment.invoiceSummary') || 'Invoice Summary'}</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('payment.subtotal') || 'Subtotal'}</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('payment.tax') || 'Tax'}</span>
                  <span className="font-medium">{formatCurrency(invoice.taxAmount)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold text-lg">{t('payment.total') || 'Total'}</span>
                <span className="font-bold text-lg">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              {invoice.paidAmount && (
                <div className="border-t pt-3 flex justify-between text-green-600">
                  <span className="font-semibold">{t('payment.paidAmount') || 'Paid Amount'}</span>
                  <span className="font-bold">{formatCurrency(invoice.paidAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method */}
          {invoice.paymentMethod && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-teal-600" />
                <h2 className="text-xl font-bold">{t('payment.paymentMethod') || 'Payment Method'}</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">{t('payment.methodType') || 'Method Type'}</p>
                  <p className="font-medium capitalize">{invoice.paymentMethod.methodType}</p>
                </div>
                
                {invoice.paymentMethod.methodType === 'bank' && (
                  <>
                    {invoice.paymentMethod.bankName && (
                      <div>
                        <p className="text-sm text-gray-600">{t('payment.bankName') || 'Bank Name'}</p>
                        <p className="font-medium">{invoice.paymentMethod.bankName}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.accountHolderName && (
                      <div>
                        <p className="text-sm text-gray-600">{t('payment.accountHolder') || 'Account Holder'}</p>
                        <p className="font-medium">{invoice.paymentMethod.accountHolderName}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.accountNumber && (
                      <div>
                        <p className="text-sm text-gray-600">{t('payment.accountNumber') || 'Account Number'}</p>
                        <p className="font-medium font-mono">{invoice.paymentMethod.accountNumber}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.routingNumber && (
                      <div>
                        <p className="text-sm text-gray-600">{t('payment.routingNumber') || 'Routing Number'}</p>
                        <p className="font-medium font-mono">{invoice.paymentMethod.routingNumber}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.iban && (
                      <div>
                        <p className="text-sm text-gray-600">{t('payment.iban') || 'IBAN'}</p>
                        <p className="font-medium font-mono">{invoice.paymentMethod.iban}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.swiftCode && (
                      <div>
                        <p className="text-sm text-gray-600">{t('payment.swiftCode') || 'SWIFT Code'}</p>
                        <p className="font-medium font-mono">{invoice.paymentMethod.swiftCode}</p>
                      </div>
                    )}
                    {(invoice.paymentMethod.addressLine1 || invoice.paymentMethod.city) && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">{t('payment.bankAddress') || 'Bank Address'}</p>
                        <p className="text-sm font-medium">
                          {invoice.paymentMethod.addressLine1}
                          {invoice.paymentMethod.addressLine2 && `, ${invoice.paymentMethod.addressLine2}`}
                          {invoice.paymentMethod.city && `, ${invoice.paymentMethod.city}`}
                          {invoice.paymentMethod.state && `, ${invoice.paymentMethod.state}`}
                          {invoice.paymentMethod.postalCode && ` ${invoice.paymentMethod.postalCode}`}
                          {invoice.paymentMethod.country && `, ${invoice.paymentMethod.country}`}
                        </p>
                      </div>
                    )}
                  </>
                )}
                
                {invoice.paymentMethod.methodType === 'paypal' && invoice.paymentMethod.paypalEmail && (
                  <div>
                    <p className="text-sm text-gray-600">{t('payment.paypalEmail') || 'PayPal Email'}</p>
                    <p className="font-medium">{invoice.paymentMethod.paypalEmail}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!invoice.paymentMethod && (
            <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-5 h-5 text-yellow-600" />
                <h2 className="text-lg font-semibold text-yellow-900">{t('payment.paymentMethod') || 'Payment Method'}</h2>
              </div>
              <p className="text-sm text-yellow-800">
                {t('payment.noPaymentMethodConfigured') || 'No payment method configured. Please set up a payment method in your account settings.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

