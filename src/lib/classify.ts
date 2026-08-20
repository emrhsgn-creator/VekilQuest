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

import { TOPICS, type Topic } from '../data/topics';
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

export function siniflandir(soruMetni: string, secenekMetinleri: string[] = []): Siniflandirma {
  const hamMetin = [soruMetni, ...secenekMetinleri].join(' \n ');
  const metin = ' ' + normalize(hamMetin) + ' ';
  const maddeler = smkMaddeleriniBul(hamMetin);

  const skorlar = new Map<string, number>();
  const ekle = (topicId: string, puan: number) => {
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
