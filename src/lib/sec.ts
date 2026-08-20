/** Soru seçme ve filtreleme yardımcıları. */

import type { Cevaplama, Soru } from '../types';
import { TOPIC_BY_ID } from '../data/topics';
import { normalize } from './metin';

export type Filtre = {
  arama: string;
  areaId: string;
  topicId: string;
  yil: string;
  durum: 'hepsi' | 'cozulmemis' | 'yanlis' | 'isaretli' | 'cevapsiz';
  siralama: 'karisik' | 'sirali' | 'zayifOnce';
};

export const BOS_FILTRE: Filtre = {
  arama: '', areaId: '', topicId: '', yil: '', durum: 'hepsi', siralama: 'karisik',
};

export function filtrele(sorular: Soru[], cevaplamalar: Cevaplama[], filtre: Filtre): Soru[] {
  const cozulmus = new Set(cevaplamalar.map((c) => c.soruId));
  const yanlisYapilan = new Set(
    cevaplamalar.filter((c) => !c.dogru).map((c) => c.soruId),
  );
  // Sonradan doğru yapılanlar "yanlış" listesinden düşer.
  const sonDurum = new Map<string, boolean>();
  for (const c of [...cevaplamalar].sort((a, b) => a.zaman - b.zaman)) {
    sonDurum.set(c.soruId, c.dogru);
  }

  const arama = normalize(filtre.arama);

  return sorular.filter((s) => {
    if (filtre.topicId && s.topicId !== filtre.topicId) return false;
    if (filtre.areaId) {
      const konu = s.topicId ? TOPIC_BY_ID.get(s.topicId) : undefined;
      if (konu?.areaId !== filtre.areaId) return false;
    }
    if (filtre.yil && String(s.yil ?? '') !== filtre.yil) return false;

    switch (filtre.durum) {
      case 'cozulmemis': if (cozulmus.has(s.id)) return false; break;
      case 'yanlis': if (!yanlisYapilan.has(s.id) || sonDurum.get(s.id) === true) return false; break;
      case 'isaretli': if (!s.etiketler?.includes('işaretli')) return false; break;
      case 'cevapsiz': if (s.cevap) return false; break;
    }

    if (arama) {
      const govde = normalize(s.metin + ' ' + s.secenekler.map((o) => o.metin).join(' '));
      if (!govde.includes(arama)) return false;
    }
    return true;
  });
}

/** Sınavda çözülebilir sorular: cevabı bilinen ve iptal edilmemiş olanlar. */
export function cozulebilir(sorular: Soru[]): Soru[] {
  return sorular.filter((s) => s.cevap && !s.iptal && s.secenekler.length >= 2);
}

export function karistir<T>(dizi: T[], tohum = Date.now()): T[] {
  const kopya = [...dizi];
  let durum = tohum >>> 0;
  const sonraki = () => {
    // xorshift32 — deterministik ve bağımlılıksız.
    durum ^= durum << 13; durum >>>= 0;
    durum ^= durum >> 17;
    durum ^= durum << 5; durum >>>= 0;
    return durum / 0xffffffff;
  };
  for (let i = kopya.length - 1; i > 0; i--) {
    const j = Math.floor(sonraki() * (i + 1));
    [kopya[i], kopya[j]] = [kopya[j], kopya[i]];
  }
  return kopya;
}

/**
 * Zayıf konulara ağırlık vererek soru seçer.
 * Öncelik skoru yüksek konulardan orantılı olarak daha çok soru alınır.
 */
export function zayifOnceSec(
  sorular: Soru[],
  oncelikler: Map<string, number>,
  adet: number,
): Soru[] {
  const puanli = sorular.map((s) => ({
    soru: s,
    puan: (oncelikler.get(s.topicId ?? '') ?? 0.2) + Math.random() * 0.25,
  }));
  puanli.sort((a, b) => b.puan - a.puan);
  return puanli.slice(0, adet).map((p) => p.soru);
}

export function yillar(sorular: Soru[]): number[] {
  return [...new Set(sorular.map((s) => s.yil).filter((y): y is number => !!y))].sort((a, b) => b - a);
}
