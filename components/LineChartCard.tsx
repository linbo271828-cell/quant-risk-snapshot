"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "../lib/utils";

type LineChartCardProps = {
  title: string;
  data: Array<{ name: string; value: number | null }>;
  valueFormatter?: (value: number) => string;
  className?: string;
  color?: string;
};

export default function LineChartCard({
  title,
  data,
  valueFormatter,
  className,
  color = "#2563eb",
}: LineChartCardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="h-60 w-full">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" hide />
            <YAxis
              tickFormatter={valueFormatter}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 12,
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / .05)",
              }}
              formatter={(value) =>
                typeof value === "number" ? (valueFormatter?.(value) ?? value) : value
              }
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
