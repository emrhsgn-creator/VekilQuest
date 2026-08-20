/**
 * TÜRKPATENT sınav kitapçıklarından çıkarılan ham metni yapılandırılmış
 * sorulara çevirir.
 *
 * Bu dosya bilerek düz JavaScript: hem tarayıcıdaki içe aktarma ekranı
 * (src/pages/IceAktar.tsx) hem de terminalden çalışan toplu dönüştürücü
 * (tools/pdf-to-json.mjs) aynı ayrıştırma mantığını kullansın diye. Tip
 * tanımları parse.d.mts dosyasında.
 *
 * ── Neden bu kadar iş var? ────────────────────────────────────────────────
 * Gerçek kitapçıkların düzeni yıldan yıla değişiyor ve naif bir "satır başındaki
 * numara = yeni soru" kuralı üç ayrı yerde patlıyor:
 *
 *   1) Kapaktaki AÇIKLAMALAR listesi de 1-10 diye numaralı.
 *   2) Soru gövdelerinde "1. … 2. … 3. …" biçiminde alt maddeler var; bunlar
 *      soru numarasıyla aynı görünüyor.
 *   3) Soru ayracı yıla göre değişiyor: 2015'te "7-", sonraki yıllarda "7.".
 *
 * Çözüm: soruları numaralardan değil, **seçenek kümelerinden** yakalıyoruz.
 * Her gerçek sorunun tam olarak bir A→E dizisi vardır. İki ardışık seçenek
 * kümesi arasındaki metin tek bir sorunun gövdesidir ve o gövdenin başındaki
 * ilk numara sorunun numarasıdır. Gövde içindeki alt maddeler numaradan sonra
 * geldiği için doğal olarak elenir.
 *
 * Kitapçıklar ayrıca çok bölümlü: 1. kitapçık patent, 2. kitapçık marka /
 * coğrafi işaret / tasarım sorularını taşıyor; 2015'te bunun yerine
 * "PATENT SORULARI / MARKA SORULARI / ORTAK SORULAR" başlıkları var. Her bölüm
 * 1'den yeniden numaralanıyor, cevap anahtarı ise sürekli numaralandırma
 * kullanıyor; bu yüzden hem yerel hem genel numara tutuluyor.
 */

/**
 * Türkçe büyük harf katlaması.
 *
 * JS'in regex `i` bayrağı `İ` (U+0130) ile `i`yi eşleştirmez; bu yüzden
 * "SORU KİTAPÇIĞI" gibi başlıklar /kitapçığı/i ile yakalanmaz. Desen eşlemeden
 * önce satırı burada sadeleştiriyoruz.
 */
const KATLAMA = {
  'İ': 'i', 'I': 'i', 'ı': 'i', 'Ş': 's', 'ş': 's', 'Ğ': 'g', 'ğ': 'g',
  'Ü': 'u', 'ü': 'u', 'Ö': 'o', 'ö': 'o', 'Ç': 'c', 'ç': 'c',
  'Â': 'a', 'â': 'a', 'Î': 'i', 'î': 'i', 'Û': 'u', 'û': 'u',
};

export function katla(metin) {
  return katlaHizali(metin).replace(/\s+/g, ' ').trim();
}

/**
 * Uzunluğu ve dolayısıyla karakter indekslerini koruyan katlama.
 * Başlık konumlarını katlanmış metinde bulup özgün metni aynı indeksle
 * dilimleyebilmek için gerekli.
 */
export function katlaHizali(metin) {
  let cikti = '';
  for (let i = 0; i < metin.length; i++) {
    const harf = metin[i];
    const eslesme = KATLAMA[harf];
    if (eslesme) { cikti += eslesme; continue; }
    const kucuk = harf.toLowerCase();
    cikti += kucuk.length === 1 ? kucuk : harf;
  }
  return cikti;
}

/** Cevap anahtarı başlıkları asla gürültü sayılmaz; bölme onlara dayanıyor. */
const KORUNAN = /cevap anahtar|sinavi cevaplar|cevap anahtarlar/;

/**
 * Sayfa başlığı/altlığı gibi soru metnine karışan satırlar.
 * Desenler `katla()` çıktısına, yani sadeleştirilmiş küçük harfe uygulanır.
 */
const GURULTU_DESENLERI = [
  /^\d{1,3}$/,
  /soru kitapcigi/,
  /genel yeterlik sinavi/,
  /vekilligi sinavi/,
  /t\.?c\.? kimlik numarasi/,
  /^(adi soyadi|salon no|sira no|imza)$/,
  /adayin (adi|soyadi)/,
  /diger sayfaya geciniz/,
  /^test bitti/,
  /sinav baslamadan/,
  /^sayfa \d+/,
  /^turk patent ve marka kurumu$/,
  /her hakki saklidir/,
  /yazili izni olmadan/,
  /gerekli cezai sorumlulugu/,
  /^[-\u2013\u2014_]{3,}$/,
];

function gurultuMu(satir) {
  const s = katla(satir);
  if (!s || KORUNAN.test(s)) return false;
  return GURULTU_DESENLERI.some((d) => d.test(s));
}

/** PDF metnini satır kırıkları ve tireli bölünmelerden arındırır. */
export function metniTemizle(ham) {
  const satirlar = ham
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ')
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

/* ────────────────────────────────── seçenek kümeleri ────────────────────── */

// Harften hemen önce boşluk/satır başı olmalı: "KİTAPÇIĞI (A)" gibi sayfa
// başlıklarındaki parantezli harfler seçenek sanılmasın.
const SECENEK_ISARETI = /(?:^|[ \t\n])([A-E])\s*[).]\s+/g;
const SIRA = ['A', 'B', 'C', 'D', 'E'];

/**
 * Metindeki tüm A→E seçenek kümelerini bulur. Her küme bir soruyu işaretler.
 * En az dört seçenek (A-D) art arda gelmelidir; metin içinde geçen tekil
 * "A)" atıfları böylece elenir.
 */
function secenekKumeleriniBul(metin) {
  SECENEK_ISARETI.lastIndex = 0;
  const isaretler = [];
  let eslesme;
  while ((eslesme = SECENEK_ISARETI.exec(metin)) !== null) {
    isaretler.push({
      harf: eslesme[1],
      bas: eslesme.index + eslesme[0].indexOf(eslesme[1]),
      govdeBas: SECENEK_ISARETI.lastIndex,
    });
  }

  const kumeler = [];
  for (let i = 0; i < isaretler.length; i++) {
    if (isaretler[i].harf !== 'A') continue;
    const dizi = [isaretler[i]];
    for (let j = i + 1; j < isaretler.length && dizi.length < 5; j++) {
      if (isaretler[j].harf === SIRA[dizi.length]) dizi.push(isaretler[j]);
    }
    if (dizi.length < 4) continue;
    kumeler.push(dizi);
    // Bu kümenin son işaretinden sonrasına atla; iç içe eşleşme olmasın.
    while (i < isaretler.length && isaretler[i].bas <= dizi[dizi.length - 1].bas) i++;
    i--;
  }
  return kumeler;
}

/** Seçenek kümesini {harf, metin} listesine çevirir. `son`, kümeden sonraki sınır. */
function seceneklereBol(metin, dizi, son) {
  return dizi.map((isaret, i) => {
    const bitis = dizi[i + 1] ? dizi[i + 1].bas : son;
    return { harf: isaret.harf, metin: metin.slice(isaret.govdeBas, bitis).replace(/\s+/g, ' ').trim() };
  });
}

/* ─────────────────────────────────── numaralar ──────────────────────────── */

/** Satır başındaki "12.", "12-", "12)" biçimindeki numara adayları. */
const NUMARA_ADAYI = /(?:^|\n)\s*(\d{1,3})\s*[-.)]\s+/g;

function numaraAdaylari(metin) {
  NUMARA_ADAYI.lastIndex = 0;
  const adaylar = [];
  let eslesme;
  while ((eslesme = NUMARA_ADAYI.exec(metin)) !== null) {
    adaylar.push({
      no: Number(eslesme[1]),
      bas: eslesme.index + eslesme[0].search(/\d/),
      govdeBas: NUMARA_ADAYI.lastIndex,
    });
  }
  return adaylar;
}

/* ─────────────────────────────── kitapçık bölme ─────────────────────────── */

// Desenler katlanmış (Türkçe karakterleri sadeleştirilmiş, küçük harfli) metne
// uygulanır; katlama uzunluğu koruduğu için bulunan indeksler özgün metinde de
// geçerlidir.
const CEVAP_BASLIGI = /^.{0,80}(cevap\s*anahtar|sinavi\s*cevaplar)/m;
const KITAPCIK_SINIRI = /^\s*aciklamalar\s*$/gm;
const BOLUM_BASLIGI = /^\s*(patent|marka|tasarim|cografi isaret|ortak)\s+(sorulari|sorular)\s*$/gm;

/**
 * Belgeyi soru kitapçıklarına ve cevap anahtarı bölgesine ayırır.
 * @returns {{kitapciklar: {metin:string, bolumler:{ad:string|null, metin:string}[]}[], anahtarMetni: string}}
 */
export function kisimlaraAyir(temizMetin) {
  const katli = katlaHizali(temizMetin);
  const anahtarEslesme = CEVAP_BASLIGI.exec(katli);
  const kesim = anahtarEslesme ? anahtarEslesme.index : temizMetin.length;
  const soruBolgesi = temizMetin.slice(0, kesim);
  const anahtarMetni = temizMetin.slice(kesim);

  // Her "AÇIKLAMALAR" yeni bir kitapçığın başı. Öncesindeki kapak atılır.
  KITAPCIK_SINIRI.lastIndex = 0;
  const sinirlar = [];
  const katliSoruBolgesi = katli.slice(0, kesim);
  let e;
  while ((e = KITAPCIK_SINIRI.exec(katliSoruBolgesi)) !== null) sinirlar.push(e.index);

  const parcalar = sinirlar.length
    ? sinirlar.map((bas, i) => soruBolgesi.slice(bas, sinirlar[i + 1] ?? soruBolgesi.length))
    : [soruBolgesi];

  const kitapciklar = parcalar.map((metin) => ({ metin, bolumAdlari: bolumAdlari(metin) }));
  return { kitapciklar, anahtarMetni };
}

/**
 * Kitapçıktaki "PATENT SORULARI" gibi bölüm adlarını görülme sırasına göre
 * döndürür.
 *
 * Bu başlıklar sayfa üstbilgisi olarak basılıyor; yani bölümün başında değil,
 * ortasında beliriyorlar. Bu yüzden metni onlara göre BÖLMÜYORUZ — bölüm
 * sınırı, soru numaralandırmasının 1'e dönmesinden anlaşılıyor. Başlıklar
 * yalnızca bulunan bölümleri adlandırmak için kullanılıyor.
 */
function bolumAdlari(kitapcikMetni) {
  BOLUM_BASLIGI.lastIndex = 0;
  const katli = katlaHizali(kitapcikMetni);
  const adlar = [];
  let e;
  while ((e = BOLUM_BASLIGI.exec(katli)) !== null) {
    const ad = kitapcikMetni
      .slice(e.index, e.index + e[0].length)
      .trim().toLocaleUpperCase('tr').split(/\s+/)[0];
    if (adlar[adlar.length - 1] !== ad) adlar.push(ad);
  }
  return adlar;
}

/* ──────────────────────────────── soru çıkarma ──────────────────────────── */

/**
 * Tek bir bölümdeki soruları çıkarır.
 * @returns {{sorular: object[], uyarilar: string[]}}
 */
function bolumdenSorular(bolumMetni, bolumlereAyrilabilir = false) {
  const uyarilar = [];
  const kumeler = secenekKumeleriniBul(bolumMetni);
  if (kumeler.length === 0) return { sorular: [], uyarilar };

  // Kapak / AÇIKLAMALAR bölgesini at: ilk seçenek kümesinden önceki son
  // "KISALTMALAR" (yoksa "AÇIKLAMALAR") başlığına kadar olan kısım soru değil.
  const ilkKume = kumeler[0][0].bas;
  const onSozSonu = sonBaslikKonumu(bolumMetni.slice(0, ilkKume));

  const adaylar = numaraAdaylari(bolumMetni).filter((a) => a.bas >= onSozSonu);

  const sorular = [];
  const artikBloklar = [];
  let bolumIndeksi = 0;
  // Bölümün ilk sorusunun numarası 1 olmak zorunda değil: bazı kitapçıklar
  // önceki kitapçıktan devam eder (ör. 2. kitapçık 61'den başlar). İlk adayı
  // olduğu gibi kabul edip zinciri oradan kuruyoruz.
  let sonNo = 0;

  for (let k = 0; k < kumeler.length; k++) {
    const dizi = kumeler[k];
    const oncekiSon = k === 0 ? onSozSonu : sonrakiSinir(bolumMetni, kumeler[k - 1]);
    const govdeSonu = dizi[0].bas;

    const penceredekiler = adaylar.filter((a) => a.bas >= oncekiSon && a.bas < govdeSonu);

    // Basılı numara, cevap anahtarıyla hizalamanın tek güvenilir dayanağı:
    // araya kaçırdığımız bir soru girse bile sonraki numaralar doğru kalır.
    // Bu yüzden numarayı sıradan değil metinden alıyoruz — ama yalnızca
    // süreklilik makulse. Gövde içindeki alt maddeler ("1. … 2. …") soru
    // numarasından sonra geldiği için ilk uygun aday doğru olandır.
    let aday = k === 0 ? penceredekiler[0] : penceredekiler.find((a) => a.no === sonNo + 1);
    if (k === 0 && aday) sonNo = aday.no - 1;

    if (!aday) {
      // Numaralandırma 1'e dönüyorsa yeni bir bölüm başlamıştır
      // (2015 kitapçığında PATENT / MARKA / ORTAK bölümleri gibi). Bu kural
      // yalnızca kitapçıkta gerçekten bölüm başlığı varsa uygulanır: aksi
      // hâlde gövde içindeki "1. … 2. …" alt maddeleri yanlışlıkla yeni bölüm
      // sanılıp numaralandırma ikiye bölünüyor.
      const yeniden = bolumlereAyrilabilir
        ? penceredekiler.find((a) => a.no <= 3 && sonNo >= 8)
        : undefined;
      if (yeniden) {
        bolumIndeksi += 1;
        aday = yeniden;
        sonNo = yeniden.no - 1;
      }
    }
    if (!aday) {
      // Numara atlaması: bir soruyu kaçırmış olabiliriz. Küçük bir sıçramayı
      // kabul et, büyük sıçramayı (gövde içi numara olabilir) reddet.
      aday = penceredekiler.find((a) => a.no > sonNo && a.no <= sonNo + 6);
      if (aday && aday.no > sonNo + 1) {
        uyarilar.push(
          `${sonNo + 1}${aday.no - sonNo > 2 ? `–${aday.no - 1}` : ''}. soru ayrıştırılamadı; kitapçıkta ${aday.no}. soruyla devam ediliyor.`,
        );
      }
    }
    if (!aday) {
      // Numarası olmayan seçenek bloğu. Bu genelde gövdesi görsel olan bir
      // sorunun ya da sayfa düzeninden kopmuş bir tablonun artığıdır. Soru
      // sayılırsa numara zinciri kayar ve BÜTÜN sonraki cevaplar yanlış
      // eşleşir; bu yüzden atlanıp rapor ediliyor.
      artikBloklar.push(sonNo);
      continue;
    }

    const no = aday.no;
    sonNo = no;

    const govdeBas = aday ? aday.govdeBas : oncekiSon;
    const metin = bolumMetni.slice(govdeBas, govdeSonu).replace(/\s+/g, ' ').trim();
    const secenekler = seceneklereBol(bolumMetni, dizi, sonrakiSinir(bolumMetni, dizi));

    const gorselIcerikli = metin.length < 15;
    if (gorselIcerikli) {
      uyarilar.push(`${no}. sorunun gövdesi okunamadı — büyük olasılıkla görsel (tablo/şekil) içerikli.`);
    }

    sorular.push({
      no,
      bolumIndeksi,
      metin,
      secenekler,
      cevap: '',
      gorselIcerikli: gorselIcerikli || undefined,
    });
  }

  if (artikBloklar.length) {
    uyarilar.push(
      `${artikBloklar.length} adet numarasız seçenek bloğu atlandı (${artikBloklar
        .map((n) => `${n}. sorudan sonra`).slice(0, 5).join(', ')}). ` +
      'Gövdesi görsel olan sorular olabilir; ilgili soruları elle eklemen gerekebilir.',
    );
  }
  return { sorular, uyarilar };
}

/** Seçenek kümesinin bittiği yeri kestirir: son seçenekten sonraki numara adayı. */
function sonrakiSinir(metin, dizi) {
  const sonIsaret = dizi[dizi.length - 1];
  const kalan = metin.slice(sonIsaret.govdeBas);
  const sonraki = /(?:^|\n)\s*\d{1,3}\s*[-.)]\s+/.exec(kalan);
  return sonIsaret.govdeBas + (sonraki ? sonraki.index : kalan.length);
}

function sonBaslikKonumu(onBolge) {
  for (const desen of [/KISALTMALAR/gi, /A[ÇC]IKLAMALAR/gi]) {
    let son = -1;
    let e;
    desen.lastIndex = 0;
    while ((e = desen.exec(onBolge)) !== null) son = e.index + e[0].length;
    if (son >= 0) return son;
  }
  return 0;
}

/**
 * Ham kitapçık metnini sorulara böler. Tek bölümlü basit metinlerde de
 * (ör. elle yapıştırılan sorular) çalışır.
 * @returns {{sorular: object[], uyarilar: string[]}}
 */
export function sorulariAyristir(hamMetin) {
  const temiz = metniTemizle(hamMetin);
  const { kitapciklar } = kisimlaraAyir(temiz);

  const uyarilar = [];
  /** Her biri bir kitapçık ya da bölüm: cevap anahtarında bir sütuna/aralığa karşılık gelir. */
  const kumeler = [];

  kitapciklar.forEach((kitapcik, kIndeks) => {
    const sonuc = bolumdenSorular(kitapcik.metin, kitapcik.bolumAdlari.length > 1);
    uyarilar.push(...sonuc.uyarilar.map((u) =>
      kitapciklar.length > 1 ? `${kIndeks + 1}. kitapçık: ${u}` : u));

    const adlar = kitapcik.bolumAdlari;
    const bolumSayisi = Math.max(...sonuc.sorular.map((s) => s.bolumIndeksi), 0) + 1;
    for (let b = 0; b < bolumSayisi; b++) {
      const altKume = sonuc.sorular.filter((s) => s.bolumIndeksi === b);
      if (altKume.length === 0) continue;
      kumeler.push({
        kitapcikNo: kitapciklar.length > 1 ? kIndeks + 1 : undefined,
        bolum: bolumSayisi > 1 ? (adlar[b] ?? `BÖLÜM ${b + 1}`) : undefined,
        beyan: beyanEdilenSoruSayisi(kitapcik.metin),
        sorular: altKume,
      });
    }
  });

  // ── Numaralandırma ──────────────────────────────────────────────────────
  // Üç ayrı kavram var ve karıştırılırsa cevaplar kayar:
  //   yerelNo   : kitapçıkta basılı numara (kullanıcıya gösterilen)
  //   anahtarNo : cevap anahtarında aranacak numara
  //   sira      : belge içinde benzersiz sıra (kimlik üretmek için)
  // Kitapçıklar bazen 1'den yeniden başlar, bazen önceki kitapçıktan devam
  // eder (2. kitapçığın 61'den başlaması gibi). Karar kümesi bazında verilir.
  const sorular = [];
  let enBuyukAnahtar = 0;
  let sira = 0;

  for (const kume of kumeler) {
    const enKucukYerel = Math.min(...kume.sorular.map((s) => s.no));
    const devamEdiyor = enKucukYerel > enBuyukAnahtar;
    const kaydirma = devamEdiyor ? 0 : enBuyukAnahtar;

    for (const soru of kume.sorular) {
      sira += 1;
      const anahtarNo = soru.no + kaydirma;
      enBuyukAnahtar = Math.max(enBuyukAnahtar, anahtarNo);
      sorular.push({
        ...soru,
        sira,
        yerelNo: soru.no,
        anahtarNo,
        no: soru.no,
        kitapcikNo: kume.kitapcikNo,
        bolum: kume.bolum,
      });
    }

    if (kume.beyan && kume.sorular.length < kume.beyan) {
      uyarilar.push(
        `${kume.kitapcikNo ?? 1}. kitapçıkta ${kume.beyan} sorudan ${kume.sorular.length} tanesi ayrıştırılabildi.`,
      );
    }
  }

  if (sorular.length === 0) {
    uyarilar.push('Metinde A–E seçenekli soru bulunamadı. PDF taranmış görüntü olabilir.');
  }
  return { sorular, uyarilar };
}

/** Kapaktaki "Bu kitapçıkta 60 soru bulunmaktadır." ifadesinden soru sayısını okur. */
export function beyanEdilenSoruSayisi(kitapcikMetni) {
  // Desen katlanmış metne uygulanır: "kitapçığında" -> "kitapciginda".
  // Desen katlanmış metne uygulanır: "kitapçıkta" -> "kitapcikta".
  const e = /kitapci(?:kta|ginda)\s+(\d{1,3})\s+soru/.exec(katla(kitapcikMetni));
  return e ? Number(e[1]) : null;
}

/* ─────────────────────────────── cevap anahtarı ─────────────────────────── */

const ANAHTAR_CIFTI = /(?:^|[\s|])(\d{1,3})\s*[-.):]?\s*([A-Ea-e])(?=[\s|]|$)/g;

/**
 * Cevap anahtarını ayrıştırır.
 *
 * İki biçim var:
 *  • Sürekli numaralandırma (1-100), birden çok sütuna yayılmış olabilir.
 *    Numaralar benzersiz olduğu için tüm çiftler tek haritada birleşir.
 *  • Bölüm başına ayrı numaralandırma (2015): "1 C   1 C   1 A" gibi paralel
 *    sütunlar. Numaralar tekrar ettiği için sütun sırası bölüm sırasına eşlenir.
 *
 * @returns {{tekil: Map<number,string>, sutunlar: Map<number,string>[]}}
 */
export function cevapAnahtariAyristir(hamMetin) {
  const metin = metniTemizle(hamMetin);
  const satirlar = metin.split('\n');

  const satirCiftleri = satirlar.map((satir) => {
    ANAHTAR_CIFTI.lastIndex = 0;
    const ciftler = [];
    let e;
    while ((e = ANAHTAR_CIFTI.exec(satir)) !== null) {
      const no = Number(e[1]);
      if (no >= 1 && no <= 200) ciftler.push({ no, harf: e[2].toLocaleUpperCase('tr') });
    }
    return ciftler;
  }).filter((c) => c.length > 0);

  const tumCiftler = satirCiftleri.flat();
  const benzersiz = new Set(tumCiftler.map((c) => c.no)).size === tumCiftler.length;

  if (benzersiz || tumCiftler.length === 0) {
    return { tekil: new Map(tumCiftler.map((c) => [c.no, c.harf])), sutunlar: [] };
  }

  // Numaralar tekrar ediyor: sütun bazlı anahtar.
  const sutunSayisi = Math.max(...satirCiftleri.map((c) => c.length));
  const sutunlar = Array.from({ length: sutunSayisi }, () => new Map());
  for (const ciftler of satirCiftleri) {
    // Yalnızca tam genişlikteki satırlar sütun hizasını korur.
    if (ciftler.length !== sutunSayisi) continue;
    ciftler.forEach((c, i) => { if (!sutunlar[i].has(c.no)) sutunlar[i].set(c.no, c.harf); });
  }
  return { tekil: new Map(), sutunlar };
}

/** "İPTAL" olarak işaretlenmiş soru numaralarını çıkarır. */
export function iptalEdilenler(hamMetin) {
  const iptaller = new Set();
  const desen = /(\d{1,3})\s*[-.):]?\s*[İIi]PTAL/gi;
  let eslesme;
  while ((eslesme = desen.exec(hamMetin)) !== null) iptaller.add(Number(eslesme[1]));
  return iptaller;
}

/* ───────────────────────────── uçtan uca ayrıştırma ─────────────────────── */

/**
 * Cevap anahtarı kitapçığın içinde olan (ya da ayrı verilen) bir sınav belgesini
 * baştan sona ayrıştırır: bölümlere ayırır, soruları çıkarır, cevapları eşler.
 *
 * @param {string} kitapcikMetni
 * @param {string} [ayriAnahtarMetni] Cevap anahtarı ayrı dosyadaysa.
 * @returns {{sorular: object[], uyarilar: string[], rapor: object}}
 */
export function belgeyiAyristir(kitapcikMetni, ayriAnahtarMetni = '') {
  const temiz = metniTemizle(kitapcikMetni);
  const { anahtarMetni } = kisimlaraAyir(temiz);
  const { sorular, uyarilar } = sorulariAyristir(kitapcikMetni);

  const anahtarKaynagi = ayriAnahtarMetni || anahtarMetni;
  const anahtar = anahtarKaynagi ? cevapAnahtariAyristir(anahtarKaynagi) : { tekil: new Map(), sutunlar: [] };
  const iptaller = anahtarKaynagi ? iptalEdilenler(anahtarKaynagi) : new Set();

  // Sütunlu anahtarda sütun sırası, sorulardaki bölüm sırasına karşılık gelir.
  const bolumSirasi = [...new Set(sorular.map((s) => s.bolum ?? `kitapçık ${s.kitapcikNo ?? 1}`))];

  const cikti = sorular.map((soru) => {
    let harf = '';
    if (anahtar.sutunlar.length > 0) {
      const sutunIndeksi = bolumSirasi.indexOf(soru.bolum ?? `kitapçık ${soru.kitapcikNo ?? 1}`);
      harf = anahtar.sutunlar[sutunIndeksi]?.get(soru.yerelNo) ?? '';
    } else {
      harf = anahtar.tekil.get(soru.anahtarNo) ?? '';
    }
    const gecerli = soru.secenekler.some((o) => o.harf === harf);
    return {
      ...soru,
      cevap: gecerli ? harf : '',
      iptal: iptaller.has(soru.anahtarNo) || undefined,
    };
  });

  if (anahtar.sutunlar.length > 0 && anahtar.sutunlar.length !== bolumSirasi.length) {
    uyarilar.push(
      `Cevap anahtarında ${anahtar.sutunlar.length} sütun var ama ${bolumSirasi.length} bölüm bulundu; eşleşme kontrol edilmeli.`,
    );
  }

  return {
    sorular: cikti,
    uyarilar,
    rapor: {
      toplam: cikti.length,
      cevapliEslesen: cikti.filter((s) => s.cevap).length,
      cevapsiz: cikti.filter((s) => !s.cevap && !s.iptal).length,
      secenekEksik: cikti.filter((s) => s.secenekler.length < 4).length,
      gorselIcerikli: cikti.filter((s) => s.gorselIcerikli).length,
      iptal: cikti.filter((s) => s.iptal).length,
      bolumler: bolumSirasi,
    },
  };
}

/** Ayrı ayrıştırılmış soru ve anahtarı birleştirir (basit, tek bölümlü hâl). */
export function birlestir(sorular, anahtar, iptaller = new Set()) {
  const harita = anahtar instanceof Map ? anahtar : anahtar.tekil;
  const cikti = sorular.map((s) => {
    const cevap = harita.get(s.no) ?? '';
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
      cevapliEslesen: cikti.filter((s) => s.cevap).length,
      cevapsiz: cikti.filter((s) => !s.cevap && !s.iptal).length,
      secenekEksik: cikti.filter((s) => s.secenekler.length < 4).length,
      iptal: cikti.filter((s) => s.iptal).length,
    },
  };
}
