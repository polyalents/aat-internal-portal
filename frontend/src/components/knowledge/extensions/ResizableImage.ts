import Image from "@tiptap/extension-image"

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-width") ||
          element.style.width ||
          "100%",
        renderHTML: (attributes: Record<string, string>) => ({
          "data-width": attributes.width,
          style: `width:${attributes.width || "100%"};max-width:100%;height:auto;`,
        }),
      },
      align: {
        default: "left",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-align") || "left",
        renderHTML: (attributes: Record<string, string>) => {
          const align = attributes.align || "left"
          const width = attributes.width || "100%"

          let margin = "1rem auto 1rem 0"
          if (align === "center") margin = "1rem auto"
          if (align === "right") margin = "1rem 0 1rem auto"

          return {
            "data-align": align,
            style: `width:${width};max-width:100%;height:auto;display:block;margin:${margin};`,
          }
        },
      },
    }
  },
})

export default ResizableImage