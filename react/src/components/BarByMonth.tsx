/** Bar chart for yearly totals per month. */
import { useEffect, useState } from 'react';
// MUI and Recharts imports for chart rendering
import { Paper, Typography } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Currency } from '../types';
import { getYearMonthTotals } from '../services/idb';

// Props: selected year and currency for the chart
interface Props { year: number; currency: Currency; }

export default function BarByMonth({ year, currency }: Props) {
  // Chart data: array of {month, total}
  const [data, setData] = useState<{month:string; total:number}[]>([]);
  // Fetch totals per month when year/currency changes
  useEffect(() => { getYearMonthTotals(year, currency).then(setData); }, [year, currency]);
  return (
    <Paper sx={{ p:2, height: 380 }}>
      {/* Chart title */}
      <Typography variant="h6" sx={{ mb: 1 }}>Bar by Month: {year} — {currency}</Typography>
      {/* Responsive bar chart */}
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="total" name="Total" />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}