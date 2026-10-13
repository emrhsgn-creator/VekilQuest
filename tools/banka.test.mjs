/**
 * Gömülü bankanın cihazdaki kopyayla eşitlenmesi (src/lib/bankaGuncelle.ts).
 * TypeScript olduğu için esbuild ile geçici bir ES modülüne derleniyor.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const gecici = path.join(tmpdir(), `vekilquest-banka-${Date.now()}.mjs`);
await build({ entryPoints: ['src/lib/bankaGuncelle.ts'], bundle: true, format: 'esm', outfile: gecici, logLevel: 'error' });
const { gomuluBankayiBirlestir } = await import(`file://${gecici}`);
test.after(() => rm(gecici, { force: true }));

const soru = (id, metin, ek = {}) => ({
  id, yil: 2024, no: Number(id.split('-').pop()), kaynak: 't', metin, cevap: 'A',
  secenekler: [{ harf: 'A', metin: 'a' }, { harf: 'B', metin: 'b' }], eklenme: 1, ...ek,
});
const bos = { cevaplamalar: [], tekrarKartlari: [], seanslar: [], devamEdenler: [] };

test('aynı kimlikli soru gömülü sürümle yenilenir, işaret ve elle konu korunur', () => {
  const eski = soru('tp-2024-A-marka-1', 'Eski metin sayfay Diğer sayfaya geçiniz.', {
    gomulu: true, etiketler: ['işaretli'], topicId: 'elle', topicGuven: 1,
  });
  const yeni = soru('tp-2024-A-marka-1', 'Eski metin', { gomulu: true, topicId: 'otomatik', topicGuven: 0.7, gorsel: 'veri/gorsel/x.webp' });
  const { sorular, ozet } = gomuluBankayiBirlestir({ ...bos, sorular: [eski] }, [yeni]);
  assert.equal(sorular.length, 1);
  assert.equal(sorular[0].metin, 'Eski metin');
  assert.equal(sorular[0].gorsel, 'veri/gorsel/x.webp');
  assert.deepEqual(sorular[0].etiketler, ['işaretli']);
  assert.equal(sorular[0].topicId, 'elle');
  assert.equal(ozet.guncellenen, 1);
});

test('kullanıcının kendi içe aktardığı kopya birleşir, çözüm geçmişi yeni kimliğe taşınır', () => {
  const kendi = soru('tp-2024-A-2kitapçık-7', 'Bir başvuru sahibi, TÜRKPATENT’e başvurmuştur. Diğer sayfaya geçiniz.');
  const gomulu = soru('tp-2024-A-marka-7', 'Bir başvuru sahibi, TÜRKPATENT’e başvurmuştur.', { gomulu: true });
  const durum = {
    sorular: [kendi],
    cevaplamalar: [{ id: 'c1', soruId: kendi.id, seansId: 's1', mod: 'calisma', secilen: 'A', dogru: true, sure: 1, zaman: 1 }],
    tekrarKartlari: [{ soruId: kendi.id, kolaylik: 2.5, aralik: 1, vade: 0, tekrarSayisi: 3, hataSayisi: 0, sonGorulme: 0 }],
    seanslar: [{ id: 's1', mod: 'calisma', baslik: 'x', soruIdleri: [kendi.id], baslangic: 0 }],
    devamEdenler: [{ seansId: 's2', mod: 'deneme', baslik: 'y', soruIdleri: [kendi.id], anindaGeriBildirim: false,
      indeks: 0, kayitlar: { [kendi.id]: { secilen: 'B', gosterildi: false, sure: 5 } }, baslangic: 0, guncelleme: 0 }],
  };
  const sonuc = gomuluBankayiBirlestir(durum, [gomulu]);
  assert.deepEqual(sonuc.sorular.map((s) => s.id), ['tp-2024-A-marka-7']);
  assert.equal(sonuc.cevaplamalar[0].soruId, 'tp-2024-A-marka-7');
  assert.equal(sonuc.tekrarKartlari[0].soruId, 'tp-2024-A-marka-7');
  assert.deepEqual(sonuc.seanslar[0].soruIdleri, ['tp-2024-A-marka-7']);
  assert.deepEqual(Object.keys(sonuc.devamEdenler[0].kayitlar), ['tp-2024-A-marka-7']);
  assert.equal(sonuc.ozet.birlesen, 1);
});

test('gömülü bankadan çıkarılan soru silinir, kullanıcının kendi sorusu kalır', () => {
  const kaldirilan = soru('tp-2024-A-marka-9', 'Artık yok', { gomulu: true });
  const kendi = soru('elle-1', 'Kendi sorum', { yil: undefined });
  const { sorular, ozet } = gomuluBankayiBirlestir({ ...bos, sorular: [kaldirilan, kendi] }, [soru('tp-2024-A-marka-1', 'Yeni', { gomulu: true })]);
  assert.deepEqual(sorular.map((s) => s.id).sort(), ['elle-1', 'tp-2024-A-marka-1']);
  assert.equal(ozet.silinen, 1);
  assert.equal(ozet.eklenen, 1);
});

test('farklı numaralı benzer sorular birbirine karışmaz', () => {
  const kendi = soru('x-5', 'Aynı gövde');
  const gomulu = soru('tp-2024-A-marka-6', 'Aynı gövde', { gomulu: true });
  const { sorular } = gomuluBankayiBirlestir({ ...bos, sorular: [kendi] }, [gomulu]);
  assert.equal(sorular.length, 2);
});
