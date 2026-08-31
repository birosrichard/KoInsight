import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { appConfig } from '../../config';
import { fakeBook } from '../../db/factories/book-factory';
import { CoversService } from './covers-service';

describe('CoversService.uploadFromUrl', () => {
  it('downloads a public image and saves it as the book cover', async () => {
    const originalCoversPath = appConfig.coversPath;
    const coversPath = await mkdtemp(path.join(tmpdir(), 'koinsight-covers-'));
    appConfig.coversPath = coversPath;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
          headers: { 'content-type': 'image/jpeg' },
        })
      )
    );

    try {
      const book = { ...fakeBook({ md5: 'test-book' }), id: 1 };
      await CoversService.uploadFromUrl(book, 'https://8.8.8.8/cover.jpg');

      expect(await readFile(path.join(coversPath, 'test-book.jpg'))).toEqual(
        Buffer.from([0xff, 0xd8, 0xff])
      );
    } finally {
      appConfig.coversPath = originalCoversPath;
      vi.unstubAllGlobals();
      await rm(coversPath, { recursive: true });
    }
  });
});
