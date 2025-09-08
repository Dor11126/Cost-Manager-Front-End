import { useState } from 'react';
// MUI imports for form layout
import { Box, TextField, MenuItem, Button, Stack, Paper } from '@mui/material';
import { addCost } from '../services/idb';
import { Currency } from '../types';

// Props: callback for when a cost is added
interface Props { onAdded?: ()=>void; }

export default function CostForm({ onAdded }: Props) {
  // Form fields state
  const [sum, setSum] = useState<number>(0);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState('');
  // Submit handler: validate and add cost
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sum || sum <= 0) return;
    await addCost({ sum, currency, category, description });
    setSum(0); setDescription('');
    onAdded?.();
  };
  return (
    <Paper sx={{ p: 2 }}>
      {/* Cost entry form */}
      <Box component="form" onSubmit={submit}>
        <Stack direction={{ xs:'column', sm:'row' }} spacing={2}>
          {/* Amount input */}
          <TextField type="number" label="Sum" value={sum} inputProps={{ step: '0.01' }} onChange={(e)=>setSum(Number(e.target.value))} required />
          {/* Currency selector */}
          <TextField select label="Currency" value={currency} onChange={(e)=>setCurrency(e.target.value as Currency)}>
            <MenuItem value="USD">USD</MenuItem><MenuItem value="ILS">ILS</MenuItem><MenuItem value="GBP">GBP</MenuItem><MenuItem value="EURO">EURO</MenuItem>
          </TextField>
          {/* Category input */}
          <TextField label="Category" value={category} onChange={(e)=>setCategory(e.target.value)} required />
          {/* Description input */}
          <TextField label="Description" value={description} onChange={(e)=>setDescription(e.target.value)} />
          {/* Submit button */}
          <Button type="submit" variant="contained">Add</Button>
        </Stack>
      </Box>
    </Paper>
  );
}