import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { createTicket, getTicketCategories } from "@/shared/api/tickets"
import type { TicketCategory, TicketPriority } from "@/shared/types"

export default function TicketCreatePage() {
  const navigate = useNavigate()

  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TicketPriority>("normal")
  const [categoryId, setCategoryId] = useState("")

  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTicketCategories()
      .then(setCategories)
      .catch((err) => {
        console.error("Ошибка загрузки категорий:", err)
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
      })

      navigate(`/tickets/${ticket.id}`)
    } catch (err: any) {
      console.error(err)
      console.log("BACKEND ERROR:", err.response?.data)
      setError("Не удалось создать заявку")
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
          className="w-full border rounded-lg px-3 py-2"
          required
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание"
          className="w-full border rounded-lg px-3 py-2 min-h-[120px]"
          required
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
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
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="now">Сейчас</option>
          <option value="today">Сегодня</option>
          <option value="normal">В рабочем порядке</option>
        </select>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          {loading ? "Создание..." : "Создать"}
        </button>
      </form>
    </div>
  )
}