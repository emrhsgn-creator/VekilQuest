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
import { belgeyiAyristir, bolumKapsamlari, cozumluBankaAyristir, katla } from '../src/lib/parse.mjs';
import { sayfaMetni } from '../src/lib/pdfMetin.mjs';

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
  const [bas, son] = (arg.sayfalar ?? `1-${belge.numPages}`).split('-').map(Number);
  for (let i = bas; i <= Math.min(son, belge.numPages); i++) {
    sayfalar.push(await sayfaMetni(await belge.getPage(i)));
  }
  return sayfalar.join('\n\n');
}

const arg = argumanlar(process.argv);

if (!arg.kitapcik || arg.yardim) {
  console.log(`
Marka Vekilliği soru bankası dönüştürücü

  --kitapcik <dosya>       Soru kitapçığı PDF/TXT  (zorunlu)
  --anahtar  <dosya>       Cevap anahtarı PDF/TXT — anahtar kitapçığın içindeyse
                           gerekmez, otomatik bulunur
  --yil      <2021>        Sınav yılı
  --kitapcik-turu <A|B>    Kitapçık türü
  --oturum   <1>           Aynı yılda birden fazla oturum varsa
  --kapsam   <marka|hepsi> Varsayılan "marka": Genel Yeterlik kitapçığının
                           patent bölümü çıktıya alınmaz
  --tur      <sinav|cozumlu>  "cozumlu": yayınevi soru bankası düzeni
                           (… SORULARI / … CEVAPLARI başlıkları, "CEVAP: X"
                           ve gerekçeli çözümler)
  --kaynak   <metin>       Çıktıdaki kaynak adı (çözümlü bankalar için)
  --sayfalar <33-56>       Yalnızca bu sayfa aralığını oku
  --bolum-adi <MARKA>      Patent kitapçığı elendikten sonra kalan tek bölümün adı
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

let anahtarMetni = '';
if (arg.anahtar) {
  if (!existsSync(arg.anahtar)) {
    console.error(`Bulunamadı: ${arg.anahtar}`);
    process.exit(1);
  }
  console.log(`Cevap anahtarı okunuyor: ${arg.anahtar}`);
  anahtarMetni = await pdfMetni(arg.anahtar);
}

const cozumluMu = arg.tur === 'cozumlu';
const { sorular: tumSorular, uyarilar, rapor } = cozumluMu
  ? cozumluBankaAyristir(`${kitapcikMetni}\n\n${anahtarMetni}`)
  : belgeyiAyristir(kitapcikMetni, anahtarMetni);

// Genel Yeterlik kitapçıkları patent ve marka sorularını ayrı bölümlerde
// taşıyor. Varsayılan davranış, marka vekilliği kapsamı dışındaki patent
// bölümünü hiç çıktıya almamak.
const bolumAdi = (s) => s.bolum ?? (s.kitapcikNo ? `${s.kitapcikNo}. kitapçık` : 'tümü');
const kapsamlar = bolumKapsamlari(tumSorular);
const hepsiniAl = arg.kapsam === 'hepsi';
const ayristirilan = hepsiniAl
  ? tumSorular
  : tumSorular.filter((s) => kapsamlar.get(bolumAdi(s)) !== 'patent');
const elenen = tumSorular.length - ayristirilan.length;

const kaynak = arg.kaynak ?? [
  'TÜRKPATENT',
  yil ?? '',
  'Genel Yeterlik Sınavı',
  kitapcikTuru ? `(${kitapcikTuru})` : '',
].filter(Boolean).join(' ');

// Ayrı oturumlu sınavlarda (2024'ten itibaren patent ve marka kitapçıkları
// tek PDF'te) elde tek bölüm kalır; "2. kitapçık" yerine anlamlı bir ad ver.
if (arg['bolum-adi']) {
  const kalanlar = new Set(ayristirilan.map(bolumAdi));
  if (kalanlar.size !== 1) {
    console.error(`--bolum-adi yalnızca tek bölüm kaldığında kullanılabilir; kalan: ${[...kalanlar].join(', ')}`);
    process.exit(1);
  }
  for (const s of ayristirilan) { s.bolum = arg['bolum-adi']; s.kitapcikNo = undefined; }
}

const simdi = Date.now();
const banka = ayristirilan.map((s) => ({
  // Kimlik bölümü de içerir: bölümlü kitapçıklarda numaralar tekrar ediyor.
  // Kimlik ASCII kalsın: Türkçe karakterler katlanıp sadeleştiriliyor.
  id: [
    arg.onek ?? 'tp',
    yil,
    arg.oturum,
    cozumluMu ? null : kitapcikTuru,
    s.bolum ? katla(s.bolum).replace(/[^a-z0-9]+/g, '') : (s.kitapcikNo ? `k${s.kitapcikNo}` : null),
    s.yerelNo,
  ].filter((p) => p !== undefined && p !== null && p !== '').join('-'),
  no: s.yerelNo,
  yil,
  oturum: arg.oturum,
  kitapcik: kitapcikTuru,
  bolum: s.bolum ?? (s.kitapcikNo ? `${s.kitapcikNo}. kitapçık` : undefined),
  // Çözümlü kitaplar soru bankası, sınav kitapçıkları çıkmış sorudur.
  tur: cozumluMu ? 'banka' : 'cikmis',
  kaynak,
  metin: s.metin,
  secenekler: s.secenekler,
  cevap: s.cevap,
  aciklama: s.aciklama,
  iptal: s.iptal,
  eklenme: simdi,
}));

const ciktiYolu = arg.cikti
  ?? path.join('data', 'sorular', `${yil ?? 'bilinmeyen'}-genel-${kitapcikTuru ?? 'x'}.json`);
await mkdir(path.dirname(ciktiYolu), { recursive: true });
await writeFile(ciktiYolu, JSON.stringify({ surum: 1, kaynak, sorular: banka }, null, 2), 'utf8');

console.log(`\nYazıldı: ${ciktiYolu}`);
console.table({ ...rapor, yazilan: ayristirilan.length, elenenPatent: elenen });
console.log('\nBölüm kapsamları:');
for (const [ad, kapsam] of kapsamlar) {
  const adet = tumSorular.filter((s) => bolumAdi(s) === ad).length;
  const durum = kapsam === 'patent' && !hepsiniAl ? 'ELENDİ' : 'alındı';
  console.log(`  ${ad.padEnd(16)} ${kapsam.padEnd(7)} ${String(adet).padStart(3)} soru  →  ${durum}`);
}
if (elenen > 0) {
  console.log(`\n${elenen} patent sorusu çıktıya alınmadı. Hepsini istiyorsan: --kapsam hepsi`);
}
if (uyarilar.length) {
  console.log('\nUyarılar:');
  for (const u of uyarilar.slice(0, 20)) console.log('  •', u);
  if (uyarilar.length > 20) console.log(`  … ve ${uyarilar.length - 20} uyarı daha`);
}
if (rapor.cevapsiz > 0) {
  console.log(`\n${rapor.cevapsiz} sorunun cevabı eşleşmedi. Uygulamadaki "Soru Bankası" ekranından elle tamamlayabilirsin.`);
}
