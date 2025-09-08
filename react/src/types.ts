export type Currency = 'USD' | 'ILS' | 'GBP' | 'EURO';
export interface Cost { id?: number; sum: number; currency: Currency; category: string; description: string; Date: { year: number; month: number; day: number }; dateISO: string; }
export interface Report { year: number; month: number; costs: Array<{ sum: number; currency: Currency; category: string; description: string; Date: { day: number }; }>; total: { currency: Currency; total: number }; }
export type Rates = Record<Currency, number>;
