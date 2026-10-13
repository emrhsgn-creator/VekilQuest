import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { oku, yaz, yerelOku, yerelYaz } from './lib/db';
import { kaliteNotu, kartiGuncelle, yeniKart } from './lib/srs';
import { topluSiniflandir } from './lib/classify';
import { bolumKapsamlari } from './lib/parse.mjs';
import { soruyuBicimle } from './lib/bicim.mjs';
import { gomuluBankayiBirlestir, type BirlestirmeOzeti } from './lib/bankaGuncelle';
import { kapsamDisiMi } from './data/topics';
import {
  VARSAYILAN_AYARLAR,
  type Ayarlar, type Cevaplama, type DevamKaydi, type Seans, type Soru, type TekrarKarti, type Yedek,
} from './types';

const ANAHTAR = {
  sorular: 'sorular',
  cevaplamalar: 'cevaplamalar',
  seanslar: 'seanslar',
  tekrar: 'tekrarKartlari',
  devamEdenler: 'devamEdenler',
  ayarlar: 'mv.ayarlar',
  bankaDamgasi: 'mv.bankaDamgasi',
} as const;

/** Uygulamayla birlikte dağıtılan soru bankası (tools/soru-bankasi-uret.mjs üretir). */
const GOMULU_BANKA = 'veri/soru-bankasi.json';

type Durum = {
  hazir: boolean;
  sorular: Soru[];
  cevaplamalar: Cevaplama[];
  seanslar: Seans[];
  tekrarKartlari: TekrarKarti[];
  /** Yarım bırakılmış seanslar — kaldığın yerden devam için. */
  devamEdenler: DevamKaydi[];
  ayarlar: Ayarlar;
};

type Islemler = {
  soruEkle: (sorular: Soru[]) => void;
  soruGuncelle: (id: string, degisiklik: Partial<Soru>) => void;
  soruSil: (idler: string[]) => void;
  tumSorulariSiniflandir: () => number;
  seansBaslat: (seans: Seans) => void;
  seansBitir: (seansId: string) => void;
  devamKaydet: (kayit: DevamKaydi) => void;
  devamSil: (seansId: string) => void;
  gomuluBankayiEsitle: (gomulu: Soru[], damga: string) => BirlestirmeOzeti;
  cevapKaydet: (girdi: Omit<Cevaplama, 'id' | 'zaman'>) => void;
  isaretiDegistir: (soruId: string) => void;
  ayarlariGuncelle: (degisiklik: Partial<Ayarlar>) => void;
  yedekAl: () => Yedek;
  yedekYukle: (yedek: Yedek) => void;
  ilerlemeyiSifirla: () => void;
  hepsiniSil: () => void;
};

const Baglam = createContext<(Durum & Islemler & { tumSorular: Soru[] }) | null>(null);

export function StoreSaglayici({ children }: { children: ReactNode }) {
  const [durum, setDurum] = useState<Durum>({
    hazir: false,
    sorular: [],
    cevaplamalar: [],
    seanslar: [],
    tekrarKartlari: [],
    devamEdenler: [],
    ayarlar: yerelOku<Ayarlar>(ANAHTAR.ayarlar, VARSAYILAN_AYARLAR),
  });

  // Yazma işlemleri yoğun olabildiği için IndexedDB'ye debounce ile yazıyoruz.
  const zamanlayicilar = useRef<Record<string, number>>({});
  const kalicilastir = useCallback((anahtar: string, deger: unknown) => {
    window.clearTimeout(zamanlayicilar.current[anahtar]);
    zamanlayicilar.current[anahtar] = window.setTimeout(() => {
      void yaz(anahtar, deger);
    }, 300);
  }, []);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      const [sorular, cevaplamalar, seanslar, tekrarKartlari, devamEdenler] = await Promise.all([
        oku<Soru[]>(ANAHTAR.sorular, []),
        oku<Cevaplama[]>(ANAHTAR.cevaplamalar, []),
        oku<Seans[]>(ANAHTAR.seanslar, []),
        oku<TekrarKarti[]>(ANAHTAR.tekrar, []),
        oku<DevamKaydi[]>(ANAHTAR.devamEdenler, []),
      ]);
      if (iptal) return;

      let baslangic = { sorular, cevaplamalar, seanslar, tekrarKartlari, devamEdenler };

      // Gömülü soru bankası: ilk açılışta yüklenir, sonraki yayınlarda
      // (damga değişince) cihazdaki kopyayla eşitlenir. Böylece yeni eklenen
      // sınavlar ve ayrıştırma düzeltmeleri mevcut kullanıcılara da ulaşır.
      // Kullanıcının kendi eklediği sorular ve çözüm geçmişi korunur.
      const gelen = await gomuluBankayiGetir();
      if (iptal) return;
      if (gelen.sorular.length > 0 && (sorular.length === 0 || gelen.damga !== gomuluBankaDamgasi())) {
        const birlesik = gomuluBankayiBirlestir(baslangic, gelen.sorular);
        baslangic = {
          sorular: birlesik.sorular,
          cevaplamalar: birlesik.cevaplamalar,
          seanslar: birlesik.seanslar,
          tekrarKartlari: birlesik.tekrarKartlari,
          devamEdenler: birlesik.devamEdenler,
        };
        void yaz(ANAHTAR.sorular, birlesik.sorular);
        void yaz(ANAHTAR.cevaplamalar, birlesik.cevaplamalar);
        void yaz(ANAHTAR.seanslar, birlesik.seanslar);
        void yaz(ANAHTAR.tekrar, birlesik.tekrarKartlari);
        void yaz(ANAHTAR.devamEdenler, birlesik.devamEdenler);
        yerelYaz(ANAHTAR.bankaDamgasi, gelen.damga);
      }

      // Cihazda kayıtlı (ör. kendi içe aktarılmış) sorulardaki sayfa
      // artıklarını ayıkla, öncülleri satırlara böl. Değişiklik yoksa aynı
      // nesne döner; yalnızca bir şey düzeldiyse diske yazılır.
      const bicimli = baslangic.sorular.map(soruyuBicimle);
      if (bicimli.some((s, i) => s !== baslangic.sorular[i])) {
        baslangic = { ...baslangic, sorular: bicimli };
        void yaz(ANAHTAR.sorular, bicimli);
      }

      setDurum((d) => ({ ...d, hazir: true, ...baslangic }));
    })();
    return () => { iptal = true; };
  }, []);

  // Tema
  useEffect(() => {
    const kok = document.documentElement;
    if (durum.ayarlar.tema === 'sistem') kok.removeAttribute('data-tema');
    else kok.setAttribute('data-tema', durum.ayarlar.tema);
  }, [durum.ayarlar.tema]);

  const islemler = useMemo<Islemler>(() => ({
    soruEkle(yeniler) {
      setDurum((d) => {
        const mevcut = new Map(d.sorular.map((s) => [s.id, s]));
        for (const soru of yeniler) {
          // Aynı id ile gelen soru mevcut kaydı günceller; çözüm geçmişi korunur.
          mevcut.set(soru.id, soruyuBicimle({ ...mevcut.get(soru.id), ...soru }));
        }
        const sorular = [...mevcut.values()];
        kalicilastir(ANAHTAR.sorular, sorular);
        return { ...d, sorular };
      });
    },

    soruGuncelle(id, degisiklik) {
      setDurum((d) => {
        const sorular = d.sorular.map((s) => (s.id === id ? { ...s, ...degisiklik } : s));
        kalicilastir(ANAHTAR.sorular, sorular);
        return { ...d, sorular };
      });
    },

    soruSil(idler) {
      const kume = new Set(idler);
      setDurum((d) => {
        const sorular = d.sorular.filter((s) => !kume.has(s.id));
        const cevaplamalar = d.cevaplamalar.filter((c) => !kume.has(c.soruId));
        const tekrarKartlari = d.tekrarKartlari.filter((k) => !kume.has(k.soruId));
        kalicilastir(ANAHTAR.sorular, sorular);
        kalicilastir(ANAHTAR.cevaplamalar, cevaplamalar);
        kalicilastir(ANAHTAR.tekrar, tekrarKartlari);
        return { ...d, sorular, cevaplamalar, tekrarKartlari };
      });
    },

    tumSorulariSiniflandir() {
      let sayac = 0;
      setDurum((d) => {
        // Bölüm duyarlı toplu atama: patent bölümündeki sorular marka
        // konularına, marka bölümündekiler patent konularına düşmesin.
        const sonuclar = topluSiniflandir(d.sorular, bolumKapsamlari(d.sorular));
        const sorular = d.sorular.map((s) => {
          // Elle atanmış konular korunur.
          if (s.topicId && (s.topicGuven ?? 0) >= 0.9) return s;
          const sonuc = sonuclar.get(s.id);
          if (!sonuc?.topicId) return s;
          sayac += 1;
          return { ...s, topicId: sonuc.topicId, topicGuven: sonuc.guven, smkMaddeleri: sonuc.maddeler };
        });
        kalicilastir(ANAHTAR.sorular, sorular);
        return { ...d, sorular };
      });
      return sayac;
    },

    seansBaslat(seans) {
      setDurum((d) => {
        if (d.seanslar.some((s) => s.id === seans.id)) return d;
        const seanslar = [...d.seanslar, seans];
        kalicilastir(ANAHTAR.seanslar, seanslar);
        return { ...d, seanslar };
      });
    },

    seansBitir(seansId) {
      setDurum((d) => {
        const seanslar = d.seanslar.map((s) => (s.id === seansId ? { ...s, bitis: Date.now() } : s));
        kalicilastir(ANAHTAR.seanslar, seanslar);
        return { ...d, seanslar };
      });
    },

    devamKaydet(kayit) {
      setDurum((d) => {
        const devamEdenler = [kayit, ...d.devamEdenler.filter((k) => k.seansId !== kayit.seansId)]
          // En fazla on yarım seans tutulur; en eskisi düşer.
          .slice(0, 10);
        kalicilastir(ANAHTAR.devamEdenler, devamEdenler);
        return { ...d, devamEdenler };
      });
    },

    devamSil(seansId) {
      setDurum((d) => {
        if (!d.devamEdenler.some((k) => k.seansId === seansId)) return d;
        const devamEdenler = d.devamEdenler.filter((k) => k.seansId !== seansId);
        kalicilastir(ANAHTAR.devamEdenler, devamEdenler);
        return { ...d, devamEdenler };
      });
    },

    gomuluBankayiEsitle(gomulu, damga) {
      let ozet: BirlestirmeOzeti = { eklenen: 0, guncellenen: 0, birlesen: 0, silinen: 0 };
      setDurum((d) => {
        const sonuc = gomuluBankayiBirlestir(d, gomulu);
        ozet = sonuc.ozet;
        kalicilastir(ANAHTAR.sorular, sonuc.sorular);
        kalicilastir(ANAHTAR.cevaplamalar, sonuc.cevaplamalar);
        kalicilastir(ANAHTAR.seanslar, sonuc.seanslar);
        kalicilastir(ANAHTAR.tekrar, sonuc.tekrarKartlari);
        kalicilastir(ANAHTAR.devamEdenler, sonuc.devamEdenler);
        return {
          ...d,
          sorular: sonuc.sorular,
          cevaplamalar: sonuc.cevaplamalar,
          seanslar: sonuc.seanslar,
          tekrarKartlari: sonuc.tekrarKartlari,
          devamEdenler: sonuc.devamEdenler,
        };
      });
      yerelYaz(ANAHTAR.bankaDamgasi, damga);
      return ozet;
    },

    cevapKaydet(girdi) {
      setDurum((d) => {
        const kayit: Cevaplama = {
          ...girdi,
          id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          zaman: Date.now(),
        };
        const cevaplamalar = [...d.cevaplamalar, kayit];

        // Aralıklı tekrar kartını güncelle.
        const kartlar = [...d.tekrarKartlari];
        const indeks = kartlar.findIndex((k) => k.soruId === girdi.soruId);
        const kart = indeks >= 0 ? kartlar[indeks] : yeniKart(girdi.soruId);
        const guncel = kartiGuncelle(kart, kaliteNotu(girdi.dogru, girdi.sure, girdi.secilen !== null));
        if (indeks >= 0) kartlar[indeks] = guncel; else kartlar.push(guncel);

        kalicilastir(ANAHTAR.cevaplamalar, cevaplamalar);
        kalicilastir(ANAHTAR.tekrar, kartlar);
        return { ...d, cevaplamalar, tekrarKartlari: kartlar };
      });
    },

    isaretiDegistir(soruId) {
      setDurum((d) => {
        const sorular = d.sorular.map((s) =>
          s.id === soruId
            ? { ...s, etiketler: s.etiketler?.includes('işaretli')
                ? s.etiketler.filter((e) => e !== 'işaretli')
                : [...(s.etiketler ?? []), 'işaretli'] }
            : s,
        );
        kalicilastir(ANAHTAR.sorular, sorular);
        return { ...d, sorular };
      });
    },

    ayarlariGuncelle(degisiklik) {
      setDurum((d) => {
        const ayarlar = { ...d.ayarlar, ...degisiklik };
        yerelYaz(ANAHTAR.ayarlar, ayarlar);
        return { ...d, ayarlar };
      });
    },

    yedekAl() {
      return {
        surum: 1,
        olusturma: Date.now(),
        sorular: durum.sorular,
        cevaplamalar: durum.cevaplamalar,
        seanslar: durum.seanslar,
        tekrarKartlari: durum.tekrarKartlari,
        devamEdenler: durum.devamEdenler,
        ayarlar: durum.ayarlar,
      };
    },

    yedekYukle(yedek) {
      setDurum((d) => {
        const yeni: Durum = {
          ...d,
          sorular: yedek.sorular ?? [],
          cevaplamalar: yedek.cevaplamalar ?? [],
          seanslar: yedek.seanslar ?? [],
          tekrarKartlari: yedek.tekrarKartlari ?? [],
          devamEdenler: yedek.devamEdenler ?? [],
          ayarlar: { ...VARSAYILAN_AYARLAR, ...(yedek.ayarlar ?? {}) },
        };
        kalicilastir(ANAHTAR.devamEdenler, yeni.devamEdenler);
        kalicilastir(ANAHTAR.sorular, yeni.sorular);
        kalicilastir(ANAHTAR.cevaplamalar, yeni.cevaplamalar);
        kalicilastir(ANAHTAR.seanslar, yeni.seanslar);
        kalicilastir(ANAHTAR.tekrar, yeni.tekrarKartlari);
        yerelYaz(ANAHTAR.ayarlar, yeni.ayarlar);
        return yeni;
      });
    },

    ilerlemeyiSifirla() {
      setDurum((d) => {
        kalicilastir(ANAHTAR.cevaplamalar, []);
        kalicilastir(ANAHTAR.seanslar, []);
        kalicilastir(ANAHTAR.tekrar, []);
        kalicilastir(ANAHTAR.devamEdenler, []);
        return { ...d, cevaplamalar: [], seanslar: [], tekrarKartlari: [], devamEdenler: [] };
      });
    },

    hepsiniSil() {
      setDurum((d) => {
        kalicilastir(ANAHTAR.sorular, []);
        kalicilastir(ANAHTAR.cevaplamalar, []);
        kalicilastir(ANAHTAR.seanslar, []);
        kalicilastir(ANAHTAR.tekrar, []);
        kalicilastir(ANAHTAR.devamEdenler, []);
        return { ...d, sorular: [], cevaplamalar: [], seanslar: [], tekrarKartlari: [], devamEdenler: [] };
      });
    },
  }), [kalicilastir, durum.sorular, durum.cevaplamalar, durum.seanslar, durum.tekrarKartlari, durum.devamEdenler, durum.ayarlar]);

  // `sorular` kapsam ayarına göre süzülmüş listedir; ekranların çoğu bunu
  // kullanır. Soru bankası, yedekleme ve içe aktarma `tumSorular` ile çalışır.
  const kapsamdaki = useMemo(
    () => (durum.ayarlar.sadeceMarkaKapsami
      ? durum.sorular.filter((s) => !kapsamDisiMi(s.topicId))
      : durum.sorular),
    [durum.sorular, durum.ayarlar.sadeceMarkaKapsami],
  );

  const deger = useMemo(
    () => ({ ...durum, sorular: kapsamdaki, tumSorular: durum.sorular, ...islemler }),
    [durum, kapsamdaki, islemler],
  );
  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>;
}

/**
 * Gömülü soru bankasını okur. Dosya yoksa ya da bozuksa sessizce boş döner —
 * uygulama yine de açılmalı, kullanıcı kendi sorularını yükleyebilir.
 */
export async function gomuluBankayiGetir(): Promise<{ sorular: Soru[]; damga: string }> {
  try {
    const yanit = await fetch(`${import.meta.env.BASE_URL}${GOMULU_BANKA}`);
    if (!yanit.ok) return { sorular: [], damga: '' };
    const veri = await yanit.json();
    const simdi = Date.now();
    const sorular: Soru[] = (veri.sorular ?? []).map((s: Soru) => ({
      ...s,
      gomulu: true,
      eklenme: s.eklenme ?? simdi,
    }));
    return { sorular, damga: String(veri.damga ?? '') };
  } catch {
    return { sorular: [], damga: '' };
  }
}

/** Kullanıcının cihazındaki gömülü banka sürümü. */
export function gomuluBankaDamgasi(): string {
  return yerelOku<string>(ANAHTAR.bankaDamgasi, '');
}

export function useStore() {
  const deger = useContext(Baglam);
  if (!deger) throw new Error('useStore, StoreSaglayici içinde kullanılmalı');
  return deger;
}
