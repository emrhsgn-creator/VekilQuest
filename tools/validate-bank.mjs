#!/usr/bin/env node
/** data/sorular altındaki JSON dosyalarını şema ve tutarlılık açısından denetler. */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const klasor = process.argv[2] ?? path.join('data', 'sorular');
let dosyalar = [];
try {
  dosyalar = (await readdir(klasor)).filter((d) => d.endsWith('.json'));
} catch {
  console.error(`Klasör okunamadı: ${klasor}`);
  process.exit(1);
}

let hata = 0;
const tumIdler = new Set();

for (const dosya of dosyalar) {
  const yol = path.join(klasor, dosya);
  const icerik = JSON.parse(await readFile(yol, 'utf8'));
  const sorular = Array.isArray(icerik) ? icerik : icerik.sorular;
  if (!Array.isArray(sorular)) {
    console.error(`${dosya}: "sorular" dizisi bulunamadı`);
    hata++;
    continue;
  }
  const sorunlar = [];
  for (const s of sorular) {
    if (!s.id) sorunlar.push('id eksik');
    else if (tumIdler.has(s.id)) sorunlar.push(`yinelenen id: ${s.id}`);
    else tumIdler.add(s.id);
    if (!s.metin || s.metin.length < 10) sorunlar.push(`${s.id}: soru metni çok kısa`);
    if (!Array.isArray(s.secenekler) || s.secenekler.length < 4) sorunlar.push(`${s.id}: seçenek sayısı yetersiz`);
    if (!s.iptal && !s.cevap) sorunlar.push(`${s.id}: cevap boş`);
    if (s.cevap && !s.secenekler?.some((o) => o.harf === s.cevap)) sorunlar.push(`${s.id}: cevap seçeneklerde yok`);
  }
  const cevapsiz = sorular.filter((s) => !s.cevap && !s.iptal).length;
  console.log(`${dosya}: ${sorular.length} soru, ${cevapsiz} cevapsız, ${sorunlar.length} sorun`);
  for (const p of sorunlar.slice(0, 10)) console.log('   -', p);
  if (sorunlar.length > 10) console.log(`   … ve ${sorunlar.length - 10} sorun daha`);
  hata += sorunlar.length;
}

console.log(`\nToplam ${tumIdler.size} benzersiz soru, ${hata} sorun.`);
process.exit(hata > 0 ? 1 : 0);
