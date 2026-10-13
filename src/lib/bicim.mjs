/**
 * Soru metinlerinin okunur biçime getirilmesi.
 *
 * PDF'ten çıkan metin tek bir paragrafa dökülüyor; kitapçıkta alt alta basılı
 * öncüller ("1. … 2. … 3. …", "I. … II. …", "a) … b) …") düz yazıya karışıyor
 * ve soru anlaşılmaz hâle geliyor. Buradaki işlevler satır yapısını geri
 * kuruyor ve sayfa artıklarını ayıklıyor.
 *
 * Hem derleme aracı (tools/soru-bankasi-uret.mjs) hem de uygulama (cihazda
 * kayıtlı eski sorular açılışta düzeltilsin diye) kullanıyor. İşlevler
 * idempotent: zaten biçimlenmiş metne tekrar uygulamak bir şey değiştirmez.
 */

import { katlaHizali } from './parse.mjs';

/* ──────────────────────────────────────────────────────── sayfa artıkları */

// Katlanmış (küçük harf, Türkçe karakterler sadeleşmiş) metne uygulanır.
// Katlama uzunluğu koruduğu için bulunan aralıklar özgün metinde de geçerli.
const SATIR_ICI_GURULTU = [
  // pdfjs altlığı parçalara bölebiliyor: "sayfay Diğer sayfaya geçiniz. a geçiniz."
  /\s*(?:sayfay\s+)?(?:diger|arka|sonraki) sayfaya geciniz\.?(?:\s+a geciniz\.?)?/g,
  /\s*(?:patent|marka|ortak|tasarim) sorular(?:in)?a geciniz\.?/g,
  /\s*test(?:iniz)? bitti\.?(?:\s+cevaplarinizi kontrol ediniz\.?)?/g,
  /\s*sinavda uyulmasi gereken kurallar\s*$/g,
];

export function gurultuyuAyikla(metin) {
  if (!metin) return metin;
  let sonuc = metin;
  for (const desen of SATIR_ICI_GURULTU) {
    const katli = katlaHizali(sonuc);
    const araliklar = [];
    desen.lastIndex = 0;
    let e;
    while ((e = desen.exec(katli)) !== null) {
      if (e[0].length === 0) { desen.lastIndex += 1; continue; }
      araliklar.push([e.index, e.index + e[0].length]);
    }
    for (const [bas, son] of araliklar.reverse()) sonuc = sonuc.slice(0, bas) + sonuc.slice(son);
  }
  return sonuc.trim();
}

/* ──────────────────────────────────────────────────────────── öncüller */

const ROMA = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const HARFLER = ['a', 'b', 'c', 'ç', 'd', 'e', 'f', 'g', 'ğ', 'h'];

/**
 * Üç ayrı öncül türü. Her biri için madde işaretinin önünde satır başı,
 * boşluk ya da iki nokta olmalı; ardından boşluk ve bir içerik gelmeli.
 * "10.01.2009" gibi tarihler ve "5/1(a)" gibi atıflar böylece dışarıda kalıyor.
 */
const TURLER = [
  {
    ad: 'sayi',
    desen: /(^|[\s:;])(\d{1,2})[.)]\s+(?=\S)/g,
    deger: (e) => Number(e[2]),
    sira: (i) => i + 1,
  },
  {
    ad: 'roma',
    desen: /(^|[\s:;])(I{1,3}|IV|V|VI{1,3}|IX|X)[.)-]\s+(?=\S)/g,
    deger: (e) => ROMA.indexOf(e[2]) + 1,
    sira: (i) => i + 1,
  },
  {
    ad: 'harf',
    desen: /(^|[\s:;])([a-hçğ])\)\s+(?=\S)/g,
    deger: (e) => HARFLER.indexOf(e[2]) + 1,
    sira: (i) => i + 1,
  },
];

/**
 * Metindeki en uzun "1, 2, 3, …" zincirini bulur. Zincir 1'den başlamalı ve
 * her madde bir öncekinden sonra gelmeli. "SMK'nin 5. maddesinin 1. fıkrası"
 * gibi düz yazıdaki sayılar ya zincir kurmaz ya da kısa kalır.
 */
function zincirBul(metin, tur) {
  tur.desen.lastIndex = 0;
  const adaylar = [];
  let e;
  while ((e = tur.desen.exec(metin)) !== null) {
    adaylar.push({ deger: tur.deger(e), konum: e.index + e[1].length, govde: e.index + e[0].length });
    tur.desen.lastIndex = e.index + e[0].length;
  }
  let enIyi = [];
  for (let i = 0; i < adaylar.length; i++) {
    if (adaylar[i].deger !== 1) continue;
    const zincir = [adaylar[i]];
    for (let j = i + 1; j < adaylar.length; j++) {
      if (adaylar[j].deger === zincir.length + 1) zincir.push(adaylar[j]);
    }
    if (zincir.length > enIyi.length) enIyi = zincir;
  }
  return enIyi;
}

/** Zincirin gerçekten bir öncül listesi olduğuna yeterince emin miyiz? */
function guvenilirMi(metin, zincir, tur) {
  if (zincir.length >= 3) return true;
  if (zincir.length < 2) return false;
  if (tur.ad !== 'sayi') return true;
  // İki maddelik sayı listesi ancak bir giriş cümlesinden sonra gelirse.
  const once = metin.slice(0, zincir[0].konum).trimEnd();
  return /[:?]$/.test(once) || /\n$/.test(metin.slice(0, zincir[0].konum));
}

// Son maddeden sonra gelen soru cümlesinin başı. Kitapçıkta bu cümle listenin
// altında ayrı satırda basılı; düz metinde ise son maddenin arkasına yapışıyor.
// Sırasıyla: bilinen giriş ifadeleri ("Buna göre", "Yukarıda verilen"…),
// nokta sonrası yeni cümle ("…ödenmemiştir. 6769 sayılı SMK…") ve listeyi
// soruya bağlayan küçük harfli devam ("… reddeder. kararlarından hangisini verir?").
const SORU_CUMLESI = [
  /\s(?=(?:Buna göre|Bu bilgilere göre|Bu açıklamalara göre|Verilen bilgilere göre|Yukarıdaki bilgilere göre|Yukarıda(?:ki)? (?:yer alan|verilen|belirtilen|sayılan)|Yukarıdakilerden|Bu durumda|Söz konusu (?:ifadelerden|bilgilere)|Bu (?:işaret|ilke|tespit|görüş|ifade|bilgi|gerekçe|husus)\p{L}*)[\s,])/u,
  // "SMK m. 6/5" gibi kısaltmalar cümle sonu sayılmasın: noktadan önce en az üç harf.
  /(?<=\p{L}{3})[.!]\s(?=[\p{Lu}\d])/u,
  /\s(?=\p{Ll}\S*(?:ndan|nden|dan|den|tan|ten) hangi)/u,
];

function soruCumlesiBaslangici(madde) {
  let enErken = -1;
  for (const desen of SORU_CUMLESI) {
    const e = desen.exec(madde);
    if (!e) continue;
    const konum = e.index + e[0].length;
    if (enErken === -1 || konum < enErken) enErken = konum;
  }
  return enErken;
}

/**
 * Öncülleri ayrı satırlara alır. Liste sonrasındaki soru cümlesi de ayrı
 * paragrafa iner:
 *
 *   "… aşağıda verilmiştir: 1. Marka örneği 2. Mal listesi Buna göre …?"
 *   →
 *   "… aşağıda verilmiştir:\n1. Marka örneği\n2. Mal listesi\n\nBuna göre …?"
 */
export function oncululeriAyir(metin) {
  if (!metin) return metin;
  let sonuc = metin;
  for (const tur of TURLER) {
    const zincir = zincirBul(sonuc, tur);
    if (!guvenilirMi(sonuc, zincir, tur)) continue;

    // Son maddenin içinde soru cümlesi başlıyorsa onu da ayır.
    // Madde işaretinden sonrasına, ilk satır sonuna kadar bak: metin zaten
    // biçimliyse soru cümlesi ayrı paragrafta durur.
    const sonMadde = zincir[zincir.length - 1].govde;
    const sonMaddeMetni = sonuc.slice(sonMadde).split('\n')[0];
    const kuyruk = soruCumlesiBaslangici(sonMaddeMetni);
    let kesimler = zincir.map((m) => ({ konum: m.konum, ayrac: '\n' }));
    if (kuyruk > 0) kesimler.push({ konum: sonMadde + kuyruk, ayrac: '\n\n' });
    kesimler = kesimler.sort((a, b) => b.konum - a.konum);

    for (const { konum, ayrac } of kesimler) {
      const once = sonuc.slice(0, konum).replace(/[ \t]+$/, '');
      const sonra = sonuc.slice(konum);
      // Zaten satır başındaysa dokunma (idempotent).
      if (once === '' || once.endsWith(ayrac)) continue;
      sonuc = once.replace(/\n+$/, '') + ayrac + sonra;
    }
  }
  return sonuc;
}

/**
 * Bir soru kaydını görüntülemeye hazırlar: artıkları ayıklar, öncülleri
 * satırlara böler. Seçenekler yalnızca ayıklanır.
 * @template {{metin: string, secenekler: {harf: string, metin: string}[]}} T
 * @param {T} soru
 * @returns {T}
 */
export function soruyuBicimle(soru) {
  const metin = oncululeriAyir(gurultuyuAyikla(soru.metin));
  let degisti = metin !== soru.metin;
  const secenekler = soru.secenekler.map((o) => {
    const temiz = gurultuyuAyikla(o.metin);
    if (temiz === o.metin) return o;
    degisti = true;
    return { ...o, metin: temiz };
  });
  return degisti ? { ...soru, metin, secenekler } : soru;
}

/**
 * Görüntüleme için metni satırlara ayırır ve öncül satırlarını işaretler.
 * @returns {{tur: 'paragraf'|'oncul'|'bosluk', isaret?: string, metin: string}[]}
 */
export function satirlaraAyir(metin) {
  const cikti = [];
  for (const satir of (metin ?? '').split('\n')) {
    const t = satir.trim();
    if (!t) { cikti.push({ tur: 'bosluk', metin: '' }); continue; }
    const e = /^((?:\d{1,2}|I{1,3}|IV|VI{0,3}|IX|X)[.)-]|[a-hçğ]\))\s+(.*)$/.exec(t);
    if (e) cikti.push({ tur: 'oncul', isaret: e[1], metin: e[2] });
    else cikti.push({ tur: 'paragraf', metin: t });
  }
  return cikti;
}
