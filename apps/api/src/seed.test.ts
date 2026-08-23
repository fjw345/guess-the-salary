import { describe, expect, it } from 'vitest';
import { loadSeedRows } from './seed.js';

describe('seed workbook', () => {
  it('loads the spreadsheet as the sole seed source', async () => {
    const rows = await loadSeedRows();

    expect(rows).toHaveLength(272);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceRow: 2,
          degree: '本科',
          tenureText: '2年',
        }),
      ]),
    );
  });
});
