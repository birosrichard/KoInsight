import { Book } from '@koinsight/common/types';
import { lookup } from 'dns/promises';
import { existsSync, mkdirSync, promises, rmSync } from 'fs';
import { BlockList } from 'net';
import path from 'path';
import { appConfig } from '../../config';

const MAX_COVER_SIZE = 10 * 1024 * 1024;
const COVER_EXTENSIONS: Record<string, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const blockedAddresses = new BlockList();
([
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
] satisfies [string, number][]).forEach(([address, prefix]) =>
  blockedAddresses.addSubnet(address, prefix, 'ipv4')
);
([
  ['::', 128],
  ['::1', 128],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] satisfies [string, number][]).forEach(([address, prefix]) =>
  blockedAddresses.addSubnet(address, prefix, 'ipv6')
);

function normalizeMappedIpv4(address: string) {
  const match = /^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/i.exec(address);
  if (!match) return address;

  const high = parseInt(match[1], 16);
  const low = parseInt(match[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

export class CoversService {
  static async get(book: Book): Promise<string | null> {
    const files = await promises.readdir(appConfig.coversPath);
    const file = files.find((f) => f.startsWith(book.md5));

    if (file) {
      return `${appConfig.coversPath}/${file}`;
    } else {
      return null;
    }
  }

  static async deleteExisting(book: Book) {
    const files = await promises.readdir(appConfig.coversPath);
    const file = files.find((f) => f.startsWith(book.md5));

    if (file) {
      const filePath = `${appConfig.coversPath}/${file}`;
      rmSync(filePath, { force: true });
    }
  }

  static async upload(book: Book, file: Express.Multer.File) {
    if (!existsSync(appConfig.coversPath)) {
      mkdirSync(appConfig.coversPath, { recursive: true });
    }

    const extension = path.extname(file.originalname) || '';
    const newFilename = `${book.md5}${extension}`;
    const newPath = path.join(path.dirname(file.path), newFilename);
    await this.deleteExisting(book);
    await promises.rename(file.path, newPath);
  }

  static async uploadFromUrl(book: Book, value: string) {
    let url = new URL(value);

    for (let redirects = 0; redirects <= 3; redirects++) {
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only HTTP(S) URLs are allowed');
      }

      const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true });
      if (
        addresses.some(({ address, family }) => {
          const normalizedAddress = normalizeMappedIpv4(address);
          return blockedAddresses.check(
            normalizedAddress,
            family === 4 || normalizedAddress !== address ? 'ipv4' : 'ipv6'
          );
        })
      ) {
        throw new Error('Private network URLs are not allowed');
      }

      const response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
        url = new URL(response.headers.get('location')!, url);
        continue;
      }
      if (!response.ok) {
        throw new Error(`Image request failed with status ${response.status}`);
      }

      const extension = COVER_EXTENSIONS[response.headers.get('content-type')?.split(';')[0] ?? ''];
      if (!extension) {
        throw new Error('URL does not point to a supported image');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Image response is empty');

      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        size += chunk.byteLength;
        if (size > MAX_COVER_SIZE) {
          await reader.cancel();
          throw new Error('Image exceeds the 10 MB limit');
        }
        chunks.push(chunk);
      }

      if (!existsSync(appConfig.coversPath)) {
        mkdirSync(appConfig.coversPath, { recursive: true });
      }
      await this.deleteExisting(book);
      await promises.writeFile(
        path.join(appConfig.coversPath, `${book.md5}${extension}`),
        Buffer.concat(chunks)
      );
      return;
    }

    throw new Error('Too many redirects');
  }
}
