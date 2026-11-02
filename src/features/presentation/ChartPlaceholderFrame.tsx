
import type { PresentationChartType } from "@/stores";

export interface ChartPlaceholderFrameProps {
  chartType: PresentationChartType;
  className?: string;
}

export function ChartWireframeWatermark({ chartType }: { chartType: PresentationChartType }) {
  switch (chartType) {
    case "bar":
      return (
        <svg
          data-testid="watermark-silhouette-bar"
          className="w-80 h-52 md:w-96 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 280 180"
          fill="currentColor"
        >
          <line x1="30" y1="25" x2="260" y2="25" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" opacity="0.3" />
          <line x1="30" y1="65" x2="260" y2="65" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" opacity="0.3" />
          <line x1="30" y1="105" x2="260" y2="105" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" opacity="0.3" />
          <line x1="30" y1="145" x2="260" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="30" y1="15" x2="30" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <rect x="50" y="65" width="28" height="80" rx="3" opacity="0.6" />
          <rect x="95" y="35" width="28" height="110" rx="3" opacity="0.85" />
          <rect x="140" y="80" width="28" height="65" rx="3" opacity="0.55" />
          <rect x="185" y="25" width="28" height="120" rx="3" opacity="0.95" />
          <rect x="230" y="55" width="28" height="90" rx="3" opacity="0.7" />
        </svg>
      );
    case "barH":
      return (
        <svg
          data-testid="watermark-silhouette-barH"
          className="w-80 h-52 md:w-96 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 280 180"
          fill="currentColor"
        >
          <line x1="35" y1="15" x2="35" y2="155" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="35" y1="155" x2="265" y2="155" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <rect x="35" y="25" width="130" height="22" rx="3" opacity="0.65" />
          <rect x="35" y="58" width="200" height="22" rx="3" opacity="0.9" />
          <rect x="35" y="91" width="95" height="22" rx="3" opacity="0.55" />
          <rect x="35" y="124" width="165" height="22" rx="3" opacity="0.8" />
        </svg>
      );
    case "line":
      return (
        <svg
          data-testid="watermark-silhouette-line"
          className="w-80 h-52 md:w-96 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 280 180"
          fill="none"
        >
          <line x1="30" y1="25" x2="260" y2="25" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" opacity="0.25" />
          <line x1="30" y1="65" x2="260" y2="65" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" opacity="0.25" />
          <line x1="30" y1="105" x2="260" y2="105" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" opacity="0.25" />
          <line x1="30" y1="145" x2="260" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="30" y1="15" x2="30" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <path d="M 45 120 C 75 105, 95 55, 120 65 C 150 75, 165 25, 200 40 C 225 50, 240 20, 255 30" stroke="currentColor" strokeWidth="3" opacity="0.85" strokeLinecap="round" />
          <circle cx="45" cy="120" r="5" fill="currentColor" opacity="0.9" />
          <circle cx="120" cy="65" r="5" fill="currentColor" opacity="0.9" />
          <circle cx="200" cy="40" r="5" fill="currentColor" opacity="0.9" />
          <circle cx="255" cy="30" r="5" fill="currentColor" opacity="0.9" />
        </svg>
      );
    case "scatter":
      return (
        <svg
          data-testid="watermark-silhouette-scatter"
          className="w-80 h-52 md:w-96 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 280 180"
          fill="currentColor"
        >
          <line x1="30" y1="25" x2="260" y2="25" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" opacity="0.25" />
          <line x1="30" y1="65" x2="260" y2="65" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" opacity="0.25" />
          <line x1="30" y1="105" x2="260" y2="105" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" opacity="0.25" />
          <line x1="30" y1="145" x2="260" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="30" y1="15" x2="30" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <circle cx="55" cy="125" r="5" opacity="0.6" />
          <circle cx="75" cy="105" r="5" opacity="0.75" />
          <circle cx="95" cy="120" r="5" opacity="0.55" />
          <circle cx="115" cy="85" r="5" opacity="0.9" />
          <circle cx="135" cy="95" r="5" opacity="0.65" />
          <circle cx="155" cy="65" r="5" opacity="0.9" />
          <circle cx="175" cy="75" r="5" opacity="0.75" />
          <circle cx="195" cy="50" r="5" opacity="0.95" />
          <circle cx="215" cy="35" r="5" opacity="0.85" />
          <circle cx="235" cy="45" r="5" opacity="0.7" />
          <circle cx="250" cy="25" r="5" opacity="0.95" />
        </svg>
      );
    case "pie":
      return (
        <svg
          data-testid="watermark-silhouette-pie"
          className="w-72 h-52 md:w-80 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 200 160"
          fill="currentColor"
        >
          <circle cx="100" cy="80" r="65" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.35" />
          <path d="M 100 80 L 100 15 A 65 65 0 0 1 160 105 Z" opacity="0.85" />
          <path d="M 100 80 L 160 105 A 65 65 0 0 1 60 135 Z" opacity="0.6" />
          <path d="M 100 80 L 60 135 A 65 65 0 0 1 100 15 Z" opacity="0.4" />
        </svg>
      );
    case "donut":
      return (
        <svg
          data-testid="watermark-silhouette-donut"
          className="w-72 h-52 md:w-80 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 200 160"
          fill="none"
        >
          <circle cx="100" cy="80" r="60" stroke="currentColor" strokeWidth="20" strokeDasharray="105 275" strokeDashoffset="0" opacity="0.85" />
          <circle cx="100" cy="80" r="60" stroke="currentColor" strokeWidth="20" strokeDasharray="135 245" strokeDashoffset="-105" opacity="0.6" />
          <circle cx="100" cy="80" r="60" stroke="currentColor" strokeWidth="20" strokeDasharray="140 240" strokeDashoffset="-240" opacity="0.35" />
        </svg>
      );
    case "histogram":
      return (
        <svg
          data-testid="watermark-silhouette-histogram"
          className="w-80 h-52 md:w-96 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 280 180"
          fill="currentColor"
        >
          <line x1="30" y1="145" x2="260" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="30" y1="15" x2="30" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <rect x="40" y="125" width="28" height="20" opacity="0.45" />
          <rect x="69" y="95" width="28" height="50" opacity="0.6" />
          <rect x="98" y="55" width="28" height="90" opacity="0.8" />
          <rect x="127" y="25" width="28" height="120" opacity="0.95" />
          <rect x="156" y="45" width="28" height="100" opacity="0.85" />
          <rect x="185" y="85" width="28" height="60" opacity="0.65" />
          <rect x="214" y="120" width="28" height="25" opacity="0.45" />
        </svg>
      );
    case "box":
      return (
        <svg
          data-testid="watermark-silhouette-box"
          className="w-80 h-52 md:w-96 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 280 180"
          fill="currentColor"
        >
          <line x1="30" y1="145" x2="260" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="30" y1="15" x2="30" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="75" y1="35" x2="75" y2="130" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="65" y1="35" x2="85" y2="35" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="65" y1="130" x2="85" y2="130" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <rect x="58" y="60" width="34" height="48" rx="2" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="1.5" />
          <line x1="58" y1="83" x2="92" y2="83" stroke="currentColor" strokeWidth="2" opacity="0.95" />
          <line x1="145" y1="20" x2="145" y2="135" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="135" y1="20" x2="155" y2="20" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="135" y1="135" x2="155" y2="135" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <rect x="128" y="45" width="34" height="60" rx="2" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="1.5" />
          <line x1="128" y1="70" x2="162" y2="70" stroke="currentColor" strokeWidth="2" opacity="0.95" />
          <line x1="215" y1="50" x2="215" y2="125" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="205" y1="50" x2="225" y2="50" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="205" y1="125" x2="225" y2="125" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <rect x="198" y="70" width="34" height="40" rx="2" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="1.5" />
          <line x1="198" y1="90" x2="232" y2="90" stroke="currentColor" strokeWidth="2" opacity="0.95" />
        </svg>
      );
    case "area":
      return (
        <svg
          data-testid="watermark-silhouette-area"
          className="w-80 h-52 md:w-96 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 280 180"
          fill="none"
        >
          <line x1="30" y1="145" x2="260" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="30" y1="15" x2="30" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <path d="M 40 145 L 40 105 Q 90 65, 130 85 T 210 45 L 255 65 L 255 145 Z" fill="currentColor" opacity="0.35" />
          <path d="M 40 105 Q 90 65, 130 85 T 210 45 L 255 65" stroke="currentColor" strokeWidth="2.5" opacity="0.85" />
        </svg>
      );
    case "density":
      return (
        <svg
          data-testid="watermark-silhouette-density"
          className="w-80 h-52 md:w-96 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 280 180"
          fill="none"
        >
          <line x1="30" y1="145" x2="260" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="30" y1="15" x2="30" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <path d="M 40 145 C 80 145, 100 40, 130 40 C 160 40, 180 145, 230 145" stroke="currentColor" strokeWidth="2.5" opacity="0.85" />
          <path d="M 70 145 C 110 145, 140 60, 170 60 C 200 60, 220 145, 255 145" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 4" opacity="0.65" />
        </svg>
      );
    case "radar":
      return (
        <svg
          data-testid="watermark-silhouette-radar"
          className="w-72 h-52 md:w-80 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 200 160"
          fill="none"
        >
          <polygon points="100,20 160,50 160,110 100,140 40,110 40,50" stroke="currentColor" strokeWidth="1" opacity="0.4" />
          <polygon points="100,45 135,62 135,97 100,115 65,97 65,62" stroke="currentColor" strokeWidth="1" opacity="0.3" />
          <polygon points="100,30 148,58 120,105 100,125 55,90 50,60" fill="currentColor" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        </svg>
      );
    case "heatmap":
      return (
        <svg
          data-testid="watermark-silhouette-heatmap"
          className="w-72 h-52 md:w-80 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 200 160"
          fill="currentColor"
        >
          <rect x="30" y="20" width="30" height="25" opacity="0.85" />
          <rect x="65" y="20" width="30" height="25" opacity="0.4" />
          <rect x="100" y="20" width="30" height="25" opacity="0.7" />
          <rect x="135" y="20" width="30" height="25" opacity="0.25" />
          <rect x="30" y="50" width="30" height="25" opacity="0.4" />
          <rect x="65" y="50" width="30" height="25" opacity="0.85" />
          <rect x="100" y="50" width="30" height="25" opacity="0.5" />
          <rect x="135" y="50" width="30" height="25" opacity="0.6" />
          <rect x="30" y="80" width="30" height="25" opacity="0.7" />
          <rect x="65" y="80" width="30" height="25" opacity="0.5" />
          <rect x="100" y="80" width="30" height="25" opacity="0.85" />
          <rect x="135" y="80" width="30" height="25" opacity="0.35" />
          <rect x="30" y="110" width="30" height="25" opacity="0.25" />
          <rect x="65" y="110" width="30" height="25" opacity="0.6" />
          <rect x="100" y="110" width="30" height="25" opacity="0.35" />
          <rect x="135" y="110" width="30" height="25" opacity="0.85" />
        </svg>
      );
    case "stackedBar":
    default:
      return (
        <svg
          data-testid="watermark-silhouette-stackedBar"
          className="w-80 h-52 md:w-96 md:h-60 max-w-full text-neutral-400 dark:text-neutral-500"
          viewBox="0 0 280 180"
          fill="currentColor"
        >
          <line x1="30" y1="145" x2="260" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <line x1="30" y1="15" x2="30" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
          <rect x="60" y="90" width="32" height="55" opacity="0.85" />
          <rect x="60" y="50" width="32" height="38" opacity="0.55" />
          <rect x="120" y="80" width="32" height="65" opacity="0.85" />
          <rect x="120" y="30" width="32" height="48" opacity="0.55" />
          <rect x="180" y="100" width="32" height="45" opacity="0.85" />
          <rect x="180" y="60" width="32" height="38" opacity="0.55" />
        </svg>
      );
  }
}

export function ChartPlaceholderFrame({
  chartType,
  className = "",
}: ChartPlaceholderFrameProps) {
  return (
    <div
      data-testid="chart-placeholder-frame"
      className={`relative w-full min-h-[460px] md:min-h-[500px] rounded-2xl border-2 border-dashed border-neutral-300/80 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700/80 bg-neutral-50/50 dark:bg-neutral-900/40 p-6 flex items-center justify-center overflow-hidden transition-all duration-300 select-none ${className}`}
    >
      {/* Blueprint Grid Dots */}
      <div className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-15 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Frame Corner Anchors */}
      <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-neutral-300 dark:border-neutral-700 pointer-events-none rounded-tl-sm" />
      <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-neutral-300 dark:border-neutral-700 pointer-events-none rounded-tr-sm" />
      <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-neutral-300 dark:border-neutral-700 pointer-events-none rounded-bl-sm" />
      <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-neutral-300 dark:border-neutral-700 pointer-events-none rounded-br-sm" />

      {/* Centered Dynamic Watermark Silhouette Only */}
      <div className="relative z-10 flex items-center justify-center pointer-events-none opacity-40 hover:opacity-55 dark:opacity-25 dark:hover:opacity-40 transition-opacity duration-300">
        <ChartWireframeWatermark chartType={chartType} />
      </div>
    </div>
  );
}
