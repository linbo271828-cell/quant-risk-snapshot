"use client";

import { cn } from "../lib/utils";

type CorrHeatmapProps = {
  tickers: string[];
  matrix: number[][];
  className?: string;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function corrColor(value: number): string {
  const v = Math.max(-1, Math.min(1, value));
  let r: number, g: number, b: number;
  if (v >= 0) {
    r = Math.round(lerp(255, 220, v));
    g = Math.round(lerp(255, 38, v));
    b = Math.round(lerp(255, 38, v));
  } else {
    const t = -v;
    r = Math.round(lerp(255, 37, t));
    g = Math.round(lerp(255, 99, t));
    b = Math.round(lerp(255, 235, t));
  }
  return `rgb(${r},${g},${b})`;
}

function textColor(value: number): string {
  return Math.abs(value) > 0.55 ? "#fff" : "#1e293b";
}

export default function CorrHeatmap({ tickers, matrix, className }: CorrHeatmapProps) {
  if (tickers.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <h3 className="mb-4 text-sm font-semibold text-slate-700">Correlation heatmap</h3>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="p-1" />
              {tickers.map((t) => (
                <th key={t} className="px-2 py-1 text-center font-semibold text-slate-500">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={tickers[i]}>
                <td className="pr-2 font-semibold text-slate-500">{tickers[i]}</td>
                {row.map((val, j) => (
                  <td
                    key={`${i}-${j}`}
                    className="px-2 py-1.5 text-center tabular-nums"
                    style={{
                      backgroundColor: corrColor(val),
                      color: textColor(val),
                      minWidth: 52,
                      borderRadius: 4,
                    }}
                  >
                    {val.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
