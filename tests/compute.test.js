/**
 * Unit tests for the Compute module pure functions.
 * Tests are example-based, covering the key behaviors and edge cases.
 */
import { describe, it, expect } from 'vitest';
import {
  formatIDR,
  totalBalance,
  categoryTotals,
  sortTransactions,
  monthlySummary,
} from '../js/compute.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a minimal transaction object for testing. */
function makeTx({ id = '1', name = 'Item', amount, category, createdAt = '2025-09-21T10:00:00.000Z' } = {}) {
  return { id, name, amount, category, createdAt };
}

// ─── compute.formatIDR ───────────────────────────────────────────────────────

describe('compute.formatIDR', () => {
  it('formats 0 as "Rp 0"', () => {
    expect(formatIDR(0)).toBe('Rp 0');
  });

  it('formats a three-digit number without a separator', () => {
    expect(formatIDR(500)).toBe('Rp 500');
  });

  it('formats 12500 as "Rp 12.500"', () => {
    expect(formatIDR(12500)).toBe('Rp 12.500');
  });

  it('formats 1234567 as "Rp 1.234.567"', () => {
    expect(formatIDR(1234567)).toBe('Rp 1.234.567');
  });

  it('formats the maximum value 999999999999 as "Rp 999.999.999.999"', () => {
    expect(formatIDR(999999999999)).toBe('Rp 999.999.999.999');
  });

  it('formats exactly 1000 as "Rp 1.000"', () => {
    expect(formatIDR(1000)).toBe('Rp 1.000');
  });

  it('always starts with "Rp "', () => {
    for (const n of [0, 1, 99, 1000, 12500, 1000000]) {
      expect(formatIDR(n).startsWith('Rp ')).toBe(true);
    }
  });

  it('never contains a decimal point in the output', () => {
    for (const n of [0, 1, 12500, 1234567, 999999999999]) {
      const s = formatIDR(n);
      // The decimal point must not appear in the numeric part (after "Rp ")
      expect(s.slice(3).includes(',')).toBe(false);
      // Only periods used, and only as thousands separators
      const numericPart = s.slice(3);
      if (numericPart.includes('.')) {
        // Every segment separated by '.' must be exactly 3 digits (except first)
        const parts = numericPart.split('.');
        expect(parts[0].length).toBeGreaterThanOrEqual(1);
        expect(parts[0].length).toBeLessThanOrEqual(3);
        for (let i = 1; i < parts.length; i++) {
          expect(parts[i].length).toBe(3);
        }
      }
    }
  });
});

// ─── compute.totalBalance ────────────────────────────────────────────────────

describe('compute.totalBalance', () => {
  it('returns 0 for an empty array', () => {
    expect(totalBalance([])).toBe(0);
  });

  it('returns the amount for a single transaction', () => {
    expect(totalBalance([makeTx({ amount: 5000 })])).toBe(5000);
  });

  it('sums multiple transactions correctly', () => {
    const txs = [
      makeTx({ amount: 10000 }),
      makeTx({ amount: 25000 }),
      makeTx({ amount: 7500 }),
    ];
    expect(totalBalance(txs)).toBe(42500);
  });

  it('handles a single large amount', () => {
    expect(totalBalance([makeTx({ amount: 999999999999 })])).toBe(999999999999);
  });

  it('sums all amounts without rounding error for integers', () => {
    const txs = [makeTx({ amount: 1 }), makeTx({ amount: 2 }), makeTx({ amount: 3 })];
    expect(totalBalance(txs)).toBe(6);
  });
});

// ─── compute.categoryTotals ──────────────────────────────────────────────────

describe('compute.categoryTotals', () => {
  it('returns an empty Map for an empty transaction list', () => {
    expect(categoryTotals([]).size).toBe(0);
  });

  it('groups amounts by category', () => {
    const txs = [
      makeTx({ amount: 10000, category: 'Food' }),
      makeTx({ amount: 5000, category: 'Transport' }),
      makeTx({ amount: 8000, category: 'Food' }),
    ];
    const map = categoryTotals(txs);
    expect(map.get('Food')).toBe(18000);
    expect(map.get('Transport')).toBe(5000);
  });

  it('returns a Map with exactly one entry per distinct category', () => {
    const txs = [
      makeTx({ amount: 1000, category: 'Food' }),
      makeTx({ amount: 2000, category: 'Food' }),
      makeTx({ amount: 3000, category: 'Fun' }),
    ];
    const map = categoryTotals(txs);
    expect(map.size).toBe(2);
  });

  it('does not include categories with a zero total', () => {
    // This tests the explicit exclusion of zero-sum entries.
    // In practice amounts are always positive, but we verify the guard.
    const txs = [
      makeTx({ amount: 0, category: 'Food' }),
      makeTx({ amount: 5000, category: 'Transport' }),
    ];
    const map = categoryTotals(txs);
    expect(map.has('Food')).toBe(false);
    expect(map.has('Transport')).toBe(true);
  });

  it('handles a single transaction', () => {
    const txs = [makeTx({ amount: 15000, category: 'Fun' })];
    const map = categoryTotals(txs);
    expect(map.get('Fun')).toBe(15000);
  });
});

// ─── compute.sortTransactions ────────────────────────────────────────────────

describe('compute.sortTransactions', () => {
  const txs = [
    makeTx({ id: 'a', amount: 3000, category: 'Transport' }),
    makeTx({ id: 'b', amount: 1000, category: 'Food' }),
    makeTx({ id: 'c', amount: 2000, category: 'Fun' }),
  ];

  it('returns original order when field is null', () => {
    const result = sortTransactions(txs, { field: null, direction: 'asc' });
    expect(result.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('does NOT mutate the original array', () => {
    const original = [...txs];
    sortTransactions(txs, { field: 'amount', direction: 'asc' });
    expect(txs).toEqual(original);
  });

  it('sorts by amount ascending', () => {
    const result = sortTransactions(txs, { field: 'amount', direction: 'asc' });
    expect(result.map(t => t.amount)).toEqual([1000, 2000, 3000]);
  });

  it('sorts by amount descending', () => {
    const result = sortTransactions(txs, { field: 'amount', direction: 'desc' });
    expect(result.map(t => t.amount)).toEqual([3000, 2000, 1000]);
  });

  it('sorts by category ascending (A–Z)', () => {
    const result = sortTransactions(txs, { field: 'category', direction: 'asc' });
    expect(result.map(t => t.category)).toEqual(['Food', 'Fun', 'Transport']);
  });

  it('sorts by category descending (Z–A)', () => {
    const result = sortTransactions(txs, { field: 'category', direction: 'desc' });
    expect(result.map(t => t.category)).toEqual(['Transport', 'Fun', 'Food']);
  });

  it('returns all original transactions (no additions or removals)', () => {
    const result = sortTransactions(txs, { field: 'amount', direction: 'asc' });
    const originalIds = new Set(txs.map(t => t.id));
    const resultIds = new Set(result.map(t => t.id));
    expect(resultIds).toEqual(originalIds);
    expect(result.length).toBe(txs.length);
  });

  it('handles an empty list', () => {
    expect(sortTransactions([], { field: 'amount', direction: 'asc' })).toEqual([]);
  });

  it('handles a single-element list without error', () => {
    const single = [makeTx({ id: 'x', amount: 500, category: 'Food' })];
    expect(sortTransactions(single, { field: 'amount', direction: 'desc' })).toEqual(single);
  });

  it('category sort is case-insensitive', () => {
    const mixed = [
      makeTx({ id: '1', amount: 100, category: 'food' }),
      makeTx({ id: '2', amount: 200, category: 'TRANSPORT' }),
      makeTx({ id: '3', amount: 300, category: 'Fun' }),
    ];
    const result = sortTransactions(mixed, { field: 'category', direction: 'asc' });
    const categories = result.map(t => t.category.toLowerCase());
    expect(categories).toEqual(['food', 'fun', 'transport']);
  });
});

// ─── compute.monthlySummary ──────────────────────────────────────────────────

describe('compute.monthlySummary', () => {
  it('returns an empty array for an empty transaction list', () => {
    expect(monthlySummary([])).toEqual([]);
  });

  it('returns a single entry for transactions in one month', () => {
    const txs = [
      makeTx({ amount: 10000, createdAt: '2025-09-01T08:00:00.000Z' }),
      makeTx({ amount: 5000, createdAt: '2025-09-15T12:00:00.000Z' }),
    ];
    const result = monthlySummary(txs);
    expect(result.length).toBe(1);
    expect(result[0].label).toBe('September 2025');
    expect(result[0].total).toBe(15000);
  });

  it('groups by calendar month and sums correctly across multiple months', () => {
    const txs = [
      makeTx({ amount: 10000, createdAt: '2025-07-10T00:00:00.000Z' }),
      makeTx({ amount: 20000, createdAt: '2025-09-05T00:00:00.000Z' }),
      makeTx({ amount: 5000, createdAt: '2025-09-20T00:00:00.000Z' }),
    ];
    const result = monthlySummary(txs);
    expect(result.length).toBe(2);
    const labels = result.map(r => r.label);
    expect(labels).toContain('September 2025');
    expect(labels).toContain('July 2025');
    const sep = result.find(r => r.label === 'September 2025');
    expect(sep.total).toBe(25000);
  });

  it('returns results in reverse chronological order (most recent first)', () => {
    const txs = [
      makeTx({ amount: 1000, createdAt: '2025-07-01T00:00:00.000Z' }),
      makeTx({ amount: 2000, createdAt: '2025-11-01T00:00:00.000Z' }),
      makeTx({ amount: 3000, createdAt: '2025-09-01T00:00:00.000Z' }),
    ];
    const result = monthlySummary(txs);
    expect(result[0].label).toBe('November 2025');
    expect(result[1].label).toBe('September 2025');
    expect(result[2].label).toBe('July 2025');
  });

  it('uses the correct full month name in the label format "Month YYYY"', () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    monthNames.forEach((name, idx) => {
      const month = String(idx + 1).padStart(2, '0');
      const txList = [makeTx({ amount: 100, createdAt: `2025-${month}-15T00:00:00.000Z` })];
      const result = monthlySummary(txList);
      expect(result[0].label).toBe(`${name} 2025`);
    });
  });

  it('handles transactions spanning different years', () => {
    const txs = [
      makeTx({ amount: 1000, createdAt: '2024-12-01T00:00:00.000Z' }),
      makeTx({ amount: 2000, createdAt: '2025-01-01T00:00:00.000Z' }),
    ];
    const result = monthlySummary(txs);
    expect(result[0].label).toBe('January 2025');
    expect(result[1].label).toBe('December 2024');
  });
});
