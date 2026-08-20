export type Secenek = { harf: string; metin: string };

export type Soru = {
  id: string;
  /** Soru kitapçığındaki sıra numarası. */
  no?: number;
  /** Sınav yılı (ör. 2024). */
  yil?: number;
  /** Aynı yıl içinde birden fazla oturum varsa ayırt eder (ör. "1"). */
  oturum?: string;
  /** Kitapçık türü (A / B). */
  kitapcik?: string;
  /** Kitapçık içindeki bölüm: "MARKA", "ORTAK", "2. kitapçık" gibi. */
  bolum?: string;
  /** Sorunun geldiği kaynak: "TÜRKPATENT 2024 Marka Vekilliği (A)", "Elle eklendi" vb. */
  kaynak: string;
  metin: string;
  secenekler: Secenek[];
  /** Doğru seçeneğin harfi. Boşsa soru "cevapsız" sayılır ve sınavda çıkmaz. */
  cevap: string;
  topicId?: string;
  /** Otomatik sınıflandırmanın güven skoru (0-1). Elle atandıysa 1. */
  topicGuven?: number;
  /** Serbest metin mevzuat atıfları: ["SMK m.6/1", "TTK m.55"]. */
  atiflar?: string[];
  /** Metinde tespit edilen SMK madde numaraları. */
  smkMaddeleri?: number[];
  aciklama?: string;
  zorluk?: 1 | 2 | 3;
  etiketler?: string[];
  /** Kurum tarafından iptal edilen sorular istatistiğe katılmaz. */
  iptal?: boolean;
  eklenme: number;
};

export type Mod = 'deneme' | 'calisma' | 'tekrar';

export type Cevaplama = {
  id: string;
  soruId: string;
  seansId: string;
  mod: Mod;
  /** Boş bırakıldıysa null. */
  secilen: string | null;
  dogru: boolean;
  /** Soruda geçirilen süre (ms). */
  sure: number;
  zaman: number;
  isaretli?: boolean;
};

export type Seans = {
  id: string;
  mod: Mod;
  baslik: string;
  soruIdleri: string[];
  baslangic: number;
  bitis?: number;
  /** Deneme modunda toplam süre sınırı (saniye). */
  sureSiniri?: number;
  /** Seans sırasındaki konu filtresi — analizde gösterilir. */
  filtreOzeti?: string;
};

/** SM-2 türevi aralıklı tekrar kartı. */
export type TekrarKarti = {
  soruId: string;
  kolaylik: number;
  aralik: number;
  vade: number;
  tekrarSayisi: number;
  hataSayisi: number;
  sonGorulme: number;
};

export type Ayarlar = {
  denemeSoruSayisi: number;
  denemeSuresiDk: number;
  gecmeNotu: number;
  gunlukHedef: number;
  sinavTarihi?: string;
  anindaGeriBildirim: boolean;
  /**
   * Patent bölümü zaten içe aktarılmıyor; bu ayar ikinci bir güvence. Elle
   * eklenmiş ya da başka kaynaktan gelmiş patent soruları da çalışma, deneme
   * ve analiz ekranlarının dışında tutulur.
   */
  sadeceMarkaKapsami: boolean;
  secenekleriKaristir: boolean;
  tema: 'sistem' | 'acik' | 'koyu';
};

export type Yedek = {
  surum: 1;
  olusturma: number;
  sorular: Soru[];
  cevaplamalar: Cevaplama[];
  seanslar: Seans[];
  tekrarKartlari: TekrarKarti[];
  ayarlar: Ayarlar;
};

export const VARSAYILAN_AYARLAR: Ayarlar = {
  denemeSoruSayisi: 100,
  denemeSuresiDk: 120,
  gecmeNotu: 70,
  gunlukHedef: 30,
  anindaGeriBildirim: true,
  sadeceMarkaKapsami: true,
  secenekleriKaristir: false,
  tema: 'sistem',
};
