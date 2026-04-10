import { useEffect, useMemo, useRef, useState } from "react"
import { isAxiosError } from "axios"
import {
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Pin,
  PinOff,
  Send,
  Smile,
  Trash2,
} from "lucide-react"

import { useAuthStore } from "@/features/auth/store"
import {
  createChatMessage,
  deleteChatMessage,
  getChatMessages,
  pinChatMessage,
  unpinChatMessage,
} from "@/shared/api/chat"
import type { ChatMessage } from "@/shared/types"
import { cn, formatDateTime } from "@/lib/utils"

const EMOJIS = ["🙂", "👍", "🔥", "🎉", "❤️", "😂", "🤝", "👏"]

export default function ChatPage() {
  const { user } = useAuthStore()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showPinnedDetails, setShowPinnedDetails] = useState(false)

  const emojiCloseTimerRef = useRef<number | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  const isAdmin = user?.role === "admin"
  const canModerate = user?.role === "admin" || user?.role === "it_specialist"

  async function loadMessages() {
    try {
      const res = await getChatMessages({ page: 1, size: 200 })
      const unique = Array.from(new Map(res.items.map((item) => [item.id, item])).values())
      setMessages(unique)
      setError(null)
    } catch (err) {
      console.error("CHAT LOAD ERROR:", err)
      setError("Не удалось загрузить сообщения")
    } finally {
      setLoading(false)
    }
  }

  function scrollToBottom() {
    const container = messagesContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }

  useEffect(() => {
    void loadMessages()

    const timer = window.setInterval(() => {
      void loadMessages()
    }, 5000)

    return () => {
      window.clearInterval(timer)
      if (emojiCloseTimerRef.current) {
        window.clearTimeout(emojiCloseTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (loading) return
    requestAnimationFrame(() => {
      scrollToBottom()
    })
  }, [loading, messages.length])

  const pinnedMessages = useMemo(() => {
    return messages
      .filter((message) => message.is_pinned)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [messages])

  const regularMessages = useMemo(() => {
    return messages
      .filter((message) => !message.is_pinned)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [messages])

  const primaryPinnedMessage = pinnedMessages[0] ?? null

  function clearEmojiCloseTimer() {
    if (emojiCloseTimerRef.current) {
      window.clearTimeout(emojiCloseTimerRef.current)
      emojiCloseTimerRef.current = null
    }
  }

  function scheduleEmojiClose() {
    clearEmojiCloseTimer()
    emojiCloseTimerRef.current = window.setTimeout(() => {
      setShowEmojiPicker(false)
    }, 180)
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()

    const value = text.trim()
    if (!value) return

    try {
      setSending(true)
      await createChatMessage(value)
      setText("")
      setShowEmojiPicker(false)
      setError(null)
      await loadMessages()

      requestAnimationFrame(() => {
        scrollToBottom()
      })
    } catch (err) {
      console.error("CHAT SEND ERROR:", err)
      if (isAxiosError(err)) {
        setError(err.response?.data?.detail ?? "Не удалось отправить сообщение")
      } else {
        setError("Не удалось отправить сообщение")
      }
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(message: ChatMessage) {
    if (!confirm("Удалить сообщение?")) return

    try {
      const updated = await deleteChatMessage(message.id)
      setMessages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      console.error("CHAT DELETE ERROR:", err)
      alert("Не удалось удалить сообщение")
    }
  }

  async function handleTogglePin(message: ChatMessage) {
    try {
      const updated = message.is_pinned
        ? await unpinChatMessage(message.id)
        : await pinChatMessage(message.id)

      setMessages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      console.error("CHAT PIN ERROR:", err)
      alert("Не удалось изменить закрепление")
    }
  }

  function appendEmoji(emoji: string) {
    setText((prev) => `${prev}${emoji}`)
    setShowEmojiPicker(false)
    clearEmojiCloseTimer()
  }

  function renderMessageCard(message: ChatMessage) {
    const isOwn = user?.id === message.author_id
    const canDelete = isOwn || canModerate

    return (
      <div
        key={message.id}
        className={cn(
          "w-full overflow-hidden rounded-xl border px-3 py-2.5 sm:px-3.5 sm:py-3",
          message.is_deleted && "opacity-70"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[15px] font-semibold leading-5">
                {message.author_name ?? "Неизвестно"}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatDateTime(message.created_at)}
              </span>
            </div>

            <p
              className={cn(
                "mt-1 whitespace-pre-wrap break-words text-[14px] leading-5",
                message.is_deleted && "italic text-muted-foreground"
              )}
            >
              {message.text}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {isAdmin && !message.is_deleted && (
              <button
                type="button"
                onClick={() => void handleTogglePin(message)}
                className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                title={message.is_pinned ? "Снять закрепление" : "Закрепить"}
              >
                {message.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </button>
            )}

            {canDelete && !message.is_deleted && (
              <button
                type="button"
                onClick={() => void handleDelete(message)}
                className="rounded-xl border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                title="Удалить"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-bold">Общий чат</h1>
        <p className="mt-1 text-sm text-muted-foreground">Единая комната для всех сотрудников</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        {primaryPinnedMessage && (
          <div className="border-b border-border">
            <button
              type="button"
              onClick={() => setShowPinnedDetails((prev) => !prev)}
              className="flex w-full items-center gap-3 overflow-hidden px-3 py-3 text-left transition hover:bg-accent/50 sm:px-4"
            >
              <div className="flex shrink-0 items-center gap-2 self-start pt-0.5 text-yellow-600">
                <Pin className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="mb-0.5 text-[11px] font-medium text-muted-foreground">
                  {pinnedMessages.length > 1
                    ? `Закреплённые сообщения: ${pinnedMessages.length}`
                    : "Закреплённое сообщение"}
                </div>

                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="shrink-0 font-medium text-foreground">
                    {primaryPinnedMessage.author_name ?? "Неизвестно"}
                  </span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {primaryPinnedMessage.text}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-muted-foreground">
                {showPinnedDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </button>

            {showPinnedDetails && (
              <div className="max-h-[22vh] space-y-2 overflow-y-auto border-t border-border px-3 pb-3 pt-3 sm:max-h-[220px] sm:px-4 sm:pb-4">
                {pinnedMessages.map((message) => {
                  const isOwn = user?.id === message.author_id
                  const canDelete = isOwn || canModerate

                  return (
                    <div
                      key={message.id}
                      className="w-full overflow-hidden rounded-xl border border-yellow-300 bg-yellow-50/50 px-3 py-2.5 dark:border-yellow-500/30 dark:bg-yellow-500/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[14px] font-semibold leading-5">
                              {message.author_name ?? "Неизвестно"}
                            </span>
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
                              Закреплено
                            </span>
                          </div>

                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatDateTime(message.created_at)}
                          </p>

                          <p
                            className={cn(
                              "mt-1 whitespace-pre-wrap break-words text-[14px] leading-5",
                              message.is_deleted && "italic text-muted-foreground"
                            )}
                          >
                            {message.text}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {isAdmin && !message.is_deleted && (
                            <button
                              type="button"
                              onClick={() => void handleTogglePin(message)}
                              className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                              title="Снять закрепление"
                            >
                              <PinOff className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {canDelete && !message.is_deleted && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(message)}
                              className="rounded-xl border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                              title="Удалить"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div
          ref={messagesContainerRef}
          className="min-h-[260px] max-h-[42vh] w-full space-y-2 overflow-x-hidden overflow-y-auto p-3 sm:min-h-[300px] sm:max-h-[50vh] sm:space-y-2.5 sm:p-4"
        >
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Загрузка...</div>
          ) : error ? (
            <div className="py-10 text-center text-red-500">{error}</div>
          ) : regularMessages.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 opacity-40" />
              Сообщений пока нет
            </div>
          ) : (
            regularMessages.map((message) => renderMessageCard(message))
          )}
        </div>

        <form onSubmit={handleSend} className="overflow-hidden border-t border-border bg-card p-3 sm:rounded-b-xl sm:p-4">
          <div className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Написать сообщение..."
              className="min-h-[60px] max-h-[100px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-[14px] outline-none sm:min-h-[68px] sm:max-h-[110px] sm:py-2.5"
              maxLength={4000}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    clearEmojiCloseTimer()
                    setShowEmojiPicker((prev) => !prev)
                  }}
                  onMouseEnter={clearEmojiCloseTimer}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm transition hover:bg-accent"
                >
                  <Smile className="h-4 w-4" />
                  Эмодзи
                </button>

                {showEmojiPicker && (
                  <div
                    className="absolute bottom-full left-0 z-20 mb-2 w-[220px] rounded-xl border border-border bg-background p-3 shadow-lg"
                    onMouseEnter={clearEmojiCloseTimer}
                    onMouseLeave={scheduleEmojiClose}
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => appendEmoji(emoji)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-lg transition hover:bg-accent"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-xs text-muted-foreground">{text.length}/4000</p>

                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60 sm:px-4"
                >
                  <Send className="h-4 w-4" />
                  {sending ? "Отправка..." : "Отправить"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}