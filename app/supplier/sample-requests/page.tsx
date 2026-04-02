import { redirect } from 'next/navigation'

/** Sample request list merged into Research & updates; keep this URL for bookmarks and emails that only link to detail. */
export default function SupplierSampleRequestsRedirectPage() {
  redirect('/supplier/research-updates')
}
