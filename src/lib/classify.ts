/**
 * Soruların konu taksonomisine otomatik yerleştirilmesi.
 *
 * İçe aktarılan sınav sorularında konu bilgisi bulunmaz. Burada iki sinyal
 * birleştirilir:
 *   1) Metindeki SMK madde atıfları (ör. "6769 sayılı Kanun'un 6 ncı maddesi")
 *      — güçlü sinyal, çünkü madde numarası konuyu tek başına belirler.
 *   2) Konuya özgü anahtar ifadeler — uzun ifadeler kısa olanlardan daha
 *      ayırt edici olduğu için kelime sayısına göre ağırlıklandırılır.
 *
 * Sonuç, güven skoruyla birlikte döner. Düşük güvenli atamalar arayüzde
 * "gözden geçirilmeli" olarak işaretlenir; kullanıcı tek tıkla düzeltebilir.
 */

import { AREAS, TOPICS, type Topic } from '../data/topics';
import { SMK_BY_NO } from '../data/smk';
import { normalize } from './metin';

const HAZIR_KONULAR = TOPICS.map((t) => ({
  konu: t,
  ifadeler: t.anahtar.map((a) => ({ metin: normalize(a), agirlik: a.split(/\s+/).length })),
}));

/** Metinde "6 ncı maddesi", "madde 6", "m.6/1" gibi atıfları yakalar. */
const MADDE_DESENLERI = [
  /(\d{1,3})\s*(?:inci|ıncı|nci|ncı|uncu|üncü|ünci)\s*madde/gi,
  /madde\s*(\d{1,3})/gi,
  /\bm\.?\s*(\d{1,3})\b/gi,
  /\bmd\.?\s*(\d{1,3})\b/gi,
];

export function smkMaddeleriniBul(metin: string): number[] {
  const bulunan = new Set<number>();
  for (const desen of MADDE_DESENLERI) {
    desen.lastIndex = 0;
    for (const eslesme of metin.matchAll(desen)) {
      const no = Number(eslesme[1]);
      if (SMK_BY_NO.has(no)) bulunan.add(no);
    }
  }
  return [...bulunan].sort((a, b) => a - b);
}

export type Siniflandirma = {
  topicId?: string;
  guven: number;
  maddeler: number[];
  /** Sıralı ilk üç aday — arayüzde alternatif olarak sunulur. */
  adaylar: { topicId: string; skor: number }[];
};

/**
 * Aday konuları belirli bir alan kümesiyle sınırlar.
 * `patent`  : yalnızca patent konuları
 * `markaVb` : patent dışındaki tüm konular
 * `{ alanlar }`: yalnızca verilen alanların konuları
 */
export type AlanKisiti = 'patent' | 'markaVb' | { alanlar: string[] } | undefined;

function kisitliMi(topicId: string, kisit: AlanKisiti): boolean {
  if (!kisit) return true;
  const konu = TOPICS.find((t) => t.id === topicId);
  // Sorunun kitapçıktaki yerinden alanı biliniyorsa (ör. ortak bölümün
  // 49–60'ı genel hukuk) yalnızca o alanların konuları aday olur.
  if (typeof kisit === 'object') return !!konu && kisit.alanlar.includes(konu.areaId);
  const patentMi = konu?.areaId === 'patent';
  return kisit === 'patent' ? patentMi : !patentMi;
}

export function siniflandir(
  soruMetni: string,
  secenekMetinleri: string[] = [],
  kisit: AlanKisiti = undefined,
): Siniflandirma {
  const hamMetin = [soruMetni, ...secenekMetinleri].join(' \n ');
  const metin = ' ' + normalize(hamMetin) + ' ';
  const maddeler = smkMaddeleriniBul(hamMetin);

  const skorlar = new Map<string, number>();
  const ekle = (topicId: string, puan: number) => {
    if (!kisitliMi(topicId, kisit)) return;
    skorlar.set(topicId, (skorlar.get(topicId) ?? 0) + puan);
  };

  // 1) Madde atıfları
  for (const no of maddeler) {
    const madde = SMK_BY_NO.get(no);
    if (madde?.topicId) ekle(madde.topicId, 6);
  }

  // 2) Anahtar ifadeler
  for (const { konu, ifadeler } of HAZIR_KONULAR) {
    for (const ifade of ifadeler) {
      if (ifade.metin.length < 4) continue;
      if (metin.includes(ifade.metin)) {
        ekle(konu.id, 1 + ifade.agirlik * 1.4);
      }
    }
  }

  if (skorlar.size === 0) {
    return { guven: 0, maddeler, adaylar: [] };
  }

  const sirali = [...skorlar.entries()]
    .map(([topicId, skor]) => ({ topicId, skor }))
    .sort((a, b) => b.skor - a.skor);

  const enIyi = sirali[0];
  const ikinci = sirali[1]?.skor ?? 0;

  // Güven: hem mutlak skor hem de ikinci adaya olan fark dikkate alınır.
  const mutlak = Math.min(1, enIyi.skor / 12);
  const ayrisma = enIyi.skor === 0 ? 0 : (enIyi.skor - ikinci) / enIyi.skor;
  const guven = Math.round(Math.min(1, 0.45 * mutlak + 0.55 * ayrisma) * 100) / 100;

  return {
    topicId: enIyi.topicId,
    guven,
    maddeler,
    adaylar: sirali.slice(0, 3),
  };
}

export function konuOner(metin: string): Topic | undefined {
  const sonuc = siniflandir(metin);
  return TOPICS.find((t) => t.id === sonuc.topicId);
}

/* ─────────────────────────── bölüm duyarlı toplu atama ───────────────────── */

export type SiniflandirilabilirSoru = {
  id: string;
  metin: string;
  secenekler: { metin: string }[];
  yil?: number;
  bolum?: string;
};

/**
 * Bir soru kümesini, kitapçık bölümlerini de hesaba katarak sınıflandırır.
 *
 * Genel Yeterlik kitapçıkları patent ve marka sorularını ayrı bölümlerde
 * taşıyor ("PATENT SORULARI" / "MARKA SORULARI", ya da 1. ve 2. kitapçık).
 * Bölüm bilgisi, tek tek anahtar kelimelerden çok daha güçlü bir sinyal:
 * patent bölümündeki bir soru marka konusuna atanmamalı.
 *
 * Hangi bölümün patent olduğunu sabit kabul etmiyoruz — bölümün kendi
 * içeriğinden ölçüyoruz. Önce kısıtsız bir geçiş yapılıyor, sonra her bölümün
 * patent oranına bakılıp bölüm baskın çıktıysa o kümedeki sorular ilgili alana
 * kısıtlanarak yeniden sınıflandırılıyor. Böylece kural, düzeni farklı olan
 * gelecekteki kitapçıklarda da kendini ayarlıyor.
 */
export function topluSiniflandir<T extends SiniflandirilabilirSoru>(
  sorular: T[],
  /**
   * Bölüm kapsamları önceden ölçüldüyse (bkz. parse.mjs `bolumKapsamlari`)
   * kapsam kararı buradan alınır. Böylece kapsam için tek bir otorite olur:
   * marka bölümündeki bir soru — "ORTAK" gibi karma bir bölümde olsa bile —
   * patent konusuna atanıp çalışma ekranlarından gizlenmez.
   */
  bolumKapsami?: Map<string, 'patent' | 'marka' | 'karma'>,
): Map<string, Siniflandirma> {
  const patentTopicIdleri = new Set(TOPICS.filter((t) => t.areaId === 'patent').map((t) => t.id));
  const metinler = new Map(sorular.map((s) => [s.id, [s.metin, ...s.secenekler.map((o) => o.metin)]] as const));

  // 1. geçiş — kısıtsız
  const ilk = new Map<string, Siniflandirma>();
  for (const soru of sorular) {
    const [metin, ...secenekler] = metinler.get(soru.id)!;
    ilk.set(soru.id, siniflandir(metin, secenekler));
  }

  // Bölüm anahtarı: aynı yılın aynı bölümü tek küme.
  const kumeAnahtari = (s: T) => `${s.yil ?? '?'}|${s.bolum ?? '?'}`;
  const kumeler = new Map<string, T[]>();
  for (const soru of sorular) {
    const k = kumeAnahtari(soru);
    if (!kumeler.has(k)) kumeler.set(k, []);
    kumeler.get(k)!.push(soru);
  }

  // 2. geçiş — bölümün baskın alanını ölçüp kısıtlı yeniden sınıflandırma.
  //
  // Eşikler gerçek kitapçıklardan ölçüldü: patent bölümlerinin ham patent
  // oranı 0,57–0,88, marka bölümlerinin 0,00–0,08 bandında. Arada kalan
  // "ORTAK" bölümü 0,40 civarında çıkıyor ve kısıtlanmamalı — bu yüzden
  // patent kararı mutlak eşiğe değil, aynı yılın bölümleri arasındaki
  // sıralamaya bağlanıyor: yalnızca yılın en yüksek oranlı bölümü, o da 0,5'i
  // aşıyorsa patent kabul edilir.
  const oranlar = new Map<string, number>();
  for (const [anahtar, kume] of kumeler) {
    if (kume.length < 5) continue;
    const atanan = kume.filter((s) => ilk.get(s.id)?.topicId);
    if (atanan.length < kume.length * 0.4) continue;
    const patentSayisi = atanan.filter((s) => patentTopicIdleri.has(ilk.get(s.id)!.topicId!)).length;
    oranlar.set(anahtar, patentSayisi / atanan.length);
  }

  // Yıl başına en yüksek patent oranlı bölüm
  const yilinEnYuksegi = new Map<string, string>();
  for (const [anahtar, oran] of oranlar) {
    const yil = anahtar.split('|')[0];
    const mevcut = yilinEnYuksegi.get(yil);
    if (!mevcut || oran > oranlar.get(mevcut)!) yilinEnYuksegi.set(yil, anahtar);
  }

  const sonuc = new Map(ilk);
  const anahtarlar = bolumKapsami ? [...kumeler.keys()] : [...oranlar.keys()];

  for (const anahtar of anahtarlar) {
    let kisit: AlanKisiti;
    if (bolumKapsami) {
      // Dışarıdan gelen kapsam ölçümü belirleyici.
      const bolumAdi = anahtar.split('|')[1];
      kisit = bolumKapsami.get(bolumAdi) === 'patent' ? 'patent' : 'markaVb';
    } else {
      const oran = oranlar.get(anahtar);
      if (oran === undefined) continue;
      const yil = anahtar.split('|')[0];
      const enYuksekMi = yilinEnYuksegi.get(yil) === anahtar;
      kisit = enYuksekMi && oran >= 0.5 ? 'patent' : oran < 0.15 ? 'markaVb' : undefined;
    }
    if (!kisit) continue;

    for (const soru of kumeler.get(anahtar) ?? []) {
      const [metin, ...secenekler] = metinler.get(soru.id)!;
      const yeni = siniflandir(metin, secenekler, kisit);
      // Patent bölümünde hiçbir konuya oturmayan soru, marka analizini
      // bozmaması için toplama konusuna yazılır.
      if (!yeni.topicId && kisit === 'patent') {
        sonuc.set(soru.id, { ...yeni, topicId: 'patent-genel', guven: 0.2 });
      } else {
        sonuc.set(soru.id, yeni);
      }
    }
  }
  return sonuc;
}

/** Alan kimliğinden okunabilir ad — arayüz mesajları için. */
export function alanAdi(areaId: string): string {
  return AREAS.find((a) => a.id === areaId)?.ad ?? areaId;
}
