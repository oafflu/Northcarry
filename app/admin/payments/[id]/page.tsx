"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, XCircle, Loader2, Building2, Mail, Phone, MapPin, FileText, Calendar, CreditCard, Landmark, Upload, X, FileIcon, Download, Edit2, Save } from "lucide-react"
import { getSupplierInvoiceById, markInvoiceAsPaid, cancelInvoice, resendInvoicePaidEmail, updateInvoiceNotes } from "@/app/actions/payments"
import { downloadSupplierInvoice } from "@/lib/invoice-utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as string
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPayDialog, setShowPayDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [resendingEmail, setResendingEmail] = useState<string | null>(null)
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [editedNotes, setEditedNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    if (invoiceId) {
      loadInvoice()
    }
  }, [invoiceId])

  const loadInvoice = async () => {
    setLoading(true)
    try {
      const result = await getSupplierInvoiceById(invoiceId)
      
      if (result.error) {
        toast.error("Failed to load invoice", {
          description: result.error,
        })
        router.push('/admin/payments')
      } else {
        setInvoice(result.data)
        setEditedNotes(result.data?.notes || "")
      }
    } catch (error: any) {
      console.error('Error loading invoice:', error)
      toast.error("Failed to load invoice", {
        description: error.message || "An unexpected error occurred",
      })
      router.push('/admin/payments')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type', {
          description: 'Please upload an image (JPEG, PNG, GIF, WEBP) or PDF file',
        })
        return
      }

      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File too large', {
          description: 'File size must be less than 10MB',
        })
        return
      }

      setReceiptFile(file)

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setReceiptPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setReceiptPreview(null)
      }
    }
  }

  const handleRemoveReceipt = () => {
    setReceiptFile(null)
    setReceiptPreview(null)
    // Reset file input
    const fileInput = document.getElementById('receipt-file') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  const handleMarkAsPaid = async () => {
    if (!invoice) return

    setPaying(true)
    setUploadingReceipt(false)

    try {
      let receiptUrl: string | undefined = undefined

      // Upload receipt file if provided
      if (receiptFile) {
        setUploadingReceipt(true)
        const formData = new FormData()
        formData.append('file', receiptFile)

        const uploadResponse = await fetch('/api/payments/upload-receipt', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          throw new Error(errorData.error || 'Failed to upload receipt')
        }

        const uploadData = await uploadResponse.json()
        receiptUrl = uploadData.url
        setUploadingReceipt(false)
      }

      // Mark invoice as paid with notes and receipt
      const result = await markInvoiceAsPaid(invoice.id, {
        paidAmount: invoice.totalAmount,
        notes: paymentNotes || undefined,
        receiptUrl: receiptUrl,
      })

      if (result.success) {
        toast.success("Invoice marked as paid", {
          description: `Invoice ${invoice.invoiceNumber} has been marked as paid`,
        })
        setShowPayDialog(false)
        setPaymentNotes("")
        setReceiptFile(null)
        setReceiptPreview(null)
        loadInvoice()
      } else {
        toast.error("Failed to mark invoice as paid", {
          description: result.error,
        })
      }
    } catch (error: any) {
      console.error('Error marking invoice as paid:', error)
      toast.error("Failed to mark invoice as paid", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setPaying(false)
      setUploadingReceipt(false)
    }
  }

  const handleCancelInvoice = async () => {
    if (!invoice) return

    setCancelling(true)
    try {
      const result = await cancelInvoice(invoice.id, cancelReason)

      if (result.success) {
        toast.success("Invoice cancelled", {
          description: `Invoice ${invoice.invoiceNumber} has been cancelled`,
        })
        setShowCancelDialog(false)
        setCancelReason("")
        loadInvoice()
      } else {
        toast.error("Failed to cancel invoice", {
          description: result.error,
        })
      }
    } catch (error: any) {
      console.error('Error cancelling invoice:', error)
      toast.error("Failed to cancel invoice", {
        description: error.message || "An unexpected error occurred",
      })
    } finally {
      setCancelling(false)
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
      toast.success("Invoice downloaded")
    } catch (error: any) {
      toast.error("Failed to download invoice", {
        description: error.message,
      })
    }
  }

  const handleResendEmail = async (recipientType: 'supplier' | 'admin') => {
    if (!invoice) return
    setResendingEmail(recipientType)
    try {
      const result = await resendInvoicePaidEmail(invoice.id, recipientType)
      if (result.success) {
        toast.success(`Email sent to ${recipientType === 'supplier' ? 'supplier' : 'admin(s)'}`)
      } else {
        toast.error("Failed to resend email", {
          description: result.error,
        })
      }
    } catch (error: any) {
      toast.error("Failed to resend email", {
        description: error.message,
      })
    } finally {
      setResendingEmail(null)
    }
  }

  const handleEditNotes = () => {
    if (!invoice) return
    setEditedNotes(invoice.notes || "")
    setIsEditingNotes(true)
  }

  const handleCancelEditNotes = () => {
    if (!invoice) return
    setEditedNotes(invoice.notes || "")
    setIsEditingNotes(false)
  }

  const handleSaveNotes = async () => {
    if (!invoice) return

    setSavingNotes(true)
    try {
      const result = await updateInvoiceNotes(invoice.id, editedNotes)
      if (result.success) {
        toast.success("Invoice notes updated successfully")
        setIsEditingNotes(false)
        await loadInvoice()
      } else {
        toast.error("Failed to update notes", {
          description: result.error,
        })
      }
    } catch (error: any) {
      toast.error("Failed to update notes", {
        description: error.message,
      })
    } finally {
      setSavingNotes(false)
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
          <p className="text-gray-500">Invoice not found</p>
          <Link href="/admin/payments" className="text-teal-600 hover:text-teal-700 mt-4 inline-block">
            Back to Payments
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/payments" className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Payments
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoice {invoice.invoiceNumber}</h1>
            <p className="text-gray-600 mt-1">Supplier invoice details</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleDownloadInvoice}
              variant="outline"
              className="border-teal-300 text-teal-600 hover:bg-teal-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
            {invoice.status === 'paid' && (
              <>
                <Button
                  onClick={() => handleResendEmail('supplier')}
                  disabled={resendingEmail !== null}
                  variant="outline"
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  {resendingEmail === 'supplier' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Resend to Supplier
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleResendEmail('admin')}
                  disabled={resendingEmail !== null}
                  variant="outline"
                  className="border-purple-300 text-purple-600 hover:bg-purple-50"
                >
                  {resendingEmail === 'admin' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Resend to Admin
                    </>
                  )}
                </Button>
              </>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <>
                <Button
                  onClick={() => setShowPayDialog(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Paid
                </Button>
                <Button
                  onClick={() => setShowCancelDialog(true)}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Invoice
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Invoice Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Invoice Number</p>
                <p className="font-medium">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Invoice Date</p>
                <p className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
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
                  <p className="text-sm text-gray-600">Paid Date</p>
                  <p className="font-medium">{new Date(invoice.paidAt).toLocaleDateString()}</p>
                </div>
              )}
              {invoice.receiptUrl && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600 mb-2">Payment Receipt</p>
                  <a
                    href={invoice.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 underline"
                  >
                    <FileText className="w-4 h-4" />
                    View Receipt
                  </a>
                </div>
              )}
              {invoice.status === 'paid' && (
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-600 font-medium">Payment Notes</p>
                    {!isEditingNotes ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditNotes}
                        className="h-7 px-2 text-xs"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEditNotes}
                          disabled={savingNotes}
                          className="h-7 px-2 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveNotes}
                          disabled={savingNotes}
                          className="h-7 px-2 text-xs text-teal-600 hover:text-teal-700"
                        >
                          {savingNotes ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3 mr-1" />
                          )}
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditingNotes ? (
                    <Textarea
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      placeholder="Enter payment notes..."
                      rows={4}
                      className="resize-none"
                    />
                  ) : (
                    <p className="text-sm font-medium whitespace-pre-wrap min-h-[1.5rem]">
                      {invoice.notes || <span className="text-gray-400 italic">No notes added</span>}
                    </p>
                  )}
                </div>
              )}
              {invoice.status !== 'paid' && invoice.notes && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600 mb-1">Payment Notes</p>
                  <p className="text-sm font-medium whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Numbers */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Order Numbers</h2>
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
                <p className="text-gray-500">No orders found</p>
              )}
            </div>
          </div>

          {/* Supplier Company Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Supplier Company Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Company Name</p>
                  <p className="font-medium">{invoice.companyName || '-'}</p>
                </div>
                {invoice.taxId && (
                  <div>
                    <p className="text-sm text-gray-600">Tax ID</p>
                    <p className="font-medium">{invoice.taxId}</p>
                  </div>
                )}
                {invoice.businessRegistrationNumber && (
                  <div>
                    <p className="text-sm text-gray-600">Business Registration Number</p>
                    <p className="font-medium">{invoice.businessRegistrationNumber}</p>
                  </div>
                )}
              </div>
              {invoice.companyAddress && (
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-medium">{invoice.companyAddress}</p>
                  {invoice.country && (
                    <p className="text-sm text-gray-500 mt-1">{invoice.country}</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {invoice.email && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{invoice.email}</p>
                  </div>
                )}
                {invoice.contactNumber && (
                  <div>
                    <p className="text-sm text-gray-600">Contact Number</p>
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
            <h2 className="text-xl font-bold mb-4">Invoice Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">{formatCurrency(invoice.taxAmount)}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold text-lg">Total</span>
                <span className="font-bold text-lg">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              {invoice.paidAmount && (
                <div className="border-t pt-3 flex justify-between text-green-600">
                  <span className="font-semibold">Paid Amount</span>
                  <span className="font-bold">{formatCurrency(invoice.paidAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supplier Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">Supplier</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium">{invoice.supplierName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{invoice.supplierEmail}</p>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          {invoice.paymentMethod && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-teal-600" />
                <h2 className="text-xl font-bold">Payment Method</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Method Type</p>
                  <p className="font-medium capitalize">{invoice.paymentMethod.methodType}</p>
                </div>
                
                {invoice.paymentMethod.methodType === 'bank' && (
                  <>
                    {invoice.paymentMethod.bankName && (
                      <div>
                        <p className="text-sm text-gray-600">Bank Name</p>
                        <p className="font-medium">{invoice.paymentMethod.bankName}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.accountHolderName && (
                      <div>
                        <p className="text-sm text-gray-600">Account Holder</p>
                        <p className="font-medium">{invoice.paymentMethod.accountHolderName}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.accountNumber && (
                      <div>
                        <p className="text-sm text-gray-600">Account Number</p>
                        <p className="font-medium font-mono">{invoice.paymentMethod.accountNumber}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.routingNumber && (
                      <div>
                        <p className="text-sm text-gray-600">Routing Number</p>
                        <p className="font-medium font-mono">{invoice.paymentMethod.routingNumber}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.iban && (
                      <div>
                        <p className="text-sm text-gray-600">IBAN</p>
                        <p className="font-medium font-mono">{invoice.paymentMethod.iban}</p>
                      </div>
                    )}
                    {invoice.paymentMethod.swiftCode && (
                      <div>
                        <p className="text-sm text-gray-600">SWIFT Code</p>
                        <p className="font-medium font-mono">{invoice.paymentMethod.swiftCode}</p>
                      </div>
                    )}
                    {(invoice.paymentMethod.addressLine1 || invoice.paymentMethod.city) && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Bank Address</p>
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
                    <p className="text-sm text-gray-600">PayPal Email</p>
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
                <h2 className="text-lg font-semibold text-yellow-900">Payment Method</h2>
              </div>
              <p className="text-sm text-yellow-800">
                No payment method configured for this supplier. Please contact the supplier to set up a payment method.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pay Invoice Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Invoice as Paid</DialogTitle>
            <DialogDescription>
              Mark invoice {invoice?.invoiceNumber} as paid. This will update the invoice status and record the payment.
            </DialogDescription>
          </DialogHeader>
          {invoice && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Invoice Amount:</span>
                  <span className="text-sm font-semibold">{formatCurrency(invoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Supplier:</span>
                  <span className="text-sm font-medium">{invoice.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Orders:</span>
                  <span className="text-sm">{invoice.orderCount} order(s)</span>
                </div>
              </div>

              {/* Payment Notes */}
              <div className="space-y-2">
                <Label htmlFor="payment-notes">Payment Notes (Optional)</Label>
                <Textarea
                  id="payment-notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Add any notes about this payment (e.g., transaction reference, payment method details, etc.)"
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  Add any additional information about this payment
                </p>
              </div>

              {/* Receipt Upload */}
              <div className="space-y-2">
                <Label htmlFor="receipt-file">Transfer Receipt (Optional)</Label>
                {!receiptFile ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-teal-500 transition-colors">
                    <input
                      type="file"
                      id="receipt-file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="receipt-file"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 mb-1">
                        Click to upload receipt
                      </p>
                      <p className="text-xs text-gray-500">
                        Images (JPEG, PNG, GIF, WEBP) or PDF • Max 10MB
                      </p>
                    </label>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {receiptFile.type.startsWith('image/') ? (
                          <FileIcon className="w-5 h-5 text-teal-600" />
                        ) : (
                          <FileText className="w-5 h-5 text-teal-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{receiptFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(receiptFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveReceipt}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {receiptPreview && (
                      <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                        <img
                          src={receiptPreview}
                          alt="Receipt preview"
                          className="w-full h-auto max-h-48 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPayDialog(false)
                setPaymentNotes("")
                setReceiptFile(null)
                setReceiptPreview(null)
              }}
              disabled={paying || uploadingReceipt}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsPaid}
              disabled={paying || uploadingReceipt}
              className="bg-green-600 hover:bg-green-700"
            >
              {paying || uploadingReceipt ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadingReceipt ? 'Uploading receipt...' : 'Processing...'}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Paid
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Invoice Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Invoice</DialogTitle>
            <DialogDescription>
              Cancel invoice {invoice?.invoiceNumber}. You can provide a reason for cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">Reason (Optional)</label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter cancellation reason..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelDialog(false)
                setCancelReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCancelInvoice}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

