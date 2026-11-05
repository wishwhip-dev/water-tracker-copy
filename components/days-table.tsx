/**
 * Each of the last 14 days as a row — date and glasses logged, today first — so the fortnight can
 * be read at a glance without following bars to an axis.
 */
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDay } from "@/lib/days";
import type { DayRow } from "@/components/daily-chart";

export function DaysTable({ rows }: { rows: DayRow[] }) {
  const newestFirst = [...rows].reverse();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Glasses logged</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {newestFirst.map((row, index) => (
          <TableRow key={row.day}>
            <TableCell className="whitespace-nowrap">
              {formatDay(row.day)}
              {index === 0 && (
                <Badge variant="secondary" className="ml-2">
                  Today
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.glasses}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
