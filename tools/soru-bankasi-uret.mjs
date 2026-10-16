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
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { bolumKapsamlari } from '../src/lib/parse.mjs';
import { soruyuBicimle } from '../src/lib/bicim.mjs';

const KAYNAK_KLASOR = path.join('data', 'sorular');
const CIKTI = path.join('public', 'veri', 'soru-bankasi.json');

const gecici = path.join(tmpdir(), `vekilquest-classify-${Date.now()}.mjs`);
await build({
  stdin: {
    contents: "export * from './src/lib/classify.ts'; import { TOPICS } from './src/data/topics.ts'; export const TOPIC_IDLERI = new Set(TOPICS.map((t) => t.id));",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
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

// Elle konu düzeltmeleri: sınıflandırıcının açıkça yanıldığı sorular.
const { konular: elleKonular, alanKurallari = [] } = JSON.parse(
  await readFile(path.join('tools', 'konu-duzeltmeleri.json'), 'utf8'),
);
const { TOPIC_IDLERI, siniflandir } = await import(`file://${gecici}`);

// Yerinden alanı belli sorular: sınıflandırıcı yalnızca o alanlarda arar.
for (const kural of alanKurallari) {
  const desen = new RegExp(kural.desen);
  for (const s of sorular) {
    if (!desen.test(s.id) || s.topicId) continue;
    const sonuc = siniflandir(s.metin, s.secenekler.map((o) => o.metin), { alanlar: kural.alanlar });
    siniflar.set(s.id, { topicId: sonuc.topicId, guven: sonuc.guven, maddeler: sonuc.maddeler });
  }
}
for (const [id, topicId] of Object.entries(elleKonular)) {
  if (!TOPIC_IDLERI.has(topicId)) {
    console.error(`konu-duzeltmeleri.json: bilinmeyen konu "${topicId}" (${id})`);
    process.exit(1);
  }
  if (!sorular.some((s) => s.id === id)) console.warn(`Uyarı: konu düzeltmesindeki soru bankada yok: ${id}`);
}
const zenginlestirilmis = sorular.map((s) => {
  const sonuc = siniflar.get(s.id);
  // Öncüller satırlara bölünür, sayfa artıkları ayıklanır (src/lib/bicim.mjs).
  const elle = elleKonular[s.id];
  return soruyuBicimle({
    ...s,
    topicId: elle ?? s.topicId ?? sonuc?.topicId,
    topicGuven: elle ? 1 : (s.topicGuven ?? sonuc?.guven),
    smkMaddeleri: s.smkMaddeleri ?? sonuc?.maddeler,
  });
});

// Kitapçıktan kesilmiş görseller (tools/gorsel-kes.py) gerçekten var mı?
const eksikGorsel = zenginlestirilmis.filter((s) => s.gorsel && !existsSync(path.join('public', s.gorsel)));
if (eksikGorsel.length > 0) {
  console.error(`Görseli bulunamayan sorular: ${eksikGorsel.map((s) => s.id).join(', ')}`);
  process.exit(1);
}
const kullanilan = new Set(zenginlestirilmis.map((s) => s.gorsel).filter(Boolean));
const sahipsiz = existsSync(path.join('public', 'veri', 'gorsel'))
  ? (await readdir(path.join('public', 'veri', 'gorsel'))).filter((d) => !kullanilan.has(`veri/gorsel/${d}`))
  : [];
if (sahipsiz.length > 0) console.warn(`Uyarı: hiçbir soruya bağlı olmayan görseller: ${sahipsiz.join(', ')}`);

const yillar = [...new Set(zenginlestirilmis.map((s) => s.yil).filter(Boolean))].sort();

await mkdir(path.dirname(CIKTI), { recursive: true });
await writeFile(CIKTI, JSON.stringify({
  surum: 1,
  // İçerik özeti: soru metni, cevabı ya da görseli değişen her derlemede
  // farklılaşır, uygulama da cihazdaki kopyayı buna bakarak günceller.
  damga: `${yillar.join('-')}-${zenginlestirilmis.length}-${createHash('sha256')
    .update(JSON.stringify(zenginlestirilmis.map(({ eklenme, ...s }) => s)))
    .digest('hex').slice(0, 10)}`,
  kaynak: 'TÜRKPATENT Patent ve Marka Vekilliği sınavları (marka bölümleri) ve Marka Kılavuzu çalışma seti',
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
