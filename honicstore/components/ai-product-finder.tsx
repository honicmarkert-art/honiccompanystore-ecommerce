"use client"

import { useState } from "react"
import { Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function AiProductFinder({ onQuery }: { onQuery: (query: string) => void }) {
  const [open, setOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState("")
  const [payload, setPayload] = useState<{ mimeType: string; data: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const takeFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Drop a photo.")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Use a photo under 8 MB.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || "")
      const data = dataUrl.split(",")[1] || ""
      if (!data) return
      setPreview(dataUrl)
      setPayload({ mimeType: file.type || "image/jpeg", data })
      setError("")
    }
    reader.readAsDataURL(file)
  }

  const find = async () => {
    if (!payload || busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/ai-product-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: payload }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.query) throw new Error(data?.error || "Could not find a product in that photo")
      setOpen(false)
      onQuery(String(data.query))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find a product in that photo")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-yellow-500 px-2.5 text-xs font-semibold text-neutral-950 hover:bg-yellow-600 sm:h-10 sm:px-3 sm:text-sm"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Use AI to find product</span>
        <span className="sm:hidden">AI</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,80vw)] rounded-xl border border-neutral-200 bg-white p-3 text-neutral-950 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Find a product from a photo</p>
            <button type="button" onClick={() => setOpen(false)} className="text-neutral-500" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              const file = event.dataTransfer.files?.[0]
              if (file) takeFile(file)
            }}
            className={cn("rounded-lg border border-dashed px-3 py-4 text-center", dragOver ? "border-yellow-500 bg-yellow-50" : "border-neutral-300")}
          >
            {preview ? (
              <img src={preview} alt="" className="mx-auto h-28 w-full rounded object-cover" />
            ) : (
              <label className="block cursor-pointer text-sm text-neutral-500">
                Drag a photo here, or click to choose
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) takeFile(file)
                    event.target.value = ""
                  }}
                />
              </label>
            )}
          </div>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={find}
              disabled={!payload || busy}
              className="h-9 flex-1 rounded-lg bg-yellow-500 text-sm font-semibold text-neutral-950 disabled:opacity-50"
            >
              {busy ? "Reading photo..." : "Find product"}
            </button>
            {preview ? (
              <button
                type="button"
                onClick={() => {
                  setPreview("")
                  setPayload(null)
                }}
                className="h-9 rounded-lg border border-neutral-200 px-3 text-sm font-semibold"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
