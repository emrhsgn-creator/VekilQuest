/**
 * Çıkmış sınav karnesi (src/lib/karne.ts): parça parça çözülen sınavın
 * toplam sonucu.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const gecici = path.join(tmpdir(), `vekilquest-karne-${Date.now()}.mjs`);
await build({ entryPoints: ['src/lib/karne.ts'], bundle: true, format: 'esm', outfile: gecici, logLevel: 'error' });
const { sinavKarnesi, sinavSorulari } = await import(`file://${gecici}`);
test.after(() => rm(gecici, { force: true }));

const soru = (id, no, bolum, ek = {}) => ({
  id, no, bolum, yil: 2019, kaynak: 't', metin: 'm', cevap: 'A',
  secenekler: [{ harf: 'A', metin: 'a' }, { harf: 'B', metin: 'b' }], eklenme: 0, ...ek,
});
const cevap = (soruId, secilen, zaman, mod = 'deneme') => ({
  id: `${soruId}-${zaman}`, soruId, seansId: 's', mod, secilen, dogru: secilen === 'A', sure: 1, zaman,
});

test('sınav soruları kitapçık sırasıyla: önce bölüm, sonra numara', () => {
  // Bankadaki ilk görülme sırası bölüm sırasıdır.
  const havuz = [
    soru('k1-42', 42, '1. kitapçık'), soru('k2-62', 62, '2. kitapçık'),
    soru('k1-41', 41, '1. kitapçık'), soru('k2-61', 61, '2. kitapçık'),
    soru('kilavuz', 1, 'x', { yil: undefined, tur: 'banka' }),
  ];
  const sirali = sinavSorulari(havuz, 2019);
  assert.deepEqual(sirali.map((s) => s.id), ['k1-41', 'k1-42', 'k2-61', 'k2-62']);
});

test('eksik sorular bulunur; tamamlanınca toplam sonuç birleşir', () => {
  const sorular = [soru('a', 1), soru('b', 2), soru('c', 3), soru('d', 4)];
  const once = [cevap('a', 'A', 1), cevap('b', 'B', 2)];
  let k = sinavKarnesi(2019, sorular, once);
  assert.deepEqual(k.eksik.map((s) => s.id), ['c', 'd']);
  assert.equal(k.tamam, false);
  assert.equal(k.puan, 25);

  k = sinavKarnesi(2019, sorular, [...once, cevap('c', 'A', 10), cevap('d', null, 11)]);
  assert.equal(k.tamam, true);
  assert.deepEqual([k.dogru, k.yanlis, k.bos, k.cozulen], [2, 1, 1, 4]);
  assert.equal(k.puan, 50);
});

test('her soru için ilk çözüm esas alınır; sonraki çalışma puanı değiştirmez', () => {
  const sorular = [soru('a', 1)];
  const k = sinavKarnesi(2019, sorular, [cevap('a', 'A', 50, 'calisma'), cevap('a', 'B', 5)]);
  assert.equal(k.dogru, 0);
  assert.equal(k.yanlis, 1);
});

test('iptal edilen soru puanlanmaz ve eksik sayılmaz', () => {
  const sorular = [soru('a', 1), soru('b', 2, undefined, { iptal: true })];
  const k = sinavKarnesi(2019, sorular, [cevap('a', 'A', 1)]);
  assert.equal(k.toplam, 1);
  assert.equal(k.tamam, true);
  assert.equal(k.puan, 100);
});
