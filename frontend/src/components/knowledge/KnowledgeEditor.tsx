import { useEffect, useMemo, useState } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
} from "lucide-react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"

import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function KnowledgeEditor({
  value,
  onChange,
  placeholder = "Текст статьи...",
}: Props) {
  const [sourceMode, setSourceMode] = useState(false)

  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    [placeholder]
  )

  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[260px] w-full rounded-b-2xl px-4 py-4 text-sm leading-7 text-foreground outline-none",
      },
    },
  })

  useEffect(() => {
    if (!editor || sourceMode) return
    const current = editor.getHTML()
    if (current !== value) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false })
    }
  }, [editor, value, sourceMode])

  function applyLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Ссылка", previousUrl || "https://")
    if (url === null) return

    if (!url.trim()) {
      editor.chain().focus().unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  const Btn = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void
    active?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border text-muted-foreground transition hover:bg-accent hover:text-foreground",
        active
          ? "border-primary/30 bg-primary/10 text-foreground"
          : "border-border bg-background"
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/25 p-3">
        <Btn
          title="Заголовок 1"
          active={editor?.isActive("heading", { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </Btn>

        <Btn
          title="Заголовок 2"
          active={editor?.isActive("heading", { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </Btn>

        <Btn
          title="Жирный"
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Btn>

        <Btn
          title="Курсив"
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Btn>

        <Btn
          title="Подчёркивание"
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </Btn>

        <Btn
          title="Маркированный список"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Btn>

        <Btn
          title="Нумерованный список"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Btn>

        <Btn
          title="Цитата"
          active={editor?.isActive("blockquote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Btn>

        <Btn
          title="Кодовый блок"
          active={editor?.isActive("codeBlock")}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 className="h-4 w-4" />
        </Btn>

        <Btn
          title="Ссылка"
          active={editor?.isActive("link")}
          onClick={applyLink}
        >
          <Link2 className="h-4 w-4" />
        </Btn>

        <Btn
          title="По левому краю"
          active={editor?.isActive({ textAlign: "left" })}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </Btn>

        <Btn
          title="По центру"
          active={editor?.isActive({ textAlign: "center" })}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </Btn>

        <Btn
          title="По правому краю"
          active={editor?.isActive({ textAlign: "right" })}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </Btn>

        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setSourceMode((prev) => !prev)}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium transition",
              sourceMode
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-border bg-background hover:bg-accent"
            )}
          >
            {sourceMode ? "Визуально" : "HTML"}
          </button>
        </div>
      </div>

      {sourceMode ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[260px] w-full resize-y bg-background px-4 py-4 text-sm leading-7 outline-none"
          placeholder={placeholder}
        />
      ) : (
        <div className="bg-background">
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  )
}