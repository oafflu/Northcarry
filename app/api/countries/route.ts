import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from("countries")
      .select("code, name, currency_code, currency_symbol, is_active, shipping_enabled")
      .eq("is_active", true)
      .eq("shipping_enabled", true)
      .order("sort_order, name")

    if (error) {
      console.error("Error fetching countries:", error)
      return NextResponse.json({ data: [], error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    console.error("Error in countries API:", error)
    return NextResponse.json({ data: [], error: error.message || "Internal server error" }, { status: 500 })
  }
}

