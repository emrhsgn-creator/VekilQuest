export type HamSecenek = { harf: string; metin: string };
export type HamSoru = {
  no: number;
  metin: string;
  secenekler: HamSecenek[];
  cevap: string;
  iptal?: boolean;
};

export type AyristirmaRaporu = {
  toplam: number;
  cevapliEslesen: number;
  cevapsiz: number;
  secenekEksik: number;
  iptal: number;
};

export function metniTemizle(ham: string): string;
export function sorulariAyristir(hamMetin: string): { sorular: HamSoru[]; uyarilar: string[] };
export function cevapAnahtariAyristir(hamMetin: string): Map<number, string>;
export function iptalEdilenler(hamMetin: string): Set<number>;
export function birlestir(
  sorular: HamSoru[],
  anahtar: Map<number, string>,
  iptaller?: Set<number>,
): { sorular: HamSoru[]; rapor: AyristirmaRaporu };
