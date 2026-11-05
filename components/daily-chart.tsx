"use client";

/**
 * Glasses per day for the last 14 days, oldest first, with a dashed reference line at the daily
 * goal. Empty days are drawn as empty bars in their place — the window is filled, so a day with
 * no history never drops off the axis.
 */
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { niceAxis } from "@/lib/chart-periods";
import { formatDay, formatDayShort } from "@/lib/days";

export type DayRow = { day: string; glasses: number };

const config = { glasses: { label: "Glasses", color: "var(--chart-1)" } } satisfies ChartConfig;

export function DailyChart({ rows, goal }: { rows: DayRow[]; goal: number }) {
  const axis = niceAxis(Math.max(goal, ...rows.map((row) => row.glasses)));
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={rows} margin={{ top: 20, right: 8, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(value: string) => formatDayShort(value)}
          // Fourteen labels do not fit a phone; show every fourth, the tooltip names the rest.
          interval={3}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          domain={[0, axis.top]}
          ticks={axis.ticks}
          width={axis.width}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12 }}
        />
        <ChartTooltip
          content={<ChartTooltipContent />}
          labelFormatter={(label) => formatDay(String(label))}
        />
        <Bar dataKey="glasses" fill="var(--color-glasses)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        <ReferenceLine
          y={goal}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={{
            value: `Goal ${goal}`,
            position: "insideTopLeft",
            fontSize: 12,
            fill: "var(--muted-foreground)",
          }}
        />
      </BarChart>
    </ChartContainer>
  );
}