export type HamSecenek = { harf: string; metin: string };

export type HamSoru = {
  /** Kitapçıkta basılı numara. */
  no: number;
  /** Bölüm içindeki basılı numara (bölümlü kitapçıklarda `no` ile aynı). */
  yerelNo: number;
  /** Cevap anahtarında aranan numara (kitapçık kayması uygulanmış hâli). */
  anahtarNo: number;
  /** Belge içinde benzersiz sıra — kimlik üretmek için. */
  sira: number;
  kitapcikNo?: number;
  /** "PATENT" / "MARKA" / "ORTAK" gibi bölüm adı. */
  bolum?: string;
  metin: string;
  secenekler: HamSecenek[];
  cevap: string;
  iptal?: boolean;
  /** Gövdesi metin olarak okunamayan (tablo/şekil içeren) soru. */
  gorselIcerikli?: boolean;
};

export type AyristirmaRaporu = {
  toplam: number;
  cevapliEslesen: number;
  cevapsiz: number;
  secenekEksik: number;
  gorselIcerikli: number;
  iptal: number;
  bolumler: string[];
};

export type CevapAnahtari = {
  /** Sürekli numaralandırılmış anahtar. */
  tekil: Map<number, string>;
  /** Bölüm başına ayrı numaralandırılmış paralel sütunlar. */
  sutunlar: Map<number, string>[];
};

export function katla(metin: string): string;
export function katlaHizali(metin: string): string;
export function metniTemizle(ham: string): string;
export function beyanEdilenSoruSayisi(kitapcikMetni: string): number | null;
export function kisimlaraAyir(temizMetin: string): {
  kitapciklar: { metin: string; bolumAdlari: string[] }[];
  anahtarMetni: string;
};
export function sorulariAyristir(hamMetin: string): { sorular: HamSoru[]; uyarilar: string[] };
export function cevapAnahtariAyristir(hamMetin: string): CevapAnahtari;
export function iptalEdilenler(hamMetin: string): Set<number>;
export function belgeyiAyristir(
  kitapcikMetni: string,
  ayriAnahtarMetni?: string,
): { sorular: HamSoru[]; uyarilar: string[]; rapor: AyristirmaRaporu };
export function birlestir(
  sorular: HamSoru[],
  anahtar: Map<number, string> | CevapAnahtari,
  iptaller?: Set<number>,
): { sorular: HamSoru[]; rapor: Omit<AyristirmaRaporu, 'gorselIcerikli' | 'bolumler'> };

/** Bölüm adı -> kapsam. "patent" bölümleri marka vekilliği kapsamı dışıdır. */
export function bolumKapsamlari(
  sorular: { bolum?: string; kitapcikNo?: number; metin: string; secenekler: { metin: string }[] }[],
): Map<string, 'patent' | 'marka' | 'karma'>;

export function patentDisiKuyrukBasi<T>(sorular: T[], patentMi?: (soru: T) => boolean): number;
export function patentSorusuMu(soru: { metin: string; secenekler: { metin: string }[] }): boolean;
