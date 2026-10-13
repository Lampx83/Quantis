import { Copy } from "lucide-react";
import { t } from "@/i18n";

/** Số thực hiển thị như bảng Excel (không làm tròn quá tay); số nguyên giữ nguyên. */
export function fmtStat(v: number | null | undefined, digits = 6): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

export function fmtPValue(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p === 0) return "0";
  if (p < 1e-4) {
    // Dạng khoa học như Excel (vd. 7.4145E-07) — tránh hai dòng một phía/hai phía cùng hiện "< 0.000001".
    const [m, e] = p.toExponential(4).split("e");
    const exp = Number(e);
    return `${m}E${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return p.toFixed(6);
}

interface ExcelStyleTableProps {
  title?: string;
  /** Hàng tiêu đề; phần tử đầu có thể rỗng (cột nhãn). */
  header: string[];
  /** Các hàng đã định dạng sẵn (chuỗi). Ô trống = "". */
  rows: string[][];
}

/** Bảng kết quả kiểu Excel Data Analysis: nhãn bên trái, số căn phải; nút sao chép TSV để dán lại vào Excel. */
export function ExcelStyleTable({ title, header, rows }: ExcelStyleTableProps) {
  const copy = () => {
    const lines = [header.join("\t"), ...rows.map((r) => r.join("\t"))];
    void navigator.clipboard?.writeText(lines.join("\n"));
  };
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        {title ? <p className="font-medium">{title}</p> : <span />}
        <button
          type="button"
          onClick={copy}
          className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        >
          <Copy className="w-3.5 h-3.5" /> {t("hypothesisTab.common.copy")}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs tabular-nums border-y border-neutral-300 dark:border-neutral-600">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-600">
              {header.map((h, i) => (
                <th key={i} className={`py-1.5 px-3 font-medium italic ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b border-neutral-100 dark:border-neutral-700/50 last:border-b-0">
                {r.map((c, ci) => (
                  <td key={ci} className={`py-1 px-3 ${ci === 0 ? "text-left" : "text-right"}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
