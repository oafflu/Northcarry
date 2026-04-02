'use client'

/**
 * Generate and download supplier invoice as HTML/PDF
 */
export function downloadSupplierInvoice(invoice: any) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Please allow popups to download invoice')
  }

  const origin = window.location.origin
  const invoiceDate = new Date(invoice.invoiceDate || invoice.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const dueDate = invoice.dueDate 
    ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const paidDate = invoice.paidAt
    ? new Date(invoice.paidAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const subtotal = parseFloat(invoice.subtotal || '0')
  const taxAmount = parseFloat(invoice.taxAmount || invoice.tax_amount || '0')
  const totalAmount = parseFloat(invoice.totalAmount || invoice.total_amount || invoice.amount || '0')
  const paidAmount = invoice.paidAmount ? parseFloat(invoice.paidAmount.toString()) : null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - ${invoice.invoiceNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            color: #333;
            background: white;
          }
          .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #14b8a6;
          }
          .invoice-header h1 {
            color: #14b8a6;
            font-size: 32px;
            font-weight: bold;
          }
          .invoice-info {
            text-align: right;
          }
          .invoice-info p {
            margin: 4px 0;
            font-size: 14px;
          }
          .company-info {
            margin-bottom: 30px;
          }
          .company-info h2 {
            color: #14b8a6;
            font-size: 24px;
            margin-bottom: 10px;
          }
          .billing-info {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .billing-info h3 {
            color: #14b8a6;
            font-size: 16px;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          .billing-info p {
            margin: 4px 0;
            font-size: 14px;
            line-height: 1.6;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .items-table thead {
            background: #14b8a6;
            color: white;
          }
          .items-table th {
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 14px;
          }
          .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
          }
          .items-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          .items-table .text-right {
            text-align: right;
          }
          .items-table .text-center {
            text-align: center;
          }
          .totals {
            margin-left: auto;
            width: 300px;
            margin-top: 20px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
          }
          .totals-row.total {
            font-size: 18px;
            font-weight: bold;
            padding-top: 12px;
            border-top: 2px solid #14b8a6;
            margin-top: 8px;
          }
          .totals-row.label {
            color: #666;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
          }
          .status-paid {
            background: #d1fae5;
            color: #065f46;
          }
          .status-pending {
            background: #fef3c7;
            color: #92400e;
          }
          @media print {
            body {
              padding: 20px;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <div>
            <h1>INVOICE</h1>
            <p style="margin-top: 8px; color: #666;">Invoice #${invoice.invoiceNumber}</p>
          </div>
          <div class="invoice-info">
            <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
            ${dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ''}
            ${paidDate ? `<p><strong>Paid Date:</strong> ${paidDate}</p>` : ''}
            <p style="margin-top: 8px;">
              <span class="status-badge ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">
                ${invoice.status?.toUpperCase() || 'PENDING'}
              </span>
            </p>
          </div>
        </div>

        <div class="company-info">
          <h2>${invoice.companyName || 'Supplier Company'}</h2>
          ${invoice.companyAddress ? `<p>${invoice.companyAddress}</p>` : ''}
          ${invoice.country ? `<p>${invoice.country}</p>` : ''}
          ${invoice.email ? `<p>Email: ${invoice.email}</p>` : ''}
          ${invoice.contactNumber ? `<p>Phone: ${invoice.contactNumber}</p>` : ''}
          ${invoice.taxId ? `<p>Tax ID: ${invoice.taxId}</p>` : ''}
        </div>

        <div class="billing-info">
          <h3>Bill To</h3>
          <p><strong>BREVI</strong></p>
          <p>Payment Processing</p>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Order Numbers</th>
              <th class="text-center">Quantity</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                ${(invoice.orderNumbers || []).map((on: string) => `<div>${on}</div>`).join('')}
              </td>
              <td class="text-center">${invoice.orderCount || (invoice.orderNumbers || []).length}</td>
              <td class="text-right">${formatCurrency(subtotal)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span class="label">Subtotal:</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          ${taxAmount > 0 ? `
            <div class="totals-row">
              <span class="label">Tax:</span>
              <span>${formatCurrency(taxAmount)}</span>
            </div>
          ` : ''}
          <div class="totals-row total">
            <span>Total:</span>
            <span>${formatCurrency(totalAmount)}</span>
          </div>
          ${paidAmount !== null ? `
            <div class="totals-row" style="color: #059669; font-weight: bold;">
              <span>Paid Amount:</span>
              <span>${formatCurrency(paidAmount)}</span>
            </div>
          ` : ''}
        </div>

        ${invoice.notes ? `
          <div class="billing-info" style="margin-top: 30px;">
            <h3>Notes</h3>
            <p style="white-space: pre-wrap;">${invoice.notes}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>BREVI™ is a product of OAFFLU LLC</p>
          <p style="margin-top: 8px;">This is an official invoice document.</p>
        </div>
      </body>
    </html>
  `

  printWindow.document.write(htmlContent)
  printWindow.document.close()
  printWindow.focus()
  
  // Wait for content to load, then trigger print
  setTimeout(() => {
    printWindow.print()
  }, 250)
}

