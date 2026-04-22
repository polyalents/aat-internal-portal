import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  CodeXml,
  FileCode2,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Maximize2,
  Pilcrow,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"

import { cn } from "@/lib/utils"
import { uploadKnowledgeImage } from "@/shared/api/knowledge"
import ResizableImage from "@/components/knowledge/extensions/ResizableImage"

type RichTextEditorProps = {
  value: string
  onChange: (payload: { html: string; text: string }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

type ToolbarButtonProps = {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}

type EditorMode = "visual" | "html"
type ImageAlign = "left" | "center" | "right"

function ToolbarButton({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition",
        active
          ? "border-primary/30 bg-primary/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Введите текст...",
  disabled = false,
  className,
}: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const lastHtmlRef = useRef(value || "")
  const [mode, setMode] = useState<EditorMode>("visual")
  const [htmlValue, setHtmlValue] = useState(value || "")
  const [, forceSelectionState] = useState(0)

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto", "tel"],
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "knowledge-editor-image",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
        defaultAlignment: "left",
      }),
    ],
    [placeholder]
  )

  const editor = useEditor({
    editable: !disabled,
    extensions,
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "knowledge-editor-content min-h-[320px] focus:outline-none px-4 py-4 text-sm leading-7 text-foreground",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML()
      const text = currentEditor.getText()
      lastHtmlRef.current = html
      setHtmlValue(html)
      onChange({ html, text })
    },
    onSelectionUpdate: () => {
      forceSelectionState((prev) => prev + 1)
    },
    onTransaction: () => {
      forceSelectionState((prev) => prev + 1)
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    const normalized = value || ""

    if (!editor) {
      setHtmlValue(normalized)
      lastHtmlRef.current = normalized
      return
    }

    if (normalized === lastHtmlRef.current) return

    if (mode === "visual" && editor.getHTML() !== normalized) {
      editor.commands.setContent(normalized, { emitUpdate: false })
    }

    setHtmlValue(normalized)
    lastHtmlRef.current = normalized
  }, [value, editor, mode])

  function emitHtml(html: string) {
    if (!editor) return

    lastHtmlRef.current = html
    setHtmlValue(html)
    editor.commands.setContent(html || "", { emitUpdate: false })
    onChange({
      html,
      text: editor.getText(),
    })
  }

  function switchMode() {
    if (!editor) return

    if (mode === "visual") {
      const currentHtml = editor.getHTML()
      setHtmlValue(currentHtml)
      lastHtmlRef.current = currentHtml
      setMode("html")
      return
    }

    editor.commands.setContent(htmlValue || "", { emitUpdate: false })
    const html = editor.getHTML()
    const text = editor.getText()
    lastHtmlRef.current = html
    setHtmlValue(html)
    onChange({ html, text })
    setMode("visual")
  }

  function isStoredMarkActive(markName: "bold" | "italic" | "code") {
    if (!editor) return false
    if (editor.isActive(markName)) return true

    const storedMarks = editor.state.storedMarks ?? editor.state.selection.$from.marks()
    return storedMarks.some((mark) => mark.type.name === markName)
  }

  function toggleTextMark(mark: "bold" | "italic" | "code") {
    if (!editor) return

    const active = isStoredMarkActive(mark)

    if (mark === "bold") {
      if (active) {
        editor.chain().focus().unsetBold().run()
      } else {
        editor.chain().focus().setBold().run()
      }
      forceSelectionState((prev) => prev + 1)
      return
    }

    if (mark === "italic") {
      if (active) {
        editor.chain().focus().unsetItalic().run()
      } else {
        editor.chain().focus().setItalic().run()
      }
      forceSelectionState((prev) => prev + 1)
      return
    }

    if (active) {
      editor.chain().focus().unsetCode().run()
    } else {
      editor.chain().focus().setCode().run()
    }
    forceSelectionState((prev) => prev + 1)
  }

  function getImageAttrs(): { align: ImageAlign; width: string } {
    if (!editor) return { align: "left", width: "100%" }

    const attrs = editor.getAttributes("image") as {
      align?: ImageAlign
      width?: string
    }

    return {
      align: attrs.align || "left",
      width: attrs.width || "100%",
    }
  }

  function updateSelectedImage(next: Partial<{ align: ImageAlign; width: string }>) {
    if (!editor || !editor.isActive("image")) return
    editor.chain().focus().updateAttributes("image", next).run()
    forceSelectionState((prev) => prev + 1)
  }

  function getCurrentAlignment(): "left" | "center" | "right" {
    if (!editor) return "left"

    if (editor.isActive("image")) {
      return getImageAttrs().align
    }

    if (editor.isActive({ textAlign: "center" })) return "center"
    if (editor.isActive({ textAlign: "right" })) return "right"
    return "left"
  }

  function applyAlignment(align: "left" | "center" | "right") {
    if (!editor) return

    if (editor.isActive("image")) {
      updateSelectedImage({ align })
      return
    }

    editor.chain().focus().setTextAlign(align).run()
    forceSelectionState((prev) => prev + 1)
  }

  function promptImageWidth() {
    if (!editor || !editor.isActive("image")) return

    const current = getImageAttrs().width.replace("%", "")
    const entered = window.prompt("Ширина изображения в процентах", current || "100")
    if (entered === null) return

    const normalized = entered.trim().replace("%", "")
    const valueNum = Number(normalized)

    if (!Number.isFinite(valueNum) || valueNum <= 0 || valueNum > 1000) {
      window.alert("Введите число больше 0")
      return
    }

    updateSelectedImage({ width: `${valueNum}%` })
  }

  async function insertUploadedImage(file: File, fallbackName = "image") {
    if (!editor) return

    const uploaded = await uploadKnowledgeImage(file)

    editor
      .chain()
      .focus()
      .setImage({
        src: uploaded.url,
        alt: uploaded.filename || fallbackName,
        title: uploaded.filename || fallbackName,
      })
      .run()

    editor.chain().focus().updateAttributes("image", { width: "100%", align: "left" }).run()
    forceSelectionState((prev) => prev + 1)
  }

  async function handleImagePick(file: File | null) {
    if (!file || !editor) return

    try {
      await insertUploadedImage(file, file.name)
    } catch (error) {
      console.error("UPLOAD KNOWLEDGE IMAGE ERROR:", error)
      window.alert("Не удалось загрузить изображение")
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = ""
      }
    }
  }

  async function handlePasteImage(event: ClipboardEvent) {
    if (!editor || disabled) return

    const items = Array.from(event.clipboardData?.items ?? [])
    const imageItem = items.find((item) => item.type.startsWith("image/"))
    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return

    event.preventDefault()

    try {
      await insertUploadedImage(file, "pasted-image")
    } catch (error) {
      console.error("PASTE KNOWLEDGE IMAGE ERROR:", error)
      window.alert("Не удалось вставить изображение из буфера")
    }
  }

  useEffect(() => {
    if (!editor) return

    const dom = editor.view.dom
    const onPaste = (event: Event) => {
      void handlePasteImage(event as ClipboardEvent)
    }

    dom.addEventListener("paste", onPaste)
    return () => {
      dom.removeEventListener("paste", onPaste)
    }
  }, [editor, disabled])

  function handleSetLink() {
    if (!editor) return

    const previousUrl = (editor.getAttributes("link").href as string | undefined) || ""
    const url = window.prompt("Введите ссылку", previousUrl)

    if (url === null) return

    const normalized = url.trim()

    if (!normalized) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }

    const href =
      /^https?:\/\//i.test(normalized) ||
        /^mailto:/i.test(normalized) ||
        /^tel:/i.test(normalized)
        ? normalized
        : `https://${normalized}`

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
  }

  if (!editor) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card", className)}>
        <div className="flex h-[420px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  const isVisual = mode === "visual"
  const imageSelected = editor.isActive("image")
  const imageAttrs = getImageAttrs()
  const currentAlign = getCurrentAlignment()

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="border-b border-border bg-muted/25 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {isVisual && (
            <>
              <ToolbarButton
                title="Отменить"
                disabled={!editor.can().chain().focus().undo().run() || disabled}
                onClick={() => editor.chain().focus().undo().run()}
              >
                <Undo2 className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="Повторить"
                disabled={!editor.can().chain().focus().redo().run() || disabled}
                onClick={() => editor.chain().focus().redo().run()}
              >
                <Redo2 className="h-4 w-4" />
              </ToolbarButton>

              <div className="mx-1 h-9 w-px bg-border" />

              <ToolbarButton
                title="Жирный"
                active={isStoredMarkActive("bold")}
                disabled={disabled}
                onClick={() => toggleTextMark("bold")}
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="Курсив"
                active={isStoredMarkActive("italic")}
                disabled={disabled}
                onClick={() => toggleTextMark("italic")}
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="Цитата"
                active={editor.isActive("blockquote")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                <Quote className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="Код в строке"
                active={isStoredMarkActive("code")}
                disabled={disabled}
                onClick={() => toggleTextMark("code")}
              >
                <Code2 className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="Блок кода"
                active={editor.isActive("codeBlock")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              >
                <FileCode2 className="h-4 w-4" />
              </ToolbarButton>

              <div className="mx-1 h-9 w-px bg-border" />

              <ToolbarButton
                title="H1"
                active={editor.isActive("heading", { level: 1 })}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                <Heading1 className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="H2"
                active={editor.isActive("heading", { level: 2 })}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                <Heading2 className="h-4 w-4" />
              </ToolbarButton>

              <div className="mx-1 h-9 w-px bg-border" />

              <ToolbarButton
                title="Маркированный список"
                active={editor.isActive("bulletList")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <List className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="Нумерованный список"
                active={editor.isActive("orderedList")}
                disabled={disabled}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered className="h-4 w-4" />
              </ToolbarButton>

              <div className="mx-1 h-9 w-px bg-border" />

              <ToolbarButton
                title="Ссылка"
                active={editor.isActive("link")}
                disabled={disabled}
                onClick={handleSetLink}
              >
                <LinkIcon className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="Изображение"
                disabled={disabled}
                onClick={() => imageInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" />
              </ToolbarButton>

              <div className="mx-1 h-9 w-px bg-border" />

              <ToolbarButton
                title="По левому краю"
                active={currentAlign === "left"}
                disabled={disabled}
                onClick={() => applyAlignment("left")}
              >
                <AlignLeft className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="По центру"
                active={currentAlign === "center"}
                disabled={disabled}
                onClick={() => applyAlignment("center")}
              >
                <AlignCenter className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title="По правому краю"
                active={currentAlign === "right"}
                disabled={disabled}
                onClick={() => applyAlignment("right")}
              >
                <AlignRight className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton
                title={imageSelected ? `Размер изображения: ${imageAttrs.width}` : "Размер изображения"}
                active={imageSelected}
                disabled={disabled || !imageSelected}
                onClick={promptImageWidth}
              >
                <Maximize2 className="h-4 w-4" />
              </ToolbarButton>
            </>
          )}

          <div className="ml-auto" />

          <ToolbarButton
            title={isVisual ? "Переключить в HTML" : "Переключить в визуальный режим"}
            disabled={disabled}
            active={!isVisual}
            onClick={switchMode}
          >
            {isVisual ? <CodeXml className="h-4 w-4" /> : <Pilcrow className="h-4 w-4" />}
          </ToolbarButton>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              void handleImagePick(file)
            }}
          />
        </div>
      </div>

      {isVisual ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          value={htmlValue}
          disabled={disabled}
          onChange={(e) => {
            const nextHtml = e.target.value
            setHtmlValue(nextHtml)
            emitHtml(nextHtml)
          }}
          className="min-h-[420px] w-full resize-y border-0 bg-card px-4 py-4 font-mono text-sm leading-6 text-foreground outline-none"
          spellCheck={false}
        />
      )}

      <style>{`
        .knowledge-editor-content > *:first-child {
          margin-top: 0;
        }

        .knowledge-editor-content > *:last-child {
          margin-bottom: 0;
        }

        .knowledge-editor-content h1 {
          margin: 1.25rem 0 0.75rem;
          font-size: 1.875rem;
          line-height: 1.2;
          font-weight: 700;
        }

        .knowledge-editor-content h2 {
          margin: 1rem 0 0.625rem;
          font-size: 1.5rem;
          line-height: 1.25;
          font-weight: 700;
        }

        .knowledge-editor-content p {
          margin: 0.75rem 0;
        }

        .knowledge-editor-content ul,
        .knowledge-editor-content ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }

        .knowledge-editor-content ul {
          list-style: disc;
        }

        .knowledge-editor-content ol {
          list-style: decimal;
        }

        .knowledge-editor-content li {
          margin: 0.25rem 0;
        }

        .knowledge-editor-content blockquote {
          margin: 1rem 0;
          border-left: 3px solid hsl(var(--border));
          padding-left: 1rem;
          color: hsl(var(--muted-foreground));
        }

        .knowledge-editor-content code {
          border-radius: 0.5rem;
          background: rgb(15 23 42 / 0.08);
          padding: 0.15rem 0.4rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.875em;
        }

        .dark .knowledge-editor-content code {
          background: rgb(148 163 184 / 0.12);
        }

        .knowledge-editor-content pre {
          margin: 1rem 0;
          overflow-x: auto;
          border-radius: 1rem;
          background: rgb(15 23 42);
          padding: 1rem;
          color: rgb(241 245 249);
        }

        .knowledge-editor-content pre code {
          background: transparent;
          padding: 0;
          color: inherit;
        }

        .knowledge-editor-content a {
          color: hsl(var(--primary));
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .knowledge-editor-content img.knowledge-editor-image {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 1rem;
          border: 1px solid hsl(var(--border));
        }

        .knowledge-editor-content img.knowledge-editor-image[data-align="left"] {
          margin: 1rem auto 1rem 0;
        }

        .knowledge-editor-content img.knowledge-editor-image[data-align="center"] {
          margin: 1rem auto;
        }

        .knowledge-editor-content img.knowledge-editor-image[data-align="right"] {
          margin: 1rem 0 1rem auto;
        }

        .knowledge-editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  )
}