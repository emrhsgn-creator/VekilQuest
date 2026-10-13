/**
 * Soru çözme akışı — çalışma, deneme ve tekrar modlarının ortak motoru.
 *
 * Modlar arasındaki farklar:
 *   çalışma / tekrar : her sorudan sonra anında geri bildirim, süre sınırı yok
 *   deneme           : geri bildirim yok, süre sınırı ve soru paleti var,
 *                      sonuçlar ancak sınav bitince açılır
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SoruKarti, SoruPaleti } from './SoruKarti';
import { Kart, Olcut, sayacBicim, sureBicim } from './ui';
import { BuyuklukListesi, Halka, yuzde } from './Grafik';
import { useStore } from '../store';
import { TOPIC_BY_ID, areaOf } from '../data/topics';
import type { DevamKaydi, Mod, SeansKaydi, Soru } from '../types';

type Kayit = SeansKaydi;

/** Bu kadar saniyede bir, süre işlerken anlık görüntü kaydedilir. */
const KAYIT_ARALIGI_SN = 15;

export function SeansCalistir({
  sorular, mod, baslik, sureSiniriSn, anindaGeriBildirim, filtreOzeti, onCik, devam,
}: {
  sorular: Soru[];
  mod: Mod;
  baslik: string;
  sureSiniriSn?: number;
  anindaGeriBildirim: boolean;
  filtreOzeti?: string;
  onCik: () => void;
  /** Yarım kalmış bir seansa dönülüyorsa onun anlık görüntüsü. */
  devam?: DevamKaydi;
}) {
  const { seansBaslat, seansBitir, cevapKaydet, isaretiDegistir, devamKaydet, devamSil } = useStore();

  const [seansId] = useState(
    () => devam?.seansId ?? `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
  );
  const [baslangic] = useState(() => devam?.baslangic ?? Date.now());

  // Seans kaydı render sırasında değil, bağlandıktan sonra oluşturulur.
  useEffect(() => {
    seansBaslat({
      id: seansId,
      mod,
      baslik,
      soruIdleri: sorular.map((s) => s.id),
      baslangic,
      sureSiniri: sureSiniriSn,
      filtreOzeti,
    });
    // Seans bir kez, bileşen bağlandığında kaydedilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [indeks, setIndeks] = useState(() => Math.min(devam?.indeks ?? 0, Math.max(0, sorular.length - 1)));
  const [kayitlar, setKayitlar] = useState<Record<string, Kayit>>(() => devam?.kayitlar ?? {});
  const [bitti, setBitti] = useState(false);
  const [kalanSn, setKalanSn] = useState(devam?.kalanSn ?? sureSiniriSn ?? 0);
  // Süreli bir seansa geri dönülüyorsa süre, kullanıcı hazır olana kadar durur.
  const [duraklatildi, setDuraklatildi] = useState(() => !!devam && !!sureSiniriSn);

  const soruBaslangic = useRef(Date.now());
  useEffect(() => { soruBaslangic.current = Date.now(); }, [indeks, duraklatildi]);
  // Paletten ya da "Sonraki" ile geçilince yeni sorunun başı görünsün (mobilde
  // palet sorunun altında kaldığı için aksi hâlde sayfa ortasında kalınıyor).
  const ilkCizim = useRef(true);
  useEffect(() => {
    if (ilkCizim.current) { ilkCizim.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [indeks]);

  // ── Kaldığın yerden devam ────────────────────────────────────────────────
  // Seansın anlık görüntüsü her anlamlı değişiklikte, süre işlerken düzenli
  // aralıklarla ve ekrandan çıkılırken kaydedilir. Böylece sayfa kapansa,
  // başka bir ekrana geçilse ya da "Duraklat → Kaydet ve çık" denense de
  // seans Panel'den kaldığı yerden sürdürülebilir.
  const anlik = useRef<DevamKaydi | null>(null);
  anlik.current = bitti ? null : {
    seansId,
    mod,
    baslik,
    soruIdleri: sorular.map((s) => s.id),
    anindaGeriBildirim,
    filtreOzeti,
    sureSiniriSn,
    kalanSn: sureSiniriSn ? kalanSn : undefined,
    indeks,
    kayitlar,
    baslangic,
    guncelleme: Date.now(),
  };
  const kaydetRef = useRef(devamKaydet);
  kaydetRef.current = devamKaydet;
  const anlikKaydet = useCallback(() => {
    const k = anlik.current;
    // Hiç ilerleme yoksa (açıp hemen çıkıldıysa) yarım seans listesini doldurma.
    if (!k || (k.indeks === 0 && Object.keys(k.kayitlar).length === 0)) return;
    kaydetRef.current(k);
  }, []);

  useEffect(() => { anlikKaydet(); }, [indeks, kayitlar, duraklatildi, anlikKaydet]);
  useEffect(() => {
    const gizlenince = () => { if (document.visibilityState === 'hidden') anlikKaydet(); };
    document.addEventListener('visibilitychange', gizlenince);
    window.addEventListener('pagehide', anlikKaydet);
    return () => {
      document.removeEventListener('visibilitychange', gizlenince);
      window.removeEventListener('pagehide', anlikKaydet);
      // Ekrandan çıkılıyor (başka sayfaya geçiş): son durumu kaydet.
      anlikKaydet();
    };
  }, [anlikKaydet]);

  const bitir = useCallback(() => {
    anlik.current = null;
    setBitti(true);
    seansBitir(seansId);
    devamSil(seansId);
  }, [seansBitir, devamSil, seansId]);

  // Deneme modu geri sayımı — duraklatılınca durur.
  useEffect(() => {
    if (!sureSiniriSn || bitti || duraklatildi) return;
    const zamanlayici = window.setInterval(() => {
      setKalanSn((k) => {
        if (k <= 1) {
          window.clearInterval(zamanlayici);
          return 0;
        }
        return k - 1;
      });
    }, 1000);
    return () => window.clearInterval(zamanlayici);
  }, [sureSiniriSn, bitti, duraklatildi]);

  const aktifSoru = sorular[indeks];
  const aktifKayit = aktifSoru ? kayitlar[aktifSoru.id] : undefined;

  const sec = useCallback((harf: string) => {
    if (!aktifSoru || bitti) return;
    if (anindaGeriBildirim && aktifKayit?.gosterildi) return;

    const sure = Date.now() - soruBaslangic.current;
    const dogru = harf === aktifSoru.cevap;

    setKayitlar((k) => ({ ...k, [aktifSoru.id]: { secilen: harf, gosterildi: anindaGeriBildirim, sure } }));

    // Deneme modunda cevap sınav bitince kaydedilir; anında geri bildirimde hemen.
    if (anindaGeriBildirim && !aktifSoru.iptal) {
      cevapKaydet({ soruId: aktifSoru.id, seansId, mod, secilen: harf, dogru, sure });
    }
  }, [aktifSoru, aktifKayit, anindaGeriBildirim, bitti, cevapKaydet, seansId, mod]);

  // Deneme modunda cevaplar sınav sonunda toplu kaydedilir.
  const denemeSonuKaydet = useCallback(() => {
    anlik.current = null;
    for (const soru of sorular) {
      if (soru.iptal) continue;
      const k = kayitlar[soru.id];
      cevapKaydet({
        soruId: soru.id,
        seansId,
        mod,
        secilen: k?.secilen ?? null,
        dogru: !!k && k.secilen === soru.cevap,
        sure: k?.sure ?? 0,
      });
    }
    bitir();
  }, [sorular, kayitlar, cevapKaydet, seansId, mod, bitir]);

  // Süre doldu: deneme cevapları kaydedilip sonuç ekranı açılır. Süre
  // dolduğunda bitirmek sayacın içinden değil buradan yapılıyor, çünkü
  // denemeSonuKaydet o anki cevapları görmeli.
  useEffect(() => {
    if (!sureSiniriSn || bitti || kalanSn > 0) return;
    if (anindaGeriBildirim) bitir(); else denemeSonuKaydet();
  }, [kalanSn, sureSiniriSn, bitti, anindaGeriBildirim, bitir, denemeSonuKaydet]);

  // Süre işlerken düzenli aralıklarla kalan süreyi de kaydet.
  useEffect(() => {
    if (sureSiniriSn && kalanSn > 0 && kalanSn % KAYIT_ARALIGI_SN === 0) anlikKaydet();
  }, [kalanSn, sureSiniriSn, anlikKaydet]);

  const ilerle = useCallback(() => {
    if (indeks < sorular.length - 1) setIndeks((i) => i + 1);
    else if (anindaGeriBildirim) bitir();
  }, [indeks, sorular.length, anindaGeriBildirim, bitir]);

  // Ok tuşlarıyla gezinme
  useEffect(() => {
    const dinleyici = (e: KeyboardEvent) => {
      const hedef = e.target as HTMLElement | null;
      if (hedef && ['INPUT', 'TEXTAREA', 'SELECT'].includes(hedef.tagName)) return;
      if (duraklatildi) return;
      if (e.key === 'ArrowRight') ilerle();
      if (e.key === 'ArrowLeft') setIndeks((i) => Math.max(0, i - 1));
      if (e.key === 'Enter' && anindaGeriBildirim && aktifKayit?.gosterildi) ilerle();
    };
    window.addEventListener('keydown', dinleyici);
    return () => window.removeEventListener('keydown', dinleyici);
  }, [ilerle, anindaGeriBildirim, aktifKayit, duraklatildi]);

  if (bitti) {
    return <SeansSonucu sorular={sorular} kayitlar={kayitlar} baslik={baslik} onCik={onCik} />;
  }

  if (!aktifSoru) {
    return (
      <Kart baslik="Soru bulunamadı">
        <p className="sessiz">Bu filtreye uyan soru yok.</p>
        <button className="dugme" onClick={onCik}>Geri dön</button>
      </Kart>
    );
  }

  const cevaplananSayisi = Object.values(kayitlar).filter((k) => k.secilen !== null).length;
  const acilMi = !!sureSiniriSn && kalanSn <= 300;

  return (
    <div className="yigin">
      <div className="satir aralikli">
        <div>
          <h1>{baslik}</h1>
          <p className="sessiz" style={{ margin: 0 }}>
            {cevaplananSayisi} / {sorular.length} cevaplandı
          </p>
        </div>
        <div className="satir">
          {sureSiniriSn ? (
            <span className={`sayac ${acilMi ? 'acil' : ''}`} aria-live="polite">{sayacBicim(kalanSn)}</span>
          ) : null}
          {!duraklatildi && (
            <button className="dugme" onClick={() => setDuraklatildi(true)}
                    title="Süreyi durdur; istersen kaydedip çık, sonra kaldığın yerden devam et">
              ⏸ Duraklat
            </button>
          )}
          <button className="dugme" onClick={anindaGeriBildirim ? bitir : denemeSonuKaydet}>
            {anindaGeriBildirim ? 'Bitir ve özet gör' : 'Sınavı bitir'}
          </button>
        </div>
      </div>

      {duraklatildi ? (
        <Kart baslik="Duraklatıldı">
          <div className="yigin">
            <p style={{ margin: 0 }}>
              {sureSiniriSn ? <>Süre durdu, kalan süre <strong>{sayacBicim(kalanSn)}</strong>. </> : null}
              {cevaplananSayisi} / {sorular.length} soru cevaplandı, {indeks + 1}. sorudasın.
            </p>
            <p className="sessiz" style={{ margin: 0 }}>
              İlerlemen bu cihazda kayıtlı. Şimdi çıkarsan Panel'deki
              {' '}<em>Yarım kalan oturumlar</em> bölümünden kaldığın yerden devam edebilirsin.
            </p>
            <div className="satir">
              <button className="dugme birincil" onClick={() => setDuraklatildi(false)} autoFocus>
                ▶ Devam et
              </button>
              <button className="dugme" onClick={() => { anlikKaydet(); onCik(); }}>
                Kaydet ve çık
              </button>
            </div>
          </div>
        </Kart>
      ) : (
      <>

      <div className="cubuk">
        <span style={{ width: `${((indeks + 1) / sorular.length) * 100}%`, background: 'var(--vurgu)' }} />
      </div>

      <SoruKarti
        soru={aktifSoru}
        sira={indeks + 1}
        toplam={sorular.length}
        secilen={aktifKayit?.secilen ?? null}
        gosterCevap={!!aktifKayit?.gosterildi}
        onSec={sec}
        isaretli={aktifSoru.etiketler?.includes('işaretli')}
        onIsaretle={() => isaretiDegistir(aktifSoru.id)}
      />

      <div className="satir aralikli">
        <button className="dugme" onClick={() => setIndeks((i) => Math.max(0, i - 1))} disabled={indeks === 0}>
          ← Önceki
        </button>
        <span className="minik gizli-mobil">A–E ile cevapla · ← → ile gez</span>
        <button className="dugme birincil" onClick={ilerle}>
          {indeks === sorular.length - 1 ? (anindaGeriBildirim ? 'Bitir' : 'Son soru') : 'Sonraki →'}
        </button>
      </div>

      {!anindaGeriBildirim && (
        <Kart baslik="Soru paleti" not="Cevapladıkların mavi, işaretlediklerin alt çizgili görünür.">
          <SoruPaleti
            toplam={sorular.length}
            aktif={indeks}
            cevaplananlar={new Set(sorular.map((s, i) => (kayitlar[s.id]?.secilen ? i : -1)).filter((i) => i >= 0))}
            isaretliler={new Set(sorular.map((s, i) => (s.etiketler?.includes('işaretli') ? i : -1)).filter((i) => i >= 0))}
            onGit={setIndeks}
          />
        </Kart>
      )}
      </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ sonuç ekranı */

function SeansSonucu({
  sorular, kayitlar, baslik, onCik,
}: {
  sorular: Soru[];
  kayitlar: Record<string, Kayit>;
  baslik: string;
  onCik: () => void;
}) {
  const { ayarlar } = useStore();
  const [yanlislariGoster, setYanlislariGoster] = useState(true);

  const gecerli = sorular.filter((s) => !s.iptal);
  const dogru = gecerli.filter((s) => kayitlar[s.id]?.secilen === s.cevap);
  const bos = gecerli.filter((s) => !kayitlar[s.id]?.secilen);
  const yanlis = gecerli.filter((s) => {
    const k = kayitlar[s.id];
    return k?.secilen && k.secilen !== s.cevap;
  });
  const oran = gecerli.length ? dogru.length / gecerli.length : 0;
  const puan = Math.round(oran * 100);
  const gecti = puan >= ayarlar.gecmeNotu;
  const toplamSure = Object.values(kayitlar).reduce((a, k) => a + k.sure, 0);

  const konuKirilimi = useMemo(() => {
    const kova = new Map<string, { toplam: number; dogru: number }>();
    for (const s of gecerli) {
      const id = s.topicId ?? '_yok';
      const g = kova.get(id) ?? { toplam: 0, dogru: 0 };
      g.toplam += 1;
      if (kayitlar[s.id]?.secilen === s.cevap) g.dogru += 1;
      kova.set(id, g);
    }
    return [...kova.entries()]
      .map(([id, g]) => ({
        id,
        etiket: id === '_yok' ? 'Sınıflandırılmamış' : (TOPIC_BY_ID.get(id)?.ad ?? id),
        deger: g.dogru / g.toplam,
        altEtiket: `${areaOf(id)?.kisa ?? 'Sınıflandırılmamış'} · ${g.dogru}/${g.toplam} doğru`,
      }))
      .sort((a, b) => a.deger - b.deger);
  }, [gecerli, kayitlar]);

  const gosterilenler = yanlislariGoster ? [...yanlis, ...bos] : gecerli;

  return (
    <div className="yigin">
      <div className="satir aralikli">
        <div>
          <h1>Sonuç · {baslik}</h1>
          <p className="sessiz" style={{ margin: 0 }}>{new Date().toLocaleString('tr-TR')}</p>
        </div>
        <button className="dugme birincil" onClick={onCik}>Bitir</button>
      </div>

      <div className="izgara izgara-4">
        <div className="kart" style={{ display: 'grid', placeItems: 'center' }}>
          <Halka oran={oran} etiket="Net doğruluk" />
        </div>
        <Olcut etiket="Doğru" deger={dogru.length} alt={`${gecerli.length} soru üzerinden`} renk="var(--dogru)" />
        <Olcut etiket="Yanlış" deger={yanlis.length} alt={`${bos.length} boş`} renk="var(--yanlis)" />
        <Olcut etiket="Süre" deger={sureBicim(toplamSure)}
               alt={`Soru başı ${sureBicim(gecerli.length ? toplamSure / gecerli.length : 0)}`} />
      </div>

      <div className={`bilgi-kutusu ${gecti ? '' : 'uyari'}`}>
        {gecti
          ? `Bu denemede %${puan} ile ${ayarlar.gecmeNotu} geçme eşiğinin üzerindesin.`
          : `Bu denemede %${puan} aldın; belirlediğin ${ayarlar.gecmeNotu} eşiğinin ${ayarlar.gecmeNotu - puan} puan altındasın.`}
        {sorular.some((s) => s.iptal) && ' İptal edilmiş sorular hesaba katılmadı.'}
      </div>

      <Kart baslik="Konu kırılımı" not="En zayıf konu en üstte.">
        <BuyuklukListesi satirlar={konuKirilimi} birim="%" />
      </Kart>

      <Kart
        baslik="Soruları gözden geçir"
        eylem={
          <div className="satir">
            <button className={`dugme kucuk ${yanlislariGoster ? 'birincil' : ''}`}
                    onClick={() => setYanlislariGoster(true)}>
              Yanlış ve boşlar ({yanlis.length + bos.length})
            </button>
            <button className={`dugme kucuk ${yanlislariGoster ? '' : 'birincil'}`}
                    onClick={() => setYanlislariGoster(false)}>
              Tümü ({gecerli.length})
            </button>
          </div>
        }
      >
        {gosterilenler.length === 0 ? (
          <p className="sessiz">Hiç yanlışın yok. Tebrikler.</p>
        ) : (
          <div className="yigin">
            {gosterilenler.map((s, i) => (
              <SoruKarti key={s.id} soru={s} sira={i + 1} toplam={gosterilenler.length}
                         secilen={kayitlar[s.id]?.secilen ?? null} gosterCevap
                         onSec={() => {}} />
            ))}
          </div>
        )}
      </Kart>

      <div className="satir">
        <button className="dugme birincil" onClick={onCik}>Bitir</button>
        <Link className="dugme" to="/analiz">Ayrıntılı analize git</Link>
        <span className="minik">Bu seansın sonuçları analiz ekranına işlendi ({yuzde(oran)}).</span>
      </div>
    </div>
  );
}
