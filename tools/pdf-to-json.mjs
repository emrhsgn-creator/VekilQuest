#!/usr/bin/env node
/**
 * TÜRKPATENT sınav kitapçığı + cevap anahtarı PDF'lerini uygulamanın
 * soru bankası JSON biçimine çevirir.
 *
 * Kullanım:
 *   node tools/pdf-to-json.mjs --kitapcik data/ham/2024-marka-A.pdf \
 *                              --anahtar  data/ham/2024-marka-A-cevap.pdf \
 *                              --yil 2024 --kitapcik-turu A
 *
 * Metin dosyası da verilebilir (.txt). PDF metni gömülü değilse (taranmış
 * görüntü) çıktı boş gelir; bu durumda önce OCR gerekir.
 *
 * Çıktı varsayılan olarak data/sorular/<yil>-marka-<kitapcik>.json dosyasına
 * yazılır ve uygulamanın "İçe Aktar" ekranından yüklenebilir.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sorulariAyristir, cevapAnahtariAyristir, iptalEdilenler, birlestir } from '../src/lib/parse.mjs';

function argumanlar(argv) {
  const cikti = {};
  for (let i = 2; i < argv.length; i++) {
    const parca = argv[i];
    if (!parca.startsWith('--')) continue;
    const anahtar = parca.slice(2);
    const deger = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    cikti[anahtar] = deger;
  }
  return cikti;
}

async function pdfMetni(dosya) {
  if (dosya.toLowerCase().endsWith('.txt')) {
    return readFile(dosya, 'utf8');
  }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const veri = new Uint8Array(await readFile(dosya));
  const belge = await getDocument({ data: veri, useSystemFonts: true }).promise;
  const sayfalar = [];
  for (let i = 1; i <= belge.numPages; i++) {
    const sayfa = await belge.getPage(i);
    const icerik = await sayfa.getTextContent();
    // Y koordinatı değiştiğinde satır sonu ekleyerek düzeni koru.
    let sonY = null;
    let satir = '';
    const satirlar = [];
    for (const oge of icerik.items) {
      if (!('str' in oge)) continue;
      const y = Math.round(oge.transform[5]);
      if (sonY !== null && Math.abs(y - sonY) > 2) {
        satirlar.push(satir.trim());
        satir = '';
      }
      satir += oge.str + (oge.hasEOL ? ' ' : '');
      sonY = y;
    }
    if (satir.trim()) satirlar.push(satir.trim());
    sayfalar.push(satirlar.join('\n'));
  }
  return sayfalar.join('\n\n');
}

const arg = argumanlar(process.argv);

if (!arg.kitapcik || arg.yardim) {
  console.log(`
Marka Vekilliği soru bankası dönüştürücü

  --kitapcik <dosya>       Soru kitapçığı PDF/TXT  (zorunlu)
  --anahtar  <dosya>       Cevap anahtarı PDF/TXT
  --yil      <2024>        Sınav yılı
  --kitapcik-turu <A|B>    Kitapçık türü
  --oturum   <1>           Aynı yılda birden fazla oturum varsa
  --cikti    <dosya.json>  Çıktı yolu
`);
  process.exit(arg.kitapcik ? 0 : 1);
}

if (!existsSync(arg.kitapcik)) {
  console.error(`Bulunamadı: ${arg.kitapcik}`);
  process.exit(1);
}

const yil = arg.yil ? Number(arg.yil) : undefined;
const kitapcikTuru = arg['kitapcik-turu'];

console.log(`Kitapçık okunuyor: ${arg.kitapcik}`);
const kitapcikMetni = await pdfMetni(arg.kitapcik);
const { sorular, uyarilar } = sorulariAyristir(kitapcikMetni);

let anahtar = new Map();
let iptaller = new Set();
if (arg.anahtar) {
  if (!existsSync(arg.anahtar)) {
    console.error(`Bulunamadı: ${arg.anahtar}`);
    process.exit(1);
  }
  console.log(`Cevap anahtarı okunuyor: ${arg.anahtar}`);
  const anahtarMetni = await pdfMetni(arg.anahtar);
  anahtar = cevapAnahtariAyristir(anahtarMetni);
  iptaller = iptalEdilenler(anahtarMetni);
}

const { sorular: birlesik, rapor } = birlestir(sorular, anahtar, iptaller);

const kaynak = [
  'TÜRKPATENT',
  yil ?? '',
  'Marka Vekilliği',
  kitapcikTuru ? `(${kitapcikTuru})` : '',
].filter(Boolean).join(' ');

const banka = birlesik.map((s) => ({
  id: `tp-${yil ?? 'x'}${arg.oturum ? '-' + arg.oturum : ''}-${kitapcikTuru ?? 'x'}-${s.no}`,
  no: s.no,
  yil,
  oturum: arg.oturum,
  kitapcik: kitapcikTuru,
  kaynak,
  metin: s.metin,
  secenekler: s.secenekler,
  cevap: s.cevap,
  iptal: s.iptal,
  eklenme: Date.now(),
}));

const ciktiYolu = arg.cikti ?? path.join('data', 'sorular', `${yil ?? 'bilinmeyen'}-marka-${kitapcikTuru ?? 'x'}.json`);
await mkdir(path.dirname(ciktiYolu), { recursive: true });
await writeFile(ciktiYolu, JSON.stringify({ surum: 1, kaynak, sorular: banka }, null, 2), 'utf8');

console.log(`\nYazıldı: ${ciktiYolu}`);
console.table(rapor);
if (uyarilar.length) {
  console.log('\nUyarılar:');
  for (const u of uyarilar.slice(0, 20)) console.log('  •', u);
  if (uyarilar.length > 20) console.log(`  … ve ${uyarilar.length - 20} uyarı daha`);
}
if (rapor.cevapsiz > 0) {
  console.log(`\n${rapor.cevapsiz} sorunun cevabı eşleşmedi. Uygulamadaki "Soru Bankası" ekranından elle tamamlayabilirsin.`);
}
