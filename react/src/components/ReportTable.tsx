import React, { useEffect, useMemo, useState } from "react";
// MUI imports for table and layout
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Button,
  Stack,
} from "@mui/material";
import { getReport } from "../services/idb";
import type { Currency } from "../types"; // Currency type for props

type Props = {
  year: number;
  month: number;
  currency: Currency; // Currency type for report
};

export default function ReportTable({ year, month, currency }: Props) {
  // State for report data and JSON view toggle
  const [data, setData] = useState<any>(null);
  const [showJson, setShowJson] = useState(false);

  // Fetch report when year/month/currency changes
  useEffect(() => {
    (async () => {
      try {
        const rep = await getReport(year, month, currency); // currency is Currency type
        setData(rep);
        console.log("[REPORT]", rep);
      } catch (err) {
        console.error("Failed to load report:", err);
      }
    })();
  }, [year, month, currency]);

  // Memoized JSON string for display
  const jsonText = useMemo(
      () => (data ? JSON.stringify(data, null, 2) : ""),
      [data]
  );

  if (!data) return null;

  return (
      <Paper sx={{ p: 3 }}>
        {/* Header and Show/Hide JSON button */}
        <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
        >
          <Typography variant="h6">
            Report: {year}/{month} — {currency}
          </Typography>
          <Button variant="outlined" onClick={() => setShowJson((v) => !v)}>
            {showJson ? "Hide JSON" : "Show JSON"}
          </Button>
        </Stack>

        {/* JSON view (toggle) */}
        {showJson && (
            <pre
                style={{
                  background: "#0b1021",
                  color: "#e6f3ff",
                  padding: 12,
                  borderRadius: 8,
                  overflowX: "auto",
                  marginBottom: 16,
                }}
            >
          {jsonText}
        </pre>
        )}

        {/* Table of costs */}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Day</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Sum</TableCell>
              <TableCell>Currency</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Cost rows */}
            {data.costs.map((r: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell>{r.Date.day}</TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell align="right">{r.sum.toFixed(2)}</TableCell>
                  <TableCell>{r.currency}</TableCell>
                </TableRow>
            ))}
            {/* Total row */}
            <TableRow>
              <TableCell colSpan={3} align="right">
                <b>Total</b>
              </TableCell>
              <TableCell align="right">
                <b>{data.total.total.toFixed(2)}</b>
              </TableCell>
              <TableCell>
                <b>{data.total.currency}</b>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>
  );
}
