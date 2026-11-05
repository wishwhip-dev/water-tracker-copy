# Charts

`@/components/ui/chart` wraps Recharts and maps your series onto the project's theme. It is
already installed and already themed — do not add a charting library, and do not hand-roll an SVG
bar chart.

```tsx
"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config = { spend: { label: "Spend", color: "var(--chart-1)" } } satisfies ChartConfig;

<ChartContainer config={config} className="h-[240px] w-full">
  <AreaChart data={data}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="month" tickLine={false} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Area dataKey="spend" stroke="var(--color-spend)" fill="var(--color-spend)"
          fillOpacity={0.2} isAnimationActive={false} />
  </AreaChart>
</ChartContainer>
```

Each key in `config` becomes a `--color-<key>` variable, so `color: "var(--chart-1)"` in the
config is what `stroke="var(--color-spend)"` resolves to. Five colours are themed, `--chart-1`
through `--chart-5`. Use them rather than hex values: they are the only chart colours that follow
the project's palette, in light and in dark mode alike (the tokens switch with the device). Give a
series `color`, not `theme`: a `theme: { light, dark }` entry follows a `.dark` class this project
never sets.

## Every period on the axis, empty ones too

Rows grouped by month have no row for a month with nothing in it, and the chart then skips that
month: May sits next to August and nobody can tell June and July were empty. When the chart shows
a range of months (or weeks, or days), fill it with `fillPeriods` from `@/lib/chart-periods`, so an
empty month is an empty bar in its place:

```tsx
import { fillPeriods, periodKey, periodLabel } from "@/lib/chart-periods";

// totals: [{ month: "2026-05", spend: 120 }, { month: "2026-08", spend: 80 }], keyed with periodKey(date)
const rows = fillPeriods(totals, { key: "month", from: firstDate, to: today, empty: (month) => ({ month, spend: 0 }) })
  .map((row) => ({ ...row, label: periodLabel(row.month) }));   // "May", "Jun", "Jul", "Aug"
```

`unit: "week"` or `"day"` does the same for weeks (keyed by their Monday) and days. `from` and
`to` are dates you pass: read today's date in an event handler or once the page has hydrated, never
during render. When a caption promises "every month", this is what keeps the promise.

## Leave out the period still going

Tonight has no sleep logged until morning, and this month is half spent. A rolling window ("last 7
nights") or an average that counts the current period counts an empty one and comes out low. Take
the window from `recentPeriods`, which ends at the last complete period, and average over those
keys only:

```tsx
import { recentPeriods } from "@/lib/chart-periods";

const nights = recentPeriods(7, { now: today, unit: "day" });   // yesterday and the 6 before it
const logged = nights.map((night) => byNight.get(night)).filter((entry) => entry !== undefined);
const average = logged.length ? logged.reduce((sum, entry) => sum + entry.hours, 0) / logged.length : null;
```

`includeCurrent: true` is for a period that already has its data (a night keyed by the morning it
ended, logged on waking). `lastCompletePeriod(now, unit)` is the `to` to give `fillPeriods`.

## Whole, even ticks and labels that fit

Recharts picks ticks from the data and draws them at its default axis width, so a top of 10 can
come out as 0, 3, 6, 10 with "10" clipped to ".0". `niceAxis` gives the axis a round top, even
whole-number ticks and a width for its longest label:

```tsx
import { niceAxis } from "@/lib/chart-periods";
import { Bar, BarChart, ReferenceLine, YAxis } from "recharts";

const axis = niceAxis(Math.max(0, ...rows.map((row) => row.hours)));   // top 10, ticks 0, 2, 4, 6, 8, 10, width 40

<BarChart data={rows} margin={{ top: 16, right: 8 }}>
  <YAxis domain={[0, axis.top]} ticks={axis.ticks} width={axis.width} allowDecimals={false} tickLine={false} axisLine={false} />
  <Bar dataKey="hours" fill="var(--color-hours)" isAnimationActive={false} />
  <ReferenceLine y={average} stroke="var(--muted-foreground)" strokeDasharray="4 4"
                 label={{ value: "7-night avg", position: "insideTopLeft", fontSize: 12, fill: "var(--muted-foreground)" }} />
</BarChart>
```

Pass the axis's `tickFormatter` as `format` when labels carry a unit ("8h"), so the width counts
it. A reference line comes after the bars, so it draws over them, and its label sits at the left,
above the line (`position: "insideTopLeft"`), where the newest bars on the right cannot cover it;
the chart's top margin keeps the top tick's label in the box.

## `isAnimationActive={false}` on every series is not optional

Recharts animates a series in from zero on mount, and that animation does not complete in the
headless browser this project is verified with. The grid and the axes draw, the data does not, and
the chart is checked as an empty box — a verification failure on a chart that is perfectly correct
in a real browser.

Measured, not guessed. Set it on every `Area`, `Bar`, `Line`, `Pie` and `Radar` you render.

If you want the chart to animate for a real visitor, animate its *container* with Motion instead —
the entrance is what reads as motion anyway, and the series itself stays drawn from the first
frame.

## A chart needs a height

`ChartContainer` fills its parent, and a parent with no height collapses it to nothing. Give it an
explicit height (`h-[240px]`, `aspect-video`) or put it in a grid row that has one. A chart that
renders as a 0px box is the second most common way this goes wrong.

## Clear of a bar fixed to the bottom

The axis labels are the last thing a chart draws, and a chart is often the last thing on its page.
On a phone with a tab bar fixed to the bottom edge they end up under the bar unless the page makes
room: the content above a fixed bottom bar ends with `pb-bottom-bar` (the bar's height,
`--bottom-bar` in `app/globals.css`, plus the home indicator), and the bar itself takes the
`bottom-bar` utility: fixed to the edge, never sticky. Put it on the page's scrolling container once, in the layout that renders
the bar, never as a margin under one chart. Keep the axis inside the chart's own height too: a
`ChartContainer` with an `XAxis` needs room for the labels below the bars (`h-[240px]`, not the
bars' height alone).

## Client component

Recharts measures the DOM, so anything rendering a chart needs `"use client"` at the top of the
file. A chart in a server component fails at build, not at runtime.

## In a post or a panel

A quantity over a range is a chart. When the reader needs to see the shape of a relationship, the
component is `ChartContainer`, never a sentence and never a hand-drawn SVG. In a media plan it is
the second view beside the control that drives it:

```
section            reader does                    medium
performance        drags a ratio                  Slider + Table breakdown + ChartContainer
```
