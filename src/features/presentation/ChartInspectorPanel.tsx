import { t } from "@/i18n";
import type { Dataset, ChartConfig, ChartControls, BarMode, ErrorBarType, ColorPaletteName, ChartSortOrder } from "@/types";
import { DEFAULT_CHART_CONTROLS } from "@/types";
import type { AggregateFunction } from "@/utils/aggregation";
import { PALETTES } from "./colorPalettes";
import { ChevronDown, SlidersHorizontal, BarChart3, ShieldAlert, Type, Download, Palette, PanelRightClose } from "lucide-react";

/** Charts whose X/Y/aggregation live in `chartConfig` (vs legacy hooks). */
export const usesConfigAxes = (chartType: string): boolean =>
  ["bar", "barH", "line", "scatter"].includes(chartType);

/** Charts that support a Legend grouping field. */
export const supportsLegend = (chartType: string): boolean =>
  ["bar", "barH", "line", "scatter"].includes(chartType);

/** Charts that support data labels. */
export const supportsDataLabels = (chartType: string): boolean =>
  ["bar", "barH", "line", "pie", "donut", "histogram", "area", "radar"].includes(chartType);

/** Charts that have custom options in the inspector. */
export const supportsOptions = (chartType: string): boolean =>
  ["pie", "donut", "histogram", "heatmap", "radar"].includes(chartType);

/** All 12 reachable charts support auto title generation. */
export const supportsAutoTitle = (chartType: string): boolean =>
  [
    "bar", "barH", "line", "scatter",
    "pie", "donut", "histogram", "box",
    "heatmap", "area", "density", "radar"
  ].includes(chartType);

export interface ChartInspectorPanelProps {
  chartType: string;
  dataset: Dataset | null;
  config: ChartConfig;
  onChange: (patch: Partial<ChartConfig>) => void;
  controls?: ChartControls;
  onControlsChange?: (patch: Partial<ChartControls>) => void;
  onExportCsv?: () => void;
  onExportPng?: () => void;
  onCopy?: () => void;
  onClose?: () => void;
  disabled?: boolean;
  className?: string;
}

const inputControlClass =
  "w-full px-2.5 py-1.5 text-xs rounded-md border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50/70 hover:bg-white focus:bg-white dark:bg-neutral-800/60 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xs";

const labelClass =
  "block mb-1.5 text-[11.5px] font-medium text-neutral-600 dark:text-neutral-300 tracking-tight";

export function ChartInspectorPanel({
  chartType,
  dataset,
  config,
  onChange,
  controls = DEFAULT_CHART_CONTROLS,
  onControlsChange = () => {},
  onExportCsv,
  onClose,
  disabled = false,
  className = "",
}: ChartInspectorPanelProps) {
  const columnNames = dataset?.columnNames || [];

  const getColDisplayName = (col: string): string => {
    const varMeta = dataset?.variables?.[col];
    if (varMeta?.label && varMeta.label.trim() !== "" && varMeta.label !== col) {
      return `${varMeta.label} (${col})`;
    }
    return col;
  };

  // Determine numeric columns
  const numericColumns = columnNames.filter((col) => {
    const meta = dataset?.variables?.[col];
    if (meta) {
      return meta.type === "numeric" || meta.measure === "scale";
    }
    // Fallback inspect rows
    const rows = dataset?.data || dataset?.preview || [];
    const header = rows[0];
    if (!header) return true;
    const idx = header.indexOf(col);
    if (idx === -1) return true;
    for (let r = 1; r < Math.min(rows.length, 10); r++) {
      const val = rows[r]?.[idx];
      if (val !== undefined && val !== "" && !Number.isNaN(Number(val))) {
        return true;
      }
    }
    return true;
  });

  // Determine categorical columns
  const categoricalColumns = columnNames.filter((col) => {
    const meta = dataset?.variables?.[col];
    if (meta) {
      return meta.type === "string" || meta.measure === "nominal" || meta.measure === "ordinal";
    }
    return true;
  });

  const hasLegend = supportsLegend(chartType);
  const hasBarMode = chartType === "bar" || chartType === "barH";
  const hasErrorBars = chartType === "bar" || chartType === "barH" || chartType === "line";
  const isMeanAggregation = config.aggregation === "mean";
  const hasConfigAxes = usesConfigAxes(chartType);

  const aggregationOptions: { value: AggregateFunction; labelKey: string }[] = [
    { value: "mean", labelKey: "presentationView.aggLabel.mean" },
    { value: "sum", labelKey: "presentationView.aggLabel.sum" },
    { value: "count", labelKey: "presentationView.aggLabel.count" },
    { value: "median", labelKey: "presentationView.aggLabel.median" },
    { value: "std", labelKey: "presentationView.aggLabel.std" },
    { value: "min", labelKey: "presentationView.aggLabel.min" },
    { value: "max", labelKey: "presentationView.aggLabel.max" },
  ];

  return (
    <aside
      className={`w-80 shrink-0 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-xl shadow-xs flex flex-col text-xs overflow-hidden sticky top-4 max-h-[calc(100vh-5rem)] ${className}`}
      data-testid="chart-inspector-panel"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/60 dark:bg-neutral-900/60 select-none">
        <div className="flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200 text-xs tracking-tight">
          <SlidersHorizontal className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
          <span>{t("presentationView.inspectorTitle")}</span>
        </div>
        {onClose && (
          <button
            type="button"
            data-testid="inspector-toggle-btn"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 -mr-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center"
            title="Collapse inspector"
            aria-label="Collapse inspector"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="overflow-y-auto divide-y divide-neutral-200/80 dark:divide-neutral-800 flex-1 [scrollbar-width:thin] [scrollbar-color:rgba(156,163,175,0.4)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700 hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-track]:bg-transparent">
        {hasConfigAxes ? (
          <>
            {/* Accordion 1: Data & Axes */}
            <details open className="group">
              <summary className="w-full px-4 py-3 flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 cursor-pointer select-none transition-colors list-none [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800/50">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                  <span>{t("presentationView.accordionData")}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-open:rotate-180 transition-transform duration-200 ease-out" />
              </summary>
              <div className="px-4 pb-4 pt-0.5 space-y-3 bg-white dark:bg-neutral-900">
                {/* X Axis */}
                <div>
                  <label className={labelClass}>
                    {t("presentationView.axisXLabel")}
                  </label>
                  <select
                    data-testid="x-col-select"
                    disabled={disabled || columnNames.length === 0}
                    value={config.xCol}
                    onChange={(e) => onChange({ xCol: e.target.value })}
                    className={inputControlClass}
                  >
                    <option value="">{t("presentationView.noneOption")}</option>
                    {columnNames.map((col) => (
                      <option key={col} value={col}>
                        {getColDisplayName(col)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Y Axis */}
                <div>
                  <label className={labelClass}>
                    {t("presentationView.axisYNumericLabel")}
                  </label>
                  <select
                    data-testid="y-col-select"
                    disabled={disabled || numericColumns.length === 0}
                    value={config.yCol}
                    onChange={(e) => onChange({ yCol: e.target.value })}
                    className={inputControlClass}
                  >
                    <option value="">{t("presentationView.noneOption")}</option>
                    {numericColumns.map((col) => (
                      <option key={col} value={col}>
                        {getColDisplayName(col)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Aggregation - only for bar, barH, line when Y is selected */}
                {["bar", "barH", "line"].includes(chartType) && config.yCol && (
                  <div>
                    <label className={labelClass}>
                      {t("presentationView.aggregationLabel")}
                    </label>
                    <select
                      data-testid="aggregation-select"
                      disabled={disabled}
                      value={config.aggregation}
                      onChange={(e) =>
                        onChange({ aggregation: e.target.value as AggregateFunction })
                      }
                      className={inputControlClass}
                    >
                      {aggregationOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Legend (Grouping Field) - only for bar, line, scatter */}
                {hasLegend && (
                  <div>
                    <label className={labelClass}>
                      {t("presentationView.legendLabel")}
                    </label>
                    <select
                      data-testid="legend-col-select"
                      disabled={disabled || categoricalColumns.length === 0}
                      value={config.legendCol}
                      onChange={(e) => onChange({ legendCol: e.target.value, ...(e.target.value && (config.sortOrder === "value-asc" || config.sortOrder === "value-desc") ? { sortOrder: "category-asc" } : {}) })}
                      className={inputControlClass}
                    >
                      <option value="">{t("presentationView.noneOption")}</option>
                      {categoricalColumns.map((col) => (
                        <option key={col} value={col}>
                          {getColDisplayName(col)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sort Order - for bar and barH */}
                {["bar", "barH"].includes(chartType) && (
                  <div>
                    <label className={labelClass}>
                      {t("presentationView.sortOrderLabel")}
                    </label>
                    <select
                      data-testid="sort-order-select"
                      disabled={disabled}
                      value={
                        hasLegend &&
                        config.legendCol &&
                        (config.sortOrder === "value-asc" || config.sortOrder === "value-desc")
                          ? "category-asc"
                          : config.sortOrder || "category-asc"
                      }
                      onChange={(e) =>
                        onChange({ sortOrder: e.target.value as ChartSortOrder })
                      }
                      className={inputControlClass}
                    >
                      <option value="category-asc">
                        {t("presentationView.sortCategoryAsc")}
                      </option>
                      <option value="category-desc">
                        {t("presentationView.sortCategoryDesc")}
                      </option>
                      <option
                        value="value-asc"
                        disabled={Boolean(hasLegend && config.legendCol)}
                      >
                        {t("presentationView.sortValueAsc")}
                        {hasLegend && config.legendCol
                          ? ` (${t("presentationView.sortValueDisabledWithLegend")})`
                          : ""}
                      </option>
                      <option
                        value="value-desc"
                        disabled={Boolean(hasLegend && config.legendCol)}
                      >
                        {t("presentationView.sortValueDesc")}
                        {hasLegend && config.legendCol
                          ? ` (${t("presentationView.sortValueDisabledWithLegend")})`
                          : ""}
                      </option>
                      <option value="none">
                        {t("presentationView.sortOriginal")}
                      </option>
                    </select>
                  </div>
                )}
              </div>
            </details>

            {/* Accordion 2: Style & Palette */}
            <details className="group">
              <summary className="w-full px-4 py-3 flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 cursor-pointer select-none transition-colors list-none [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800/50">
                <span className="flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                  <span>{t("presentationView.accordionStyle")}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-open:rotate-180 transition-transform duration-200 ease-out" />
              </summary>
              <div className="px-4 pb-4 pt-0.5 space-y-3 bg-white dark:bg-neutral-900">
                {/* Bar Mode (clustered vs stacked) */}
                {hasBarMode && (
                  <div>
                    <label className={labelClass}>
                      {t("presentationView.barModeLabel")}
                    </label>
                    <select
                      data-testid="bar-mode-select"
                      disabled={disabled}
                      value={config.barMode}
                      onChange={(e) => onChange({ barMode: e.target.value as BarMode })}
                      className={inputControlClass}
                    >
                      <option value="clustered">
                        {t("presentationView.barModeClustered")}
                      </option>
                      <option value="stacked">
                        {t("presentationView.barModeStacked")}
                      </option>
                    </select>
                  </div>
                )}

                {/* Color Palette */}
                <div>
                  <label className={labelClass}>
                    {t("presentationView.paletteLabel")}
                  </label>
                  <select
                    data-testid="palette-select"
                    disabled={disabled}
                    value={config.palette}
                    onChange={(e) =>
                      onChange({ palette: e.target.value as ColorPaletteName })
                    }
                    className={inputControlClass}
                  >
                    <option value="academic">
                      {t("presentationView.paletteAcademic")}
                    </option>
                    <option value="colorblind">
                      {t("presentationView.paletteColorblind")}
                    </option>
                    <option value="grayscale">
                      {t("presentationView.paletteGrayscale")}
                    </option>
                  </select>

                  {/* Swatch Preview */}
                  <div className="flex items-center gap-1.5 mt-2 px-0.5 py-1">
                    {PALETTES[config.palette]?.slice(0, 6).map((color, idx) => (
                      <span
                        key={idx}
                        className="w-4 h-4 rounded-full border border-black/10 dark:border-white/20 shadow-2xs inline-block hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </details>

            {/* Accordion 3: Error Bars - only for bar, barH, line */}
            {hasErrorBars && (
              <details className="group">
                <summary className="w-full px-4 py-3 flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 cursor-pointer select-none transition-colors list-none [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800/50">
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                    <span>{t("presentationView.accordionErrorBars")}</span>
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-open:rotate-180 transition-transform duration-200 ease-out" />
                </summary>
                <div className="px-4 pb-4 pt-0.5 space-y-3 bg-white dark:bg-neutral-900">
                  <div>
                    <label className={labelClass}>
                      {t("presentationView.errorBarLabel")}
                    </label>
                    <select
                      data-testid="error-bar-select"
                      disabled={disabled || !isMeanAggregation}
                      value={config.errorBar}
                      onChange={(e) =>
                        onChange({ errorBar: e.target.value as ErrorBarType })
                      }
                      className={inputControlClass}
                    >
                      <option value="none">{t("presentationView.errorBarNone")}</option>
                      <option value="ci95">{t("presentationView.errorBarCi95")}</option>
                      <option value="se">{t("presentationView.errorBarSe")}</option>
                      <option value="sd">{t("presentationView.errorBarSd")}</option>
                    </select>
                  </div>

                  {!isMeanAggregation && (
                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span>{t("presentationView.errorBarMeanOnlyNotice")}</span>
                    </div>
                  )}
                </div>
              </details>
            )}
          </>
        ) : (
          <>
            {/* Accordion 1: Data & Axes */}
            <details open className="group">
              <summary className="w-full px-4 py-3 flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 cursor-pointer select-none transition-colors list-none [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800/50">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                  <span>{t("presentationView.accordionData")}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-open:rotate-180 transition-transform duration-200 ease-out" />
              </summary>
              <div className="px-4 pb-4 pt-0.5 space-y-3 bg-white dark:bg-neutral-900">
                {/* Non-academic Data & Axes controls */}
                {chartType === "area" && (
                  <>
                    <div>
                      <label className={labelClass}>
                        {t("presentationView.axisXLabel")}
                      </label>
                      <select
                        data-testid="area-x-col-select"
                        disabled={disabled || columnNames.length === 0}
                        value={config.xCol}
                        onChange={(e) => onChange({ xCol: e.target.value })}
                        className={inputControlClass}
                      >
                        <option value="">{t("presentationView.noneOption")}</option>
                        {columnNames.map((col) => (
                          <option key={col} value={col}>
                            {getColDisplayName(col)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t("presentationView.axisYNumericLabel")}
                      </label>
                      <select
                        data-testid="area-y-col-select"
                        disabled={disabled || numericColumns.length === 0}
                        value={config.yCol}
                        onChange={(e) => onChange({ yCol: e.target.value })}
                        className={inputControlClass}
                      >
                        <option value="">{t("presentationView.noneOption")}</option>
                        {numericColumns.map((col) => (
                          <option key={col} value={col}>
                            {getColDisplayName(col)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {(chartType === "pie" || chartType === "donut") && (
                  <>
                    {/* Legend (Category) */}
                    <div>
                      <label className={labelClass}>
                        {t("presentationView.pieLegendLabel")}
                      </label>
                      <select
                        data-testid={chartType === "pie" ? "pie-legend-col-select" : "donut-legend-col-select"}
                        disabled={disabled || columnNames.length === 0}
                        value={config.xCol}
                        onChange={(e) => {
                          onChange({ xCol: e.target.value });
                          onControlsChange?.({ pieBinNumeric: false });
                        }}
                        className={inputControlClass}
                      >
                        <option value="">{t("presentationView.noneOption")}</option>
                        {columnNames.map((col) => (
                          <option key={col} value={col}>
                            {getColDisplayName(col)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Values (Numeric) */}
                    <div>
                      <label className={labelClass}>
                        {t("presentationView.valuesLabel")}
                      </label>
                      <select
                        data-testid={chartType === "pie" ? "pie-values-col-select" : "donut-values-col-select"}
                        disabled={disabled || numericColumns.length === 0}
                        value={config.yCol}
                        onChange={(e) =>
                          onChange({
                            yCol: e.target.value,
                            ...(!config.yCol && e.target.value ? { aggregation: "sum" } : {}),
                          })
                        }
                        className={inputControlClass}
                      >
                        <option value="">{t("presentationView.noneOption")}</option>
                        {numericColumns.map((col) => (
                          <option key={col} value={col}>
                            {getColDisplayName(col)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Aggregation (when Values is selected) */}
                    {config.yCol && (
                      <div>
                        <label className={labelClass}>
                          {t("presentationView.aggregationLabel")}
                        </label>
                        <select
                          data-testid={chartType === "pie" ? "pie-aggregation-select" : "donut-aggregation-select"}
                          disabled={disabled}
                          value={config.aggregation || "sum"}
                          onChange={(e) =>
                            onChange({ aggregation: e.target.value as AggregateFunction })
                          }
                          className={inputControlClass}
                        >
                          {aggregationOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {t(opt.labelKey)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                {chartType === "histogram" && (
                  <div>
                    <label className={labelClass}>
                      {t("presentationView.distributionColumnLabel")}
                    </label>
                    <select
                      data-testid="histogram-col-select"
                      disabled={disabled || numericColumns.length === 0}
                      value={controls.histogramCol}
                      onChange={(e) =>
                        onControlsChange({ histogramCol: e.target.value })
                      }
                      className={inputControlClass}
                    >
                      <option value="">{t("presentationView.noneOption")}</option>
                      {numericColumns.map((col) => (
                        <option key={col} value={col}>
                          {getColDisplayName(col)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {chartType === "box" && (
                  <>
                    <div>
                      <label className={labelClass}>
                        {t("presentationView.groupVarXLabel")}
                      </label>
                      <select
                        data-testid="box-group-col-select"
                        disabled={disabled || columnNames.length === 0}
                        value={config.xCol}
                        onChange={(e) => onChange({ xCol: e.target.value })}
                        className={inputControlClass}
                      >
                        <option value="">{t("presentationView.noneOption")}</option>
                        {columnNames.map((col) => (
                          <option key={col} value={col}>
                            {getColDisplayName(col)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>
                        {t("presentationView.numericVarYLabel")}
                      </label>
                      <select
                        data-testid="box-value-col-select"
                        disabled={disabled || numericColumns.length === 0}
                        value={config.yCol}
                        onChange={(e) => onChange({ yCol: e.target.value })}
                        className={inputControlClass}
                      >
                        <option value="">{t("presentationView.noneOption")}</option>
                        {numericColumns.map((col) => (
                          <option key={col} value={col}>
                            {getColDisplayName(col)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {chartType === "density" && (
                  <>
                    <div>
                      <label className={labelClass}>
                        {t("presentationView.densityGroupLabel")}
                      </label>
                      <select
                        data-testid="density-group-col-select"
                        disabled={disabled || columnNames.length === 0}
                        value={controls.densityGroupCol}
                        onChange={(e) =>
                          onControlsChange({ densityGroupCol: e.target.value })
                        }
                        className={inputControlClass}
                      >
                        <option value="">{t("analysisView.selectPlaceholder")}</option>
                        {columnNames.map((col) => (
                          <option key={col} value={col}>
                            {getColDisplayName(col)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>
                        {t("presentationView.densityValueLabel")}
                      </label>
                      <select
                        data-testid="density-value-col-select"
                        disabled={disabled || numericColumns.length === 0}
                        value={controls.densityValueCol}
                        onChange={(e) =>
                          onControlsChange({ densityValueCol: e.target.value })
                        }
                        className={inputControlClass}
                      >
                        <option value="">{t("analysisView.selectPlaceholder")}</option>
                        {numericColumns.map((col) => (
                          <option key={col} value={col}>
                            {getColDisplayName(col)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {chartType === "radar" && (
                  <div>
                    <label className={labelClass}>
                      {t("presentationView.groupColumnOptionalLabel")}
                    </label>
                    <select
                      data-testid="radar-group-col-select"
                      disabled={disabled || columnNames.length === 0}
                      value={controls.radarGroupCol}
                      onChange={(e) =>
                        onControlsChange({ radarGroupCol: e.target.value })
                      }
                      className={inputControlClass}
                    >
                      <option value="">{t("presentationView.noGroupOption")}</option>
                      {columnNames.map((col) => (
                        <option key={col} value={col}>
                          {getColDisplayName(col)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </details>

            {/* Accordion 2: Options */}
            {supportsOptions(chartType) && (
              <details className="group">
                <summary className="w-full px-4 py-3 flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 cursor-pointer select-none transition-colors list-none [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800/50">
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                    <span>{t("presentationView.accordionOptions")}</span>
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-open:rotate-180 transition-transform duration-200 ease-out" />
                </summary>
                <div className="px-4 pb-4 pt-0.5 space-y-3 bg-white dark:bg-neutral-900">
                  {/* Non-academic Options controls */}
                  {(chartType === "pie" || chartType === "donut") && (
                    <div className="space-y-3">
                      {chartType === "pie" && (
                        <p className="text-neutral-500 dark:text-neutral-400 text-xs leading-relaxed">
                          {t("presentationView.pieHint")}
                        </p>
                      )}
                      <label className="flex items-center gap-2.5 cursor-pointer select-none group/check py-0.5">
                        <input
                          type="checkbox"
                          data-testid="pie-bin-numeric-checkbox"
                          disabled={disabled}
                          checked={controls.pieBinNumeric}
                          onChange={(e) =>
                            onControlsChange({ pieBinNumeric: e.target.checked })
                          }
                          className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500/20 dark:bg-neutral-800 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 group-hover/check:text-neutral-900 dark:group-hover/check:text-neutral-100 transition-colors">
                          {t("presentationView.binNumericLabel")}
                        </span>
                      </label>

                      {controls.pieBinNumeric && (
                        <div className="space-y-3 pl-6 pt-1 border-l-2 border-neutral-100 dark:border-neutral-800 ml-1">
                          <div>
                            <label className={labelClass}>
                              {t("presentationView.numericColumnLabel")}
                            </label>
                            <select
                              data-testid="pie-numeric-col-select"
                              disabled={disabled || numericColumns.length === 0}
                              value={controls.pieNumericCol}
                              onChange={(e) =>
                                onControlsChange({ pieNumericCol: e.target.value })
                              }
                              className={inputControlClass}
                            >
                              <option value="">{t("presentationView.noneOption")}</option>
                              {numericColumns.map((col) => (
                                <option key={col} value={col}>
                                  {getColDisplayName(col)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className={labelClass}>
                              {t("presentationView.binCountLabel")}
                            </label>
                            <select
                              data-testid="pie-bin-count-select"
                              disabled={disabled}
                              value={controls.pieBinCount}
                              onChange={(e) =>
                                onControlsChange({ pieBinCount: Number(e.target.value) })
                              }
                              className={inputControlClass}
                            >
                              {[2, 3, 4, 5, 6].map((n) => (
                                <option key={n} value={n}>
                                  {n} {t("presentationView.binCountUnit")}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {chartType === "histogram" && (
                    <label className="flex items-center gap-2.5 cursor-pointer select-none group/check py-0.5">
                      <input
                        type="checkbox"
                        data-testid="histogram-kde-checkbox"
                        disabled={disabled}
                        checked={controls.showHistogramDensity}
                        onChange={(e) =>
                          onControlsChange({
                            showHistogramDensity: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500/20 dark:bg-neutral-800 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 group-hover/check:text-neutral-900 dark:group-hover/check:text-neutral-100 transition-colors">
                        {t("presentationView.showKdeLabel")}
                      </span>
                    </label>
                  )}

                  {chartType === "heatmap" && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>
                          {t("presentationView.coefficientLabel")}
                        </label>
                        <div className="grid grid-cols-3 gap-1 rounded-md bg-neutral-100 dark:bg-neutral-800/80 p-0.5 border border-neutral-200/70 dark:border-neutral-700/60">
                          {(["pearson", "spearman", "kendall"] as const).map((method) => (
                            <button
                              key={method}
                              type="button"
                              data-testid={`heatmap-method-${method}`}
                              disabled={disabled}
                              onClick={() =>
                                onControlsChange({ heatmapCorrMethod: method })
                              }
                              className={`py-1 text-center rounded text-xs capitalize transition-all ${
                                controls.heatmapCorrMethod === method
                                  ? "bg-white dark:bg-neutral-700 font-semibold text-neutral-900 dark:text-white shadow-2xs"
                                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                              }`}
                            >
                              {method}
                            </button>
                          ))}
                        </div>
                      </div>

                      {onExportCsv && (
                        <button
                          type="button"
                          data-testid="heatmap-export-csv-btn"
                          disabled={disabled}
                          onClick={onExportCsv}
                          className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 hover:bg-white dark:bg-neutral-800/60 dark:hover:bg-neutral-800 px-3 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all shadow-2xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {t("presentationView.exportCsvButton")}
                        </button>
                      )}
                    </div>
                  )}

                  {chartType === "radar" && (
                    <div>
                      <label className={labelClass}>
                        {t("presentationView.numericAxesLabel")}
                      </label>
                      <div className="border border-neutral-200 dark:border-neutral-700/80 rounded-md max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 bg-neutral-50/30 dark:bg-neutral-900/40">
                        {numericColumns.slice(0, 16).map((col) => {
                          const checked = controls.radarNumericCols.includes(col);
                          const canAdd = checked || controls.radarNumericCols.length < 8;
                          return (
                            <label
                              key={col}
                              className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs select-none cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${
                                !canAdd || disabled ? "opacity-50 cursor-not-allowed" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                data-testid={`radar-axis-checkbox-${col}`}
                                disabled={disabled || !canAdd}
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? controls.radarNumericCols.filter((x) => x !== col)
                                    : controls.radarNumericCols.length < 8
                                    ? [...controls.radarNumericCols, col]
                                    : controls.radarNumericCols;
                                  onControlsChange({ radarNumericCols: next });
                                }}
                                className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500/20 dark:bg-neutral-800 cursor-pointer"
                              />
                              <span className="text-neutral-700 dark:text-neutral-300 truncate" title={getColDisplayName(col)}>
                                {getColDisplayName(col)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}
          </>
        )}

        {/* Universal Accordion: Labels & Typography */}
        <details className="group">
          <summary className="w-full px-4 py-3 flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 cursor-pointer select-none transition-colors list-none [&::-webkit-details-marker]:hidden focus:outline-none focus-visible:bg-neutral-50 dark:focus-visible:bg-neutral-800/50">
            <span className="flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
              <span>{t("presentationView.accordionLabels")}</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-open:rotate-180 transition-transform duration-200 ease-out" />
          </summary>
          <div className="px-4 pb-4 pt-0.5 space-y-3 bg-white dark:bg-neutral-900">
            {/* Custom Title Override */}
            <div>
              <label className={labelClass}>
                {t("presentationView.titleOverrideLabel")}
              </label>
              <input
                type="text"
                data-testid="title-override-input"
                disabled={disabled}
                value={config.titleOverride}
                placeholder={t("presentationView.titleOverridePlaceholder")}
                onChange={(e) => onChange({ titleOverride: e.target.value })}
                className={inputControlClass}
              />
            </div>

            {/* Subtitle / Note */}
            <div>
              <label className={labelClass}>
                {t("presentationView.subtitleLabel")}
              </label>
              <input
                type="text"
                data-testid="subtitle-input"
                disabled={disabled}
                value={config.subtitle}
                placeholder={t("presentationView.subtitlePlaceholder")}
                onChange={(e) => onChange({ subtitle: e.target.value })}
                className={inputControlClass}
              />
            </div>

            {/* Data Labels + Decimals */}
            {supportsDataLabels(chartType) && (
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group/check py-0.5">
                  <input
                    type="checkbox"
                    data-testid="show-data-labels-checkbox"
                    disabled={disabled}
                    checked={config.showDataLabels}
                    onChange={(e) => onChange({ showDataLabels: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500/20 dark:bg-neutral-800 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 group-hover/check:text-neutral-900 dark:group-hover/check:text-neutral-100 transition-colors">
                    {t("presentationView.showDataLabelsLabel")}
                  </span>
                </label>

                {config.showDataLabels && (
                  <div className="pl-6 pt-1 space-y-1 border-l-2 border-neutral-100 dark:border-neutral-800 ml-1">
                    <label className={labelClass}>
                      {t("presentationView.decimalsLabel")}
                    </label>
                    <select
                      data-testid="decimals-select"
                      disabled={disabled}
                      value={config.decimals}
                      onChange={(e) =>
                        onChange({ decimals: Number(e.target.value) })
                      }
                      className={inputControlClass}
                    >
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}
