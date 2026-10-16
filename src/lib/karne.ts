/**
 * Çıkmış sınav karnesi: bir yılın sınavını parça parça çözsen de toplam
 * sonucunu verir.
 *
 * Banka büyüdükçe bir sınavın daha önce çözülmüş hâline yeni sorular
 * eklenebiliyor (ör. 2019'a 22 soru eklendi). Kullanıcı sınavı baştan çözmek
 * yerine yalnızca eksik kalanları çözüp tek bir sonuç görmek ister. Karne her
 * soru için **ilk** çözümü esas alır: sınav sonucu, soruyu ilk gördüğündeki
 * cevabındır; sonradan çalışma ya da tekrar modunda aynı soruyu yeniden
 * çözmek puanı değiştirmez.
 */

import type { Cevaplama, Soru } from '../types';

export type SinavKarnesi = {
  yil: number;
  /** Sınavın soruları, kitapçık sırasıyla (iptal edilenler dahil). */
  sorular: Soru[];
  /** Puanlanan soru sayısı (iptal edilenler hariç). */
  toplam: number;
  cozulen: number;
  dogru: number;
  yanlis: number;
  bos: number;
  /** Hiç çözülmemiş sorular, kitapçık sırasıyla. */
  eksik: Soru[];
  /** 0–100; çözülmemiş sorular puan getirmez. */
  puan: number;
  tamam: boolean;
  /** Soru kimliği → o sorunun ilk çözümü. */
  ilkCozumler: Map<string, Cevaplama>;
  sonCozum?: number;
};

/**
 * Bir yılın sınav soruları, kitapçıktaki sırasıyla. Bölümlü kitapçıklarda
 * (2015: MARKA 1–25, ORTAK 1–25; 2017–2021: 1. kitapçık 41–60, 2. kitapçık
 * 61–100) önce bölümün sırası, sonra basılı numara.
 */
export function sinavSorulari(havuz: Soru[], yil: number): Soru[] {
  const yilinkiler = havuz.filter((s) => s.yil === yil && s.tur !== 'banka');
  const bolumSirasi = new Map<string, number>();
  for (const s of yilinkiler) if (!bolumSirasi.has(s.bolum ?? '')) bolumSirasi.set(s.bolum ?? '', bolumSirasi.size);
  return [...yilinkiler].sort((a, b) =>
    (bolumSirasi.get(a.bolum ?? '') ?? 0) - (bolumSirasi.get(b.bolum ?? '') ?? 0) || (a.no ?? 0) - (b.no ?? 0));
}

export function sinavKarnesi(yil: number, sorular: Soru[], cevaplamalar: Cevaplama[]): SinavKarnesi {
  const kimlikler = new Set(sorular.map((s) => s.id));
  const ilkCozumler = new Map<string, Cevaplama>();
  for (const c of cevaplamalar) {
    if (!kimlikler.has(c.soruId)) continue;
    const onceki = ilkCozumler.get(c.soruId);
    if (!onceki || c.zaman < onceki.zaman) ilkCozumler.set(c.soruId, c);
  }

  const puanlanan = sorular.filter((s) => !s.iptal);
  let dogru = 0;
  let yanlis = 0;
  let bos = 0;
  const eksik: Soru[] = [];
  for (const s of puanlanan) {
    const c = ilkCozumler.get(s.id);
    if (!c) { eksik.push(s); continue; }
    if (c.secilen === null) bos += 1;
    else if (c.secilen === s.cevap) dogru += 1;
    else yanlis += 1;
  }
  const cozulen = puanlanan.length - eksik.length;
  const zamanlar = [...ilkCozumler.values()].map((c) => c.zaman);

  return {
    yil,
    sorular,
    toplam: puanlanan.length,
    cozulen,
    dogru,
    yanlis,
    bos,
    eksik,
    puan: puanlanan.length ? Math.round((dogru / puanlanan.length) * 1000) / 10 : 0,
    tamam: eksik.length === 0 && puanlanan.length > 0,
    ilkCozumler,
    sonCozum: zamanlar.length ? Math.max(...zamanlar) : undefined,
  };
}
