/**
 * Ayrıştırıcı testleri: npm test
 *
 * Tarayıcıya ihtiyaç duymaz. Buradaki durumların çoğu gerçek TÜRKPATENT
 * kitapçıklarında karşılaşılan tuzaklardan çıkarıldı; kitapçık düzeni
 * değiştiğinde ilk uyarı buradan gelir.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sorulariAyristir, cevapAnahtariAyristir, iptalEdilenler, birlestir,
  metniTemizle, belgeyiAyristir, katla, beyanEdilenSoruSayisi, bolumKapsamlari,
  cozumluBankaAyristir,
} from '../src/lib/parse.mjs';

const KITAPCIK = `
MARKA VEKİLLİĞİ SINAVI SORU KİTAPÇIĞI (A)
T.C. KİMLİK NUMARASI
1

1. 6769 sayılı Sınai Mülkiyet Kanunu'nun 5 inci maddesi
uyarınca aşağıdakilerden hangisi mutlak ret nedeni
değildir?
A) Ayırt edici niteliğe sahip olmayan işaretler
B) Ticaret alanında herkes tarafından kullanılan
işaretler
C) Karıştırılma ihtimali bulunan işaretler
D) Dinî değerleri içeren işaretler
E) Kamu düzenine aykırı işaretler

Diğer sayfaya geçiniz.
2

2. Marka tescilinden doğan koruma süresi başvuru
tarihinden itibaren kaç yıldır?
A) 5 B) 7 C) 10 D) 15 E) 20

3. Yayıma itiraz süresi ne kadardır?
A) Bir ay
B) İki ay
C) Üç ay
D) Altı ay
E) Bir yıl
`;

test('Türkçe katlama büyük İ ve ı harflerini eşitler', () => {
  // JS'in regex `i` bayrağı İ (U+0130) ile i'yi eşleştirmediği için gerekli.
  assert.equal(katla('SORU KİTAPÇIĞI'), 'soru kitapcigi');
  assert.equal(katla('AÇIKLAMALAR'), 'aciklamalar');
});

test('sayfa başlığı ve altlığı temizlenir', () => {
  const temiz = metniTemizle(KITAPCIK);
  assert.ok(!temiz.includes('SORU KİTAPÇIĞI'));
  assert.ok(!temiz.includes('Diğer sayfaya geçiniz'));
});

test('numaralı sorular ve seçenekler ayrıştırılır', () => {
  const { sorular, uyarilar } = sorulariAyristir(KITAPCIK);
  assert.equal(sorular.length, 3);
  assert.deepEqual(uyarilar, []);
  assert.equal(sorular[0].no, 1);
  assert.equal(sorular[0].secenekler.length, 5);
  assert.ok(sorular[0].metin.startsWith('6769 sayılı'));
});

test('satır ortasında bölünmüş seçenek metni birleştirilir', () => {
  const { sorular } = sorulariAyristir(KITAPCIK);
  assert.equal(sorular[0].secenekler[1].metin, 'Ticaret alanında herkes tarafından kullanılan işaretler');
});

test('tek satırda dizilmiş seçenekler ayrıştırılır', () => {
  const { sorular } = sorulariAyristir(KITAPCIK);
  assert.deepEqual(sorular[1].secenekler.map((o) => o.metin), ['5', '7', '10', '15', '20']);
});

test('sayfa başlığındaki "(A)" seçenek sanılmaz', () => {
  // Gerçek kitapçıklarda "… SORU KİTAPÇIĞI (A)" satırı her sayfanın üstünde
  // basılı; bu (A) seçenek işareti sayılırsa sonraki sorunun gövdesi yutuluyor.
  const metin = `
1. İlk soru nedir?
A) Bir B) İki C) Üç D) Dört E) Beş
PATENT VE MARKA VEKİLLİĞİ GENEL YETERLİK SINAVI 1. SORU KİTAPÇIĞI (A)
2. İkinci soru nedir?
A) Altı B) Yedi C) Sekiz D) Dokuz E) On
`;
  const { sorular } = sorulariAyristir(metin);
  assert.equal(sorular.length, 2);
  assert.equal(sorular[1].metin, 'İkinci soru nedir?');
  assert.equal(sorular[1].secenekler[0].metin, 'Altı');
});

test('soru gövdesindeki alt maddeler yeni soru sayılmaz', () => {
  // "1. Keşifler / 2. Hayvan yetiştirme usulleri" gibi listeler soru
  // numarasıyla aynı biçimde ama gövdenin parçası.
  const metin = `
7- 1. Keşifler
2. Hayvan yetiştirme usulleri
3. Tedavi usulleri
Yukarıdakilerden hangisi buluş niteliğinde değildir?
A) Yalnız 1 B) Yalnız 2 C) 1 ve 2 D) 1 ve 3 E) 2 ve 3
8- İkinci soru nedir?
A) Bir B) İki C) Üç D) Dört E) Beş
`;
  const { sorular } = sorulariAyristir(metin);
  assert.equal(sorular.length, 2);
  assert.deepEqual(sorular.map((s) => s.no), [7, 8]);
});

test('numarasız seçenek bloğu numaralandırmayı kaydırmaz', () => {
  // Gövdesi görsel olan sorularda yalnızca seçenekler metne düşüyor. Bunlar
  // soru sayılırsa sonraki bütün cevaplar bir kayar.
  const metin = `
10. Onuncu soru nedir?
A) Bir B) İki C) Üç D) Dört E) Beş
A) EPO B) TÜRKPATENT C) WIPO D) EUIPO E) Hiçbiri
11. On birinci soru nedir?
A) Alt B) Üst C) Yan D) Ön E) Arka
`;
  const { sorular, uyarilar } = sorulariAyristir(metin);
  assert.deepEqual(sorular.map((s) => s.no), [10, 11]);
  assert.ok(uyarilar.some((u) => u.includes('numarasız seçenek bloğu')));
});

test('kapaktaki AÇIKLAMALAR maddeleri soru sayılmaz', () => {
  const metin = `
AÇIKLAMALAR
1. Soru kitapçığının sayfalarının eksik olup olmadığını kontrol ediniz.
2. Cevap kağıdında doldurmanız gereken alanlar bulunmaktadır.
4. Bu kitapçıkta 2 soru bulunmaktadır. Toplam cevaplama süresi 90 dakikadır.
KISALTMALAR
6769 sayılı SMK : 6769 sayılı Sınai Mülkiyet Kanunu
1. Gerçek ilk soru nedir?
A) Bir B) İki C) Üç D) Dört E) Beş
2. Gerçek ikinci soru nedir?
A) Altı B) Yedi C) Sekiz D) Dokuz E) On
`;
  const { sorular } = sorulariAyristir(metin);
  assert.equal(sorular.length, 2);
  assert.equal(sorular[0].metin, 'Gerçek ilk soru nedir?');
  assert.equal(beyanEdilenSoruSayisi(metin), 2);
});

test('cevap anahtarı farklı biçimlerde okunur', () => {
  for (const ham of ['1-C  2-C  3-B', '1. C\n2. C\n3. B', '1) C 2) C 3) B', '1 C | 2 C | 3 B']) {
    const anahtar = cevapAnahtariAyristir(ham);
    assert.equal(anahtar.tekil.get(1), 'C', ham);
    assert.equal(anahtar.tekil.get(3), 'B', ham);
  }
});

test('çok sütunlu ama sürekli numaralı anahtar tek haritada birleşir', () => {
  const anahtar = cevapAnahtariAyristir('1- D 21- C 41- B\n2- B 22- B 42- A');
  assert.equal(anahtar.tekil.get(21), 'C');
  assert.equal(anahtar.tekil.get(42), 'A');
  assert.equal(anahtar.sutunlar.length, 0);
});

test('bölüm başına numaralanan paralel sütunlar ayrılır', () => {
  // 2015 kitapçığı: PATENT / MARKA / ORTAK için üç paralel sütun, her biri
  // 1'den başlıyor. Tek haritaya sıkıştırılırsa iki bölümün cevabı kaybolur.
  const anahtar = cevapAnahtariAyristir('1 C 1 A 1 E\n2 A 2 B 2 D');
  assert.equal(anahtar.sutunlar.length, 3);
  assert.equal(anahtar.sutunlar[0].get(1), 'C');
  assert.equal(anahtar.sutunlar[1].get(1), 'A');
  assert.equal(anahtar.sutunlar[2].get(2), 'D');
});

test('iptal edilen sorular tespit edilir', () => {
  const iptaller = iptalEdilenler('1-C 2-İPTAL 3-B');
  assert.ok(iptaller.has(2));
  assert.ok(!iptaller.has(1));
});

test('belgeyiAyristir kitapçık içindeki anahtarı bulup eşler', () => {
  const belge = `${KITAPCIK}
MARKA VEKİLLİĞİ SINAVI CEVAP ANAHTARI (A)
1- C 2- C 3- B
`;
  const { sorular, rapor } = belgeyiAyristir(belge);
  assert.equal(rapor.toplam, 3);
  assert.equal(rapor.cevapliEslesen, 3);
  assert.equal(sorular[0].cevap, 'C');
  assert.equal(sorular[2].cevap, 'B');
});

test('ikinci kitapçık numaralandırmaya devam ediyorsa kaydırma uygulanmaz', () => {
  const belge = `
AÇIKLAMALAR
KISALTMALAR
1. Birinci kitapçığın sorusu nedir?
A) Bir B) İki C) Üç D) Dört E) Beş
AÇIKLAMALAR
KISALTMALAR
61. İkinci kitapçığın sorusu nedir?
A) Altı B) Yedi C) Sekiz D) Dokuz E) On
CEVAP ANAHTARI
1- A 61- D
`;
  const { sorular } = belgeyiAyristir(belge);
  assert.equal(sorular.length, 2);
  assert.equal(sorular[1].anahtarNo, 61);
  assert.equal(sorular[1].cevap, 'D');
});

test('ikinci kitapçık 1\'den başlıyorsa anahtar numarası kaydırılır', () => {
  const belge = `
AÇIKLAMALAR
KISALTMALAR
1. Birinci kitapçığın birinci sorusu nedir?
A) Bir B) İki C) Üç D) Dört E) Beş
2. Birinci kitapçığın ikinci sorusu nedir?
A) Bir B) İki C) Üç D) Dört E) Beş
AÇIKLAMALAR
KISALTMALAR
1. İkinci kitapçığın sorusu nedir?
A) Altı B) Yedi C) Sekiz D) Dokuz E) On
CEVAP ANAHTARI
1- A 2- B 3- E
`;
  const { sorular } = belgeyiAyristir(belge);
  assert.equal(sorular.length, 3);
  assert.equal(sorular[2].yerelNo, 1);
  assert.equal(sorular[2].anahtarNo, 3);
  assert.equal(sorular[2].cevap, 'E');
});

test('seçeneklerde bulunmayan cevap harfi yok sayılır', () => {
  const { sorular } = sorulariAyristir(KITAPCIK);
  const { sorular: birlesik } = birlestir(sorular, new Map([[1, 'Z']]));
  assert.equal(birlesik[0].cevap, '');
});

test('boş metin çöküşe yol açmaz', () => {
  const { sorular, uyarilar } = sorulariAyristir('');
  assert.equal(sorular.length, 0);
  assert.equal(uyarilar.length, 1);
});

test('bölüm kapsamı patent ve marka bölümlerini ayırır', () => {
  const soru = (bolum, metin) => ({ bolum, metin, secenekler: [{ metin: '' }] });
  const kapsam = bolumKapsamlari([
    soru('1. kitapçık', 'Patent başvurusunun tarifname ve istemleri buluş bütünlüğü taşımalıdır.'),
    soru('1. kitapçık', 'Faydalı model başvurusunda araştırma raporu talebi ve buluş basamağı.'),
    soru('1. kitapçık', 'PCT ulusal aşamaya giriş ve EPO nezdindeki patent işlemleri.'),
    soru('2. kitapçık', 'Marka tescilinde mutlak ret nedenleri ve ayırt edici nitelik.'),
    soru('2. kitapçık', 'Coğrafi işaret başvurusunda menşe adı ile mahreç işareti ayrımı.'),
    soru('2. kitapçık', 'Madrid Protokolü kapsamında uluslararası marka tescili.'),
  ]);
  assert.equal(kapsam.get('1. kitapçık'), 'patent');
  assert.equal(kapsam.get('2. kitapçık'), 'marka');
});

test('karma bölüm patent sayılıp elenmez', () => {
  // 2015 kitapçığının "ORTAK" bölümü her iki alandan da soru taşır; marka
  // adayının kapsamındadır, bu yüzden "patent" etiketi almamalı.
  const kapsam = bolumKapsamlari([
    { bolum: 'ORTAK', metin: 'Marka hakkına tecavüz halinde patent ve marka vekilinin sorumluluğu.', secenekler: [{ metin: '' }] },
    { bolum: 'ORTAK', metin: 'Sınai mülkiyet hakkında lisans sözleşmesi; marka ve patent için ortak hükümler.', secenekler: [{ metin: '' }] },
  ]);
  assert.notEqual(kapsam.get('ORTAK'), 'patent');
});

/* ───────────── çözümlü soru bankası (yayınevi kitapları) ───────────── */

const COZUMLU = `
MARKA VE PATENT VEKİLLİĞİ SINAVI
TAMAMI ÇÖZÜMLÜ SORU BANKASI
MARKA SORULARI
1. Türkiye'de marka başvuruları hangi kuruma yapılır?
A) Ticaret Bakanlığı
B) Türk Patent ve Marka Kurumu
C) Sanayi Bakanlığı
D) Adalet Bakanlığı
E) Dışişleri Bakanlığı
2. Marka koruma süresi kaç yıldır?
A) 5
B) 7
C) 10
D) 15
E) 20

COĞRAFİ İŞARET SORULARI
1. Menşe adında üretimin kaç aşaması belirlenen alanda gerçekleşir?
A) Yalnız biri
B) En az ikisi
C) Tamamı
D) Yarısı
E) Hiçbiri

MARKA SORU CEVAPLARI
1. Türkiye'de marka başvuruları Türk Patent ve Marka Kurumuna yapılır.
Bu kapsamda sorunun doğru cevabı (b) şıkkı olacaktır.
CEVAP: B
2. SMK m. 23 uyarınca koruma süresi başvuru tarihinden itibaren on yıldır.
CEVAP: C

COĞRAFİ İŞARET CEVAPLARI
1. SMK m. 34 uyarınca menşe adında tüm üretim aşamaları belirlenmiş coğrafi
alan sınırları içinde gerçekleşir.
CEVAP: C
`;

test('çözümlü banka: soru ve cevap bölümleri adlarına göre eşleşir', () => {
  const { sorular, rapor } = cozumluBankaAyristir(COZUMLU);
  assert.equal(rapor.toplam, 3);
  assert.equal(rapor.cevapliEslesen, 3);
  assert.deepEqual(rapor.bolumler, ['MARKA', 'COĞRAFİ İŞARET']);
  assert.equal(sorular[0].cevap, 'B');
  assert.equal(sorular[1].cevap, 'C');
  assert.equal(sorular[2].bolum, 'COĞRAFİ İŞARET');
  assert.equal(sorular[2].cevap, 'C');
});

test('çözümlü banka: gerekçe açıklama olarak alınır', () => {
  const { sorular, rapor } = cozumluBankaAyristir(COZUMLU);
  assert.equal(rapor.aciklamali, 3);
  assert.match(sorular[0].aciklama, /Türk Patent ve Marka Kurumuna yapılır/);
  assert.ok(!sorular[0].aciklama.includes('CEVAP'));
});

test('çözümlü banka: gerekçe içindeki madde numaraları soru sayılmaz', () => {
  // "SMK m. 23 uyarınca" ifadesi çift arayan bir ayrıştırıcıda (23, U) gibi
  // görünür; numaralandırma süreklilikle korunuyor.
  const { sorular } = cozumluBankaAyristir(COZUMLU);
  assert.deepEqual(sorular.filter((s) => s.bolum === 'MARKA').map((s) => s.yerelNo), [1, 2]);
});

test('çözümlü banka: bölüm adı özgün yazımıyla korunur', () => {
  const { sorular } = cozumluBankaAyristir(COZUMLU);
  // Eşleştirme katlanmış adla yapılır ama gösterim özgün metinden gelir.
  assert.equal(sorular[2].bolum, 'COĞRAFİ İŞARET');
});

test('çözümlü banka: "CEVAPLAR" başlığı da tanınır', () => {
  // Bazı bölümlerde başlık "TASARIM CEVAPLARI" değil "TASARIM CEVAPLAR";
  // sondaki ünlü isteğe bağlı olmalı, yoksa cevap bölümü hiç eşleşmiyor.
  const metin = `
TASARIM SORULARI
1. Tescilli tasarımın koruma süresi kaç yıldır?
A) 3
B) 5
C) 10
D) 15
E) 25

TASARIM CEVAPLAR
1. SMK m. 69 uyarınca tescilli tasarımın koruma süresi beş yıldır.
CEVAP: B
`;
  const { sorular, rapor } = cozumluBankaAyristir(metin);
  assert.equal(rapor.toplam, 1);
  assert.equal(rapor.cevapliEslesen, 1);
  assert.equal(sorular[0].cevap, 'B');
  assert.equal(sorular[0].bolum, 'TASARIM');
});
