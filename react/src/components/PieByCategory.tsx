import { useEffect, useMemo, useState } from 'react';
// MUI and Recharts imports for pie chart
import { Paper, Typography } from '@mui/material';
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Currency } from '../types';
import { getMonthCategoryTotals } from '../services/idb';
import { toFixed2 } from '../services/currency';

// Props: selected year/month/currency for chart
interface Props { year: number; month: number; currency: Currency; }

export default function PieByCategory({ year, month, currency }: Props) {
  // Chart data: array of {name, value}
  const [data, setData] = useState<{name:string; value:number}[]>([]);
  // Fetch category totals when year/month/currency changes
  useEffect(() => { getMonthCategoryTotals(year, month, currency).then(setData); }, [year, month, currency]);
  // Generate color palette for pie slices
  const colors = useMemo(()=>Array.from({length:12},(_,i)=>`hsl(${i*30},70%,55%)`),[]);
  return (
    <Paper sx={{ p:2, height: 380 }}>
      {/* Chart title */}
      <Typography variant="h6" sx={{ mb: 1 }}>Pie by Category: {year}/{month} — {currency}</Typography>
      {/* Responsive pie chart */}
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={110} label={({name, value})=> `${name}: ${toFixed2(value)}`}>
            {data.map((_,i)=><Cell key={i} fill={colors[i%colors.length]} />)}
          </Pie>
          <Tooltip formatter={(v:number)=>toFixed2(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Paper>
  );
}