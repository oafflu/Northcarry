'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from '@/lib/translations/supplier/context'
import {
  getSupplierAdminChatsForPortal,
  getSupplierAdminChatMessages,
  sendSupplierAdminChatMessage,
} from '@/app/actions/suppliers'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

export default function SupplierMessagesPage() {
  const { t } = useTranslation()
  const [chats, setChats] = useState<any[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [draft, setDraft] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)

  const loadChats = useCallback(async () => {
    setLoadingList(true)
    const res = await getSupplierAdminChatsForPortal()
    if (res.error) toast.error(res.error)
    setChats(res.data || [])
    setLoadingList(false)
  }, [])

  const loadThread = useCallback(async (chatId: string) => {
    setLoadingThread(true)
    const res = await getSupplierAdminChatMessages(chatId)
    if (res.error) {
      toast.error(res.error)
      setMessages([])
    } else {
      setMessages(res.messages || [])
    }
    setLoadingThread(false)
  }, [])

  useEffect(() => {
    loadChats()
  }, [loadChats])

  useEffect(() => {
    if (activeId) loadThread(activeId)
    else setMessages([])
  }, [activeId, loadThread])

  const adminLabel = (chat: any) => {
    const a = chat.admin
    if (!a) return 'BREVI'
    const n = `${a.first_name || ''} ${a.last_name || ''}`.trim()
    return n || a.email || 'BREVI team'
  }

  const handleSend = async () => {
    if (!activeId || !draft.trim()) return
    setSending(true)
    const res = await sendSupplierAdminChatMessage(activeId, draft)
    setSending(false)
    if (!res.success) {
      toast.error(res.error || 'Failed to send')
      return
    }
    toast.success(t('common.messagesSent') || 'Message sent')
    setDraft('')
    await loadThread(activeId)
    await loadChats()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-teal-600" />
          {t('common.messages') || 'Messages'}
        </h1>
        <p className="text-gray-600 mt-1 text-sm">
          {t('common.messagesSubtitle') ||
            'Conversations with BREVI admins. Replies notify them by email and push.'}
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('common.conversations') || 'Conversations'}</CardTitle>
            <CardDescription className="text-xs">
              {t('common.selectThread') || 'Select a thread to read and reply'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[480px] overflow-y-auto">
            {loadingList ? (
              <div className="flex justify-center py-8 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : chats.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                {t('common.noMessagesYet') ||
                  'No messages yet. An admin message will appear here when they contact you.'}
              </p>
            ) : (
              chats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    activeId === c.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-gray-900">{adminLabel(c)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {c.last_message_at
                      ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true })
                      : ''}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('common.thread') || 'Thread'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeId ? (
              <p className="text-sm text-gray-500 py-12 text-center">
                {t('common.chooseConversation') || 'Choose a conversation on the left.'}
              </p>
            ) : loadingThread ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-gray-50 max-h-[320px] overflow-y-auto p-3 space-y-2">
                  {messages.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">{t('common.noMessagesInThread') || 'No messages yet.'}</p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderType === 'supplier'
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                              mine
                                ? 'bg-teal-600 text-white'
                                : 'bg-white border border-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.message}</p>
                            <p className={`text-[10px] mt-1 ${mine ? 'text-teal-100' : 'text-gray-400'}`}>
                              {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t('common.typeReply') || 'Type your reply…'}
                    rows={3}
                    className="flex-1 min-h-[72px]"
                  />
                  <Button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || !draft.trim()}
                    className="bg-teal-600 hover:bg-teal-700 shrink-0"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    {t('common.send') || 'Send'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-gray-500">
        <Link href="/supplier/research-updates" className="text-teal-600 hover:underline">
          {t('common.researchAndUpdates') || 'Research & updates'}
        </Link>
        {' · '}
        <Link href="/supplier" className="text-teal-600 hover:underline">
          {t('common.dashboard') || 'Dashboard'}
        </Link>
      </p>
    </div>
  )
}
