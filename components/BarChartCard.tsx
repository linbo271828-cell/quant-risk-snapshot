"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "../lib/utils";

type BarChartCardProps = {
  title: string;
  data: Array<{ name: string; value: number }>;
  valueFormatter?: (value: number) => string;
  className?: string;
};

export default function BarChartCard({ title, data, valueFormatter, className }: BarChartCardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <h3 className="mb-4 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="h-60 w-full">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={valueFormatter} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
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
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
