/**
 * Đồng bộ với Writium (Đề cương nghiên cứu): cùng localStorage key.
 * Pre-reg và checklist tái lập được chỉnh ở đây; phần còn lại đề cương trong Writium.
 */
export const WRITIUM_RESEARCH_PROTOCOLS_KEY = "writium_research_protocols"

export interface WritiumPreReg {
  hypotheses: string
  design: string
  sampleSize: string
  analysisPlan: string
  primaryOutcome: string
  exclusionCriteria: string
}

export interface WritiumReprodItem {
  id: string
  text: string
  checked: boolean
}

/** Bản ghi tối thiểu; thực tế là đối tượng đề cương đầy đủ từ Writium */
export type WritiumProtocolBlob = Record<string, unknown> & {
  id: string
  title: string
  prereg?: WritiumPreReg | null
  reprodChecklist?: WritiumReprodItem[] | null
}

const LEGACY_PROTOCOLUM_KEY = "protocolum_protocols"

export function loadWritiumProtocolBlobs(): WritiumProtocolBlob[] {
  try {
    let raw = localStorage.getItem(WRITIUM_RESEARCH_PROTOCOLS_KEY)
    if (!raw) {
      const leg = localStorage.getItem(LEGACY_PROTOCOLUM_KEY)
      if (leg) {
        localStorage.setItem(WRITIUM_RESEARCH_PROTOCOLS_KEY, leg)
        try {
          localStorage.removeItem(LEGACY_PROTOCOLUM_KEY)
        } catch {
          /* ignore */
        }
        raw = leg
      }
    }
    if (!raw) return []
    const p = JSON.parse(raw) as unknown
    return Array.isArray(p) ? (p as WritiumProtocolBlob[]) : []
  } catch {
    return []
  }
}

export function saveWritiumProtocolBlobs(list: WritiumProtocolBlob[]) {
  localStorage.setItem(WRITIUM_RESEARCH_PROTOCOLS_KEY, JSON.stringify(list))
}
