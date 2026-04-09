import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { isAxiosError } from "axios"

import { getProfile } from "@/shared/api/profile"
import { createTicket, getTicketCategories, uploadAttachment } from "@/shared/api/tickets"
import type { TicketCategory, TicketPriority } from "@/shared/types"

export default function TicketCreatePage() {
  const navigate = useNavigate()

  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TicketPriority>("normal")
  const [categoryId, setCategoryId] = useState("")

  const [contactPhone, setContactPhone] = useState("")
  const [internalPhone, setInternalPhone] = useState("")
  const [roomNumber, setRoomNumber] = useState("")
  const [email, setEmail] = useState("")

  const [attachments, setAttachments] = useState<File[]>([])

  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTicketCategories()
      .then(setCategories)
      .catch((err) => {
        console.error("Ошибка загрузки категорий:", err)
      })

    getProfile()
      .then((profile) => {
        setContactPhone(profile.mobile_phone ?? "")
        setInternalPhone(profile.internal_phone ?? "")
        setRoomNumber(profile.room_number ?? "")
        setEmail(profile.email ?? "")
      })
      .catch((err) => {
        console.error("Ошибка загрузки профиля:", err)
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const ticket = await createTicket({
        subject,
        description,
        category_id: categoryId,
        priority,
        contact_phone: contactPhone || undefined,
        internal_phone: internalPhone || undefined,
        room_number: roomNumber || undefined,
        contact_email: email.trim() || undefined,
      })

      if (attachments.length > 0) {
        await Promise.all(attachments.map((file) => uploadAttachment(ticket.id, file)))
      }

      navigate(`/tickets/${ticket.id}`)
    } catch (err) {
      console.error(err)
      if (isAxiosError(err)) {
        setError(err.response?.data?.detail ?? "Не удалось создать заявку")
      } else {
        setError("Не удалось создать заявку")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Создать заявку</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Тема"
          className="w-full rounded-lg border px-3 py-2"
          required
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание"
          className="min-h-[120px] w-full rounded-lg border px-3 py-2"
          required
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border px-3 py-2"
          required
        >
          <option value="">Выбери категорию</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
          className="w-full rounded-lg border px-3 py-2"
        >
          <option value="now">Сейчас</option>
          <option value="today">Сегодня</option>
          <option value="normal">В рабочем порядке</option>
        </select>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Контактный телефон</label>
            <input
              value={contactPhone}
              readOnly
              className="w-full rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Внутренний телефон</label>
            <input
              value={internalPhone}
              readOnly
              className="w-full rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Кабинет</label>
            <input
              value={roomNumber}
              readOnly
              className="w-full rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="name@example.com"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-muted-foreground">Вложения</label>
          <input
            type="file"
            multiple
            onChange={(e) => setAttachments(Array.from(e.target.files ?? []))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          {attachments.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {attachments.map((file) => (
                <li key={`${file.name}-${file.lastModified}`}>{file.name}</li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white"
        >
          {loading ? "Создание..." : "Создать"}
        </button>
      </form>
    </div>
  )
}