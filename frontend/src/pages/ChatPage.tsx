import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { isAxiosError } from "axios"
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileImage,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Send,
  Smile,
  Trash2,
  Users,
  X,
} from "lucide-react"

import { useAuthStore } from "@/features/auth/store"
import {
  createChatMessage,
  deleteChatMessage,
  downloadChatAttachment,
  fetchChatAttachmentBlob,
  getChatMessages,
  getChats,
  getOrCreateDirectChat,
  markChatAsRead,
  pinChat,
  pinChatMessage,
  searchChatEmployees,
  unpinChat,
  unpinChatMessage,
} from "@/shared/api/chat"
import type {
  Chat,
  ChatAttachment,
  ChatMessage,
  ChatMessageStatus,
  Employee,
} from "@/shared/types"
import { cn, formatDateTime, formatRelative } from "@/lib/utils"

const EMOJIS = ["🙂", "👍", "🔥", "🎉", "❤️", "😂", "🤝", "👏"]

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
])

const MAX_FILE_SIZE = 10 * 1024 * 1024
const POLL_MS = 5000

function fileSizeLabel(s: number) {
  if (s < 1024) return `${s} B`
  if (s < 1048576) return `${(s / 1024).toFixed(1)} KB`
  return `${(s / 1048576).toFixed(1)} MB`
}

function chatSubtitle(c: Chat) {
  if (c.type === "global") return "Общий чат компании"
  if (c.type === "department") return "Чат отдела"
  return "Личный диалог"
}

function participantDisplay(name?: string | null, email?: string | null) {
  const n = name?.trim() ?? ""
  const e = email?.trim() ?? ""

  if (n && e && n.toLowerCase() !== e.toLowerCase()) return `${n} · ${e}`
  return n || e || "—"
}

function sortChats(list: Chat[]): Chat[] {
  return [...list].sort((a, b) => {
    if (a.type === "global" && b.type !== "global") return -1
    if (b.type === "global" && a.type !== "global") return 1

    if (
      a.type === "department" &&
      b.type !== "department" &&
      b.type !== "global"
    ) {
      return -1
    }

    if (
      b.type === "department" &&
      a.type !== "department" &&
      a.type !== "global"
    ) {
      return 1
    }

    if (a.is_pinned && !b.is_pinned) return -1
    if (b.is_pinned && !a.is_pinned) return 1

    const aT = a.last_message_at
      ? +new Date(a.last_message_at)
      : +new Date(a.updated_at)
    const bT = b.last_message_at
      ? +new Date(b.last_message_at)
      : +new Date(b.updated_at)

    return bT - aT
  })
}

function getOwnStatus(
  msg: ChatMessage,
  uid?: string | null
): ChatMessageStatus | null {
  if (!uid || !msg.statuses?.length) return null

  const foreign = msg.statuses.filter((s) => s.user_id !== uid)
  if (!foreign.length) return null

  const read = foreign
    .filter((s) => s.read_at)
    .sort((a, b) => +new Date(b.read_at!) - +new Date(a.read_at!))[0]

  if (read) return read

  const delivered = foreign
    .filter((s) => s.delivered_at)
    .sort((a, b) => +new Date(b.delivered_at!) - +new Date(a.delivered_at!))[0]

  return delivered ?? foreign[0]
}

function useImageBlobCache(imageAtts: ChatAttachment[]) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const uR = useRef(urls)
  const lR = useRef(loading)
  const eR = useRef(errors)

  useEffect(() => {
    uR.current = urls
  }, [urls])

  useEffect(() => {
    lR.current = loading
  }, [loading])

  useEffect(() => {
    eR.current = errors
  }, [errors])

  useEffect(() => {
    const needed = new Set(imageAtts.map((a) => a.id))

    setUrls((p) => {
      const n: Record<string, string> = {}
      for (const [k, v] of Object.entries(p)) {
        if (needed.has(k)) n[k] = v
        else URL.revokeObjectURL(v)
      }
      return n
    })

    setErrors((p) => {
      const n: Record<string, string> = {}
      for (const [k, v] of Object.entries(p)) {
        if (needed.has(k)) n[k] = v
      }
      return n
    })

    setLoading((p) => {
      const n: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(p)) {
        if (needed.has(k)) n[k] = v
      }
      return n
    })

    let dead = false

    const go = async () => {
      for (const att of imageAtts.filter(
        (a) => !uR.current[a.id] && !lR.current[a.id] && !eR.current[a.id]
      )) {
        if (dead) return

        setLoading((p) => ({ ...p, [att.id]: true }))

        try {
          const { blob, contentType } = await fetchChatAttachmentBlob(att.id)
          const t = blob.type || contentType

          if (!t?.startsWith("image/") || !blob.size) {
            throw new Error("bad")
          }

          const u = URL.createObjectURL(blob)

          if (dead) {
            URL.revokeObjectURL(u)
            return
          }

          setUrls((p) => {
            if (p[att.id]) {
              URL.revokeObjectURL(u)
              return p
            }
            return { ...p, [att.id]: u }
          })

          setErrors((p) => {
            if (!p[att.id]) return p
            const n = { ...p }
            delete n[att.id]
            return n
          })
        } catch {
          if (!dead) {
            setErrors((p) => ({
              ...p,
              [att.id]: "Не удалось загрузить",
            }))
          }
        } finally {
          if (!dead) {
            setLoading((p) => {
              const n = { ...p }
              delete n[att.id]
              return n
            })
          }
        }
      }
    }

    void go()

    return () => {
      dead = true
    }
  }, [imageAtts])

  useEffect(() => {
    return () => {
      for (const u of Object.values(uR.current)) {
        URL.revokeObjectURL(u)
      }
    }
  }, [])

  const retry = useCallback((id: string) => {
    setErrors((p) => {
      const n = { ...p }
      delete n[id]
      return n
    })

    setLoading((p) => {
      const n = { ...p }
      delete n[id]
      return n
    })
  }, [])

  return { urls, loading, errors, retry }
}

export default function ChatPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === "admin"
  const canModerate = isAdmin || user?.role === "it_specialist"

  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showPinned, setShowPinned] = useState(false)
  const [showDirect, setShowDirect] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [empSearch, setEmpSearch] = useState("")
  const [empResults, setEmpResults] = useState<Employee[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [activeImage, setActiveImage] = useState<{
    src: string
    name: string
  } | null>(null)
  const [showAttach, setShowAttach] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const emojiTimer = useRef<number | null>(null)
  const attachTimer = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgInputRef = useRef<HTMLInputElement | null>(null)
  const docInputRef = useRef<HTMLInputElement | null>(null)

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId]
  )

  const isDirect = activeChat?.type === "direct"
  const sorted = useMemo(() => sortChats(chats), [chats])

  const allSorted = useMemo(
    () => [...messages].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [messages]
  )

  const pinnedMsgs = useMemo(
    () =>
      messages
        .filter((m) => m.is_pinned)
        .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [messages]
  )

  const primaryPinned = pinnedMsgs[0] ?? null

  const imageAtts = useMemo(
    () =>
      messages
        .filter((m) => !m.is_deleted)
        .flatMap((m) => m.attachments.filter((a) => a.attachment_type === "image")),
    [messages]
  )

  const filePreviews = useMemo(
    () => files.map((f) => (IMAGE_TYPES.has(f.type) ? URL.createObjectURL(f) : null)),
    [files]
  )

  useEffect(() => {
    return () => {
      filePreviews.forEach((u) => u && URL.revokeObjectURL(u))
    }
  }, [filePreviews])

  const {
    urls: imgUrls,
    loading: imgLoad,
    errors: imgErr,
    retry: retryImg,
  } = useImageBlobCache(imageAtts)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = containerRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  const loadChats = useCallback(
    async (preferred?: string | null) => {
      const items = await getChats()
      setChats(items)

      const target = preferred ?? activeChatId
      if (target && items.some((c) => c.id === target)) return target

      if (items.length) {
        const fb = items.find((c) => c.type === "global") ?? items[0]
        setActiveChatId(fb.id)
        return fb.id
      }

      return null
    },
    [activeChatId]
  )

  const loadMessages = useCallback(
    async (chatId: string, silent = false, background = false) => {
      try {
        if (!background) setLoadingMessages(true)

        const res = await getChatMessages(chatId, { page: 1, size: 200 })
        const unique = Array.from(new Map(res.items.map((m) => [m.id, m])).values())

        setMessages(unique)

        if (!silent) {
          setShowPinned(false)
          scrollToBottom()
        }

        await markChatAsRead(chatId).catch(() => { })
        setChats((p) =>
          p.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c))
        )
      } catch (err) {
        console.error("MSG LOAD ERR", err)
      } finally {
        if (!background) setLoadingMessages(false)
      }
    },
    [scrollToBottom]
  )

  useEffect(() => {
    let off = false

    void (async () => {
      try {
        setLoadingChats(true)
        const id = await loadChats()
        if (id && !off) await loadMessages(id)
      } catch {
        setError("Не удалось загрузить чаты")
      } finally {
        if (!off) setLoadingChats(false)
      }
    })()

    return () => {
      off = true
    }
  }, [])

  const switchChat = useCallback(
    async (chatId: string) => {
      if (chatId === activeChatId) return

      setLoadingMessages(true)
      setActiveChatId(chatId)
      setMobileShowChat(true)
      setShowParticipants(false)

      await loadMessages(chatId)
    },
    [activeChatId, loadMessages]
  )

  useEffect(() => {
    if (!activeChatId) return

    const id = window.setInterval(async () => {
      try {
        await loadChats(activeChatId)
        await loadMessages(activeChatId, true, true)
      } catch (err) {
        console.error("CHAT POLL ERR", err)
      }
    }, POLL_MS)

    return () => window.clearInterval(id)
  }, [activeChatId, loadChats, loadMessages])

  useEffect(() => {
    if (!showDirect) return

    const t = window.setTimeout(async () => {
      setEmpLoading(true)

      try {
        const e = await searchChatEmployees(empSearch)
        setEmpResults(e.filter((x) => x.user_id && x.user_id !== user?.id))
      } catch (err) {
        console.error("EMP SEARCH ERR", err)
      } finally {
        setEmpLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(t)
  }, [empSearch, showDirect, user?.id])

  function clr(r: React.MutableRefObject<number | null>) {
    if (r.current) {
      window.clearTimeout(r.current)
      r.current = null
    }
  }

  function sched(
    r: React.MutableRefObject<number | null>,
    fn: (v: boolean) => void
  ) {
    clr(r)
    r.current = window.setTimeout(() => fn(false), 180)
  }

  function pickFiles(list: FileList | null, allowed: Set<string>) {
    if (!list) return

    const ok: File[] = []

    for (const f of Array.from(list)) {
      if (!allowed.has(f.type)) {
        alert(`${f.name}: неподдерживаемый тип`)
        continue
      }

      if (f.size > MAX_FILE_SIZE) {
        alert(`${f.name}: больше 10 MB`)
        continue
      }

      ok.push(f)
    }

    if (ok.length) setFiles((p) => [...p, ...ok])
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!activeChatId) return

    const val = text.trim()
    if (!val && !files.length) return

    try {
      setSending(true)
      setError(null)

      const created = await createChatMessage({
        chatId: activeChatId,
        text: val,
        files,
      })

      setMessages((p) => [...p, created])

      setChats((p) =>
        p.map((c) =>
          c.id === activeChatId
            ? {
              ...c,
              unread_count: 0,
              last_message_preview:
                created.text || (created.attachments.length ? "Вложение" : ""),
              last_message_at: created.created_at,
            }
            : c
        )
      )

      setText("")
      setFiles([])
      setShowEmoji(false)
      setShowAttach(false)
      scrollToBottom()
    } catch (err) {
      setError(
        isAxiosError(err)
          ? err.response?.data?.detail ?? "Ошибка отправки"
          : "Ошибка отправки"
      )
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(msg: ChatMessage) {
    if (!activeChatId || !confirm("Удалить сообщение?")) return

    try {
      const u = await deleteChatMessage(activeChatId, msg.id)
      setMessages((p) => p.map((m) => (m.id === u.id ? u : m)))
    } catch {
      alert("Не удалось удалить")
    }
  }

  async function handleTogglePin(msg: ChatMessage) {
    if (!activeChatId) return

    try {
      const u = msg.is_pinned
        ? await unpinChatMessage(activeChatId, msg.id)
        : await pinChatMessage(activeChatId, msg.id)

      setMessages((p) => p.map((m) => (m.id === u.id ? u : m)))
    } catch {
      alert("Ошибка закрепления")
    }
  }

  async function handleToggleChatPin() {
    if (!activeChat || activeChat.type !== "direct") return

    try {
      if (activeChat.is_pinned) await unpinChat(activeChat.id)
      else await pinChat(activeChat.id)

      await loadChats(activeChat.id)
    } catch {
      alert("Ошибка закрепления чата")
    }
  }

  async function handleOpenDirect(emp: Employee) {
    if (!emp.user_id) return

    try {
      const chat = await getOrCreateDirectChat(emp.user_id)
      await loadChats(chat.id)

      setActiveChatId(chat.id)
      setShowDirect(false)
      setEmpSearch("")
      setEmpResults([])
      setMobileShowChat(true)

      await loadMessages(chat.id)
    } catch {
      alert("Не удалось открыть чат")
    }
  }

  function renderAttachments(msg: ChatMessage, isOwn: boolean) {
    if (msg.is_deleted || !msg.attachments.length) return null

    return (
      <div className="mt-2 space-y-2">
        {msg.attachments.map((att) => {
          if (att.attachment_type === "image") {
            const src = imgUrls[att.id]
            const ld = imgLoad[att.id]
            const er = imgErr[att.id]

            return (
              <div
                key={att.id}
                className={cn("flex", isOwn ? "justify-end" : "justify-start")}
              >
                <button
                  type="button"
                  onClick={() => src && setActiveImage({ src, name: att.filename })}
                  disabled={!src || !!er}
                  className="block max-w-full overflow-hidden rounded-2xl border border-border/70 bg-muted/15 text-left transition hover:border-border disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {src ? (
                    <img
                      src={src}
                      alt={att.filename}
                      className="max-h-72 w-full object-cover"
                    />
                  ) : er ? (
                    <div className="space-y-2 p-3">
                      <p className="text-sm text-red-600">{er}</p>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          retryImg(att.id)
                        }}
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-accent"
                      >
                        Повторить
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-44 items-center justify-center gap-2 bg-muted/30 px-6 text-sm text-muted-foreground">
                      {ld && <Loader2 className="h-4 w-4 animate-spin" />}
                      Загрузка...
                    </div>
                  )}
                </button>
              </div>
            )
          }

          return (
            <div
              key={att.id}
              className={cn("flex", isOwn ? "justify-end" : "justify-start")}
            >
              <button
                type="button"
                onClick={() => void downloadChatAttachment(att)}
                className="flex max-w-full items-center gap-3 rounded-2xl border border-border/70 bg-muted/15 px-3 py-2.5 text-sm transition hover:border-border hover:bg-muted/30"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="truncate">{att.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fileSizeLabel(att.file_size)}
                </span>
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  function renderStatus(msg: ChatMessage, isOwn: boolean) {
    const status = isOwn ? getOwnStatus(msg, user?.id) : null

    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>{formatDateTime(msg.created_at)}</span>
        {isOwn && isDirect && status && !msg.is_deleted && (
          status.read_at ? (
            <>
              <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
              <span>прочитано</span>
            </>
          ) : status.delivered_at ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>доставлено</span>
            </>
          ) : null
        )}
      </span>
    )
  }

  function renderMessage(msg: ChatMessage) {
    const isOwn = user?.id === msg.author_id
    const canDel = isOwn || canModerate

    return (
      <div
        key={msg.id}
        className={cn("flex w-full", isOwn ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "w-full max-w-[85%] overflow-hidden rounded-2xl border px-4 py-3 sm:max-w-[78%]",
            msg.is_deleted && "opacity-80",
            isOwn
              ? "border-indigo-200/70 bg-indigo-50/70 dark:border-sky-500/25 dark:bg-sky-500/10"
              : "border-border/65 bg-muted/20"
          )}
        >

          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {!isOwn && (
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 break-words pr-2 text-[15px] font-semibold leading-5">
                    {msg.author_name ?? "Неизвестно"}
                  </span>

                  {!msg.is_deleted && (
                    <div className="flex shrink-0 items-center gap-1">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => void handleTogglePin(msg)}
                          className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                          title={msg.is_pinned ? "Открепить" : "Закрепить"}
                        >
                          {msg.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                      )}

                      {canDel && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(msg)}
                          className="rounded-xl border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                          title="Удалить"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isOwn && !msg.is_deleted && (
                <div className="mb-1 flex justify-end">
                  <div className="flex shrink-0 items-center gap-1">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleTogglePin(msg)}
                        className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                        title={msg.is_pinned ? "Открепить" : "Закрепить"}
                      >
                        {msg.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>
                    )}

                    {canDel && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(msg)}
                        className="rounded-xl border border-red-200 p-2 text-red-600 transition hover:bg-red-50"
                        title="Удалить"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {msg.is_deleted ? (
                <p className={cn("mt-1 italic text-[14px] text-muted-foreground", isOwn && "text-right")}>
                  Сообщение удалено
                </p>
              ) : msg.text ? (
                <p className={cn("mt-1 whitespace-pre-wrap break-words text-[14px] leading-5", isOwn && "text-right")}>
                  {msg.text}
                </p>
              ) : null}

              {renderAttachments(msg, isOwn)}

              <div className={cn("mt-1 flex", isOwn ? "justify-end" : "justify-start")}>
                {renderStatus(msg, isOwn)}
                {msg.is_pinned && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-yellow-600">
                    <Pin className="h-3 w-3" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const sidebar = (
    <aside
      className={cn(
        "chat-card flex flex-col overflow-hidden",
        mobileShowChat ? "hidden lg:flex" : "flex"
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted/25 px-5 py-3.5">
        <h2 className="text-sm font-semibold">Чаты</h2>
        <button
          type="button"
          onClick={() => setShowDirect(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Новый
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {loadingChats ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Загрузка...
          </div>
        ) : !sorted.length ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Чатов нет
          </div>
        ) : (
          sorted.map((chat) => {
            const active = activeChatId === chat.id
            const unread = chat.unread_count ?? 0
            const isSystem = chat.type === "global" || chat.type === "department"

            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => void switchChat(chat.id)}
                className={cn(
                  "w-full rounded-2xl px-3 py-3 text-left transition",
                  active
                    ? "bg-muted/45 shadow-sm ring-1 ring-border"
                    : "hover:bg-muted/25"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{chat.title}</p>
                      {isSystem && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {chat.type === "global" ? "Общий" : "Отдел"}
                        </span>
                      )}
                      {chat.is_pinned && !isSystem && (
                        <Pin className="h-3 w-3 shrink-0 text-yellow-600" />
                      )}
                    </div>

                    {chat.last_message_preview ? (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {chat.last_message_preview}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground/50">
                        Нет сообщений
                      </p>
                    )}

                    {chat.last_message_at && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                        {formatRelative(chat.last_message_at)}
                      </p>
                    )}
                  </div>

                  {unread > 0 && (
                    <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-medium text-white dark:bg-sky-500">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )

  const chatWindow = (
    <section
      className={cn(
        "chat-card flex flex-col overflow-hidden",
        !mobileShowChat ? "hidden lg:flex" : "flex"
      )}
    >
      {activeChat ? (
        <>
          <div className="border-b border-border bg-muted/25 px-4 py-3.5 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileShowChat(false)}
                  className="shrink-0 rounded-lg p-1 text-muted-foreground transition hover:bg-accent lg:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold sm:text-base">
                    {activeChat.title}
                  </h2>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {chatSubtitle(activeChat)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {(activeChat.type === "department" || activeChat.type === "global") &&
                  activeChat.participants.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowParticipants((p) => !p)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium transition hover:bg-accent"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">
                        {activeChat.participants.length}
                      </span>
                    </button>
                  )}

                {activeChat.type === "direct" && (
                  <button
                    type="button"
                    onClick={() => void handleToggleChatPin()}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium transition hover:bg-accent"
                  >
                    {activeChat.is_pinned ? (
                      <PinOff className="h-3.5 w-3.5" />
                    ) : (
                      <Pin className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {activeChat.is_pinned ? "Открепить" : "Закрепить"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {showParticipants &&
              (activeChat.type === "department" || activeChat.type === "global") && (
                <div className="mt-3 rounded-xl border border-border bg-background p-3">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Участники ({activeChat.participants.length})
                  </p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {activeChat.participants.map((p) => (
                      <div
                        key={p.user_id}
                        className="truncate rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs"
                      >
                        {participantDisplay(p.name, p.email)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {primaryPinned && (
            <div className="border-b border-border">
              <button
                type="button"
                onClick={() => setShowPinned((p) => !p)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/50"
              >
                <Pin className="h-4 w-4 shrink-0 text-yellow-600" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {pinnedMsgs.length > 1
                      ? `Закреплённых: ${pinnedMsgs.length}`
                      : "Закреплённое сообщение"}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="shrink-0 font-medium">
                      {primaryPinned.author_name ?? "?"}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {primaryPinned.text || "Вложение"}
                    </span>
                  </div>
                </div>
                {showPinned ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showPinned && (
                <div className="max-h-[220px] space-y-2 overflow-y-auto border-t border-border p-3">
                  {pinnedMsgs.map(renderMessage)}
                </div>
              )}
            </div>
          )}

          <div
            className="relative flex-1"
            style={{ maxHeight: "calc(100vh - 20rem)", minHeight: "200px" }}
          >
            <div
              ref={containerRef}
              className="h-full space-y-2 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4"
            >
              {loadingMessages && !allSorted.length && !error ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Loader2 className="mb-3 h-10 w-10 animate-spin opacity-60" />
                  <p className="text-sm">Загрузка сообщений...</p>
                </div>
              ) : !allSorted.length && !error ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <MessageCircle className="mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm font-medium text-foreground/70">
                    Сообщений пока нет
                  </p>
                  <p className="mt-1 text-xs">Отправьте первое сообщение</p>
                </div>
              ) : error ? (
                <div className="py-10 text-center text-red-500">{error}</div>
              ) : (
                allSorted.map(renderMessage)
              )}
            </div>

            {loadingMessages && allSorted.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-start justify-center bg-background/45 pt-4">
                <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Загрузка сообщений...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="border-t border-border bg-card p-3 sm:p-4">
            <div className="space-y-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (!sending && (text.trim() || files.length)) {
                      void handleSend()
                    }
                  }
                }}
                placeholder={`Написать в «${activeChat.title}»...`}
                className="chat-input min-h-[56px] max-h-[100px] w-full resize-none rounded-2xl px-3 py-2.5 text-[14px] outline-none sm:min-h-[74px] sm:max-h-[140px] sm:px-4 sm:py-3"
                maxLength={4000}
              />

              {files.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="rounded-2xl border border-border/70 bg-muted/15 p-2.5"
                    >
                      {IMAGE_TYPES.has(f.type) ? (
                        <img
                          src={filePreviews[i] ?? ""}
                          alt={f.name}
                          className="mb-2 h-24 w-full rounded-xl object-cover"
                        />
                      ) : (
                        <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-background">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}

                      <div className="truncate text-sm font-medium">{f.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {fileSizeLabel(f.size)}
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-red-600"
                      >
                        <X className="h-3 w-3" />
                        Убрать
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex flex-1 items-center gap-1.5">
                  <div
                    className="relative"
                    onMouseEnter={() => clr(emojiTimer)}
                    onMouseLeave={() => sched(emojiTimer, setShowEmoji)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        clr(emojiTimer)
                        setShowEmoji((p) => !p)
                      }}
                      className="inline-flex items-center justify-center rounded-xl border border-border bg-background p-2 text-sm hover:bg-accent"
                      title="Эмодзи"
                    >
                      <Smile className="h-4 w-4" />
                    </button>

                    {showEmoji && (
                      <div className="absolute bottom-full left-0 z-50 mb-2 w-[220px] rounded-2xl border border-border bg-background p-3 shadow-xl">
                        <div className="grid grid-cols-4 gap-2">
                          {EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => {
                                setText((p) => p + em)
                                setShowEmoji(false)
                                clr(emojiTimer)
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-xl border text-lg hover:bg-accent"
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div
                    className="relative"
                    onMouseEnter={() => clr(attachTimer)}
                    onMouseLeave={() => sched(attachTimer, setShowAttach)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        clr(attachTimer)
                        setShowAttach((p) => !p)
                      }}
                      className="inline-flex items-center justify-center rounded-xl border border-border bg-background p-2 text-sm hover:bg-accent"
                      title="Вложение"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>

                    {showAttach && (
                      <div className="absolute bottom-full left-0 z-50 mb-2 w-44 rounded-2xl border border-border bg-background p-2 shadow-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttach(false)
                            imgInputRef.current?.click()
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm hover:bg-accent"
                        >
                          <FileImage className="h-4 w-4" />
                          Фото
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttach(false)
                            docInputRef.current?.click()
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm hover:bg-accent"
                        >
                          <FileText className="h-4 w-4" />
                          Файл
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={imgInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(e) => pickFiles(e.target.files, IMAGE_TYPES)}
                  />

                  <input
                    ref={docInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={(e) => pickFiles(e.target.files, DOCUMENT_TYPES)}
                  />

                  <p className="hidden text-xs text-muted-foreground sm:block">
                    {text.length}/4000
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={sending || (!text.trim() && !files.length)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:px-4"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {sending ? "..." : "Отправить"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </>
      ) : (
        <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center text-muted-foreground">
          <MessageCircle className="mb-4 h-12 w-12 opacity-35" />
          <p className="text-base font-medium text-foreground/70">Выберите чат</p>
          <p className="mt-1 max-w-sm text-sm">
            Откройте общий чат или начните личный диалог
          </p>
        </div>
      )}
    </section>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <div className={cn(mobileShowChat ? "hidden lg:block" : "block")}>
        <div className="chat-title-card relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-5 sm:px-8 sm:py-6">
          <div className="relative z-10">
            <h1 className="text-2xl font-semibold tracking-tight">Чаты</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Общий чат, чаты отделов и личные диалоги
            </p>
          </div>
          <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-500/[0.06] blur-3xl dark:bg-sky-500/[0.07]" />
        </div>
      </div>

      <div
        className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"
        style={{ minHeight: "calc(100vh - 12rem)" }}
      >
        {sidebar}
        {chatWindow}
      </div>

      {showDirect && (
        <div
          className="fixed inset-0 z-50 bg-black/50 p-4"
          onClick={() => setShowDirect(false)}
        >
          <div
            className="mx-auto mt-20 w-full max-w-xl rounded-2xl border border-border bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Новый чат</h2>
              <button type="button" onClick={() => setShowDirect(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder="Поиск по ФИО, email, должности..."
              className="chat-input w-full rounded-xl px-3 py-2 text-sm outline-none"
            />

            <div className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
              {empLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Поиск...
                </div>
              ) : !empResults.length ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Не найдено
                </div>
              ) : (
                empResults.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => void handleOpenDirect(emp)}
                    className="w-full rounded-xl border border-border/70 px-3 py-2.5 text-left transition hover:bg-accent"
                  >
                    <div className="font-medium">{emp.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {emp.email} · {emp.position}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 p-4"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="mx-auto mt-10 max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveImage(null)}
                className="rounded-full border border-white/30 p-2 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={activeImage.src}
              alt={activeImage.name}
              className="mx-auto max-h-[80vh] rounded-lg"
            />
          </div>
        </div>
      )}

      <style>{`
        .chat-title-card {
          box-shadow:
            -14px 0 28px -14px rgb(99 102 241 / .18),
            14px 0 28px -14px rgb(14 165 233 / .14),
            0 2px 8px -4px rgb(99 102 241 / .08);
        }

        .dark .chat-title-card {
          box-shadow:
            -16px 0 32px -12px rgb(56 189 248 / .15),
            16px 0 32px -12px rgb(139 92 246 / .12),
            0 2px 8px -4px rgb(56 189 248 / .06);
        }

        .chat-card {
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          box-shadow:
            -10px 0 20px -14px rgb(99 102 241 / .14),
            10px 0 20px -14px rgb(14 165 233 / .1),
            0 1px 3px rgb(0 0 0 / .04);
        }

        .dark .chat-card {
          box-shadow:
            -12px 0 24px -12px rgb(56 189 248 / .12),
            12px 0 24px -12px rgb(139 92 246 / .1),
            0 1px 3px rgb(0 0 0 / .25);
        }

        .chat-input {
          border: 1px solid rgb(209 213 219);
          background: rgb(249 250 251);
          color: rgb(17 24 39);
          transition:
            border-color .15s,
            box-shadow .15s,
            background .15s;
        }

        .chat-input::placeholder {
          color: rgb(156 163 175);
        }

        .chat-input:hover {
          border-color: rgb(156 163 175);
          background: #fff;
        }

        .chat-input:focus {
          border-color: rgb(99 102 241);
          background: #fff;
          box-shadow: 0 0 0 3px rgb(99 102 241 / .15);
        }

        .dark .chat-input {
          border-color: rgb(51 65 85);
          background: rgb(30 41 59);
          color: rgb(241 245 249);
        }

        .dark .chat-input::placeholder {
          color: rgb(100 116 139);
        }

        .dark .chat-input:hover {
          border-color: rgb(71 85 105);
          background: rgb(35 46 66);
        }

        .dark .chat-input:focus {
          border-color: rgb(56 189 248);
          background: rgb(35 46 66);
          box-shadow: 0 0 0 3px rgb(56 189 248 / .2);
        }
      `}</style>
    </div>
  )
}