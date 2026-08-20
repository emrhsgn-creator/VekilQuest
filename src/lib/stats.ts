/**
 * Performans analizi: konu bazlı hâkimiyet, sınav ağırlığı ve öncelik hesabı.
 *
 * Amaç yalnızca "kaç doğru yaptım" değil, "hangi konuya çalışmalıyım" sorusunu
 * cevaplamak. Bunun için üç büyüklük ayrı ayrı hesaplanıp birleştiriliyor:
 *
 *   hakimiyet    : Konuyu ne kadar bildiğin (0-1). Yakın tarihli cevaplamalar
 *                  daha ağır sayılır; az veri varsa tahmin %50'ye çekilir.
 *   sinavAgirligi: Konunun sınavda çıkma yoğunluğu (0-1). Taksonomideki statik
 *                  tahmin ile yüklediğin gerçek soru bankasındaki dağılımın
 *                  karışımı.
 *   oncelik      : sinavAgirligi x eksiklik. "Çok çıkıyor ama bilmiyorum"
 *                  konuları en üste taşır.
 */

import type { Cevaplama, Soru } from '../types';
import { AREAS, TOPICS, TOPIC_BY_ID } from '../data/topics';

const GUN = 86_400_000;
/** Cevaplamaların yarı ömrü: 45 gün öncesi yarı ağırlıkta sayılır. */
const YARI_OMUR_GUN = 45;

export type KonuIstatistigi = {
  topicId: string;
  ad: string;
  areaId: string;
  bankaSoruSayisi: number;
  cozulen: number;
  dogru: number;
  yanlis: number;
  bos: number;
  dogrulukOrani: number;
  hakimiyet: number;
  veriGucu: number;
  sinavAgirligi: number;
  oncelik: number;
  ortalamaSure: number;
  sonCalisma: number;
};

export type GenelIstatistik = {
  bankaToplam: number;
  cevaplananBenzersiz: number;
  toplamCevaplama: number;
  dogru: number;
  yanlis: number;
  bos: number;
  dogrulukOrani: number;
  ortalamaSure: number;
  serisi: number;
  bugunCozulen: number;
};

function agirlik(zaman: number, simdi: number): number {
  const gunFarki = Math.max(0, (simdi - zaman) / GUN);
  return Math.pow(0.5, gunFarki / YARI_OMUR_GUN);
}

export function konuIstatistikleri(
  sorular: Soru[],
  cevaplamalar: Cevaplama[],
  simdi = Date.now(),
): KonuIstatistigi[] {
  const soruTopic = new Map(sorular.map((s) => [s.id, s.topicId]));

  const bankaSayim = new Map<string, number>();
  for (const soru of sorular) {
    if (soru.iptal) continue;
    const id = soru.topicId ?? '_yok';
    bankaSayim.set(id, (bankaSayim.get(id) ?? 0) + 1);
  }
  const bankaToplam = [...bankaSayim.values()].reduce((a, b) => a + b, 0) || 1;

  type Toplam = {
    cozulen: number; dogru: number; yanlis: number; bos: number;
    aDogru: number; aToplam: number; sure: number; son: number;
  };
  const toplamlar = new Map<string, Toplam>();
  const al = (id: string): Toplam => {
    let t = toplamlar.get(id);
    if (!t) {
      t = { cozulen: 0, dogru: 0, yanlis: 0, bos: 0, aDogru: 0, aToplam: 0, sure: 0, son: 0 };
      toplamlar.set(id, t);
    }
    return t;
  };

  for (const c of cevaplamalar) {
    const topicId = soruTopic.get(c.soruId);
    if (!topicId) continue;
    const t = al(topicId);
    const w = agirlik(c.zaman, simdi);
    t.cozulen += 1;
    t.sure += c.sure;
    t.son = Math.max(t.son, c.zaman);
    t.aToplam += w;
    if (c.secilen === null) t.bos += 1;
    else if (c.dogru) { t.dogru += 1; t.aDogru += w; }
    else t.yanlis += 1;
  }

  // Statik ağırlığı 0-1 aralığına indir.
  const statikToplam = TOPICS.reduce((a, t) => a + t.agirlik, 0);

  const ham = TOPICS.map((konu) => {
    const t = toplamlar.get(konu.id) ?? { cozulen: 0, dogru: 0, yanlis: 0, bos: 0, aDogru: 0, aToplam: 0, sure: 0, son: 0 };
    const banka = bankaSayim.get(konu.id) ?? 0;

    // Bayes düzeltmesi: Beta(2,2) öncülü ile az veride %50'ye çekilir.
    const hakimiyet = (t.aDogru + 2) / (t.aToplam + 4);
    const veriGucu = Math.min(1, t.aToplam / 10);

    const statikPay = konu.agirlik / statikToplam;
    const gozlenenPay = banka / bankaToplam;
    // Banka doldukça gözlenen dağılıma güven artar.
    const gozlemGucu = Math.min(1, bankaToplam / 300);
    const sinavAgirligi = statikPay * (1 - gozlemGucu) + gozlenenPay * gozlemGucu;

    const oncelik = sinavAgirligi * (1 - hakimiyet) * (0.7 + 0.3 * veriGucu);

    return {
      topicId: konu.id,
      ad: konu.ad,
      areaId: konu.areaId,
      bankaSoruSayisi: banka,
      cozulen: t.cozulen,
      dogru: t.dogru,
      yanlis: t.yanlis,
      bos: t.bos,
      dogrulukOrani: t.cozulen ? t.dogru / t.cozulen : 0,
      hakimiyet,
      veriGucu,
      sinavAgirligi,
      oncelik,
      ortalamaSure: t.cozulen ? t.sure / t.cozulen : 0,
      sonCalisma: t.son,
    } satisfies KonuIstatistigi;
  });

  // Önceliği 0-1 aralığına normalize et (en yüksek konu 1 olacak şekilde).
  const enYuksek = Math.max(...ham.map((k) => k.oncelik), 1e-9);
  return ham.map((k) => ({ ...k, oncelik: k.oncelik / enYuksek }));
}

export function alanIstatistikleri(konular: KonuIstatistigi[]) {
  return AREAS.map((alan) => {
    const alt = konular.filter((k) => k.areaId === alan.id);
    const cozulen = alt.reduce((a, k) => a + k.cozulen, 0);
    const dogru = alt.reduce((a, k) => a + k.dogru, 0);
    const banka = alt.reduce((a, k) => a + k.bankaSoruSayisi, 0);
    const agirlikToplam = alt.reduce((a, k) => a + k.sinavAgirligi, 0);
    const hakimiyet = agirlikToplam
      ? alt.reduce((a, k) => a + k.hakimiyet * k.sinavAgirligi, 0) / agirlikToplam
      : 0.5;
    return {
      alan,
      cozulen,
      dogru,
      bankaSoruSayisi: banka,
      dogrulukOrani: cozulen ? dogru / cozulen : 0,
      hakimiyet,
      sinavAgirligi: agirlikToplam,
    };
  });
}

export function genelIstatistik(
  sorular: Soru[],
  cevaplamalar: Cevaplama[],
  simdi = Date.now(),
): GenelIstatistik {
  const dogru = cevaplamalar.filter((c) => c.dogru).length;
  const bos = cevaplamalar.filter((c) => c.secilen === null).length;
  const yanlis = cevaplamalar.length - dogru - bos;
  const sure = cevaplamalar.reduce((a, c) => a + c.sure, 0);

  const gunBasi = new Date(simdi);
  gunBasi.setHours(0, 0, 0, 0);
  const bugunCozulen = cevaplamalar.filter((c) => c.zaman >= gunBasi.getTime()).length;

  return {
    bankaToplam: sorular.length,
    cevaplananBenzersiz: new Set(cevaplamalar.map((c) => c.soruId)).size,
    toplamCevaplama: cevaplamalar.length,
    dogru,
    yanlis,
    bos,
    dogrulukOrani: cevaplamalar.length ? dogru / cevaplamalar.length : 0,
    ortalamaSure: cevaplamalar.length ? sure / cevaplamalar.length : 0,
    serisi: calismaSerisi(cevaplamalar, simdi),
    bugunCozulen,
  };
}

/** Kesintisiz kaç gündür çalışıldığını döner (bugün çözülmediyse dünden sayar). */
export function calismaSerisi(cevaplamalar: Cevaplama[], simdi = Date.now()): number {
  if (cevaplamalar.length === 0) return 0;
  const gunler = new Set(cevaplamalar.map((c) => gunAnahtari(c.zaman)));
  let seri = 0;
  const imlec = new Date(simdi);
  imlec.setHours(0, 0, 0, 0);
  if (!gunler.has(gunAnahtari(imlec.getTime()))) {
    imlec.setDate(imlec.getDate() - 1);
    if (!gunler.has(gunAnahtari(imlec.getTime()))) return 0;
  }
  while (gunler.has(gunAnahtari(imlec.getTime()))) {
    seri += 1;
    imlec.setDate(imlec.getDate() - 1);
  }
  return seri;
}

export function gunAnahtari(zaman: number): string {
  const d = new Date(zaman);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Son N günün günlük çözüm sayısı ve doğruluk oranı. */
export function gunlukSeri(cevaplamalar: Cevaplama[], gunSayisi = 30, simdi = Date.now()) {
  const kova = new Map<string, { toplam: number; dogru: number }>();
  for (const c of cevaplamalar) {
    const k = gunAnahtari(c.zaman);
    const g = kova.get(k) ?? { toplam: 0, dogru: 0 };
    g.toplam += 1;
    if (c.dogru) g.dogru += 1;
    kova.set(k, g);
  }
  const sonuc: { gun: string; tarih: number; toplam: number; dogru: number; oran: number }[] = [];
  const imlec = new Date(simdi);
  imlec.setHours(0, 0, 0, 0);
  imlec.setDate(imlec.getDate() - (gunSayisi - 1));
  for (let i = 0; i < gunSayisi; i++) {
    const k = gunAnahtari(imlec.getTime());
    const g = kova.get(k) ?? { toplam: 0, dogru: 0 };
    sonuc.push({ gun: k, tarih: imlec.getTime(), toplam: g.toplam, dogru: g.dogru, oran: g.toplam ? g.dogru / g.toplam : 0 });
    imlec.setDate(imlec.getDate() + 1);
  }
  return sonuc;
}

/** Sınav yılı bazında performans — hangi yılın soruları daha zor geliyor. */
export function yilBazliPerformans(sorular: Soru[], cevaplamalar: Cevaplama[]) {
  const soruYil = new Map(sorular.map((s) => [s.id, s.yil]));
  const kova = new Map<number, { toplam: number; dogru: number }>();
  for (const c of cevaplamalar) {
    const yil = soruYil.get(c.soruId);
    if (!yil) continue;
    const g = kova.get(yil) ?? { toplam: 0, dogru: 0 };
    g.toplam += 1;
    if (c.dogru) g.dogru += 1;
    kova.set(yil, g);
  }
  return [...kova.entries()]
    .map(([yil, g]) => ({ yil, ...g, oran: g.toplam ? g.dogru / g.toplam : 0 }))
    .sort((a, b) => a.yil - b.yil);
}

/** Israrla yanlış yapılan sorular — tekrar listesinin çekirdeği. */
export function inatciSorular(sorular: Soru[], cevaplamalar: Cevaplama[], enAz = 2) {
  const sayim = new Map<string, { deneme: number; yanlis: number; son: number }>();
  for (const c of cevaplamalar) {
    const g = sayim.get(c.soruId) ?? { deneme: 0, yanlis: 0, son: 0 };
    g.deneme += 1;
    if (!c.dogru) g.yanlis += 1;
    g.son = Math.max(g.son, c.zaman);
    sayim.set(c.soruId, g);
  }
  const soruById = new Map(sorular.map((s) => [s.id, s]));
  return [...sayim.entries()]
    .filter(([, g]) => g.yanlis >= enAz)
    .map(([id, g]) => ({ soru: soruById.get(id), ...g, oran: g.yanlis / g.deneme }))
    .filter((x): x is { soru: Soru; deneme: number; yanlis: number; son: number; oran: number } => !!x.soru)
    .sort((a, b) => b.yanlis - a.yanlis || b.oran - a.oran);
}

/**
 * Sınav tarihine kadar konuları önceliğe göre günlere dağıtan çalışma planı.
 * Her gün için hedef soru sayısı ve odaklanılacak konular üretilir.
 */
export function calismaPlani(
  konular: KonuIstatistigi[],
  gunlukHedef: number,
  sinavTarihi: Date,
  simdi = Date.now(),
) {
  const kalanGun = Math.max(1, Math.ceil((sinavTarihi.getTime() - simdi) / GUN));
  const planlanacak = konular
    .filter((k) => k.bankaSoruSayisi > 0 || k.sinavAgirligi > 0)
    .sort((a, b) => b.oncelik - a.oncelik);

  const gunler: { tarih: number; konular: { topicId: string; ad: string; soruSayisi: number }[] }[] = [];
  // Her gün 2-3 konuya odaklan; konular önceliğe göre döngüsel dağıtılır.
  const konuBasiGun = 3;
  for (let g = 0; g < Math.min(kalanGun, 120); g++) {
    const secilen: { topicId: string; ad: string; soruSayisi: number }[] = [];
    for (let i = 0; i < konuBasiGun; i++) {
      const konu = planlanacak[(g * konuBasiGun + i) % planlanacak.length];
      if (!konu) continue;
      secilen.push({
        topicId: konu.topicId,
        ad: konu.ad,
        soruSayisi: Math.max(5, Math.round(gunlukHedef / konuBasiGun)),
      });
    }
    gunler.push({ tarih: simdi + g * GUN, konular: secilen });
  }
  return { kalanGun, gunler };
}

export function konuAdi(topicId: string | undefined): string {
  return topicId ? (TOPIC_BY_ID.get(topicId)?.ad ?? 'Sınıflandırılmamış') : 'Sınıflandırılmamış';
}
