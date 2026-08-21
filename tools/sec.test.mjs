/**
 * Soru seçme mantığı testleri (src/lib/sec.ts).
 *
 * sec.ts TypeScript olduğu için esbuild ile geçici bir ES modülüne derlenip
 * içe aktarılıyor — soru-bankasi-uret.mjs ile aynı yöntem.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const gecici = path.join(tmpdir(), `vekilquest-sec-${Date.now()}.mjs`);
await build({
  entryPoints: ['src/lib/sec.ts'],
  bundle: true,
  format: 'esm',
  outfile: gecici,
  logLevel: 'error',
});
const { sinavKonuDagilimi, gercekciDenemeSec, soruTuru, cikmisSorular } = await import(`file://${gecici}`);
test.after(() => rm(gecici, { force: true }));

const soru = (id, topicId, yil) => ({
  id, topicId, yil, kaynak: 't', metin: 'm', cevap: 'A',
  secenekler: [{ harf: 'A', metin: 'a' }, { harf: 'B', metin: 'b' }],
  eklenme: 0,
});

test('soru türü yıl bilgisinden türetilir', () => {
  assert.equal(soruTuru(soru('a', 'x', 2019)), 'cikmis');
  assert.equal(soruTuru(soru('b', 'x', undefined)), 'banka');
  assert.equal(soruTuru({ ...soru('c', 'x', undefined), tur: 'cikmis' }), 'cikmis');
});

test('sınav dağılımı yalnızca çıkmış soruları sayar', () => {
  const sorular = [
    soru('1', 'mutlak', 2019), soru('2', 'mutlak', 2019), soru('3', 'nispi', 2019),
    // Banka soruları dağılımı bozmamalı:
    soru('4', 'nispi'), soru('5', 'nispi'), soru('6', 'nispi'),
  ];
  assert.equal(cikmisSorular(sorular).length, 3);
  const dagilim = sinavKonuDagilimi(sorular);
  assert.equal(Math.round(dagilim.get('mutlak') * 100), 67);
  assert.equal(Math.round(dagilim.get('nispi') * 100), 33);
});

test('gerçekçi deneme kotaları sınav dağılımını izler', () => {
  // Sınavda mutlak %75, nispi %25.
  const cikmis = [
    soru('c1', 'mutlak', 2019), soru('c2', 'mutlak', 2019),
    soru('c3', 'mutlak', 2019), soru('c4', 'nispi', 2019),
  ];
  // Havuzda ise nispi soruları çoğunlukta — saf rastgele seçim bu dengesizliği
  // denemeye taşır; gerçekçi seçim taşımamalı.
  const havuz = [
    ...Array.from({ length: 10 }, (_, i) => soru(`m${i}`, 'mutlak')),
    ...Array.from({ length: 40 }, (_, i) => soru(`n${i}`, 'nispi')),
  ];
  const dagilim = sinavKonuDagilimi(cikmis);
  const deneme = gercekciDenemeSec(havuz, dagilim, 8, 42);

  assert.equal(deneme.length, 8);
  const mutlak = deneme.filter((s) => s.topicId === 'mutlak').length;
  assert.equal(mutlak, 6, '8 soruluk denemede mutlak konusundan 6 soru bekleniyor');
  assert.equal(deneme.filter((s) => s.topicId === 'nispi').length, 2);
});

test('gerçekçi deneme aynı soruyu iki kez koymaz', () => {
  const cikmis = [soru('c1', 'a', 2019), soru('c2', 'b', 2019)];
  const havuz = [soru('x', 'a'), soru('y', 'b'), soru('z', 'a')];
  const deneme = gercekciDenemeSec(havuz, sinavKonuDagilimi(cikmis), 3, 7);
  assert.equal(new Set(deneme.map((s) => s.id)).size, deneme.length);
});

test('konuda soru yetmezse set yine istenen uzunlukta çıkar', () => {
  // Sınavda "a" konusu %100 ama havuzda yalnızca 2 tane "a" var.
  const cikmis = [soru('c1', 'a', 2019)];
  const havuz = [soru('x', 'a'), soru('y', 'a'), soru('z', 'b'), soru('w', 'b')];
  const deneme = gercekciDenemeSec(havuz, sinavKonuDagilimi(cikmis), 4, 5);
  assert.equal(deneme.length, 4);
  assert.equal(new Set(deneme.map((s) => s.id)).size, 4);
});

test('dağılım boşsa rastgele seçime düşer', () => {
  const havuz = [soru('x', 'a'), soru('y', 'b'), soru('z', 'c')];
  const deneme = gercekciDenemeSec(havuz, new Map(), 2, 1);
  assert.equal(deneme.length, 2);
});
