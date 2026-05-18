import { getCMSContent } from "@/app/actions/cms"
import { ContactPageContent } from "@/components/contact-page-content"
import { mergeContactCMSContent } from "@/lib/contact-cms-defaults"

export default async function ContactPage() {
  const cmsData = await getCMSContent("contact")
  const content = mergeContactCMSContent(cmsData.data)

  return <ContactPageContent content={content} />
}
