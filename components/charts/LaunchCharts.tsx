"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import type { DashboardStats } from "@/lib/types";

echarts.use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const PALETTE = ["#6ee7ff", "#8b93ff", "#fbbf24", "#34d399", "#fb7185", "#a78bfa", "#38bdf8"];

const TABS = [
  { id: "cadence", label: "Cadence" },
  { id: "providers", label: "Providers" },
  { id: "orbits", label: "Orbits" },
  { id: "status", label: "Status" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const AXIS = {
  axisLine: { lineStyle: { color: "rgba(255,255,255,0.14)" } },
  axisTick: { show: false },
  axisLabel: { color: "#8f9bba", fontSize: 10, fontFamily: "ui-monospace, monospace" },
  splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)" } },
};

function buildOption(tab: TabId, stats: DashboardStats): EChartsCoreOption {
  const tooltip = {
    backgroundColor: "#080d18",
    borderColor: "rgba(110,231,255,0.3)",
    textStyle: { color: "#e7edff", fontSize: 12 },
    extraCssText: "border-radius:10px;",
  };

  if (tab === "cadence") {
    return {
      backgroundColor: "transparent",
      grid: { left: 34, right: 16, top: 18, bottom: 26 },
      tooltip: { ...tooltip, trigger: "axis" },
      xAxis: { type: "category", data: stats.monthly.map((m) => m.month), ...AXIS, splitLine: { show: false } },
      yAxis: { type: "value", ...AXIS },
      series: [
        {
          type: "bar",
          data: stats.monthly.map((m) => m.launches),
          barWidth: "46%",
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#6ee7ff" },
              { offset: 1, color: "rgba(110,231,255,0.08)" },
            ]),
          },
          emphasis: { itemStyle: { color: "#a5f3ff" } },
        },
      ],
    };
  }

  if (tab === "providers") {
    const data = [...stats.providers].reverse();
    return {
      backgroundColor: "transparent",
      grid: { left: 96, right: 20, top: 12, bottom: 22 },
      tooltip: { ...tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "value", ...AXIS },
      yAxis: {
        type: "category",
        data: data.map((p) => p.name),
        ...AXIS,
        splitLine: { show: false },
        axisLabel: { ...AXIS.axisLabel, width: 90, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: data.map((p) => p.value),
          barWidth: "55%",
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "rgba(139,147,255,0.35)" },
              { offset: 1, color: "#8b93ff" },
            ]),
          },
        },
      ],
    };
  }

  const isStatus = tab === "status";
  const data = isStatus ? stats.statuses : stats.orbits;

  return {
    backgroundColor: "transparent",
    tooltip: { ...tooltip, trigger: "item" },
    legend: {
      bottom: 0,
      textStyle: { color: "#8f9bba", fontSize: 10 },
      itemWidth: 8,
      itemHeight: 8,
      icon: "circle",
    },
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "44%"],
        padAngle: 2,
        itemStyle: { borderRadius: 4, borderColor: "#04050c", borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            color: "#e7edff",
            fontSize: 12,
            formatter: "{b}\n{d}%",
          },
        },
        data: data.map((entry, index) => ({
          name: entry.name,
          value: entry.value,
          itemStyle: { color: PALETTE[index % PALETTE.length] },
        })),
      },
    ],
  };
}

export function LaunchCharts({ stats }: { stats: DashboardStats }) {
  const [tab, setTab] = useState<TabId>("cadence");
  const container = useRef<HTMLDivElement | null>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const instance = echarts.init(container.current, undefined, { renderer: "canvas" });
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(buildOption(tab, stats), true);
  }, [tab, stats]);

  return (
    <div className="panel flex h-full flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Analytics</p>
          <h2 className="mt-1 text-base font-semibold text-ink">Launch cadence & mix</h2>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition ${
                tab === item.id ? "bg-ion/15 text-ion" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={container} className="mt-3 h-[268px] w-full" aria-label="Launch statistics chart" />

      <p className="mt-auto pt-2 text-[11px] leading-relaxed text-muted/80">
        {tab === "cadence" && "Monthly launch count across tracked upcoming and completed missions."}
        {tab === "providers" && "Upcoming share by launch service provider."}
        {tab === "orbits" && "Target orbit distribution for scheduled missions."}
        {tab === "status" && "Status mix across the tracked launch set."}
      </p>
    </div>
  );
}
