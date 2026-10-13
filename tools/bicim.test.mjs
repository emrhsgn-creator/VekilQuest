import test from 'node:test';
import assert from 'node:assert/strict';
import { gurultuyuAyikla, oncululeriAyir, satirlaraAyir, soruyuBicimle } from '../src/lib/bicim.mjs';

test('sayfa altlığı parçaları seçenekten ayıklanır', () => {
  assert.equal(gurultuyuAyikla('2, 3 ve 4 sayfay Diğer sayfaya geçiniz. a geçiniz.'), '2, 3 ve 4');
  assert.equal(gurultuyuAyikla('31.10.2014 arasında yapılabilir. Ortak Sorulara Geçiniz'), '31.10.2014 arasında yapılabilir.');
  assert.equal(gurultuyuAyikla('kazanırlar. TESTİNİZ BİTTİ. CEVAPLARINIZI KONTROL EDİNİZ.'), 'kazanırlar.');
  assert.equal(gurultuyuAyikla('Arka sayfaya geçiniz'), '');
});

test('numaralı öncüller satırlara bölünür, soru cümlesi ayrı paragraf olur', () => {
  const ham = 'Bazı belgeler aşağıda verilmiştir: 1. Marka örneği 2. Mal listesi 3. Ücret bilgisi Buna göre hangisi zorunludur?';
  assert.equal(oncululeriAyir(ham),
    'Bazı belgeler aşağıda verilmiştir:\n1. Marka örneği\n2. Mal listesi\n3. Ücret bilgisi\n\nBuna göre hangisi zorunludur?');
});

test('liste sonundaki küçük harfli devam cümlesi ayrılır', () => {
  const ham = 'Kurum; 1. yayımlar. 2. reddeder. 3. bildirir. kararlarından hangisini verir?';
  assert.equal(oncululeriAyir(ham), 'Kurum;\n1. yayımlar.\n2. reddeder.\n3. bildirir.\n\nkararlarından hangisini verir?');
});

test('düz yazıdaki sayılar, tarihler ve kısaltmalar öncül sanılmaz', () => {
  const metinler = [
    'A firması 10.01.2009 tarihinde 25. ve 35. sınıflar için başvurmuştur.',
    'SMK’nin 5. maddesinin 1. fıkrası ile 2. fıkrası birlikte değerlendirilir.',
    'Başvuru 5/1(a) ve 5/1(b) bentleri gereğince reddedilmiştir.',
  ];
  for (const m of metinler) assert.equal(oncululeriAyir(m), m);
});

test('“SMK m. 6/5” kısaltması cümle sonu sayılmaz', () => {
  const ham = 'İtiraz gerekçeleri: 1. Eskiye dayalı kullanım (SMK m. 6/3) 2. Tanınmışlık (SMK m. 6/5) gerekçelerinden hangisi geçerlidir?';
  const sonuc = oncululeriAyir(ham);
  assert.ok(sonuc.includes('(SMK m. 6/5)'));
  assert.ok(sonuc.includes('\n2. Tanınmışlık'));
});

test('Romen rakamlı ve harfli öncüller', () => {
  assert.equal(oncululeriAyir('Hangileri doğrudur? I. Devir II. Lisans III. Rehin'),
    'Hangileri doğrudur?\nI. Devir\nII. Lisans\nIII. Rehin');
  assert.equal(oncululeriAyir('Şunlardan: a) görsel b) işitsel c) kavramsal'),
    'Şunlardan:\na) görsel\nb) işitsel\nc) kavramsal');
});

test('biçimleme idempotent; değişiklik yoksa aynı nesne döner', () => {
  const soru = { metin: 'Liste: 1. Bir 2. İki 3. Üç Buna göre?', secenekler: [{ harf: 'A', metin: 'x' }] };
  const bir = soruyuBicimle(soru);
  assert.notEqual(bir, soru);
  assert.equal(soruyuBicimle(bir), bir);
  const duz = { metin: 'Düz soru?', secenekler: [{ harf: 'A', metin: 'x' }] };
  assert.equal(soruyuBicimle(duz), duz);
});

test('satirlaraAyir öncül satırlarını işaretler', () => {
  assert.deepEqual(satirlaraAyir('Giriş:\n1. Bir\n\nSoru?'), [
    { tur: 'paragraf', metin: 'Giriş:' },
    { tur: 'oncul', isaret: '1.', metin: 'Bir' },
    { tur: 'bosluk', metin: '' },
    { tur: 'paragraf', metin: 'Soru?' },
  ]);
});
