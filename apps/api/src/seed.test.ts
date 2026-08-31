import { describe, expect, it } from 'vitest';
import { loadSeedRows } from './seed.js';

describe('seed workbook', () => {
  it('loads the spreadsheet as the sole seed source', async () => {
    const rows = await loadSeedRows();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.sourceRow).toBe(2);
  });
});
