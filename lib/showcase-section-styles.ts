import type { CSSProperties } from "react"

export function showcaseSectionStyle(content: {
  backgroundColor?: string
  textColor?: string
} | null | undefined): {
  className: string
  style: CSSProperties
} {
  const backgroundColor = content?.backgroundColor?.trim()
  const textColor = content?.textColor?.trim()
  const style: CSSProperties = {}

  if (backgroundColor) style.backgroundColor = backgroundColor
  if (textColor) style.color = textColor

  return {
    className: "py-20 px-4 md:px-6 lg:px-8",
    style,
  }
}
