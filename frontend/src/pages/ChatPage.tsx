import { useEffect, useMemo, useRef, useState } from "react"
import { isAxiosError } from "axios"
import {
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
  markChatRead,
  pinChat,
  pinChatMessage,
  searchChatEmployees,
  unpinChat,
  unpinChatMessage,
} from "@/shared/api/chat"
import type { Chat, ChatAttachment, ChatMessage, Employee } from "@/shared/types"
import { cn, formatDateTime, formatRelative } from "@/lib/utils"

const EMOJIS = ["🙂", "👍", "🔥", "🎉", "❤️", "😂", "🤝", "👏"]
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
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

function fileSizeLabel(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function chatSubtitle(chat: Chat) {
  return chat.type === "global" ? "Общий чат" : "Личный диалог"
}

function MessageMeta({
  message,
  isDirect,
}: {
  message: ChatMessage
  isDirect: boolean
}) {
  const status = message.my_status
  const readAt = status?.read_at
  const deliveredAt = status?.delivered_at

  return (
    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
      <span>{formatDateTime(message.created_at)}</span>

      {isDirect && message.my_status && !message.is_deleted ? (
        <>
          {readAt ? (
            <>
              <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
              <span>прочитано</span>
            </>
          ) : deliveredAt ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>доставлено</span>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default function ChatPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === "admin"
  const canModerate = user?.role === "admin" || user?.role === "it_specialist"

  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showPinnedDetails, setShowPinnedDetails] = useState(false)
  const [showDirectModal, setShowDirectModal] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [employeeResults, setEmployeeResults] = useState<Employee[]>([])
  const [employeeLoading, setEmployeeLoading] = useState(false)
  const [activeImage, setActiveImage] = useState<{ src: string; name: string } | null>(null)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [attachmentObjectUrls, setAttachmentObjectUrls] = useState<Record<string, string>>({})
  const [loadingImageIds, setLoadingImageIds] = useState<Record<string, boolean>>({})
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, string>>({})

  const emojiCloseTimerRef = useRef<number | null>(null)
  const attachmentCloseTimerRef = useRef<number | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const documentInputRef = useRef<HTMLInputElement | null>(null)

  const attachmentObjectUrlsRef = useRef<Record<string, string>>({})
  const loadingImageIdsRef = useRef<Record<string, boolean>>({})
  const imageLoadErrorsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    attachmentObjectUrlsRef.current = attachmentObjectUrls
  }, [attachmentObjectUrls])

  useEffect(() => {
    loadingImageIdsRef.current = loadingImageIds
  }, [loadingImageIds])

  useEffect(() => {
    imageLoadErrorsRef.current = imageLoadErrors
  }, [imageLoadErrors])

  const activeChat = useMemo(
    () => chats.find((item) => item.id === activeChatId) ?? null,
    [chats, activeChatId]
  )

  const isDirectChat = activeChat?.type === "direct"

  const pinnedMessages = useMemo(
    () =>
      messages
        .filter((message) => message.is_pinned)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages]
  )

  const regularMessages = useMemo(
    () =>
      messages
        .filter((message) => !message.is_pinned)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages]
  )

  const imageAttachments = useMemo(
    () =>
      messages
        .filter((message) => !message.is_deleted)
        .flatMap((message) => message.attachments.filter((item) => item.attachment_type === "image")),
    [messages]
  )

  const selectedImagePreviews = useMemo(() => {
    return files.map((file) => (IMAGE_TYPES.has(file.type) ? URL.createObjectURL(file) : null))
  }, [files])

  const primaryPinnedMessage = pinnedMessages[0] ?? null

  async function loadChats(preferredChatId?: string | null) {
    const items = await getChats()
    setChats(items)

    const current = preferredChatId ?? activeChatId

    if (!current && items.length > 0) {
      setActiveChatId(items[0].id)
      return items[0].id
    }

    if (current && items.some((item) => item.id === current)) {
      return current
    }

    if (items.length > 0) {
      setActiveChatId(items[0].id)
      return items[0].id
    }

    return null
  }

  async function loadMessages(chatId: string, preserveScroll = false) {
    try {
      setLoadingMessages(true)
      const res = await getChatMessages(chatId, { page: 1, size: 200 })
      const unique = Array.from(new Map(res.items.map((item) => [item.id, item])).values())
      setMessages(unique)
      setShowPinnedDetails(false)

      await markChatRead(chatId).catch(() => { })
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? { ...chat, unread_count: 0 }
            : chat
        )
      )

      if (!preserveScroll) {
        requestAnimationFrame(() => {
          const container = messagesContainerRef.current
          if (!container) return
          container.scrollTop = container.scrollHeight
        })
      }
    } finally {
      setLoadingMessages(false)
    }
  }

  async function bootstrap() {
    try {
      setLoadingChats(true)
      setError(null)
      const chatId = await loadChats()
      if (chatId) {
        await loadMessages(chatId)
      }
    } catch (err) {
      console.error("CHAT LOAD ERROR:", err)
      setError("Не удалось загрузить чаты")
    } finally {
      setLoadingChats(false)
    }
  }

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    if (!activeChatId) return
    void loadMessages(activeChatId)
  }, [activeChatId])

  useEffect(() => {
    if (!activeChatId) return

    const intervalId = window.setInterval(async () => {
      try {
        await loadChats(activeChatId)
        await loadMessages(activeChatId, true)
      } catch (err) {
        console.error("CHAT POLLING ERROR:", err)
      }
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeChatId])

  useEffect(() => {
    if (!showDirectModal) return

    const timer = window.setTimeout(async () => {
      setEmployeeLoading(true)
      try {
        const employees = await searchChatEmployees(employeeSearch)
        setEmployeeResults(employees.filter((item) => item.user_id && item.user_id !== user?.id))
      } catch (err) {
        console.error("EMPLOYEE SEARCH ERROR", err)
      } finally {
        setEmployeeLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [employeeSearch, showDirectModal, user?.id])

  useEffect(() => {
    const requiredImageIds = new Set(imageAttachments.map((item) => item.id))

    setAttachmentObjectUrls((prev) => {
      const next: Record<string, string> = {}
      for (const [id, url] of Object.entries(prev)) {
        if (requiredImageIds.has(id)) next[id] = url
        else URL.revokeObjectURL(url)
      }
      return next
    })

    setImageLoadErrors((prev) => {
      const next: Record<string, string> = {}
      for (const [id, value] of Object.entries(prev)) {
        if (requiredImageIds.has(id)) next[id] = value
      }
      return next
    })

    setLoadingImageIds((prev) => {
      const next: Record<string, boolean> = {}
      for (const [id, value] of Object.entries(prev)) {
        if (requiredImageIds.has(id)) next[id] = value
      }
      return next
    })

    let disposed = false

    const loadMissing = async () => {
      const currentUrls = attachmentObjectUrlsRef.current
      const currentLoading = loadingImageIdsRef.current
      const currentErrors = imageLoadErrorsRef.current

      const toLoad = imageAttachments.filter(
        (attachment) =>
          !currentUrls[attachment.id] &&
          !currentLoading[attachment.id] &&
          !currentErrors[attachment.id]
      )

      for (const attachment of toLoad) {
        if (disposed) return
        setLoadingImageIds((prev) => ({ ...prev, [attachment.id]: true }))

        try {
          const { blob, contentType } = await fetchChatAttachmentBlob(attachment.id)
          const effectiveType = blob.type || contentType

          if (!effectiveType || !effectiveType.startsWith("image/")) {
            throw new Error(`Unexpected content type: ${effectiveType || "unknown"}`)
          }
          if (blob.size === 0) {
            throw new Error("Empty image blob")
          }

          const objectUrl = URL.createObjectURL(blob)

          if (disposed) {
            URL.revokeObjectURL(objectUrl)
            return
          }

          setAttachmentObjectUrls((prev) => {
            if (prev[attachment.id]) {
              URL.revokeObjectURL(objectUrl)
              return prev
            }
            return { ...prev, [attachment.id]: objectUrl }
          })

          setImageLoadErrors((prev) => {
            if (!prev[attachment.id]) return prev
            const next = { ...prev }
            delete next[attachment.id]
            return next
          })
        } catch (err) {
          console.error("IMAGE LOAD ERROR", err)
          if (!disposed) {
            setImageLoadErrors((prev) => ({
              ...prev,
              [attachment.id]: "Не удалось загрузить изображение",
            }))
          }
        } finally {
          if (!disposed) {
            setLoadingImageIds((prev) => {
              const next = { ...prev }
              delete next[attachment.id]
              return next
            })
          }
        }
      }
    }

    void loadMissing()

    return () => {
      disposed = true
    }
  }, [imageAttachments])

  useEffect(() => {
    return () => {
      for (const url of Object.values(attachmentObjectUrlsRef.current)) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const previewUrl of selectedImagePreviews) {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
      }
    }
  }, [selectedImagePreviews])

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

  function clearAttachmentCloseTimer() {
    if (attachmentCloseTimerRef.current) {
      window.clearTimeout(attachmentCloseTimerRef.current)
      attachmentCloseTimerRef.current = null
    }
  }

  function scheduleAttachmentClose() {
    clearAttachmentCloseTimer()
    attachmentCloseTimerRef.current = window.setTimeout(() => {
      setShowAttachmentMenu(false)
    }, 180)
  }

  function appendEmoji(emoji: string) {
    setText((prev) => `${prev}${emoji}`)
    setShowEmojiPicker(false)
    clearEmojiCloseTimer()
  }

  function pickFiles(nextFiles: FileList | null, allowed: Set<string>) {
    if (!nextFiles) return

    const accepted: File[] = []

    for (const file of Array.from(nextFiles)) {
      if (!allowed.has(file.type)) {
        alert(`Файл ${file.name}: неподдерживаемый тип`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`Файл ${file.name}: размер больше 10 MB`)
        continue
      }
      accepted.push(file)
    }

    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted])
    }
  }

  async function handleToggleChatPin() {
    if (!activeChat) return
    if (activeChat.type === "global") return

    try {
      if (activeChat.is_pinned) {
        await unpinChat(activeChat.id)
      } else {
        await pinChat(activeChat.id)
      }
      await loadChats(activeChat.id)
    } catch {
      alert("Не удалось изменить закрепление чата")
    }
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!activeChatId) return

    const value = text.trim()
    if (!value && files.length === 0) return

    try {
      setSending(true)
      setError(null)

      const created = await createChatMessage({
        chatId: activeChatId,
        text: value,
        files,
      })

      setMessages((prev) => [...prev, created])
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
              ...chat,
              unread_count: 0,
              last_message_preview: created.text || (created.attachments.length ? "Вложение" : ""),
              last_message_at: created.created_at,
            }
            : chat
        )
      )

      setText("")
      setFiles([])
      setShowEmojiPicker(false)
      setShowAttachmentMenu(false)

      requestAnimationFrame(() => {
        const container = messagesContainerRef.current
        if (!container) return
        container.scrollTop = container.scrollHeight
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
    if (!activeChatId || !confirm("Удалить сообщение?")) return

    try {
      const updated = await deleteChatMessage(activeChatId, message.id)
      setMessages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch {
      alert("Не удалось удалить сообщение")
    }
  }

  async function handleTogglePin(message: ChatMessage) {
    if (!activeChatId) return

    try {
      const updated = message.is_pinned
        ? await unpinChatMessage(activeChatId, message.id)
        : await pinChatMessage(activeChatId, message.id)

      setMessages((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch {
      alert("Не удалось изменить закрепление")
    }
  }

  async function handleOpenDirect(employee: Employee) {
    if (!employee.user_id) return

    try {
      const chat = await getOrCreateDirectChat(employee.user_id)
      const nextChats = await getChats()
      setChats(nextChats)
      setActiveChatId(chat.id)
      setShowDirectModal(false)
      setEmployeeSearch("")
      setEmployeeResults([])
      await loadMessages(chat.id)
    } catch {
      alert("Не удалось открыть личный чат")
    }
  }

  async function handleDownloadAttachment(attachment: ChatAttachment) {
    try {
      await downloadChatAttachment(attachment)
    } catch (err) {
      console.error("ATTACHMENT DOWNLOAD ERROR", err)
      alert("Не удалось скачать вложение")
    }
  }

  function handleRetryImageLoad(attachment: ChatAttachment) {
    setImageLoadErrors((prev) => {
      const next = { ...prev }
      delete next[attachment.id]
      return next
    })
    setLoadingImageIds((prev) => {
      const next = { ...prev }
      delete next[attachment.id]
      return next
    })
  }

  function renderAttachments(message: ChatMessage, isOwn: boolean) {
    if (message.is_deleted || !message.attachments.length) return null

    return (
      <div className="mt-2 space-y-2">
        {message.attachments.map((attachment) => {
          if (attachment.attachment_type === "image") {
            const src = attachmentObjectUrls[attachment.id]
            const loadingImage = loadingImageIds[attachment.id]
            const loadError = imageLoadErrors[attachment.id]

            return (
              <div key={attachment.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                <button
                  type="button"
                  onClick={() => src && setActiveImage({ src, name: attachment.filename })}
                  disabled={!src || Boolean(loadError)}
                  className="block max-w-full overflow-hidden rounded-2xl border border-border/70 bg-muted/15 text-left transition hover:border-border disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {src ? (
                    <img src={src} alt={attachment.filename} className="max-h-72 w-full object-cover" />
                  ) : loadError ? (
                    <div className="space-y-2 p-3">
                      <p className="text-sm text-red-600">{loadError}</p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleRetryImageLoad(attachment)
                        }}
                        className="rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-accent"
                      >
                        Повторить
                      </button>
                    </div>
                  ) : (
                    <div className="flex h-44 items-center justify-center gap-2 bg-muted/30 px-6 text-sm text-muted-foreground">
                      {loadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Загрузка изображения...
                    </div>
                  )}
                </button>
              </div>
            )
          }

          return (
            <div key={attachment.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
              <button
                type="button"
                onClick={() => void handleDownloadAttachment(attachment)}
                className="flex max-w-full items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/15 px-3 py-2.5 text-sm transition hover:border-border hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="truncate text-left">{attachment.filename}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{fileSizeLabel(attachment.file_size)}</span>
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  function renderMessageCard(message: ChatMessage) {
    const isOwn = user?.id === message.author_id
    const canDelete = isOwn || canModerate

    return (
      <div
        key={message.id}
        className={cn("flex w-full", isOwn ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "chat-message-card w-full max-w-[85%] overflow-hidden rounded-2xl border px-4 py-3 sm:max-w-[78%]",
            message.is_deleted && "opacity-80",
            isOwn
              ? "border-indigo-200/70 bg-indigo-50/70 dark:border-sky-500/25 dark:bg-sky-500/10"
              : "border-border/65 bg-muted/20"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {!isOwn ? (
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[15px] font-semibold leading-5">
                    {message.author_name ?? "Неизвестно"}
                  </span>
                </div>
              ) : null}

              {message.is_deleted ? (
                <p className={cn("mt-1 italic text-[14px] leading-5 text-muted-foreground", isOwn && "text-right")}>
                  Сообщение удалено
                </p>
              ) : message.text ? (
                <p className={cn("mt-1 whitespace-pre-wrap break-words text-[14px] leading-5", isOwn && "text-right")}>
                  {message.text}
                </p>
              ) : null}

              {renderAttachments(message, isOwn)}

              <div className={cn("mt-1 flex", isOwn ? "justify-end" : "justify-start")}>
                <MessageMeta message={message} isDirect={Boolean(isDirectChat)} />
              </div>
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
      </div>
    )
  }

  return (
    <div className="chat-page mx-auto max-w-7xl space-y-6 pb-10">
      <section className="chat-hero relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/95">
        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-muted-foreground">Внутренние коммуникации</p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[2rem]">
              Чаты
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Общий чат компании и личные диалоги сотрудников
            </p>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowDirectModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Новый чат
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/[0.07] blur-3xl dark:bg-sky-500/[0.08]" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-sky-500/[0.06] blur-3xl dark:bg-indigo-500/[0.06]" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="chat-card overflow-hidden">
          <div className="border-b border-border bg-muted/25 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Список чатов</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Общий чат и личные переписки</p>
          </div>

          <div className="max-h-[70vh] space-y-1 overflow-y-auto p-2">
            {loadingChats ? (
              <div className="flex items-center justify-center px-4 py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загрузка чатов...
              </div>
            ) : chats.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Чатов пока нет</div>
            ) : (
              chats.map((chat) => {
                const isActive = activeChatId === chat.id
                const unread = chat.unread_count ?? 0

                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setActiveChatId(chat.id)}
                    className={cn(
                      "group w-full rounded-2xl border px-3 py-3 text-left transition",
                      isActive
                        ? "border-border bg-muted/45 shadow-sm"
                        : "border-transparent hover:border-border/60 hover:bg-muted/25"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{chat.title}</p>
                          {chat.is_pinned ? <Pin className="h-3.5 w-3.5 text-yellow-600" /> : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{chatSubtitle(chat)}</p>

                        {chat.last_message_preview ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {chat.last_message_preview}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground/70">Сообщений пока нет</p>
                        )}

                        {chat.last_message_at ? (
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            {formatRelative(chat.last_message_at)}
                          </p>
                        ) : null}
                      </div>

                      {unread > 0 ? (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-sky-500">
                          {unread}
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="chat-card overflow-hidden">
          {activeChat ? (
            <>
              <div className="border-b border-border bg-muted/25 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="truncate text-base font-semibold">{activeChat.title}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{chatSubtitle(activeChat)}</p>
                  </div>

                  {activeChat.type !== "global" ? (
                    <button
                      type="button"
                      onClick={() => void handleToggleChatPin()}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-accent"
                    >
                      {activeChat.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      {activeChat.is_pinned ? "Открепить чат" : "Закрепить чат"}
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
                      <Pin className="h-4 w-4 text-yellow-600" />
                      Главный чат
                    </div>
                  )}
                </div>
              </div>

              {primaryPinnedMessage && (
                <div className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => setShowPinnedDetails((prev) => !prev)}
                    className="flex w-full items-center gap-3 overflow-hidden px-4 py-3 text-left transition hover:bg-accent/50"
                  >
                    <Pin className="h-4 w-4 shrink-0 text-yellow-600" />
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
                          {primaryPinnedMessage.text || "Вложение"}
                        </span>
                      </div>
                    </div>
                    {showPinnedDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {showPinnedDetails && (
                    <div className="max-h-[220px] space-y-2 overflow-y-auto border-t border-border p-3">
                      {pinnedMessages.map((message) => renderMessageCard(message))}
                    </div>
                  )}
                </div>
              )}

              <div
                ref={messagesContainerRef}
                className="min-h-[360px] max-h-[55vh] space-y-2 overflow-y-auto px-4 py-4 sm:px-5"
              >
                {loadingMessages && messages.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                    Загрузка сообщений...
                  </div>
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

              <form onSubmit={handleSend} className="border-t border-border bg-card p-4 sm:p-5">
                <div className="space-y-3">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        if (!sending && (text.trim() || files.length > 0)) {
                          void handleSend()
                        }
                      }
                    }}
                    placeholder={`Написать в «${activeChat.title}»...`}
                    className="chat-input min-h-[74px] max-h-[140px] w-full resize-none rounded-2xl px-4 py-3 text-[14px] outline-none"
                    maxLength={4000}
                  />

                  {files.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {files.map((file, index) => {
                        const isImage = IMAGE_TYPES.has(file.type)
                        const previewUrl = selectedImagePreviews[index]

                        return (
                          <div key={`${file.name}-${index}`} className="rounded-2xl border border-border/70 bg-muted/15 p-2.5">
                            {isImage ? (
                              <img
                                src={previewUrl ?? ""}
                                alt={file.name}
                                className="mb-2 h-24 w-full rounded-xl object-cover"
                              />
                            ) : (
                              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="truncate text-sm font-medium">{file.name}</div>
                            <div className="text-xs text-muted-foreground">{fileSizeLabel(file.size)}</div>
                            <button
                              type="button"
                              onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                              className="mt-1 inline-flex items-center gap-1 text-xs text-red-600"
                            >
                              <X className="h-3 w-3" />
                              Убрать
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="relative"
                        onMouseEnter={clearEmojiCloseTimer}
                        onMouseLeave={scheduleEmojiClose}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            clearEmojiCloseTimer()
                            setShowEmojiPicker((prev) => !prev)
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm transition hover:bg-accent"
                        >
                          <Smile className="h-4 w-4" />
                          Эмодзи
                        </button>

                        {showEmojiPicker && (
                          <div className="absolute bottom-full left-0 z-50 mb-2 w-[220px] rounded-2xl border border-border bg-background p-3 shadow-xl">
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

                      <div
                        className="relative"
                        onMouseEnter={clearAttachmentCloseTimer}
                        onMouseLeave={scheduleAttachmentClose}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            clearAttachmentCloseTimer()
                            setShowAttachmentMenu((prev) => !prev)
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm transition hover:bg-accent"
                        >
                          <Paperclip className="h-4 w-4" />
                          Вложение
                        </button>

                        {showAttachmentMenu && (
                          <div className="absolute bottom-full left-0 z-50 mb-2 w-44 rounded-2xl border border-border bg-background p-2 shadow-xl">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAttachmentMenu(false)
                                imageInputRef.current?.click()
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition hover:bg-accent"
                            >
                              <FileImage className="h-4 w-4" />
                              Фото
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAttachmentMenu(false)
                                documentInputRef.current?.click()
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition hover:bg-accent"
                            >
                              <FileText className="h-4 w-4" />
                              Файл
                            </button>
                          </div>
                        )}
                      </div>

                      <input
                        ref={imageInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={(e) => pickFiles(e.target.files, IMAGE_TYPES)}
                      />

                      <input
                        ref={documentInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                        onChange={(e) => pickFiles(e.target.files, DOCUMENT_TYPES)}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">{text.length}/4000</p>
                      <button
                        type="submit"
                        disabled={sending || (!text.trim() && files.length === 0)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {sending ? "Отправка..." : "Отправить"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center text-muted-foreground">
              <MessageCircle className="mb-4 h-12 w-12 opacity-35" />
              <p className="text-base font-medium text-foreground/70">Выберите чат</p>
              <p className="mt-1 max-w-sm text-sm">
                Откройте общий чат или начните личный диалог с сотрудником
              </p>
            </div>
          )}
        </section>
      </div>

      {showDirectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4" onClick={() => setShowDirectModal(false)}>
          <div
            className="mx-auto mt-20 w-full max-w-xl rounded-2xl border border-border bg-background p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Новая личка</h2>
              <button type="button" onClick={() => setShowDirectModal(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Поиск по ФИО, email, должности..."
              className="chat-input w-full rounded-xl px-3 py-2 text-sm outline-none"
            />

            <div className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto">
              {employeeLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Поиск...</div>
              ) : employeeResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Сотрудники не найдены</div>
              ) : (
                employeeResults.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => void handleOpenDirect(employee)}
                    className="w-full rounded-xl border border-border/70 px-3 py-2.5 text-left transition hover:bg-accent"
                  >
                    <div className="font-medium">{employee.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {employee.email} · {employee.position}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeImage && (
        <div className="fixed inset-0 z-50 bg-black/80 p-4" onClick={() => setActiveImage(null)}>
          <div className="mx-auto mt-10 max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveImage(null)}
                className="rounded-full border border-white/30 p-2 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img src={activeImage.src} alt={activeImage.name} className="mx-auto max-h-[80vh] rounded-lg" />
          </div>
        </div>
      )}

      <style>{`
        .chat-hero {
          border-radius: 2rem;
          border: 1px solid hsl(var(--border));
          background:
            radial-gradient(circle at top right, rgb(56 189 248 / 0.08), transparent 30%),
            radial-gradient(circle at bottom left, rgb(99 102 241 / 0.08), transparent 28%),
            hsl(var(--card));
          box-shadow:
            -20px 0 40px -18px rgb(99 102 241 / 0.22),
            20px 0 40px -18px rgb(14 165 233 / 0.18),
            0 6px 22px -10px rgb(99 102 241 / 0.12);
        }
        .chat-card {
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          box-shadow:
            -10px 0 20px -14px rgb(99 102 241 / 0.14),
            10px 0 20px -14px rgb(14 165 233 / 0.1),
            0 1px 3px rgb(0 0 0 / 0.04);
        }
        .chat-message-card {
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }
        .chat-message-card:hover {
          border-color: hsl(var(--border));
          box-shadow: 0 4px 14px rgb(0 0 0 / 0.04);
        }
        .chat-input {
          border: 1px solid rgb(209 213 219);
          background: rgb(249 250 251);
          color: rgb(17 24 39);
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .chat-input::placeholder { color: rgb(156 163 175); }
        .chat-input:hover {
          border-color: rgb(156 163 175);
          background: rgb(255 255 255);
        }
        .chat-input:focus {
          border-color: rgb(99 102 241);
          background: rgb(255 255 255);
          box-shadow: 0 0 0 3px rgb(99 102 241 / 0.15);
        }
        .dark .chat-input {
          border-color: rgb(51 65 85);
          background: rgb(30 41 59);
          color: rgb(241 245 249);
        }
        .dark .chat-input::placeholder { color: rgb(100 116 139); }
        .dark .chat-input:hover {
          border-color: rgb(71 85 105);
          background: rgb(35 46 66);
        }
        .dark .chat-input:focus {
          border-color: rgb(56 189 248);
          background: rgb(35 46 66);
          box-shadow: 0 0 0 3px rgb(56 189 248 / 0.2);
        }
      `}</style>
    </div>
  )
}