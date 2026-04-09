import { useEffect, useMemo, useRef, useState } from "react"
import { isAxiosError } from "axios"
import { MessageCircle, Pin, PinOff, Send, Smile, Trash2 } from "lucide-react"

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

  const emojiCloseTimerRef = useRef<number | null>(null)

  const isAdmin = user?.role === "admin"
  const canModerate = user?.role === "admin" || user?.role === "it_specialist"

  async function loadMessages() {
    try {
      const res = await getChatMessages({ page: 1, size: 200 })

      const unique = Array.from(
        new Map(res.items.map((item) => [item.id, item])).values()
      )

      setMessages(unique)
      setError(null)
    } catch (err) {
      console.error("CHAT LOAD ERROR:", err)
      setError("Не удалось загрузить сообщения")
    } finally {
      setLoading(false)
    }
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

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [messages])

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Общий чат</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Единая комната для всех сотрудников
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="max-h-[46vh] min-h-[320px] space-y-3 overflow-y-auto p-4 md:max-h-[50vh]">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Загрузка...</div>
          ) : error ? (
            <div className="py-10 text-center text-red-500">{error}</div>
          ) : sortedMessages.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 opacity-40" />
              Сообщений пока нет
            </div>
          ) : (
            sortedMessages.map((message) => {
              const isOwn = user?.id === message.author_id
              const canDelete = isOwn || canModerate

              return (
                <div
                  key={message.id}
                  className={cn(
                    "rounded-xl border p-3 md:p-4",
                    message.is_pinned &&
                    "border-yellow-300 bg-yellow-50/50 dark:border-yellow-500/30 dark:bg-yellow-500/10",
                    message.is_deleted && "opacity-70"
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {message.author_name ?? "Неизвестно"}
                        </span>

                        {message.is_pinned && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
                            Закреплено
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(message.created_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {isAdmin && !message.is_deleted && (
                        <button
                          type="button"
                          onClick={() => void handleTogglePin(message)}
                          className="rounded-md border border-border p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                          title={message.is_pinned ? "Снять закрепление" : "Закрепить"}
                        >
                          {message.is_pinned ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </button>
                      )}

                      {canDelete && !message.is_deleted && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(message)}
                          className="rounded-md border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p
                    className={cn(
                      "whitespace-pre-wrap break-words text-sm",
                      message.is_deleted && "italic text-muted-foreground"
                    )}
                  >
                    {message.text}
                  </p>
                </div>
              )
            })
          )}
        </div>

        <form onSubmit={handleSend} className="border-t border-border p-3 md:p-4">
          <div className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Написать сообщение..."
              className="min-h-[84px] max-h-[160px] w-full rounded-lg border border-border px-3 py-2 outline-none"
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
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-accent"
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
                          className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-lg transition hover:bg-accent"
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
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {sending ? "Отправка..." : "Отправить"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}