/**
 * TÜRKPATENT sınav kitapçıklarından çıkarılan ham metni yapılandırılmış
 * sorulara çevirir.
 *
 * Bu dosya bilerek düz JavaScript: hem tarayıcıdaki içe aktarma ekranı
 * (src/pages/IceAktar.tsx) hem de terminalden çalışan toplu dönüştürücü
 * (tools/pdf-to-json.mjs) aynı ayrıştırma mantığını kullansın diye. Tip
 * tanımları parse.d.ts dosyasında.
 *
 * Kitapçık düzeni yıldan yıla küçük farklar gösterdiği için ayrıştırma
 * toleranslı tutuldu; sonuçlar arayüzde önizlenip düzeltilebiliyor.
 */

/** Sayfa başlığı/altlığı gibi soru metnine karışan satırlar. */
const GURULTU_DESENLERI = [
  /^\s*\d{1,3}\s*$/,
  /soru\s*kitap[çc][ıi]ğ[ıi]/i,
  /marka\s*vek[İi]ll[İi]ğ[İi]\s*sinavi/i,
  /patent\s*vek[İi]ll[İi]ğ[İi]\s*sinavi/i,
  /t\.?c\.?\s*k[İi]ml[İi]k\s*numarasi/i,
  /adayin\s*(adi|soyadi)/i,
  /d[İi]ğer\s*sayfaya\s*ge[çc][İi]n[İi]z/i,
  /sinav\s*ba[şs]lamadan/i,
  /^\s*sayfa\s*\d+/i,
  /t[üu]rk\s*patent\s*ve\s*marka\s*kurumu/i,
  /^\s*[-–—_]{3,}\s*$/,
];

function gurultuMu(satir) {
  const s = satir.trim();
  if (!s) return false;
  return GURULTU_DESENLERI.some((d) => d.test(s));
}

/** PDF metnini satır kırıkları ve tireli bölünmelerden arındırır. */
export function metniTemizle(ham) {
  const satirlar = ham
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .split('\n')
    .filter((s) => !gurultuMu(s));

  return satirlar
    .join('\n')
    // satır sonundaki tireli bölünmeleri birleştir: "marka-\nsı" -> "markası"
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SORU_BASI = /(?:^|\n)\s*(\d{1,3})\s*[.)]\s+/g;
const SECENEK_BASI = /(?:^|\s)([A-E])\s*[).]\s+/g;

/**
 * Ham kitapçık metnini sorulara böler.
 * @returns {{sorular: any[], uyarilar: string[]}}
 */
export function sorulariAyristir(hamMetin) {
  const metin = metniTemizle(hamMetin);
  const uyarilar = [];

  // Soru başlangıçlarının konumlarını topla.
  const basliklar = [];
  SORU_BASI.lastIndex = 0;
  let eslesme;
  while ((eslesme = SORU_BASI.exec(metin)) !== null) {
    basliklar.push({ no: Number(eslesme[1]), bas: eslesme.index, govdeBas: SORU_BASI.lastIndex });
  }

  if (basliklar.length === 0) {
    return { sorular: [], uyarilar: ['Metinde "1." biçiminde numaralandırılmış soru bulunamadı.'] };
  }

  // Numaralar artan gitmeli; artmayanlar (ör. metin içindeki "5." atıfları) elenir.
  const temizBasliklar = [];
  let beklenen = basliklar[0].no;
  for (const b of basliklar) {
    if (b.no === beklenen || (temizBasliklar.length === 0 && b.no <= 2)) {
      temizBasliklar.push(b);
      beklenen = b.no + 1;
    } else if (b.no === beklenen + 1) {
      uyarilar.push(`${beklenen}. soru atlanmış görünüyor.`);
      temizBasliklar.push(b);
      beklenen = b.no + 1;
    }
  }

  const sorular = [];
  for (let i = 0; i < temizBasliklar.length; i++) {
    const bu = temizBasliklar[i];
    const sonraki = temizBasliklar[i + 1];
    const blok = metin.slice(bu.govdeBas, sonraki ? sonraki.bas : metin.length).trim();
    const cozum = blogaAyristir(blok);
    if (!cozum) {
      uyarilar.push(`${bu.no}. sorunun seçenekleri okunamadı; elle düzeltilmeli.`);
      sorular.push({ no: bu.no, metin: blok, secenekler: [], cevap: '' });
      continue;
    }
    sorular.push({ no: bu.no, ...cozum });
  }

  return { sorular, uyarilar };
}

/** Tek bir soru bloğunu gövde + seçenekler olarak ayırır. */
function blogaAyristir(blok) {
  SECENEK_BASI.lastIndex = 0;
  const isaretler = [];
  let eslesme;
  while ((eslesme = SECENEK_BASI.exec(blok)) !== null) {
    isaretler.push({ harf: eslesme[1], bas: eslesme.index, govdeBas: SECENEK_BASI.lastIndex });
  }

  // A ile başlayıp sırayla ilerleyen ilk diziyi bul (metin içindeki tekil
  // "A)" atıflarını elemek için).
  const beklenenSira = ['A', 'B', 'C', 'D', 'E'];
  let baslangicIndeksi = -1;
  for (let i = 0; i < isaretler.length; i++) {
    if (isaretler[i].harf !== 'A') continue;
    let uyum = 1;
    let j = i + 1;
    while (j < isaretler.length && uyum < 5 && isaretler[j].harf === beklenenSira[uyum]) {
      uyum += 1;
      j += 1;
    }
    if (uyum >= 4) { baslangicIndeksi = i; break; }
  }
  if (baslangicIndeksi === -1) return null;

  const dizi = [];
  let sira = 0;
  for (let i = baslangicIndeksi; i < isaretler.length && sira < 5; i++) {
    if (isaretler[i].harf === beklenenSira[sira]) {
      dizi.push(isaretler[i]);
      sira += 1;
    }
  }

  const govde = blok.slice(0, dizi[0].bas).replace(/\s+/g, ' ').trim();
  const secenekler = dizi.map((isaret, i) => {
    const son = dizi[i + 1] ? dizi[i + 1].bas : blok.length;
    return {
      harf: isaret.harf,
      metin: blok.slice(isaret.govdeBas, son).replace(/\s+/g, ' ').trim(),
    };
  });

  if (!govde || secenekler.some((s) => !s.metin)) return null;
  return { metin: govde, secenekler, cevap: '' };
}

/**
 * Cevap anahtarını ayrıştırır. "1-A", "1. A", "1 A", tablo hâlinde sütunlar
 * ve "1) A" biçimlerini kabul eder.
 * @returns {Map<number,string>}
 */
export function cevapAnahtariAyristir(hamMetin) {
  const metin = metniTemizle(hamMetin);
  const anahtar = new Map();
  const desen = /(?:^|[\s|])(\d{1,3})\s*[-.):]?\s*([A-Ea-e])(?=[\s|]|$)/g;
  let eslesme;
  while ((eslesme = desen.exec(metin)) !== null) {
    const no = Number(eslesme[1]);
    const harf = eslesme[2].toUpperCase();
    if (no >= 1 && no <= 200 && !anahtar.has(no)) anahtar.set(no, harf);
  }
  return anahtar;
}

/** "İPTAL" olarak işaretlenmiş soru numaralarını çıkarır. */
export function iptalEdilenler(hamMetin) {
  const iptaller = new Set();
  const desen = /(\d{1,3})\s*[-.):]?\s*[İIi]PTAL/gi;
  let eslesme;
  while ((eslesme = desen.exec(hamMetin)) !== null) {
    iptaller.add(Number(eslesme[1]));
  }
  return iptaller;
}

/** Ayrıştırılmış soru + cevap anahtarını birleştirip kalite raporu üretir. */
export function birlestir(sorular, anahtar, iptaller = new Set()) {
  let eslesen = 0;
  const cikti = sorular.map((s) => {
    const cevap = anahtar.get(s.no) ?? '';
    if (cevap) eslesen += 1;
    return {
      ...s,
      cevap: s.secenekler.some((o) => o.harf === cevap) ? cevap : '',
      iptal: iptaller.has(s.no) || undefined,
    };
  });
  return {
    sorular: cikti,
    rapor: {
      toplam: cikti.length,
      cevapliEslesen: eslesen,
      cevapsiz: cikti.filter((s) => !s.cevap && !s.iptal).length,
      secenekEksik: cikti.filter((s) => s.secenekler.length < 4).length,
      iptal: cikti.filter((s) => s.iptal).length,
    },
  };
}
