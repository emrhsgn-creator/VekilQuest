#!/usr/bin/env node
/**
 * "Marka Vekilliği Sınavı — Soru Kitapçığı" (TÜRKPATENT SMK m.5 / m.6/1
 * İnceleme Kılavuzlarından türetilmiş çalışma seti) için dönüştürücü.
 *
 * Bu kitapçığın düzeni ne sınav kitapçıklarına ne de yayınevi soru
 * bankalarına benziyor; dört ayrı biçim bir arada:
 *
 *   Kısım A   A1. soru metni / A) … E)            → 5 şıklı çoktan seçmeli
 *   A anahtarı  "A1 E <gerekçe…>" + bölüm kodu     → harf + gerekçe
 *   Bölüm 1   "B1 <unsur> ☐"                      → E/H işaretleme
 *   Bölüm 2   "B31 <kalıp> ☐"                     → R/İ işaretleme
 *   B anahtarı  başlık satırı + değer satırı       → tablo hâlinde
 *
 * İşaretlemeli maddeler uygulamada iki şıklı sorulara çevriliyor; böylece
 * doğru/yanlış drilli de normal çözme akışında çalışıyor ve istatistiğe
 * giriyor.
 *
 * Kullanım: node tools/kilavuz-to-json.mjs --pdf data/ham/marka-kilavuzu.pdf \
 *             --cikti /tmp/kilavuz.json
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { katla } from '../src/lib/parse.mjs';

/* ─────────────────────────────── argümanlar ─────────────────────────────── */

function argumanlar(argv) {
  const cikti = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const ad = argv[i].slice(2);
    cikti[ad] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  }
  return cikti;
}

const arg = argumanlar(process.argv);
if (!arg.pdf || arg.yardim) {
  console.log(`
Marka Kılavuzu çalışma kitapçığı dönüştürücü

  --pdf    <dosya>       Kitapçık PDF'i (zorunlu)
  --cikti  <dosya.json>  Çıktı yolu (varsayılan data/sorular/marka-kilavuzu.json)
  --kaynak <metin>       Çıktıdaki kaynak adı
`);
  process.exit(arg.pdf ? 0 : 1);
}
if (!existsSync(arg.pdf)) {
  console.error(`Bulunamadı: ${arg.pdf}`);
  process.exit(1);
}

/* ────────────────────────────── metin çıkarma ───────────────────────────── */

async function pdfMetni(dosya) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const belge = await getDocument({
    data: new Uint8Array(await readFile(dosya)),
    useSystemFonts: true,
  }).promise;
  const sayfalar = [];
  for (let i = 1; i <= belge.numPages; i++) {
    const icerik = await (await belge.getPage(i)).getTextContent();
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
  return sayfalar.join('\n');
}

/** Sayfa altlığı ("12 / 18Marka Vekilligi…") satır sonlarına yapışıyor. */
function altligiAt(satir) {
  return satir.replace(/\s*\d{1,3}\s*\/\s*\d{1,3}Marka Vekilligi.*$/u, '').trim();
}

/* ─────────────────────────────── Kısım A ────────────────────────────────── */

/** "BÖLÜM III — SMK m.5/1-ç (Soru A28–A40)" başlıklarını konuya bağlar. */
const BOLUM_BASLIGI = /^BÖLÜM\s+([IVX]+)\s+—\s+(.+?)\s+\(Soru\s+A(\d+)[–-]A(\d+)\)\s*$/;

function kisimASorulari(satirlar) {
  const sorular = [];
  let aktifBolum = null;
  let aktif = null;

  const bitir = () => {
    if (aktif && aktif.secenekler.length >= 4) sorular.push(aktif);
    aktif = null;
  };

  for (const ham of satirlar) {
    const satir = altligiAt(ham);
    if (!satir) continue;

    const bolum = BOLUM_BASLIGI.exec(satir);
    if (bolum) {
      bitir();
      aktifBolum = { baslik: bolum[2].trim() };
      continue;
    }
    if (/^KISIM A — CEVAP ANAHTARI/.test(satir)) { bitir(); break; }

    const soruBasi = /^A(\d{1,3})\.\s+(.*)$/.exec(satir);
    if (soruBasi) {
      bitir();
      aktif = {
        kod: `A${soruBasi[1]}`,
        no: Number(soruBasi[1]),
        bolum: aktifBolum?.baslik ?? 'Kısım A',
        metin: soruBasi[2],
        secenekler: [],
      };
      continue;
    }
    if (!aktif) continue;

    const secenek = /^([A-E])\)\s+(.*)$/.exec(satir);
    if (secenek) {
      aktif.secenekler.push({ harf: secenek[1], metin: secenek[2] });
    } else if (aktif.secenekler.length > 0) {
      // Seçenek metninin devamı
      aktif.secenekler[aktif.secenekler.length - 1].metin += ' ' + satir;
    } else {
      aktif.metin += ' ' + satir;
    }
  }
  bitir();
  return sorular;
}

/** "A1 E <gerekçe…>" blokları; gerekçe bir sonraki koda kadar sürer. */
function kisimAAnahtari(satirlar) {
  const anahtar = new Map();
  let aktif = null;
  const bitir = () => {
    if (aktif) anahtar.set(aktif.kod, { harf: aktif.harf, aciklama: aktif.parcalar.join(' ').replace(/\s+/g, ' ').trim() });
    aktif = null;
  };

  for (const ham of satirlar) {
    const satir = altligiAt(ham);
    if (!satir) continue;
    if (/^KISIM B/.test(satir)) break;

    const bas = /^A(\d{1,3})\s+([A-E])\s+(.*)$/.exec(satir);
    if (bas) {
      bitir();
      aktif = { kod: `A${bas[1]}`, harf: bas[2], parcalar: [bas[3]] };
      continue;
    }
    if (!aktif) continue;
    // "A.1" / "A.0," gibi bölüm kodu satırları gerekçeye girmemeli.
    if (/^[A-Z]\.\d+,?$/.test(satir) || /^#\s/.test(satir)) continue;
    aktif.parcalar.push(satir);
  }
  bitir();
  return anahtar;
}

/* ─────────────────────────────── Kısım B ────────────────────────────────── */

/**
 * İşaretlemeli bölümler. Maddeler "B1 <metin> ☐" satırları, anahtar ise
 * başlık satırı (B1 B2 …) + değer satırı (E H H …) çiftleri hâlinde.
 */
function kisimBBolumu(satirlar, { kodOnek, harfler, secenekler, soruKalibi, bolumAdi }) {
  const maddeler = [];
  const anahtar = new Map();
  const harfKumesi = new Set(harfler);

  let anahtardaMiyiz = false;
  let bekleyenKodlar = null;

  for (const ham of satirlar) {
    const satir = altligiAt(ham);
    if (!satir) continue;

    if (/Cevap Anahtarı/i.test(satir)) { anahtardaMiyiz = true; continue; }

    if (!anahtardaMiyiz) {
      const madde = new RegExp(`^${kodOnek}(\\d{1,3})\\s+(.*?)\\s*☐\\s*$`).exec(satir);
      if (madde) {
        // Sayfa kırılımında bazı satırlar iki kez basılmış (kitapçıkta B54
        // böyle). Aynı kod bir kez alınır.
        const kod = `${kodOnek}${madde[1]}`;
        if (!maddeler.some((m) => m.kod === kod)) {
          maddeler.push({ kod, no: Number(madde[1]), metin: madde[2].trim() });
        }
      }
      continue;
    }

    // Anahtar bölgesi: kod satırı ve hemen ardından değer satırı
    const kodlar = satir.split(/\s+/);
    if (kodlar.length >= 2 && kodlar.every((k) => new RegExp(`^${kodOnek}\\d{1,3}$`).test(k))) {
      bekleyenKodlar = kodlar;
      continue;
    }
    if (bekleyenKodlar) {
      const degerler = satir.split(/\s+/);
      if (degerler.length === bekleyenKodlar.length && degerler.every((d) => harfKumesi.has(d))) {
        bekleyenKodlar.forEach((kod, i) => anahtar.set(kod, degerler[i]));
      }
      bekleyenKodlar = null;
    }
  }

  return maddeler.map((madde) => {
    const deger = anahtar.get(madde.kod);
    return {
      kod: madde.kod,
      no: madde.no,
      bolum: bolumAdi,
      metin: soruKalibi(madde.metin),
      secenekler,
      cevap: deger ? secenekler[harfler.indexOf(deger)]?.harf ?? '' : '',
    };
  });
}

/* ──────────────────────────────── ana akış ──────────────────────────────── */

const metin = await pdfMetni(arg.pdf);
const satirlar = metin.split('\n');

const aBasi = satirlar.findIndex((s) => /^KISIM A —/.test(altligiAt(s)));
const aAnahtarBasi = satirlar.findIndex((s) => /^KISIM A — CEVAP ANAHTARI/.test(altligiAt(s)));
const bBasi = satirlar.findIndex((s) => /^KISIM B —/.test(altligiAt(s)));
const b2Basi = satirlar.findIndex((s) => /^BÖLÜM 2 —/.test(altligiAt(s)));

if (aBasi < 0 || aAnahtarBasi < 0 || bBasi < 0) {
  console.error('Beklenen KISIM A / KISIM B başlıkları bulunamadı; kitapçık düzeni değişmiş olabilir.');
  process.exit(1);
}

const aSorulari = kisimASorulari(satirlar.slice(aBasi, aAnahtarBasi));
const aAnahtar = kisimAAnahtari(satirlar.slice(aAnahtarBasi, bBasi));

const b1 = kisimBBolumu(satirlar.slice(bBasi, b2Basi), {
  kodOnek: 'B',
  harfler: ['E', 'H'],
  secenekler: [
    { harf: 'A', metin: 'Evet, farklılaştırır — işaretler artık ayırt edilemeyecek kadar benzer değildir' },
    { harf: 'B', metin: 'Hayır, farklılaştırmaz — işaretler hâlâ ayırt edilemeyecek kadar benzerdir' },
  ],
  soruKalibi: (m) => `${m}\n\nBu unsur, karşılaştırılan iki işaret arasındaki “ayırt edilemeyecek kadar benzerliği” ortadan kaldırır mı? (SMK m.5/1-ç)`,
  bolumAdi: 'Kısım B — 5/1-ç ekleri',
});

const b2 = kisimBBolumu(satirlar.slice(b2Basi), {
  kodOnek: 'B',
  harfler: ['R', 'İ'],
  secenekler: [
    { harf: 'A', metin: 'Kural olarak reddedilir' },
    { harf: 'B', metin: 'Kural olarak ilan edilir' },
  ],
  soruKalibi: (m) => `${m}\n\nBu başvuru SMK m.5/1-c bakımından kural olarak reddedilir mi, ilan edilir mi?`,
  bolumAdi: 'Kısım B — 5/1-c kalıpları',
});

/* ───────────────────────────── konu ataması ─────────────────────────────── */

const gecici = path.join(tmpdir(), `vekilquest-classify-${Date.now()}.mjs`);
await build({ entryPoints: ['src/lib/classify.ts'], bundle: true, format: 'esm', outfile: gecici, logLevel: 'error' });
const { siniflandir } = await import(`file://${gecici}`);

/**
 * Bölüm başlığı hangi SMK bendini işlediğini kesin söylüyor; konu atamasında
 * asıl dayanak bu. Sınıflandırıcı yalnızca m.4 ile ilgili (marka olabilecek
 * işaretler / sicilde gösterim) soruları ayırmak için devreye giriyor.
 */
function konuAta(soru) {
  const bolum = katla(soru.bolum);
  const varsayilan = bolum.includes('6/1') ? 'marka-nispi-ret' : 'marka-mutlak-ret';
  const sonuc = siniflandir(soru.metin, soru.secenekler.map((o) => o.metin), 'markaVb');
  if (sonuc.topicId === 'marka-isaret' && sonuc.guven >= 0.3) return { topicId: 'marka-isaret', guven: sonuc.guven };
  return { topicId: varsayilan, guven: 0.85 };
}

const simdi = Date.now();
const kaynak = arg.kaynak ?? 'Marka Kılavuzu';

const hepsi = [
  ...aSorulari.map((s) => {
    const cozum = aAnahtar.get(s.kod);
    const gecerli = cozum && s.secenekler.some((o) => o.harf === cozum.harf);
    return { ...s, cevap: gecerli ? cozum.harf : '', aciklama: cozum?.aciklama };
  }),
  ...b1,
  ...b2,
].map((s) => {
  const konu = konuAta(s);
  return {
    id: `mk-${s.kod.toLowerCase()}`,
    no: s.no,
    kaynak,
    bolum: s.bolum,
    tur: 'banka',
    metin: s.metin,
    secenekler: s.secenekler,
    cevap: s.cevap,
    aciklama: s.aciklama,
    topicId: konu.topicId,
    topicGuven: konu.guven,
    etiketler: ['marka kılavuzu'],
    eklenme: simdi,
  };
});

const ciktiYolu = arg.cikti ?? path.join('data', 'sorular', 'marka-kilavuzu.json');
await mkdir(path.dirname(ciktiYolu), { recursive: true });
await writeFile(ciktiYolu, JSON.stringify({
  surum: 1,
  kaynak,
  aciklama: 'TÜRKPATENT SMK m.5 ve m.6/1 İnceleme Kılavuzlarından türetilmiş çalışma soruları. Geçmiş sınav soruları değildir.',
  sorular: hepsi,
}, null, 1), 'utf8');

const bolumSayim = {};
for (const s of hepsi) bolumSayim[s.bolum] = (bolumSayim[s.bolum] ?? 0) + 1;

console.log(`Yazıldı: ${ciktiYolu}`);
console.log(`  ${hepsi.length} soru · ${hepsi.filter((s) => s.cevap).length} cevaplı · ${hepsi.filter((s) => s.aciklama).length} gerekçeli`);
console.log(`  Kısım A: ${aSorulari.length} · Kısım B: ${b1.length + b2.length}`);
console.table(bolumSayim);

const eksik = hepsi.filter((s) => !s.cevap).map((s) => s.kod ?? s.id);
if (eksik.length) console.log(`\nCevabı eşleşmeyen: ${eksik.join(', ')}`);
