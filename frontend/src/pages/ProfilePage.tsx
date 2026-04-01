import { useEffect, useMemo, useRef, useState } from "react"
import { Building2, CalendarDays, Camera, Mail, Phone, Save, User2 } from "lucide-react"

import { formatDateTime } from "@/lib/utils"
import { getProfile, updateProfile, uploadProfilePhoto } from "@/shared/api/profile"
import type { Employee } from "@/shared/types"

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/?$/, "") ||
  window.location.origin

function getPhotoUrl(photoUrl?: string | null): string | null {
  if (!photoUrl) return null
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl
  return `${API_BASE}${photoUrl}`
}

function toDateInputValue(dateStr?: string | null): string {
  if (!dateStr) return ""
  return String(dateStr).slice(0, 10)
}

function formatDateLabel(dateStr?: string | null): string {
  if (!dateStr) return "—"
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("ru-RU")
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [mobilePhone, setMobilePhone] = useState("")
  const [internalPhone, setInternalPhone] = useState("")
  const [roomNumber, setRoomNumber] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [vacationStart, setVacationStart] = useState("")
  const [vacationEnd, setVacationEnd] = useState("")

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadProfile()
  }, [])

  function syncForm(data: Employee) {
    setProfile(data)
    setMobilePhone(data.mobile_phone ?? "")
    setInternalPhone(data.internal_phone ?? "")
    setRoomNumber(data.room_number ?? "")
    setBirthDate(toDateInputValue(data.birth_date))
    setVacationStart(toDateInputValue(data.vacation_start))
    setVacationEnd(toDateInputValue(data.vacation_end))
  }

  async function loadProfile() {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const data = await getProfile()
      syncForm(data)
    } catch (err) {
      console.error("PROFILE LOAD ERROR:", err)
      setError("Не удалось загрузить профиль")
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!profile) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const updated = await updateProfile({
        mobile_phone: mobilePhone.trim() || null,
        internal_phone: internalPhone.trim() || null,
        room_number: roomNumber.trim() || null,
        birth_date: birthDate || null,
        vacation_start: vacationStart || null,
        vacation_end: vacationEnd || null,
      })

      syncForm(updated)
      setSuccess("Профиль сохранён")
    } catch (err) {
      console.error("PROFILE SAVE ERROR:", err)
      setError("Не удалось сохранить профиль")
    } finally {
      setSaving(false)
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setUploadingPhoto(true)
      setError(null)
      setSuccess(null)

      const updated = await uploadProfilePhoto(file)
      syncForm(updated)
      setSuccess("Фото обновлено")
    } catch (err) {
      console.error("PHOTO UPLOAD ERROR:", err)
      setError("Не удалось загрузить фото")
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const photoUrl = useMemo(() => getPhotoUrl(profile?.photo_url), [profile?.photo_url])

  const vacationStatus = useMemo(() => {
    if (!profile?.vacation_start || !profile?.vacation_end) {
      return "Отпуск не задан"
    }

    if (profile.is_on_vacation) {
      return "Сейчас в отпуске"
    }

    return "Отпуск запланирован"
  }, [profile])

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Профиль</h1>
        <div className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">
          Профиль не найден
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Профиль</h1>
        <p className="mt-1 text-sm text-muted-foreground">Личные данные, контакты и отпуск</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={profile.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User2 className="h-14 w-14 text-muted-foreground" />
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-2 right-0 rounded-full border border-border bg-background p-3 shadow-sm transition hover:bg-accent disabled:opacity-60"
                title="Загрузить фото"
              >
                <Camera className="h-4 w-4" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <h2 className="mt-5 text-2xl font-semibold">{profile.full_name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{profile.position}</p>

            <div className="mt-6 w-full space-y-3 text-left">
              <div className="flex items-start gap-3 rounded-xl border border-border p-4">
                <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{profile.email || "—"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border p-4">
                <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Отдел</p>
                  <p className="text-sm font-medium">{profile.department_name || "—"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border p-4">
                <User2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Руководитель</p>
                  <p className="text-sm font-medium">{profile.manager_name || "—"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border p-4">
                <CalendarDays className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Создано</p>
                  <p className="text-sm font-medium">{formatDateTime(profile.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-5">
              <h3 className="text-lg font-semibold">Контакты</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Данные, по которым с вами связываются внутри компании
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Мобильный телефон
                </span>
                <input
                  value={mobilePhone}
                  onChange={(e) => setMobilePhone(e.target.value)}
                  placeholder="Введите мобильный телефон"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
                />
              </label>

              <label className="space-y-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  Внутренний телефон
                </span>
                <input
                  value={internalPhone}
                  onChange={(e) => setInternalPhone(e.target.value)}
                  placeholder="Введите внутренний телефон"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Кабинет</span>
                <input
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Введите кабинет"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium">Дата рождения</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Отпуск</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Период вашего отпуска для отображения в системе
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${profile.is_on_vacation ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
                  }`}
              >
                {vacationStatus}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Дата начала отпуска</span>
                <input
                  type="date"
                  value={vacationStart}
                  onChange={(e) => setVacationStart(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium">Дата окончания отпуска</span>
                <input
                  type="date"
                  value={vacationEnd}
                  onChange={(e) => setVacationEnd(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Текущий период</p>
                <p className="mt-1 text-sm font-medium">
                  {formatDateLabel(profile.vacation_start)} — {formatDateLabel(profile.vacation_end)}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Статус</p>
                <p className="mt-1 text-sm font-medium">
                  {profile.is_on_vacation ? "Сотрудник в отпуске" : "Сотрудник работает"}
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}