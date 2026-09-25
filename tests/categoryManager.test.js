/**
 * Unit tests for the CategoryManager module.
 * Uses the createCategoryManager factory with in-memory storage adapters.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createCategoryManager, BUILTIN_CATEGORIES, MAX_CUSTOM_CATEGORIES } from '../js/categoryManager.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a simple in-memory storage adapter for testing.
 * @param {string[]} [initialCustom=[]] — custom categories to pre-load
 * @param {boolean}  [saveShouldFail=false] — simulate a storage write failure
 */
function makeStorage(initialCustom = [], saveShouldFail = false) {
  let stored = [...initialCustom];
  return {
    loadCategories: () => ({ ok: true, data: [...stored] }),
    saveCategories: (cats) => {
      if (saveShouldFail) {
        return { ok: false, error: 'Storage write failed.' };
      }
      stored = [...cats];
      return { ok: true };
    },
  };
}

/** Create a storage adapter whose loadCategories() always fails. */
function makeFailingLoadStorage() {
  return {
    loadCategories: () => ({ ok: false, error: 'Could not load categories.' }),
    saveCategories: () => ({ ok: true }),
  };
}

// ─── init() ──────────────────────────────────────────────────────────────────

describe('categoryManager.init()', () => {
  it('loads custom categories from storage', () => {
    const cm = createCategoryManager(makeStorage(['Travel', 'Health']));
    cm.init();
    expect(cm.getAll()).toContain('Travel');
    expect(cm.getAll()).toContain('Health');
  });

  it('always includes the three built-in categories after init', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    for (const cat of BUILTIN_CATEGORIES) {
      expect(cm.getAll()).toContain(cat);
    }
  });

  it('prepends built-ins before custom categories', () => {
    const cm = createCategoryManager(makeStorage(['Custom']));
    cm.init();
    const all = cm.getAll();
    expect(all.slice(0, 3)).toEqual(BUILTIN_CATEGORIES);
    expect(all[3]).toBe('Custom');
  });

  it('initialises with an empty custom list when storage load fails', () => {
    const cm = createCategoryManager(makeFailingLoadStorage());
    cm.init();
    expect(cm.getAll()).toEqual(BUILTIN_CATEGORIES);
  });

  it('starts with only built-ins when there are no stored custom categories', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    expect(cm.getAll()).toEqual(BUILTIN_CATEGORIES);
    expect(cm.getAll().length).toBe(3);
  });
});

// ─── getAll() ─────────────────────────────────────────────────────────────────

describe('categoryManager.getAll()', () => {
  it('returns a new array each call (not the same reference)', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    const a = cm.getAll();
    const b = cm.getAll();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('reflects newly added categories immediately', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    cm.add('Travel');
    expect(cm.getAll()).toContain('Travel');
  });
});

// ─── add() ───────────────────────────────────────────────────────────────────

describe('categoryManager.add()', () => {

  // ── Success ──────────────────────────────────────────────────────────────

  it('returns { ok: true } for a valid unique category name', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    expect(cm.add('Travel')).toEqual({ ok: true });
  });

  it('adds the category to the list on success', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    cm.add('Travel');
    expect(cm.getAll()).toContain('Travel');
    expect(cm.getAll().length).toBe(BUILTIN_CATEGORIES.length + 1);
  });

  it('trims whitespace before saving the category name', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    cm.add('  Health  ');
    expect(cm.getAll()).toContain('Health');
    expect(cm.getAll()).not.toContain('  Health  ');
  });

  // ── Validation rejection ─────────────────────────────────────────────────

  it('returns { ok: false } for an empty name', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    const result = cm.add('');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns { ok: false } for a whitespace-only name', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    const result = cm.add('   ');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns { ok: false } for a name exceeding 50 characters', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    const result = cm.add('a'.repeat(51));
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('does not add the category to the list when validation fails', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    const before = cm.getAll().length;
    cm.add('');
    expect(cm.getAll().length).toBe(before);
  });

  // ── Duplicate rejection ───────────────────────────────────────────────────

  it('returns { ok: false } for an exact duplicate of a built-in', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    const result = cm.add('Food');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns { ok: false } for a case-insensitive duplicate of a built-in', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    expect(cm.add('food').ok).toBe(false);
    expect(cm.add('TRANSPORT').ok).toBe(false);
    expect(cm.add('FuN').ok).toBe(false);
  });

  it('returns { ok: false } for a case-insensitive duplicate of a custom category', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    cm.add('Travel');
    const result = cm.add('TRAVEL');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('does not add a duplicate to the list', () => {
    const cm = createCategoryManager(makeStorage([]));
    cm.init();
    cm.add('Travel');
    const before = cm.getAll().length;
    cm.add('travel');
    expect(cm.getAll().length).toBe(before);
  });

  // ── 20-category limit ─────────────────────────────────────────────────────

  it('returns { ok: false } when the custom category limit (20) is already reached', () => {
    // Pre-fill storage with 20 unique custom categories
    const existing = Array.from({ length: 20 }, (_, i) => `Cat${i + 1}`);
    const cm = createCategoryManager(makeStorage(existing));
    cm.init();
    const result = cm.add('NewCat');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/limit/i);
  });

  it('allows adding exactly the 20th custom category', () => {
    const existing = Array.from({ length: 19 }, (_, i) => `Cat${i + 1}`);
    const cm = createCategoryManager(makeStorage(existing));
    cm.init();
    const result = cm.add('Cat20');
    expect(result.ok).toBe(true);
    expect(cm.getAll().length).toBe(BUILTIN_CATEGORIES.length + 20);
  });

  it('does not add the category when the limit is reached', () => {
    const existing = Array.from({ length: 20 }, (_, i) => `Cat${i + 1}`);
    const cm = createCategoryManager(makeStorage(existing));
    cm.init();
    const before = cm.getAll().length;
    cm.add('NewCat');
    expect(cm.getAll().length).toBe(before);
  });

  // ── Storage failure + revert ──────────────────────────────────────────────

  it('returns { ok: false } when storage save fails', () => {
    const cm = createCategoryManager(makeStorage([], true));
    cm.init();
    const result = cm.add('Travel');
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('reverts the in-memory state when storage save fails', () => {
    const cm = createCategoryManager(makeStorage([], true));
    cm.init();
    const before = cm.getAll().length;
    cm.add('Travel');
    // Category must NOT appear in the list after a failed save
    expect(cm.getAll()).not.toContain('Travel');
    expect(cm.getAll().length).toBe(before);
  });
});
