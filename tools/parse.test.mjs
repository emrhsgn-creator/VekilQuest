/**
 * Ayrıştırıcı testleri: node --test tools/parse.test.mjs
 * Tarayıcıya ihtiyaç duymaz; kitapçık düzeni değiştiğinde ilk uyarı buradan gelir.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sorulariAyristir, cevapAnahtariAyristir, iptalEdilenler, birlestir, metniTemizle,
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

test('cevap anahtarı farklı biçimlerde okunur', () => {
  for (const ham of ['1-C  2-C  3-B', '1. C\n2. C\n3. B', '1) C 2) C 3) B', '1 C | 2 C | 3 B']) {
    const anahtar = cevapAnahtariAyristir(ham);
    assert.equal(anahtar.get(1), 'C', ham);
    assert.equal(anahtar.get(3), 'B', ham);
  }
});

test('iptal edilen sorular tespit edilir', () => {
  const iptaller = iptalEdilenler('1-C 2-İPTAL 3-B');
  assert.ok(iptaller.has(2));
  assert.ok(!iptaller.has(1));
});

test('birleştirme raporu tutarlıdır', () => {
  const { sorular } = sorulariAyristir(KITAPCIK);
  const { sorular: birlesik, rapor } = birlestir(sorular, cevapAnahtariAyristir('1-C 2-C 3-B'));
  assert.equal(rapor.toplam, 3);
  assert.equal(rapor.cevapliEslesen, 3);
  assert.equal(rapor.cevapsiz, 0);
  assert.equal(birlesik[2].cevap, 'B');
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
