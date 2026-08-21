/** Soru seçme ve filtreleme yardımcıları. */

import type { Cevaplama, Soru } from '../types';
import { TOPIC_BY_ID } from '../data/topics';
import { normalize } from './metin';

export type Filtre = {
  arama: string;
  areaId: string;
  topicId: string;
  yil: string;
  /** Kitapçık bölümü: "MARKA", "ORTAK", "2. kitapçık" gibi. */
  bolum: string;
  durum: 'hepsi' | 'cozulmemis' | 'yanlis' | 'isaretli' | 'cevapsiz';
  siralama: 'karisik' | 'sirali' | 'zayifOnce';
};

export const BOS_FILTRE: Filtre = {
  arama: '', areaId: '', topicId: '', yil: '', bolum: '', durum: 'hepsi', siralama: 'karisik',
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
    if (filtre.bolum && s.bolum !== filtre.bolum) return false;

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

export function bolumler(sorular: Soru[]): string[] {
  return [...new Set(sorular.map((s) => s.bolum).filter((b): b is string => !!b))].sort();
}

export function yillar(sorular: Soru[]): number[] {
  return [...new Set(sorular.map((s) => s.yil).filter((y): y is number => !!y))].sort((a, b) => b - a);
}

/* ─────────────────────────── soru türü ve dağılım ───────────────────────── */

export type SoruTuru = 'cikmis' | 'banka';

/**
 * Sorunun türü. Eski kayıtlarda `tur` alanı bulunmayabilir; o durumda yıl
 * bilgisi belirleyicidir — çıkmış sınav sorularının yılı vardır.
 */
export function soruTuru(soru: Soru): SoruTuru {
  return soru.tur ?? (soru.yil ? 'cikmis' : 'banka');
}

export function cikmisSorular(sorular: Soru[]): Soru[] {
  return sorular.filter((s) => soruTuru(s) === 'cikmis');
}

/**
 * Çıkmış sorulardan gerçek sınavın konu dağılımını çıkarır: topicId -> oran.
 *
 * Bu, "sınavda hangi konudan ne kadar çıkıyor" sorusunun tek dürüst cevabı;
 * tahmin değil, elindeki gerçek kitapçıkların sayımı.
 */
export function sinavKonuDagilimi(sorular: Soru[]): Map<string, number> {
  const cikmis = cikmisSorular(sorular).filter((s) => s.topicId && !s.iptal);
  const sayim = new Map<string, number>();
  for (const soru of cikmis) {
    sayim.set(soru.topicId!, (sayim.get(soru.topicId!) ?? 0) + 1);
  }
  const toplam = [...sayim.values()].reduce((a, b) => a + b, 0);
  if (toplam === 0) return new Map();
  return new Map([...sayim].map(([id, n]) => [id, n / toplam]));
}

/**
 * Gerçek sınavın konu dağılımını taklit eden deneme seti kurar.
 *
 * Saf rastgele seçim, bankadaki soru sayısının dağılımını yansıtır — çıkmış
 * sınavın dağılımını değil. Bu fonksiyon her konuya sınavdaki payı kadar yer
 * ayırır, soruları o kotalar içinde havuzdan çeker.
 *
 * Kotalar en büyük kalan yöntemiyle tam sayıya yuvarlanır. Bir konuda yeterli
 * soru yoksa açık kalan kontenjan, kalan havuzdan rastgele tamamlanır — set
 * her hâlükârda istenen uzunlukta çıkar.
 */
export function gercekciDenemeSec(
  havuz: Soru[],
  dagilim: Map<string, number>,
  adet: number,
  tohum = Date.now(),
): Soru[] {
  if (dagilim.size === 0) return karistir(havuz, tohum).slice(0, adet);

  // Konu başına kota: taban + en büyük kalanlar
  const hamKotalar = [...dagilim].map(([topicId, oran]) => ({ topicId, ham: oran * adet }));
  const kotalar = new Map(hamKotalar.map((k) => [k.topicId, Math.floor(k.ham)]));
  let dagitilan = [...kotalar.values()].reduce((a, b) => a + b, 0);
  const kalanlar = hamKotalar
    .map((k) => ({ topicId: k.topicId, kalan: k.ham - Math.floor(k.ham) }))
    .sort((a, b) => b.kalan - a.kalan);
  for (let i = 0; dagitilan < adet && i < kalanlar.length; i++, dagitilan++) {
    kotalar.set(kalanlar[i].topicId, (kotalar.get(kalanlar[i].topicId) ?? 0) + 1);
  }

  const konuyaGore = new Map<string, Soru[]>();
  for (const soru of havuz) {
    if (!soru.topicId) continue;
    if (!konuyaGore.has(soru.topicId)) konuyaGore.set(soru.topicId, []);
    konuyaGore.get(soru.topicId)!.push(soru);
  }

  const secilen: Soru[] = [];
  const kullanilan = new Set<string>();
  for (const [topicId, kota] of kotalar) {
    if (kota <= 0) continue;
    const adaylar = karistir(konuyaGore.get(topicId) ?? [], tohum + topicId.length);
    for (const soru of adaylar.slice(0, kota)) {
      secilen.push(soru);
      kullanilan.add(soru.id);
    }
  }

  // Konularda soru yetmediyse kalanı havuzdan tamamla.
  if (secilen.length < adet) {
    const yedek = karistir(havuz.filter((s) => !kullanilan.has(s.id)), tohum + 7);
    secilen.push(...yedek.slice(0, adet - secilen.length));
  }

  return karistir(secilen, tohum + 13);
}

/** Deneme setinin konu dağılımını, hedef dağılımla karşılaştırmalı olarak döner. */
export function dagilimOzeti(sorular: Soru[], dagilim: Map<string, number>) {
  const sayim = new Map<string, number>();
  for (const soru of sorular) {
    const id = soru.topicId ?? '_yok';
    sayim.set(id, (sayim.get(id) ?? 0) + 1);
  }
  return [...sayim.entries()]
    .map(([topicId, adet]) => ({
      topicId,
      adet,
      hedefOran: dagilim.get(topicId) ?? 0,
      gercekOran: adet / Math.max(1, sorular.length),
    }))
    .sort((a, b) => b.adet - a.adet);
}
