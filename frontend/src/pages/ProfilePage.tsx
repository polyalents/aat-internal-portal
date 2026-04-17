import { useEffect, useMemo, useRef, useState } from "react"
import {
  Building2,
  CalendarDays,
  Camera,
  Check,
  Info,
  Loader2,
  Mail,
  Phone,
  Save,
  Smartphone,
  User2,
  X,
} from "lucide-react"

import { formatDateTime } from "@/lib/utils"
import { getProfile, updateProfile, uploadProfilePhoto } from "@/shared/api/profile"
import type { Employee } from "@/shared/types"

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/?$/, "") ||
  window.location.origin

const HINT_DISMISSED_KEY = "profile_save_hint_dismissed"

function getPhotoUrl(photoUrl?: string | null): string | null {
  if (!photoUrl) return null
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl
  return `${API_BASE}${photoUrl}`
}

function toDateInputValue(dateStr?: string | null): string {
  if (!dateStr) return ""
  return String(dateStr).slice(0, 10)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?"
  return (parts[0][0] + parts[1][0]).toUpperCase()
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

  const [showHint, setShowHint] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void loadProfile()
    try {
      if (!localStorage.getItem(HINT_DISMISSED_KEY)) setShowHint(true)
    } catch { setShowHint(true) }
  }, [])

  function dismissHint() {
    setShowHint(false)
    try { localStorage.setItem(HINT_DISMISSED_KEY, "1") } catch { /* ignore */ }
  }

  function syncForm(data: Employee) {
    setProfile(data)
    setMobilePhone(data.mobile_phone ?? "")
    setInternalPhone(data.internal_phone ?? "")
    setRoomNumber(data.room_number ?? "")
    setBirthDate(toDateInputValue(data.birth_date))
  }

  async function loadProfile() {
    try {
      setLoading(true); setError(null); setSuccess(null)
      const data = await getProfile()
      syncForm(data)
    } catch (err) {
      console.error("PROFILE LOAD ERROR:", err)
      setError("Не удалось загрузить профиль")
    } finally { setLoading(false) }
  }

  async function handleSave() {
    if (!profile) return
    try {
      setSaving(true); setError(null); setSuccess(null)
      const updated = await updateProfile({
        mobile_phone: mobilePhone.trim() || null,
        internal_phone: internalPhone.trim() || null,
        room_number: roomNumber.trim() || null,
        birth_date: birthDate || null,
      })
      syncForm(updated)
      setSuccess("Профиль сохранён")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error("PROFILE SAVE ERROR:", err)
      setError("Не удалось сохранить профиль")
    } finally { setSaving(false) }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setUploadingPhoto(true); setError(null); setSuccess(null)
      const updated = await uploadProfilePhoto(file)
      syncForm(updated)
      setSuccess("Фото обновлено")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error("PHOTO UPLOAD ERROR:", err)
      setError("Не удалось загрузить фото")
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const photoUrl = useMemo(() => getPhotoUrl(profile?.photo_url), [profile?.photo_url])
  const initials = useMemo(() => getInitials(profile?.full_name ?? ""), [profile?.full_name])

  const isDirty = useMemo(() => {
    if (!profile) return false
    return (
      (mobilePhone.trim() || null) !== (profile.mobile_phone ?? null) ||
      (internalPhone.trim() || null) !== (profile.internal_phone ?? null) ||
      (roomNumber.trim() || null) !== (profile.room_number ?? null) ||
      (birthDate || null) !== (toDateInputValue(profile.birth_date) || null)
    )
  }, [profile, mobilePhone, internalPhone, roomNumber, birthDate])

  useEffect(() => {
    if (isDirty && showHint) dismissHint()
  }, [isDirty, showHint])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <div className="rounded-lg border border-border bg-card p-6 text-muted-foreground">Профиль не найден</div>
      </div>
    )
  }

  return (
    <div className="profile-page relative mx-auto max-w-6xl space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Профиль</h1>
        <p className="mt-1 text-sm text-muted-foreground">Управление личной информацией и контактами</p>
      </div>

      {showHint && (
        <div className="profile-hint relative flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 dark:border-sky-500/30 dark:bg-sky-500/10">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-sky-500/20 dark:text-sky-300">
            <Info className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-indigo-900 dark:text-sky-100">Как сохранить изменения</p>
            <p className="mt-0.5 text-xs text-indigo-700/80 dark:text-sky-200/70">
              Начните редактировать любое поле — внизу экрана появится кнопка «Сохранить».
              Изменения не применятся, пока вы её не нажмёте.
            </p>
          </div>
          <button type="button" onClick={dismissHint} className="shrink-0 rounded-md p-1 text-indigo-500 transition hover:bg-indigo-100 dark:text-sky-300 dark:hover:bg-sky-500/20" title="Скрыть подсказку">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Check className="h-4 w-4" />{success}
        </div>
      )}

      {/* Two columns — aligned to top */}
      <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
        {/* LEFT: identity + read-only info */}
        <aside className="profile-card-hero overflow-hidden lg:sticky lg:top-4">
          <div className="flex flex-col items-center p-6 text-center">
            <div className="relative">
              <div className="h-28 w-28 overflow-hidden rounded-full ring-2 ring-indigo-100 dark:ring-sky-500/20">
                {photoUrl ? (
                  <img src={photoUrl} alt={profile.full_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-sky-500 text-3xl font-semibold text-white dark:from-sky-500 dark:to-indigo-600">{initials}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-card bg-indigo-600 text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-600"
                title="Загрузить фото"
              >
                {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoChange} />
            </div>
            <h2 className="mt-4 text-lg font-semibold leading-tight">{profile.full_name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{profile.position || "Должность не указана"}</p>
          </div>

          <div className="mx-6 border-t border-border" />

          <div className="divide-y divide-border/60">
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={profile.email || "—"} />
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Отдел" value={profile.department_name || "—"} />
            <InfoRow icon={<User2 className="h-4 w-4" />} label="Руководитель" value={profile.manager_name || "—"} />
            <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="В компании с" value={formatDateTime(profile.created_at)} />
          </div>

          <div className="border-t border-border px-5 py-3">
            <p className="text-[11px] text-muted-foreground">Данные из кадровой системы изменяются только администратором</p>
          </div>
        </aside>

        {/* RIGHT: editable form */}
        <section className="profile-card-plain overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">Личные контакты</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Эти данные видят коллеги во внутренних справочниках</p>
              </div>
              {isDirty && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Черновик</span>
              )}
            </div>
          </div>

          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <Field label="Мобильный телефон" icon={<Smartphone className="h-3.5 w-3.5" />}>
              <input value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} placeholder="+7 999 000 00 00" className="profile-input" />
            </Field>
            <Field label="Внутренний телефон" icon={<Phone className="h-3.5 w-3.5" />}>
              <input value={internalPhone} onChange={(e) => setInternalPhone(e.target.value)} placeholder="Например, 1234" className="profile-input" />
            </Field>
            <Field label="Кабинет">
              <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Например, 305" className="profile-input" />
            </Field>
            <Field label="Дата рождения" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="profile-input" />
            </Field>
          </div>

          <div className="border-t border-border bg-muted/20 px-6 py-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Не забудьте нажать «Сохранить» — кнопка появится внизу при изменениях
            </p>
          </div>
        </section>
      </div>

      {isDirty && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 duration-300 animate-in slide-in-from-bottom-4">
          <div className="save-bar-glow flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              Есть несохранённые изменения
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-600"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .profile-card-hero {
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          box-shadow:
            -18px 0 36px -14px rgb(99 102 241 / 0.35),
            18px 0 36px -14px rgb(14 165 233 / 0.3),
            0 4px 24px -8px rgb(99 102 241 / 0.15),
            0 1px 2px rgb(0 0 0 / 0.04);
        }
        .dark .profile-card-hero {
          box-shadow:
            -20px 0 40px -12px rgb(56 189 248 / 0.3),
            20px 0 40px -12px rgb(139 92 246 / 0.25),
            0 4px 24px -8px rgb(56 189 248 / 0.15),
            0 1px 2px rgb(0 0 0 / 0.4);
        }
        .profile-card-plain {
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          box-shadow:
            -14px 0 28px -14px rgb(99 102 241 / 0.22),
            14px 0 28px -14px rgb(14 165 233 / 0.18),
            0 1px 2px rgb(0 0 0 / 0.03);
        }
        .dark .profile-card-plain {
          box-shadow:
            -16px 0 32px -12px rgb(56 189 248 / 0.2),
            16px 0 32px -12px rgb(139 92 246 / 0.18),
            0 1px 2px rgb(0 0 0 / 0.4);
        }
        .save-bar-glow {
          box-shadow:
            0 10px 40px -10px rgb(99 102 241 / 0.4),
            0 4px 12px rgb(0 0 0 / 0.1);
        }
        .dark .save-bar-glow {
          box-shadow:
            0 10px 40px -10px rgb(56 189 248 / 0.4),
            0 4px 12px rgb(0 0 0 / 0.4);
        }
        .profile-hint {
          animation: profile-hint-glow 3s ease-in-out infinite;
        }
        @keyframes profile-hint-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgb(99 102 241 / 0); }
          50% { box-shadow: 0 0 0 6px rgb(99 102 241 / 0.08); }
        }
        .dark .profile-hint { animation-name: profile-hint-glow-dark; }
        @keyframes profile-hint-glow-dark {
          0%, 100% { box-shadow: 0 0 0 0 rgb(56 189 248 / 0); }
          50% { box-shadow: 0 0 0 6px rgb(56 189 248 / 0.1); }
        }
        .profile-input {
          display: block; width: 100%; border-radius: 0.5rem;
          border: 1px solid rgb(209 213 219); background: rgb(249 250 251);
          padding: 0.625rem 0.875rem; font-size: 0.875rem; line-height: 1.25rem;
          color: rgb(17 24 39); outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .profile-input::placeholder { color: rgb(156 163 175); }
        .profile-input:hover { border-color: rgb(156 163 175); background: rgb(255 255 255); }
        .profile-input:focus {
          border-color: rgb(99 102 241); background: rgb(255 255 255);
          box-shadow: 0 0 0 3px rgb(99 102 241 / 0.15);
        }
        .dark .profile-input {
          border-color: rgb(51 65 85); background: rgb(30 41 59); color: rgb(241 245 249);
        }
        .dark .profile-input::placeholder { color: rgb(100 116 139); }
        .dark .profile-input:hover { border-color: rgb(71 85 105); background: rgb(35 46 66); }
        .dark .profile-input:focus {
          border-color: rgb(56 189 248); background: rgb(35 46 66);
          box-shadow: 0 0 0 3px rgb(56 189 248 / 0.2);
        }
      `}</style>
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
      </span>
      {children}
    </label>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 dark:bg-sky-500/15 dark:text-sky-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium leading-tight">{value}</p>
      </div>
    </div>
  )
}