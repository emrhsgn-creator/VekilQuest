#!/usr/bin/env node
/**
 * data/sorular/*.json dosyalarını birleştirip uygulamayla birlikte dağıtılan
 * soru bankasını üretir: public/veri/soru-bankasi.json
 *
 * Uygulama ilk açılışta bu dosyayı otomatik yükler, böylece siteye giren
 * herkesin elle içe aktarma yapması gerekmez.
 *
 * Konular burada, derleme zamanında atanır; tarayıcıda yeniden sınıflandırma
 * yapılmaz. classify.ts TypeScript olduğu için esbuild ile geçici bir ES
 * modülüne derlenip içe aktarılıyor.
 *
 * Kullanım: npm run banka:uret
 */

import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { bolumKapsamlari } from '../src/lib/parse.mjs';

const KAYNAK_KLASOR = path.join('data', 'sorular');
const CIKTI = path.join('public', 'veri', 'soru-bankasi.json');

const gecici = path.join(tmpdir(), `vekilquest-classify-${Date.now()}.mjs`);
await build({
  entryPoints: ['src/lib/classify.ts'],
  bundle: true,
  format: 'esm',
  outfile: gecici,
  logLevel: 'error',
});
const { topluSiniflandir } = await import(`file://${gecici}`);

let dosyalar;
try {
  dosyalar = (await readdir(KAYNAK_KLASOR)).filter((d) => d.endsWith('.json')).sort();
} catch {
  console.error(`Klasör yok: ${KAYNAK_KLASOR}. Önce tools/pdf-to-json.mjs ile soru üret.`);
  process.exit(1);
}
if (dosyalar.length === 0) {
  console.error(`${KAYNAK_KLASOR} boş. Önce tools/pdf-to-json.mjs ile soru üret.`);
  process.exit(1);
}

const sorular = [];
for (const dosya of dosyalar) {
  const icerik = JSON.parse(await readFile(path.join(KAYNAK_KLASOR, dosya), 'utf8'));
  sorular.push(...(icerik.sorular ?? []));
}

// Kapsam ölçümü ve konu ataması — İçe Aktar ekranındakiyle aynı yol.
const kapsamlar = bolumKapsamlari(sorular);
const patentBolumleri = [...kapsamlar].filter(([, k]) => k === 'patent').map(([ad]) => ad);
if (patentBolumleri.length > 0) {
  console.error(`Kaynak dosyalarda patent bölümü var: ${patentBolumleri.join(', ')}`);
  console.error('Bunlar marka vekilliği kapsamı dışında; --kapsam marka ile yeniden üret.');
  process.exit(1);
}

const siniflar = topluSiniflandir(sorular, kapsamlar);
const zenginlestirilmis = sorular.map((s) => {
  const sonuc = siniflar.get(s.id);
  return {
    ...s,
    topicId: s.topicId ?? sonuc?.topicId,
    topicGuven: s.topicGuven ?? sonuc?.guven,
    smkMaddeleri: s.smkMaddeleri ?? sonuc?.maddeler,
  };
});

const yillar = [...new Set(zenginlestirilmis.map((s) => s.yil).filter(Boolean))].sort();

await mkdir(path.dirname(CIKTI), { recursive: true });
await writeFile(CIKTI, JSON.stringify({
  surum: 1,
  // Uygulama bu damgayı saklar; büyüdüğünde güncelleme önerir.
  damga: `${yillar.join('-')}-${zenginlestirilmis.length}`,
  kaynak: 'TÜRKPATENT Patent ve Marka Vekilliği Genel Yeterlik Sınavı — marka bölümleri',
  aciklama:
    'TÜRKPATENT tarafından yayımlanan sınav kitapçıklarından ayrıştırılmıştır. ' +
    'Kişisel sınav hazırlığı amaçlıdır.',
  yillar,
  sorular: zenginlestirilmis,
}, null, 1), 'utf8');

await rm(gecici, { force: true });

const atanmamis = zenginlestirilmis.filter((s) => !s.topicId).length;
const cevapsiz = zenginlestirilmis.filter((s) => !s.cevap && !s.iptal).length;
console.log(`Yazıldı: ${CIKTI}`);
console.log(`  ${zenginlestirilmis.length} soru · yıllar: ${yillar.join(', ')}`);
console.log(`  konusu atanmamış: ${atanmamis} · cevapsız: ${cevapsiz}`);
console.log(`  bölümler: ${[...kapsamlar.keys()].join(', ')}`);
