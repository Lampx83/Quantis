import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Circle, Download } from "lucide-react"
import {
  loadWritiumProtocolBlobs,
  saveWritiumProtocolBlobs,
  type WritiumPreReg,
  type WritiumReprodItem,
  type WritiumProtocolBlob,
} from "./writiumResearchProtocols"

function generateId(): string {
  return crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const EMPTY_PREREG: WritiumPreReg = {
  hypotheses: "",
  design: "",
  sampleSize: "",
  analysisPlan: "",
  primaryOutcome: "",
  exclusionCriteria: "",
}

const DEFAULT_REPROD: Omit<WritiumReprodItem, "id">[] = [
  { text: "Protocol/đề cương đã đăng ký", checked: false },
  { text: "Code/script phân tích có sẵn", checked: false },
  { text: "Dữ liệu có thể chia sẻ (anonymized)", checked: false },
  { text: "README mô tả cách chạy", checked: false },
  { text: "Môi trường/phiên bản ghi rõ", checked: false },
]

function ensureReprodList(existing: WritiumReprodItem[] | null | undefined): WritiumReprodItem[] {
  if (existing && existing.length > 0) return existing
  return DEFAULT_REPROD.map((e) => ({ ...e, id: generateId() }))
}

export function OpenScienceProtocolPanel({ showToast }: { showToast: (msg: string) => void }) {
  const [blobs, setBlobs] = useState<WritiumProtocolBlob[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    const list = loadWritiumProtocolBlobs()
    setBlobs(list)
    setSelectedId((prev) => {
      if (prev && list.some((b) => b.id === prev)) return prev
      return list[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const selected = blobs.find((b) => b.id === selectedId)

  const persist = useCallback((next: WritiumProtocolBlob[]) => {
    saveWritiumProtocolBlobs(next)
    setBlobs(next)
  }, [])

  const updateSelected = useCallback(
    (patch: { prereg?: WritiumPreReg; reprodChecklist?: WritiumReprodItem[] }) => {
      if (!selectedId) return
      const next = blobs.map((b) => {
        if (b.id !== selectedId) return b
        return { ...b, ...patch } as WritiumProtocolBlob
      })
      persist(next)
    },
    [blobs, selectedId, persist]
  )

  const pr = (selected?.prereg as WritiumPreReg | undefined) ?? EMPTY_PREREG
  const reproList = ensureReprodList(selected?.reprodChecklist as WritiumReprodItem[] | undefined)

  const exportPreregHtml = () => {
    const p = pr
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pre-registration</title></head><body><h1>Pre-registration draft</h1><h2>Hypotheses</h2><pre>${(p.hypotheses || "").replace(/</g, "&lt;")}</pre><h2>Design</h2><pre>${(p.design || "").replace(/</g, "&lt;")}</pre><h2>Sample</h2><p>${(p.sampleSize || "").replace(/</g, "&lt;")}</p><h2>Analysis</h2><pre>${(p.analysisPlan || "").replace(/</g, "&lt;")}</pre><h2>Primary outcome</h2><p>${(p.primaryOutcome || "").replace(/</g, "&lt;")}</p><h2>Exclusion</h2><pre>${(p.exclusionCriteria || "").replace(/</g, "&lt;")}</pre></body></html>`
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "prereg-draft.html"
    a.click()
    URL.revokeObjectURL(a.href)
    showToast("Đã tải prereg-draft.html")
  }

  if (blobs.length === 0) {
    return (
      <div className="w-full max-w-full">
        <h2 className="text-xl font-semibold mb-2">Pre-reg &amp; tái lập</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Chưa có đề cương nào trong trình duyệt. Tạo đề cương trong <strong>Writium</strong> (menu <strong>Đề cương nghiên cứu</strong>) rở lại đây để điền pre-registration và checklist tái lập.
        </p>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          Tải lại
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Pre-reg &amp; tái lập</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          Dữ liệu lưu chung với Writium (đề cương đã chọn). Dùng cùng trình duyệt / origin để đồng bộ.
        </p>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Đề cương</label>
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="w-full max-w-md rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
        >
          {blobs.map((b) => (
            <option key={b.id} value={b.id}>
              {(b.title as string) || b.id}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 space-y-3">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Pre-registration (OSF / ClinicalTrials…)</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Giả thuyết</label>
              <textarea
                value={pr.hypotheses}
                onChange={(e) => updateSelected({ prereg: { ...pr, hypotheses: e.target.value } })}
                rows={3}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                placeholder="H1, H2…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Thiết kế nghiên cứu</label>
              <textarea
                value={pr.design}
                onChange={(e) => updateSelected({ prereg: { ...pr, design: e.target.value } })}
                rows={2}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cỡ mẫu dự kiến</label>
              <input
                type="text"
                value={pr.sampleSize}
                onChange={(e) => updateSelected({ prereg: { ...pr, sampleSize: e.target.value } })}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Kế hoạch phân tích</label>
              <textarea
                value={pr.analysisPlan}
                onChange={(e) => updateSelected({ prereg: { ...pr, analysisPlan: e.target.value } })}
                rows={3}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến kết quả chính</label>
              <input
                type="text"
                value={pr.primaryOutcome}
                onChange={(e) => updateSelected({ prereg: { ...pr, primaryOutcome: e.target.value } })}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tiêu chí loại trừ</label>
              <textarea
                value={pr.exclusionCriteria}
                onChange={(e) => updateSelected({ prereg: { ...pr, exclusionCriteria: e.target.value } })}
                rows={2}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={exportPreregHtml}
              className="inline-flex items-center gap-2 rounded-lg bg-brand text-white px-4 py-2 text-sm hover:opacity-90"
            >
              <Download className="h-4 w-4" /> Xuất draft (HTML)
            </button>
          </section>

          <section className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Checklist tái lập (open science)</h3>
            <ul className="space-y-2">
              {reproList.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-left"
                    onClick={() => {
                      const list = reproList.map((x) => (x.id === e.id ? { ...x, checked: !x.checked } : x))
                      updateSelected({ reprodChecklist: list })
                    }}
                  >
                    {e.checked ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" /> : <Circle className="h-5 w-5 text-neutral-400 shrink-0" />}
                    <span className={e.checked ? "line-through text-neutral-500" : ""}>{e.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
