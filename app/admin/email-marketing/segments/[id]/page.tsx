"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Search, User, MailMinus, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getEmailSegmentMembers, type EmailSegment } from "@/app/actions/email-segments"
import { toast } from "sonner"

const PAGE_SIZE = 50

export default function SegmentDetailPage() {
  const params = useParams()
  const segmentId = params.id as string
  const [segment, setSegment] = useState<EmailSegment | null>(null)
  const [members, setMembers] = useState<
    Array<{
      id: string
      email: string
      first_name: string | null
      last_name: string | null
      marketing_status: "active" | "unsubscribed" | "unknown"
    }>
  >([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [unsubscribingId, setUnsubscribingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!segmentId) return
    setLoading(true)
    try {
      const result = await getEmailSegmentMembers(segmentId, {
        search: search || undefined,
        limit: PAGE_SIZE,
        offset,
      })
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to load segment")
        setSegment(null)
        setMembers([])
        setTotal(0)
        return
      }
      setSegment(result.data.segment)
      setMembers(result.data.members)
      setTotal(result.data.total)
    } catch (e: any) {
      toast.error(e?.message || "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [segmentId, search, offset])

  useEffect(() => {
    load()
  }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    setSearch(searchInput.trim())
  }

  const handleUnsubscribe = async (userId: string) => {
    if (!confirm("Mark this customer as unsubscribed from marketing emails?")) return
    setUnsubscribingId(userId)
    try {
      const res = await fetch("/api/admin/customers/email-opt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, optIn: false }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success("Customer unsubscribed from marketing emails")
        setMembers((prev) =>
          prev.map((m) => (m.id === userId ? { ...m, marketing_status: "unsubscribed" as const } : m))
        )
      } else {
        toast.error(data.error || "Failed to update")
      }
    } catch {
      toast.error("Failed to update")
    } finally {
      setUnsubscribingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/email-marketing/segments"
          className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 mb-2 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to segments
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{segment?.name || "Segment"}</h1>
        {segment?.description && <p className="text-gray-600 mt-1">{segment.description}</p>}
        <p className="text-sm text-gray-500 mt-2">
          {total.toLocaleString()} customer{total !== 1 ? "s" : ""} in this segment
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading members…</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No members match this view.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Marketing</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => {
                  const name =
                    [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email?.split("@")[0] || "—"
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className="font-medium text-gray-900">{name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{m.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            m.marketing_status === "unsubscribed"
                              ? "text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs font-medium"
                              : m.marketing_status === "active"
                                ? "text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs font-medium"
                                : "text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs"
                          }
                        >
                          {m.marketing_status === "unsubscribed"
                            ? "Opted out"
                            : m.marketing_status === "active"
                              ? "Opted in"
                              : "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/customers/${m.id}`}>
                            <Button variant="outline" size="sm" type="button">
                              View
                            </Button>
                          </Link>
                          {m.marketing_status !== "unsubscribed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              className="text-amber-700 border-amber-200 hover:bg-amber-50"
                              disabled={unsubscribingId === m.id}
                              onClick={() => handleUnsubscribe(m.id)}
                            >
                              <MailMinus className="w-3.5 h-3.5 mr-1" />
                              {unsubscribingId === m.id ? "…" : "Unsubscribe"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
