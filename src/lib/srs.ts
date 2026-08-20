/**
 * Aralıklı tekrar (SM-2 türevi).
 *
 * Klasik SM-2'den farkı: sınavda çoktan seçmeli soru çözüldüğü için kullanıcıdan
 * ayrıca 0-5 arası kalite notu istemiyoruz. Nota; doğruluk, seçenek sayısına
 * göre şans payı ve cevaplama süresi birlikte çevriliyor.
 */

import type { TekrarKarti } from '../types';

const GUN = 86_400_000;

export function yeniKart(soruId: string): TekrarKarti {
  return {
    soruId,
    kolaylik: 2.5,
    aralik: 0,
    vade: Date.now(),
    tekrarSayisi: 0,
    hataSayisi: 0,
    sonGorulme: 0,
  };
}

/**
 * Cevaplamadan 0-5 arası kalite notu türetir.
 * Hızlı ve doğru = 5, yavaş ama doğru = 3, yanlış = 1, boş = 0.
 */
export function kaliteNotu(dogru: boolean, sureMs: number, secilenVarMi: boolean): number {
  if (!secilenVarMi) return 0;
  if (!dogru) return 1;
  if (sureMs < 20_000) return 5;
  if (sureMs < 45_000) return 4;
  return 3;
}

export function kartiGuncelle(kart: TekrarKarti, kalite: number): TekrarKarti {
  const simdi = Date.now();
  let { kolaylik, aralik, tekrarSayisi, hataSayisi } = kart;

  if (kalite < 3) {
    // Hatalı hatırlama: seri sıfırlanır, kart ertesi gün tekrar sorulur.
    tekrarSayisi = 0;
    aralik = 1;
    hataSayisi += 1;
  } else {
    tekrarSayisi += 1;
    if (tekrarSayisi === 1) aralik = 1;
    else if (tekrarSayisi === 2) aralik = 6;
    else aralik = Math.round(aralik * kolaylik);
  }

  kolaylik = kolaylik + (0.1 - (5 - kalite) * (0.08 + (5 - kalite) * 0.02));
  kolaylik = Math.max(1.3, Math.min(2.8, kolaylik));

  // Çok uzun aralıklar sınav hazırlığında işe yaramıyor; 90 günle sınırlanıyor.
  aralik = Math.min(aralik, 90);

  return {
    ...kart,
    kolaylik,
    aralik,
    tekrarSayisi,
    hataSayisi,
    sonGorulme: simdi,
    vade: simdi + aralik * GUN,
  };
}

export function vadesiGelenler(kartlar: TekrarKarti[], simdi = Date.now()): TekrarKarti[] {
  return kartlar.filter((k) => k.vade <= simdi).sort((a, b) => a.vade - b.vade);
}

/** Sınav tarihine kadar bir kartın kaç kez daha tekrar edileceğini kabaca tahmin eder. */
export function kalanTekrarSayisi(kart: TekrarKarti, sinavTarihi: number): number {
  let sayac = 0;
  let vade = kart.vade;
  let aralik = Math.max(1, kart.aralik);
  while (vade < sinavTarihi && sayac < 12) {
    sayac += 1;
    aralik = Math.min(90, Math.round(aralik * kart.kolaylik));
    vade += aralik * GUN;
  }
  return sayac;
}
