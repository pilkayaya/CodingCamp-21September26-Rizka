/**
 * Unit tests for the Validator module pure functions.
 * Tests are example-based, covering the key behaviors and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { validateTransaction, validateCategory } from '../js/validator.js';

// ─── validator.validateTransaction ───────────────────────────────────────────

describe('validator.validateTransaction', () => {

  // ── Valid cases ──────────────────────────────────────────────────────────

  it('returns valid for a well-formed transaction', () => {
    const result = validateTransaction({ name: 'Lunch', amount: 50000, category: 'Food' });
    expect(result.valid).toBe(true);
  });

  it('returns valid for amount = 1 (minimum)', () => {
    const result = validateTransaction({ name: 'Coffee', amount: 1, category: 'Food' });
    expect(result.valid).toBe(true);
  });

  it('returns valid for amount = 999999999999 (maximum)', () => {
    const result = validateTransaction({ name: 'Big Purchase', amount: 999999999999, category: 'Fun' });
    expect(result.valid).toBe(true);
  });

  it('returns valid for name exactly 100 characters', () => {
    const name = 'a'.repeat(100);
    const result = validateTransaction({ name, amount: 10000, category: 'Transport' });
    expect(result.valid).toBe(true);
  });

  // ── Name validation ──────────────────────────────────────────────────────

  it('returns invalid when name is empty string', () => {
    const result = validateTransaction({ name: '', amount: 100, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('returns invalid when name is whitespace only', () => {
    const result = validateTransaction({ name: '   ', amount: 100, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('returns invalid when name exceeds 100 characters', () => {
    const name = 'a'.repeat(101);
    const result = validateTransaction({ name, amount: 10000, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  // ── Amount validation ────────────────────────────────────────────────────

  it('returns invalid when amount is 0', () => {
    const result = validateTransaction({ name: 'Lunch', amount: 0, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeDefined();
  });

  it('returns invalid when amount is negative', () => {
    const result = validateTransaction({ name: 'Lunch', amount: -100, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeDefined();
  });

  it('returns invalid with decimal error message when amount is 12.5', () => {
    const result = validateTransaction({ name: 'Lunch', amount: 12.5, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBe('Amount must be a whole number (no decimals)');
  });

  it('returns invalid with decimal error message when amount is 0.01', () => {
    const result = validateTransaction({ name: 'Item', amount: 0.01, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBe('Amount must be a whole number (no decimals)');
  });

  it('returns invalid when amount exceeds 999999999999', () => {
    const result = validateTransaction({ name: 'Lunch', amount: 1000000000000, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeDefined();
  });

  it('returns invalid when amount is empty string', () => {
    const result = validateTransaction({ name: 'Lunch', amount: '', category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeDefined();
  });

  it('returns invalid when amount is null', () => {
    const result = validateTransaction({ name: 'Lunch', amount: null, category: 'Food' });
    expect(result.valid).toBe(false);
    expect(result.errors.amount).toBeDefined();
  });

  // ── Category validation ──────────────────────────────────────────────────

  it('returns invalid when category is empty string', () => {
    const result = validateTransaction({ name: 'Lunch', amount: 50000, category: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.category).toBeDefined();
  });

  it('returns invalid when category is whitespace only', () => {
    const result = validateTransaction({ name: 'Lunch', amount: 50000, category: '   ' });
    expect(result.valid).toBe(false);
    expect(result.errors.category).toBeDefined();
  });

  // ── Multiple errors ──────────────────────────────────────────────────────

  it('can return errors for multiple fields simultaneously', () => {
    const result = validateTransaction({ name: '', amount: 0, category: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.amount).toBeDefined();
    expect(result.errors.category).toBeDefined();
  });

  it('does not include errors object when valid', () => {
    const result = validateTransaction({ name: 'Lunch', amount: 50000, category: 'Food' });
    expect(result).toEqual({ valid: true });
  });
});

// ─── validator.validateCategory ──────────────────────────────────────────────

describe('validator.validateCategory', () => {

  // ── Valid cases ──────────────────────────────────────────────────────────

  it('returns valid for a new unique category name', () => {
    const result = validateCategory('Travel', ['Food', 'Transport', 'Fun']);
    expect(result.valid).toBe(true);
  });

  it('returns valid for a 1-character name', () => {
    const result = validateCategory('X', ['Food']);
    expect(result.valid).toBe(true);
  });

  it('returns valid for a 50-character name', () => {
    const name = 'a'.repeat(50);
    const result = validateCategory(name, ['Food']);
    expect(result.valid).toBe(true);
  });

  it('returns valid when existing categories list is empty', () => {
    const result = validateCategory('Food', []);
    expect(result.valid).toBe(true);
  });

  // ── Empty / whitespace ───────────────────────────────────────────────────

  it('returns invalid for empty string', () => {
    const result = validateCategory('', ['Food']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns invalid for whitespace-only string', () => {
    const result = validateCategory('   ', ['Food']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  // ── Length ───────────────────────────────────────────────────────────────

  it('returns invalid for a name exceeding 50 characters', () => {
    const name = 'a'.repeat(51);
    const result = validateCategory(name, ['Food']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  // ── Duplicate detection (case-insensitive) ───────────────────────────────

  it('returns invalid for an exact duplicate', () => {
    const result = validateCategory('Food', ['Food', 'Transport']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns invalid for a case-insensitive duplicate (lowercase input)', () => {
    const result = validateCategory('food', ['Food']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns invalid for a case-insensitive duplicate (uppercase input)', () => {
    const result = validateCategory('TRANSPORT', ['Food', 'Transport']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns invalid for a mixed-case duplicate', () => {
    const result = validateCategory('fOoD', ['Food']);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('does not include error property when valid', () => {
    const result = validateCategory('Travel', ['Food']);
    expect(result).toEqual({ valid: true });
  });
});
