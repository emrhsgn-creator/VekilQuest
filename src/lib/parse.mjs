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
  /(diger|arka|sonraki) sayfaya geciniz/,
  /sorularina geciniz|sorulara geciniz/,
  /^test(iniz)? bitti/,
  /cevaplarinizi kontrol ediniz/,
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
    return { harf: isaret.harf, metin: kuyrukGurultusunuAt(metin.slice(isaret.govdeBas, bitis)).replace(/\s+/g, ' ').trim() };
  });
}

/**
 * Bir parçanın sonuna yapışan sayfa artıklarını atar: tek başına kitapçık
 * harfi ("A"), sütun sonuna düşen bölüm başlığı ("ORTAK SORULAR"), "Test
 * bitti" gibi satırlar. Bunlar sayfa başlığı olarak basıldığı için bir sonraki
 * sorunun değil, o sütundaki son seçeneğin arkasına ekleniyor.
 */
const KUYRUK_GURULTUSU = [
  /^[a-e]$/,
  /^(patent|marka|tasarim|cografi isaret|ortak)( sorulari?| sorulara geciniz)?$/,
  /^test(iniz)? bitti/,
  /^cevaplarinizi kontrol/,
  /^sinavda uyulmasi gereken/,
  /sinavi$/,
];

function kuyrukGurultusunuAt(parca) {
  const satirlar = parca.split('\n');
  while (satirlar.length > 1) {
    const son = katla(satirlar[satirlar.length - 1]);
    if (son && !KUYRUK_GURULTUSU.some((d) => d.test(son))) break;
    satirlar.pop();
  }
  return satirlar.join('\n');
}

/* ─────────────────────────────────── numaralar ──────────────────────────── */

/**
 * Satır başındaki "12.", "12-", "12)" biçimindeki numara adayları.
 * 2015 kitapçığında tireden sonra boşluk bırakılmayan sorular var
 * ("15-6098 sayılı…", "25-Yoğun…"); tire için boşluk zorunlu değil. Tireden
 * sonra kısa bir sayı gelmesi ise numara sayılmaz: tasarım görsel numaraları
 * ("1-1 1-2 2-1") seçenek metninin içinde satır başına düşebiliyor.
 */
const NUMARA_DESENI = String.raw`(?:^|\n)\s*(\d{1,3})\s*(?:[.)]\s+|-(?:\s+|(?=[\p{L}"“]|\d{3})))`;
const NUMARA_ADAYI = new RegExp(NUMARA_DESENI, 'gu');

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
    const metin = kuyrukGurultusunuAt(bolumMetni.slice(govdeBas, govdeSonu)).replace(/\s+/g, ' ').trim();
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
  const sonraki = new RegExp(NUMARA_DESENI, 'u').exec(kalan);
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

  // Bir bölüm birden çok sütuna yayılmış olabilir: 2024 anahtarında patent
  // 1–30 | 31–60, marka 1–30 | 31–60 olmak üzere dört sütun var. Sütun sayısı
  // bölüm sayısının katıysa ardışık sütunlar aynı bölüme aittir.
  if (anahtar.sutunlar.length > bolumSirasi.length
      && bolumSirasi.length > 0
      && anahtar.sutunlar.length % bolumSirasi.length === 0) {
    const kat = anahtar.sutunlar.length / bolumSirasi.length;
    anahtar.sutunlar = bolumSirasi.map((_, b) => new Map(
      anahtar.sutunlar.slice(b * kat, b * kat + kat).flatMap((m) => [...m]),
    ));
  }

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

/* ─────────────────────────── bölüm kapsamı (marka / patent) ─────────────── */

/**
 * Genel Yeterlik kitapçıkları patent ve marka sorularını ayrı bölümlerde
 * taşıyor. Marka vekilliğine hazırlanan biri için patent bölümü tümüyle
 * kapsam dışı; bu yüzden içe aktarmadan önce hangi bölümün ne olduğunu
 * bilmemiz gerekiyor.
 *
 * Karar tek tek sorulara değil bölümün tamamına bakılarak veriliyor: tek bir
 * sorunun içinde "patent" kelimesinin geçmesi onu patent sorusu yapmaz, ama
 * kırk sorunun tamamında geçiyorsa bölüm patent bölümüdür. Ayrıca eşik mutlak
 * değil oransal — "ORTAK" gibi karma bölümler ikisine de yakın çıkar ve
 * elenmez.
 *
 * Bu, taksonomiye bağlı olmayan hafif bir ölçüm (src/lib/classify.ts'teki
 * ayrıntılı sınıflandırmadan bağımsız), çünkü terminal aracının da buna
 * ihtiyacı var.
 */
const PATENT_IZLERI = [
  'patent', 'buluş', 'faydalı model', 'istem', 'tarifname', 'buluş basamağı',
  'araştırma raporu', 'inceleme raporu', 'pct', 'epo', 'avrupa patenti',
  'ipc', 'rüçhan belgesi', 'tekniğin bilinen durumu', 'hizmet buluşu',
  'zorunlu lisans', '551 sayılı',
];

const MARKA_IZLERI = [
  'marka', 'coğrafi işaret', 'menşe adı', 'mahreç işareti', 'geleneksel ürün',
  'tasarım', 'nice', 'nis anlaşması', 'muvafakat', 'yayıma itiraz',
  'mutlak ret', 'nispi ret', 'madrid', 'tanınmış', '556 sayılı', '555 sayılı',
  'ayırt edici', 'sınıflandırma', 'tescilli marka',
];

function izSayisi(metin, izler) {
  const k = katla(metin);
  let toplam = 0;
  for (const iz of izler) {
    const desen = katla(iz);
    let konum = k.indexOf(desen);
    while (konum !== -1) { toplam += 1; konum = k.indexOf(desen, konum + desen.length); }
  }
  return toplam;
}

/**
 * Soruları bölümlerine göre gruplayıp her bölümün kapsamını belirler.
 * @param {{bolum?: string, kitapcikNo?: number, metin: string, secenekler: {metin:string}[]}[]} sorular
 * @returns {Map<string, 'patent'|'marka'|'karma'>} bölüm adı -> kapsam
 */
export function bolumKapsamlari(sorular) {
  const kumeler = new Map();
  for (const soru of sorular) {
    const ad = soru.bolum ?? (soru.kitapcikNo ? `${soru.kitapcikNo}. kitapçık` : 'tümü');
    if (!kumeler.has(ad)) kumeler.set(ad, []);
    kumeler.get(ad).push(soru);
  }

  const sonuc = new Map();
  for (const [ad, liste] of kumeler) {
    const metin = liste.map((s) => `${s.metin} ${s.secenekler.map((o) => o.metin).join(' ')}`).join(' \n ');
    const patent = izSayisi(metin, PATENT_IZLERI);
    const marka = izSayisi(metin, MARKA_IZLERI);
    // Belirgin baskınlık aranıyor: karma bölümler ("ORTAK") elenmesin.
    if (patent > marka * 2) sonuc.set(ad, 'patent');
    else if (marka > patent * 2) sonuc.set(ad, 'marka');
    else sonuc.set(ad, 'karma');
  }
  return sonuc;
}

/* ──────────────── çözümlü soru bankası (yayınevi kitapları) ─────────────── */

/**
 * Yayınevi soru bankalarının düzeni sınav kitapçıklarından farklı:
 *
 *   MARKA SORULARI
 *   1. Soru metni…
 *   A) … E) …
 *
 *   MARKA SORU CEVAPLARI
 *   1. Gerekçeli çözüm metni…
 *   CEVAP: D
 *
 * Cevap anahtarı "1- D" çiftleri yerine düzyazı içinde "CEVAP: X" işaretleri
 * hâlinde geliyor. Çift arayan ayrıştırıcı bu metinde felakete yol açar:
 * "SMK m. 4 düzenlemesi" ifadesi (4, D) çifti gibi görünür. Bu yüzden burada
 * çözümler CEVAP işaretlerine göre çıkarılıyor — sorularda seçenek kümelerine
 * göre yapılanın aynısı.
 *
 * Kazanç yalnızca cevap değil: her sorunun gerekçesi de metin olarak geliyor
 * ve uygulamadaki açıklama alanını dolduruyor.
 */

// Başlıklar kitaptan kitaba küçük farklar gösteriyor: "TASARIM CEVAPLARI" da
// oluyor "TASARIM CEVAPLAR" da. Sondaki ünlü isteğe bağlı.
const BOLUM_BASLIGI_COZUMLU =
  /^ *([a-zçğıöşü][a-zçğıöşü ]{3,60}?) +(sorulari?|soru cevaplari?|cevaplari?) *$/gm;
const CEVAP_ISARETI = /cevap *: *([a-e])(?![a-z])/g;

/** Bir cevap bölümünü {no -> {harf, aciklama}} haritasına çevirir. */
function cozumleriAyristir(bolumMetni) {
  const katli = katlaHizali(bolumMetni);
  CEVAP_ISARETI.lastIndex = 0;
  const isaretler = [];
  let e;
  while ((e = CEVAP_ISARETI.exec(katli)) !== null) {
    isaretler.push({
      harf: e[1].toLocaleUpperCase('tr'),
      bas: e.index,
      son: e.index + e[0].length,
    });
  }

  const adaylar = numaraAdaylari(bolumMetni);
  const sonuc = new Map();
  let sonNo = 0;

  for (let k = 0; k < isaretler.length; k++) {
    const isaret = isaretler[k];
    const pencereBas = k === 0 ? 0 : isaretler[k - 1].son;
    const penceredekiler = adaylar.filter((a) => a.bas >= pencereBas && a.bas < isaret.bas);

    // Gerekçe metninde "1. maddesinde" gibi ifadeler numara adayı gibi
    // görünebilir; süreklilik kuralı bunları eler.
    const aday = penceredekiler.find((a) => a.no === sonNo + 1)
      ?? penceredekiler.find((a) => a.no > sonNo && a.no <= sonNo + 6);

    const no = aday ? aday.no : sonNo + 1;
    sonNo = no;

    const aciklama = bolumMetni
      .slice(aday ? aday.govdeBas : pencereBas, isaret.bas)
      .replace(/\s+/g, ' ')
      .trim();

    if (!sonuc.has(no)) sonuc.set(no, { harf: isaret.harf, aciklama });
  }
  return sonuc;
}

/**
 * Çözümlü soru bankasını ayrıştırır. Soru ve cevap bölümleri aynı belgede ya
 * da ayrı dosyalarda olabilir; hepsi tek metin hâlinde verilebilir.
 *
 * @param {string} hamMetin
 * @returns {{sorular: object[], uyarilar: string[], rapor: object}}
 */
export function cozumluBankaAyristir(hamMetin) {
  const temiz = metniTemizle(hamMetin);
  const katli = katlaHizali(temiz);

  BOLUM_BASLIGI_COZUMLU.lastIndex = 0;
  const basliklar = [];
  let e;
  while ((e = BOLUM_BASLIGI_COZUMLU.exec(katli)) !== null) {
    // Eşleştirme katlanmış ad üzerinden (marka == MARKA), gösterim ise
    // özgün metinden: "COĞRAFİ İŞARET…" düzgün görünsün.
    //
    // Başlık kalıbı bölümden bölüme değişiyor: "ORTAK SORULAR" karşısında
    // "ORTAK SORULARIN CEVAPLARI" var. İkincisinde ad "ortak sorularin" gibi
    // okunuyor ve eşleşme kaçıyor; ada takılan bu ekler eşleştirmeden önce
    // atılıyor.
    const adBaslangici = e.index + e[0].indexOf(e[1]);
    basliklar.push({
      eslesmeAdi: e[1].trim().replace(/ +(sorularin|sorular|soru)$/, '').trim(),
      ad: temiz.slice(adBaslangici, adBaslangici + e[1].trim().length)
        .trim().replace(/ +(SORULARIN|SORULAR|SORU)$/i, '').trim(),
      tur: e[2].startsWith('sorular') ? 'soru' : 'cevap',
      govdeBas: e.index + e[0].length,
      bas: e.index,
    });
  }

  const uyarilar = [];
  if (basliklar.length === 0) {
    return { sorular: [], uyarilar: ['Belgede "… SORULARI" / "… CEVAPLARI" başlıkları bulunamadı.'], rapor: {} };
  }

  const bolumler = basliklar.map((b, i) => ({
    ...b,
    metin: temiz.slice(b.govdeBas, basliklar[i + 1]?.bas ?? temiz.length),
  }));

  // Aynı adı taşıyan soru ve cevap bölümlerini eşleştir.
  const sorular = [];
  for (const bolum of bolumler.filter((b) => b.tur === 'soru')) {
    const { sorular: cikan, uyarilar: uyari } = bolumdenSorular(bolum.metin);
    uyarilar.push(...uyari.map((u) => `${bolum.ad}: ${u}`));

    const cevapBolumu = bolumler.find((b) => b.tur === 'cevap' && b.eslesmeAdi === bolum.eslesmeAdi);
    const cozumler = cevapBolumu ? cozumleriAyristir(cevapBolumu.metin) : new Map();
    if (!cevapBolumu) uyarilar.push(`${bolum.ad}: cevap bölümü bulunamadı.`);

    for (const soru of cikan) {
      const cozum = cozumler.get(soru.no);
      const gecerli = cozum && soru.secenekler.some((o) => o.harf === cozum.harf);
      sorular.push({
        ...soru,
        yerelNo: soru.no,
        anahtarNo: soru.no,
        bolum: bolum.ad.toLocaleUpperCase('tr'),
        cevap: gecerli ? cozum.harf : '',
        aciklama: cozum?.aciklama || undefined,
      });
    }
  }

  sorular.forEach((s, i) => { s.sira = i + 1; });

  return {
    sorular,
    uyarilar,
    rapor: {
      toplam: sorular.length,
      cevapliEslesen: sorular.filter((s) => s.cevap).length,
      cevapsiz: sorular.filter((s) => !s.cevap).length,
      aciklamali: sorular.filter((s) => s.aciklama).length,
      secenekEksik: sorular.filter((s) => s.secenekler.length < 4).length,
      bolumler: [...new Set(sorular.map((s) => s.bolum))],
    },
  };
}
