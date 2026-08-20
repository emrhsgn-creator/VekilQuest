import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { oku, yaz, yerelOku, yerelYaz } from './lib/db';
import { kaliteNotu, kartiGuncelle, yeniKart } from './lib/srs';
import { topluSiniflandir } from './lib/classify';
import { bolumKapsamlari } from './lib/parse.mjs';
import { kapsamDisiMi } from './data/topics';
import {
  VARSAYILAN_AYARLAR,
  type Ayarlar, type Cevaplama, type Seans, type Soru, type TekrarKarti, type Yedek,
} from './types';

const ANAHTAR = {
  sorular: 'sorular',
  cevaplamalar: 'cevaplamalar',
  seanslar: 'seanslar',
  tekrar: 'tekrarKartlari',
  ayarlar: 'mv.ayarlar',
} as const;

type Durum = {
  hazir: boolean;
  sorular: Soru[];
  cevaplamalar: Cevaplama[];
  seanslar: Seans[];
  tekrarKartlari: TekrarKarti[];
  ayarlar: Ayarlar;
};

type Islemler = {
  soruEkle: (sorular: Soru[]) => void;
  soruGuncelle: (id: string, degisiklik: Partial<Soru>) => void;
  soruSil: (idler: string[]) => void;
  tumSorulariSiniflandir: () => number;
  seansBaslat: (seans: Seans) => void;
  seansBitir: (seansId: string) => void;
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
      const [sorular, cevaplamalar, seanslar, tekrarKartlari] = await Promise.all([
        oku<Soru[]>(ANAHTAR.sorular, []),
        oku<Cevaplama[]>(ANAHTAR.cevaplamalar, []),
        oku<Seans[]>(ANAHTAR.seanslar, []),
        oku<TekrarKarti[]>(ANAHTAR.tekrar, []),
      ]);
      if (iptal) return;
      setDurum((d) => ({ ...d, hazir: true, sorular, cevaplamalar, seanslar, tekrarKartlari }));
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
          mevcut.set(soru.id, { ...mevcut.get(soru.id), ...soru });
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
          ayarlar: { ...VARSAYILAN_AYARLAR, ...(yedek.ayarlar ?? {}) },
        };
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
        return { ...d, cevaplamalar: [], seanslar: [], tekrarKartlari: [] };
      });
    },

    hepsiniSil() {
      setDurum((d) => {
        kalicilastir(ANAHTAR.sorular, []);
        kalicilastir(ANAHTAR.cevaplamalar, []);
        kalicilastir(ANAHTAR.seanslar, []);
        kalicilastir(ANAHTAR.tekrar, []);
        return { ...d, sorular: [], cevaplamalar: [], seanslar: [], tekrarKartlari: [] };
      });
    },
  }), [kalicilastir, durum.sorular, durum.cevaplamalar, durum.seanslar, durum.tekrarKartlari, durum.ayarlar]);

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

export function useStore() {
  const deger = useContext(Baglam);
  if (!deger) throw new Error('useStore, StoreSaglayici içinde kullanılmalı');
  return deger;
}
