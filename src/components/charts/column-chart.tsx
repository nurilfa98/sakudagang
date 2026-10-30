// Grafik kolom berkelompok (SVG) untuk laporan: omset & laba bersih per hari
// atau per bulan. Dipakai beranda Pemilik dan laporan bulanan/tahunan.
//
// Aturan tampilan mengikuti panduan dataviz:
// - Satu sumbu Y (semua seri dalam rupiah); nilai negatif (rugi) tumbuh ke
//   bawah dari garis nol.
// - Kolom ≤ 24px, ujung data membulat 4px, sisi garis dasar siku; 2px celah
//   antar kolom dalam satu kelompok.
// - Warna seri dari palet kategori yang sudah divalidasi (biru, oranye),
//   langkah tersendiri untuk mode gelap. Teks tidak pernah memakai warna seri.
// - Legenda selalu ada untuk ≥ 2 seri. Garis bantu tipis & samar.
// - Hover/fokus per kelompok: tooltip berisi semua seri (nilai tebal, nama
//   di belakang). Tooltip hanya pelengkap: tabel di bawah grafik memuat
//   angka yang sama.

"use client";

import { useEffect, useRef, useState } from "react";
import { formatCompactRupiah, formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

// Slot palet kategori 1 & 2 (lihat skill dataviz, palette.md).
export const CHART_SERIES_COLORS = [
  { fill: "fill-[#2a78d6] dark:fill-[#3987e5]", bg: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  { fill: "fill-[#eb6834] dark:fill-[#d95926]", bg: "bg-[#eb6834] dark:bg-[#d95926]" },
] as const;

export type ChartSeries = { name: string };
export type ChartDatum = { label: string; tick: string; values: number[] };

const HEIGHT = 240;
const MARGIN = { top: 12, right: 8, bottom: 28, left: 56 };
const MAX_BAR = 24;
const GAP = 2;
const RADIUS = 4;

export function ColumnChart({
  data,
  series,
  ariaLabel,
}: {
  data: ChartDatum[];
  series: ChartSeries[]; // maksimal 2 (slot warna tersedia)
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const values = data.flatMap((datum) => datum.values);
  const { ticks, min, max } = niceScale(Math.min(0, ...values), Math.max(0, ...values));
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const y = (value: number) => MARGIN.top + ((max - value) / (max - min || 1)) * plotHeight;
  const band = plotWidth / Math.max(data.length, 1);
  const barWidth = Math.max(2, Math.min(MAX_BAR, (band * 0.8 - GAP * (series.length - 1)) / series.length));
  const groupWidth = barWidth * series.length + GAP * (series.length - 1);
  // Label sumbu X secukupnya agar tidak bertumpuk (± 32px per label).
  const tickEvery = Math.max(1, Math.ceil(32 / band));

  const activeDatum = active === null ? null : data[active];
  const tooltipLeft = active === null ? 0 : MARGIN.left + band * active + band / 2;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {series.map((item, index) => (
          <li key={item.name} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm", CHART_SERIES_COLORS[index].bg)} aria-hidden />
            {item.name}
          </li>
        ))}
      </ul>
      <div ref={containerRef} className="relative w-full">
        <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel} className="block overflow-visible">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? "stroke-muted-foreground/50" : "stroke-border"}
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {formatCompactRupiah(tick)}
              </text>
            </g>
          ))}

          {data.map((datum, index) => {
            const x0 = MARGIN.left + band * index + (band - groupWidth) / 2;
            return (
              <g key={datum.label}>
                {active === index && (
                  <rect
                    x={MARGIN.left + band * index}
                    y={MARGIN.top}
                    width={band}
                    height={plotHeight}
                    className="fill-muted"
                  />
                )}
                {datum.values.map((value, seriesIndex) => (
                  <path
                    key={seriesIndex}
                    d={columnPath(x0 + seriesIndex * (barWidth + GAP), barWidth, y(0), y(value))}
                    className={CHART_SERIES_COLORS[seriesIndex].fill}
                  />
                ))}
                {index % tickEvery === 0 && (
                  <text
                    x={MARGIN.left + band * index + band / 2}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px] tabular-nums"
                  >
                    {datum.tick}
                  </text>
                )}
                {/* Area sentuh selebar satu kelompok penuh, lebih besar dari kolomnya. */}
                <rect
                  x={MARGIN.left + band * index}
                  y={MARGIN.top}
                  width={band}
                  height={plotHeight}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${datum.label}: ${series.map((item, i) => `${item.name} ${formatRupiah(datum.values[i])}`).join(", ")}`}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
        </svg>

        {activeDatum && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-40 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-sm shadow-md"
            style={{ left: Math.min(Math.max(tooltipLeft, 80), width - 80) }}
          >
            <p className="mb-1 text-xs text-muted-foreground">{activeDatum.label}</p>
            {series.map((item, index) => (
              <p key={item.name} className="flex items-center gap-2">
                <span className={cn("h-0.5 w-3 rounded-full", CHART_SERIES_COLORS[index].bg)} aria-hidden />
                <span className="font-semibold tabular-nums">{formatRupiah(activeDatum.values[index])}</span>
                <span className="text-muted-foreground">{item.name}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Kolom dari garis dasar (y0) ke nilai (y1): ujung data membulat, sisi dasar
// siku. Nilai negatif (y1 di bawah y0) membulat di bawah.
function columnPath(x: number, width: number, y0: number, y1: number) {
  const height = Math.abs(y1 - y0);
  if (height < 0.5) return "";
  const r = Math.min(RADIUS, width / 2, height);
  if (y1 < y0) {
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + width - r} Q${x + width},${y1} ${x + width},${y1 + r} V${y0} Z`;
  }
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + width - r} Q${x + width},${y1} ${x + width},${y1 - r} V${y0} Z`;
}

// Garis bantu bernilai bulat (1, 2, 2.5, 5 × 10^n), ± 4 garis.
function niceScale(minValue: number, maxValue: number) {
  if (minValue === 0 && maxValue === 0) return { ticks: [0, 1000], min: 0, max: 1000 };
  const rough = (maxValue - minValue) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rough) ?? 10 * magnitude;
  const min = Math.floor(minValue / step) * step;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let tick = min; tick <= max + step / 2; tick += step) ticks.push(Math.round(tick));
  return { ticks, min, max };
}
