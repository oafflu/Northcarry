export type ContactCMSContent = {
  title: string
  subtitle: string
  email: string
  address: string
  formEnabled: boolean
  getInTouchHeading: string
  emailDescription: string
  liveChatTitle: string
  liveChatDescription: string
  formHeading: string
  businessHoursTitle: string
  businessHours: string
}

export const CONTACT_CMS_DEFAULTS: ContactCMSContent = {
  title: "Contact Us",
  subtitle: "",
  email: "hello@brevibrushes.com",
  address: "Brevi Brush Limited\n10685-B Hazelhurst Dr. #34479\nHouston, TX 77043, USA",
  formEnabled: true,
  getInTouchHeading: "Get In Touch",
  emailDescription:
    "Send us an email and we'll get back to you as soon as possible.",
  liveChatTitle: "Live Chat",
  liveChatDescription:
    "Use our live chat feature for instant support. Look for the chat icon in the bottom right corner of the page.",
  formHeading: "Send Us a Message",
  businessHoursTitle: "Business Hours",
  businessHours:
    "Monday - Friday: 9:00 AM - 6:00 PM EST\nSaturday: 10:00 AM - 4:00 PM EST\nSunday: Closed",
}

export function mergeContactCMSContent(raw: unknown): ContactCMSContent {
  const saved = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}

  const str = (key: keyof ContactCMSContent, fallback: string) =>
    typeof saved[key] === "string" ? (saved[key] as string) : fallback

  return {
    title: str("title", CONTACT_CMS_DEFAULTS.title),
    subtitle: str("subtitle", CONTACT_CMS_DEFAULTS.subtitle),
    email: str("email", CONTACT_CMS_DEFAULTS.email),
    address: str("address", CONTACT_CMS_DEFAULTS.address),
    formEnabled:
      typeof saved.formEnabled === "boolean"
        ? saved.formEnabled
        : CONTACT_CMS_DEFAULTS.formEnabled,
    getInTouchHeading: str("getInTouchHeading", CONTACT_CMS_DEFAULTS.getInTouchHeading),
    emailDescription: str("emailDescription", CONTACT_CMS_DEFAULTS.emailDescription),
    liveChatTitle: str("liveChatTitle", CONTACT_CMS_DEFAULTS.liveChatTitle),
    liveChatDescription: str(
      "liveChatDescription",
      CONTACT_CMS_DEFAULTS.liveChatDescription
    ),
    formHeading: str("formHeading", CONTACT_CMS_DEFAULTS.formHeading),
    businessHoursTitle: str("businessHoursTitle", CONTACT_CMS_DEFAULTS.businessHoursTitle),
    businessHours: str("businessHours", CONTACT_CMS_DEFAULTS.businessHours),
  }
}
