import { useCallback, useMemo, useRef, useState } from 'react';
import { gomuluBankayiGetir, useStore } from '../store';
import { Kart } from '../components/ui';
import { siniflandir, topluSiniflandir } from '../lib/classify';
import { pdfMetniCikar, pdfMi } from '../lib/pdf';
import { TOPICS, TOPIC_BY_ID } from '../data/topics';
import { kisalt } from '../lib/metin';
import type { Soru, Yedek } from '../types';
import {
  belgeyiAyristir, bolumKapsamlari, patentDisiKuyrukBasi, type AyristirmaRaporu, type HamSoru,
} from '../lib/parse.mjs';

type Adim = 'yukle' | 'onizle';

export default function IceAktar() {
  const { soruEkle, tumSorular: sorular, yedekYukle, gomuluBankayiEsitle } = useStore();

  const [adim, setAdim] = useState<Adim>('yukle');
  const [kitapcikMetni, setKitapcikMetni] = useState('');
  const [anahtarMetni, setAnahtarMetni] = useState('');
  const [durum, setDurum] = useState('');
  const [yil, setYil] = useState('');
  const [kitapcikTuru, setKitapcikTuru] = useState('A');
  const [oturum, setOturum] = useState('');
  const [patentiAtla, setPatentiAtla] = useState(true);
  const [ayristirilan, setAyristirilan] = useState<HamSoru[]>([]);
  const [rapor, setRapor] = useState<AyristirmaRaporu | null>(null);
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const jsonGiris = useRef<HTMLInputElement>(null);

  const dosyaOku = useCallback(async (dosya: File, hedef: 'kitapcik' | 'anahtar') => {
    setDurum(`${dosya.name} okunuyor…`);
    try {
      const metin = pdfMi(dosya)
        ? await pdfMetniCikar(dosya, (s, t) => setDurum(`${dosya.name}: ${s}/${t} sayfa`))
        : await dosya.text();
      if (hedef === 'kitapcik') setKitapcikMetni(metin);
      else setAnahtarMetni(metin);
      setDurum(`${dosya.name} okundu (${metin.length.toLocaleString('tr-TR')} karakter).`);
      // Dosya adından yılı tahmin et: "2024-marka-A.pdf"
      const yilEslesme = dosya.name.match(/(20\d{2})/);
      if (yilEslesme && !yil) setYil(yilEslesme[1]);
      const turEslesme = dosya.name.match(/[^a-z](a|b)[^a-z]/i);
      if (turEslesme) setKitapcikTuru(turEslesme[1].toUpperCase());
    } catch (hata) {
      setDurum(`Okunamadı: ${(hata as Error).message}. PDF taranmış görüntüyse önce OCR gerekiyor.`);
    }
  }, [yil]);

  const ayristir = () => {
    // Cevap anahtarı çoğu kitapçığın son sayfasında yer alıyor; ayrı dosya
    // verilmediyse belge içinden otomatik bulunur.
    const { sorular: cikan, uyarilar: uyari, rapor: r } = belgeyiAyristir(kitapcikMetni, anahtarMetni);
    setAyristirilan(cikan);
    setRapor(r);
    setUyarilar(uyari);
    setAdim('onizle');
  };

  const kaydet = () => {
    const kaynak = ['TÜRKPATENT', yil, 'Genel Yeterlik Sınavı', kitapcikTuru ? `(${kitapcikTuru})` : '']
      .filter(Boolean).join(' ');
    const simdi = Date.now();

    const bolumAdi = (s: HamSoru) =>
      s.bolum ?? (s.kitapcikNo ? `${s.kitapcikNo}. kitapçık` : 'tümü');
    const kapsamlar = bolumKapsamlari(ayristirilan);

    // Genel Yeterlik kitapçığının patent bölümü marka vekilliği kapsamı
    // dışında; karar tek tek sorulara değil bölümün tamamına bakılarak
    // verilir, böylece yanlış sınıflandırılan bir marka sorusu elenmez. Patent
    // kitapçığının sonundaki tasarım, vekillik ve genel hukuk soruları
    // (2017–2021: 41–60) ise kapsam içinde olduğu için alınır.
    const gecerli = ayristirilan.filter((s) => s.metin && s.secenekler.length >= 2);
    const uygun = !patentiAtla ? gecerli : [...new Set(gecerli.map(bolumAdi))].flatMap((ad) => {
      const bolum = gecerli.filter((s) => bolumAdi(s) === ad);
      return kapsamlar.get(ad) === 'patent' ? bolum.slice(patentDisiKuyrukBasi(bolum)) : bolum;
    });
    const elenen = ayristirilan.length - uygun.length;
    const kimlikli = uygun.map((s) => ({
      id: String(s.sira),
      metin: s.metin,
      secenekler: s.secenekler,
      yil: yil ? Number(yil) : undefined,
      bolum: s.bolum ?? (s.kitapcikNo ? `${s.kitapcikNo}. kitapçık` : undefined),
    }));
    const siniflar = topluSiniflandir(kimlikli, kapsamlar);

    const yeniSorular: Soru[] = uygun
      .map((s) => {
        const sonuc = siniflar.get(String(s.sira)) ?? siniflandir(s.metin, s.secenekler.map((o) => o.metin));
        const bolum = s.bolum ?? (s.kitapcikNo ? `${s.kitapcikNo}. kitapçık` : undefined);
        return {
          // Kimlik bölümü de içerir: bölümlü kitapçıklarda numaralar tekrarlanır.
          id: ['tp', yil || 'x', oturum, kitapcikTuru || 'x',
               bolum?.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]+/g, ''), s.yerelNo]
            .filter(Boolean).join('-'),
          no: s.yerelNo,
          yil: yil ? Number(yil) : undefined,
          oturum: oturum || undefined,
          kitapcik: kitapcikTuru || undefined,
          bolum,
          tur: yil ? 'cikmis' : 'banka',
          kaynak,
          metin: s.metin,
          secenekler: s.secenekler,
          cevap: s.cevap,
          topicId: sonuc.topicId,
          topicGuven: sonuc.guven,
          smkMaddeleri: sonuc.maddeler,
          iptal: s.iptal,
          eklenme: simdi,
        };
      });

    soruEkle(yeniSorular);
    setDurum(
      `${yeniSorular.length} soru bankaya eklendi.` +
      (elenen > 0 ? ` ${elenen} patent sorusu kapsam dışı olduğu için alınmadı.` : ''),
    );
    setAdim('yukle');
    setKitapcikMetni('');
    setAnahtarMetni('');
    setAyristirilan([]);
    setRapor(null);
  };

  const gomuluYukle = async () => {
    setDurum('Uygulamayla gelen soru bankası yükleniyor…');
    const { sorular: gelen, damga } = await gomuluBankayiGetir();
    if (gelen.length === 0) {
      setDurum('Gömülü soru bankası okunamadı.');
      return;
    }
    const ozet = gomuluBankayiEsitle(gelen, damga);
    setDurum(
      `Gömülü banka eşitlendi: ${ozet.eklenen} yeni, ${ozet.guncellenen} güncellenen` +
      (ozet.birlesen ? `, kendi yüklediğin ${ozet.birlesen} kopya gömülü sürümle birleştirildi` : '') +
      '. Çözüm geçmişin korundu.',
    );
  };

  const jsonYukle = async (dosya: File) => {
    try {
      const veri = JSON.parse(await dosya.text());
      if (veri.surum === 1 && Array.isArray(veri.cevaplamalar)) {
        yedekYukle(veri as Yedek);
        setDurum('Tam yedek geri yüklendi (sorular, çözüm geçmişi ve ayarlar).');
        return;
      }
      const gelen: Soru[] = Array.isArray(veri) ? veri : veri.sorular;
      if (!Array.isArray(gelen)) throw new Error('Dosyada "sorular" dizisi bulunamadı.');
      const simdi = Date.now();
      const kapsamlar = bolumKapsamlari(
        gelen.map((s) => ({ bolum: s.bolum, metin: s.metin ?? '', secenekler: s.secenekler ?? [] })),
      );
      const suzulmus = patentiAtla
        ? gelen.filter((s) => kapsamlar.get(s.bolum ?? 'tümü') !== 'patent')
        : gelen;
      const elenen = gelen.length - suzulmus.length;
      const kimlikli = suzulmus.map((s, i) => ({
        id: s.id ?? `js-${simdi}-${i}`,
        metin: s.metin ?? '',
        secenekler: s.secenekler ?? [],
        yil: s.yil,
        bolum: s.bolum,
      }));
      const siniflar = topluSiniflandir(kimlikli, kapsamlar);
      soruEkle(suzulmus.map((s, i) => {
        const kimlik = kimlikli[i].id;
        const sonuc = s.topicId ? null : siniflar.get(kimlik);
        return {
          ...s,
          id: kimlik,
          kaynak: s.kaynak ?? veri.kaynak ?? 'JSON içe aktarma',
          eklenme: s.eklenme ?? simdi,
          topicId: s.topicId ?? sonuc?.topicId,
          topicGuven: s.topicGuven ?? sonuc?.guven,
          smkMaddeleri: s.smkMaddeleri ?? sonuc?.maddeler,
        };
      }));
      setDurum(
        `${suzulmus.length} soru JSON'dan içe aktarıldı.` +
        (elenen > 0 ? ` ${elenen} patent sorusu kapsam dışı olduğu için alınmadı.` : ''),
      );
    } catch (hata) {
      setDurum(`JSON okunamadı: ${(hata as Error).message}`);
    }
  };

  if (adim === 'onizle') {
    return (
      <Onizleme
        sorular={ayristirilan}
        rapor={rapor}
        uyarilar={uyarilar}
        onDegis={setAyristirilan}
        onGeri={() => setAdim('yukle')}
        onKaydet={kaydet}
      />
    );
  }

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>İçe aktar</h1>
          <p>
            TÜRKPATENT soru kitapçığını ve cevap anahtarını yükle; uygulama soruları ayrıştırıp
            konulara otomatik yerleştirsin. Dosyalar tarayıcından dışarı çıkmaz, tamamı cihazında işlenir.
          </p>
        </div>
      </div>

      <div className="yigin">
        <Kart baslik="1 · Sınav dosyalarını yükle"
              not="PDF veya düz metin (.txt) kabul edilir. Cevap anahtarı çoğu kitapçığın son sayfasında yer alır ve otomatik bulunur; ayrı dosyaysa sağdaki kutuya yükle.">
          <div className="izgara izgara-2">
            <BirakmaAlani etiket="Soru kitapçığı" dolu={!!kitapcikMetni}
                          onDosya={(d) => dosyaOku(d, 'kitapcik')} />
            <BirakmaAlani etiket="Cevap anahtarı" dolu={!!anahtarMetni} istegeBagli
                          onDosya={(d) => dosyaOku(d, 'anahtar')} />
          </div>

          {durum && <div className="bilgi-kutusu" style={{ marginTop: 14 }}>{durum}</div>}

          <details style={{ marginTop: 14 }}>
            <summary className="minik" style={{ cursor: 'pointer' }}>Metni elle yapıştır</summary>
            <div className="alan" style={{ marginTop: 10 }}>
              <label htmlFor="k-metin">Soru kitapçığı metni</label>
              <textarea id="k-metin" value={kitapcikMetni} rows={7}
                        placeholder={'1. Aşağıdakilerden hangisi…\nA) …\nB) …'}
                        onChange={(e) => setKitapcikMetni(e.target.value)} />
            </div>
            <div className="alan">
              <label htmlFor="a-metin">Cevap anahtarı metni</label>
              <textarea id="a-metin" value={anahtarMetni} rows={4}
                        placeholder="1-C 2-A 3-E …"
                        onChange={(e) => setAnahtarMetni(e.target.value)} />
            </div>
          </details>
        </Kart>

        <Kart baslik="2 · Sınavı tanımla" not="Bu bilgiler yıl bazlı analiz ve soru kimliği için kullanılır.">
          <div className="alan-satir">
            <div>
              <label htmlFor="i-yil">Sınav yılı</label>
              <input id="i-yil" type="number" min={2000} max={2100} value={yil}
                     placeholder="2024" onChange={(e) => setYil(e.target.value)} />
            </div>
            <div>
              <label htmlFor="i-tur">Kitapçık türü</label>
              <input id="i-tur" type="text" maxLength={2} value={kitapcikTuru}
                     onChange={(e) => setKitapcikTuru(e.target.value.toUpperCase())} />
            </div>
            <div>
              <label htmlFor="i-oturum">Oturum (varsa)</label>
              <input id="i-oturum" type="text" value={oturum} placeholder="1"
                     onChange={(e) => setOturum(e.target.value)} />
            </div>
          </div>
          <label className="satir" style={{ gap: 9, fontWeight: 500, marginBottom: 12 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={patentiAtla}
                   onChange={(e) => setPatentiAtla(e.target.checked)} />
            Patent sorularını alma (marka vekilliği kapsamı dışı)
          </label>
          <p className="minik" style={{ marginTop: -6 }}>
            Genel Yeterlik kitapçıklarının bir bölümü patent, diğeri marka sorularından oluşur.
            Bu seçenek açıkken patent bölümü hiç içe aktarılmaz.
          </p>
          <button className="dugme birincil buyuk" onClick={ayristir} disabled={!kitapcikMetni.trim()}>
            Ayrıştır ve önizle
          </button>
        </Kart>

        <Kart baslik="JSON ile içe aktar"
              not="Daha önce dışa aktardığın soru bankası ya da tam yedek dosyası. Uygulamayla gelen banka ilk açılışta zaten yüklenir.">
          <div className="satir">
            <input ref={jsonGiris} type="file" accept=".json,application/json" style={{ display: 'none' }}
                   onChange={(e) => { const d = e.target.files?.[0]; if (d) void jsonYukle(d); e.target.value = ''; }} />
            <button className="dugme" onClick={() => jsonGiris.current?.click()}>JSON dosyası seç</button>
            <button className="dugme" onClick={gomuluYukle}>Uygulamayla gelen bankayı yeniden yükle</button>
            <span className="minik">Bankada şu an {sorular.length} soru var.</span>
          </div>
        </Kart>

        <Kart baslik="Toplu dönüştürme (terminal)"
              not="Çok sayıda yılı tek seferde eklemek istersen depodaki komut satırı aracı daha pratik.">
          <pre className="kod">{`node tools/pdf-to-json.mjs \\
  --kitapcik data/ham/2024-marka-A.pdf \\
  --anahtar  data/ham/2024-marka-A-cevap.pdf \\
  --yil 2024 --kitapcik-turu A`}</pre>
          <p className="minik" style={{ marginBottom: 0 }}>
            Çıktı <code>data/sorular/</code> altına JSON olarak yazılır; buradan “JSON dosyası seç” ile yükleyebilirsin.
          </p>
        </Kart>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- bırakma alanı */

function BirakmaAlani({
  etiket, onDosya, dolu, istegeBagli,
}: {
  etiket: string;
  onDosya: (dosya: File) => void;
  dolu: boolean;
  istegeBagli?: boolean;
}) {
  const [uzerinde, setUzerinde] = useState(false);
  const giris = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`birakma ${uzerinde ? 'uzerinde' : ''} ${dolu ? 'dolu' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setUzerinde(true); }}
      onDragLeave={() => setUzerinde(false)}
      onDrop={(e) => {
        e.preventDefault();
        setUzerinde(false);
        const d = e.dataTransfer.files?.[0];
        if (d) onDosya(d);
      }}
      onClick={() => giris.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') giris.current?.click(); }}
    >
      <input ref={giris} type="file" accept=".pdf,.txt" style={{ display: 'none' }}
             onChange={(e) => { const d = e.target.files?.[0]; if (d) onDosya(d); e.target.value = ''; }} />
      <strong>{dolu ? '✓ ' : ''}{etiket}</strong>
      <span className="minik">
        {dolu ? 'Yüklendi — değiştirmek için tıkla' : `PDF veya TXT sürükle ya da tıkla${istegeBagli ? ' (isteğe bağlı)' : ''}`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ önizleme */

function Onizleme({
  sorular, rapor, uyarilar, onDegis, onGeri, onKaydet,
}: {
  sorular: HamSoru[];
  rapor: AyristirmaRaporu | null;
  uyarilar: string[];
  onDegis: (s: HamSoru[]) => void;
  onGeri: () => void;
  onKaydet: () => void;
}) {
  const [yalnizSorunlu, setYalnizSorunlu] = useState(false);

  const sorunlu = (s: HamSoru) => (!s.cevap && !s.iptal) || s.secenekler.length < 4 || s.metin.length < 15;
  const gosterilen = yalnizSorunlu ? sorular.filter(sorunlu) : sorular;
  const sorunluSayisi = sorular.filter(sorunlu).length;

  const konuOnizleme = useMemo(() => {
    const kova = new Map<string, number>();
    for (const s of sorular) {
      const sonuc = siniflandir(s.metin, s.secenekler.map((o) => o.metin));
      const ad = sonuc.topicId ? (TOPIC_BY_ID.get(sonuc.topicId)?.ad ?? '?') : 'Sınıflandırılamadı';
      kova.set(ad, (kova.get(ad) ?? 0) + 1);
    }
    return [...kova.entries()].sort((a, b) => b[1] - a[1]);
  }, [sorular]);

  const guncelle = (indeks: number, degisiklik: Partial<HamSoru>) => {
    onDegis(sorular.map((s, i) => (i === indeks ? { ...s, ...degisiklik } : s)));
  };

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Önizleme</h1>
          <p>Kaydetmeden önce gözden geçir. Ayrıştırma yüzde yüz kusursuz değildir; eksikleri burada düzeltebilirsin.</p>
        </div>
        <div className="satir">
          <button className="dugme" onClick={onGeri}>← Geri</button>
          <button className="dugme birincil buyuk" onClick={onKaydet} disabled={sorular.length === 0}>
            {sorular.length} soruyu bankaya ekle
          </button>
        </div>
      </div>

      <div className="yigin">
        {rapor && (
          <div className="izgara izgara-4">
            <div className="kart olcut">
              <span className="olcut-etiket">Ayrıştırılan soru</span>
              <span className="olcut-deger">{rapor.toplam}</span>
            </div>
            <div className="kart olcut">
              <span className="olcut-etiket">Cevabı eşleşen</span>
              <span className="olcut-deger" style={{ color: 'var(--dogru)' }}>{rapor.cevapliEslesen}</span>
            </div>
            <div className="kart olcut">
              <span className="olcut-etiket">Cevabı eksik</span>
              <span className="olcut-deger" style={{ color: rapor.cevapsiz ? 'var(--uyari)' : undefined }}>{rapor.cevapsiz}</span>
            </div>
            <div className="kart olcut">
              <span className="olcut-etiket">Bölüm</span>
              <span className="olcut-deger">{rapor.bolumler.length}</span>
              <span className="olcut-alt">{rapor.bolumler.join(' · ') || '—'}</span>
            </div>
          </div>
        )}

        {uyarilar.length > 0 && (
          <div className="bilgi-kutusu uyari">
            <strong>Ayrıştırma uyarıları</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {uyarilar.slice(0, 6).map((u, i) => <li key={i}>{u}</li>)}
              {uyarilar.length > 6 && <li>… ve {uyarilar.length - 6} uyarı daha</li>}
            </ul>
          </div>
        )}

        <Kart baslik="Otomatik konu dağılımı"
              not="Sorular metindeki madde atıfları ve anahtar ifadelere göre konulara yerleştirildi. Bankada tek tek düzeltebilirsin.">
          <div className="satir" style={{ gap: 6 }}>
            {konuOnizleme.slice(0, 14).map(([ad, sayi]) => (
              <span key={ad} className={`rozet ${ad === 'Sınıflandırılamadı' ? 'uyari' : ''}`}>{ad} · {sayi}</span>
            ))}
          </div>
        </Kart>

        <Kart baslik={`Sorular (${gosterilen.length})`}
              eylem={
                <button className={`dugme kucuk ${yalnizSorunlu ? 'birincil' : ''}`}
                        onClick={() => setYalnizSorunlu((v) => !v)} disabled={sorunluSayisi === 0}>
                  {sorunluSayisi ? `Sorunlu olanlar (${sorunluSayisi})` : 'Sorun yok'}
                </button>
              }>
          <div className="yigin">
            {gosterilen.map((s) => {
              const indeks = sorular.indexOf(s);
              return (
                <div key={indeks} className={`onizleme-satir ${sorunlu(s) ? 'sorunlu' : ''}`}>
                  <div className="satir aralikli">
                    <strong style={{ fontSize: '.82rem' }}>
                      {s.bolum ? `${s.bolum} · ` : s.kitapcikNo ? `${s.kitapcikNo}. kitapçık · ` : ''}
                      {s.yerelNo}. soru
                    </strong>
                    <div className="satir">
                      {s.iptal && <span className="rozet uyari">iptal</span>}
                      <label htmlFor={`c-${indeks}`} style={{ margin: 0 }}>Cevap</label>
                      <select id={`c-${indeks}`} value={s.cevap} style={{ width: 70 }}
                              onChange={(e) => guncelle(indeks, { cevap: e.target.value })}>
                        <option value="">—</option>
                        {s.secenekler.map((o) => <option key={o.harf} value={o.harf}>{o.harf}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ fontSize: '.85rem' }}>{kisalt(s.metin, 260)}</div>
                  <div className="minik">
                    {s.secenekler.length} seçenek · {s.secenekler.map((o) => `${o.harf}) ${kisalt(o.metin, 28)}`).join('  ')}
                  </div>
                </div>
              );
            })}
          </div>
        </Kart>

        <div className="satir">
          <button className="dugme birincil buyuk" onClick={onKaydet}>
            {sorular.length} soruyu bankaya ekle
          </button>
          <span className="minik">
            Aynı yıl ve kitapçık için tekrar aktarırsan mevcut kayıtlar güncellenir, çözüm geçmişin korunur.
          </span>
        </div>
      </div>
    </>
  );
}

export const KONU_SAYISI = TOPICS.length;
