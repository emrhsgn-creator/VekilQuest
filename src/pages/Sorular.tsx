/**
 * Soruları sınıflandırılmış hâlde gözden geçirme ekranı.
 *
 * İki bakış açısı var ve ikisi farklı soruları cevaplıyor:
 *   Yıla göre   — "2019 sınavında ne çıkmış?" Çıkmış sorular, sınav ve bölüm
 *                 sırasıyla; sınavın kendi düzenini görmek için.
 *   Konuya göre — "Mutlak ret nedenlerinden kaç soru var, hangileri?" Tüm banka,
 *                 hukuk alanı ve konu ağacına göre.
 *   Kaynağa göre — "Marka Kılavuzu setinde neler var?" Soruların geldiği
 *                 kitapçık/kitap ve onun kendi bölümlerine göre.
 *
 * Her grup açılıp okunabiliyor ve doğrudan çözmeye başlanabiliyor.
 */

import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { DevamEdenler } from '../components/DevamEdenler';
import { BosDurum, Cubuk, Kart } from '../components/ui';
import { SoruKarti } from '../components/SoruKarti';
import { SeansCalistir } from '../components/SeansCalistir';
import { yuzde } from '../components/Grafik';
import { AREAS, TOPICS, TOPIC_BY_ID, areaOf } from '../data/topics';
import { cozulebilir, karistir, soruTuru } from '../lib/sec';
import { kisalt } from '../lib/metin';
import type { Soru } from '../types';

type Bakis = 'yil' | 'konu' | 'kaynak';

/** Bir grup soru: yıl, kitapçık bölümü ya da konu. */
type Grup = {
  anahtar: string;
  baslik: string;
  altBaslik?: string;
  sorular: Soru[];
  /** İç içe gruplar (yıl → bölüm, alan → konu). */
  altGruplar?: Grup[];
};

export default function Sorular() {
  const { sorular, cevaplamalar, ayarlar } = useStore();
  const [bakis, setBakis] = useState<Bakis>('yil');
  const [acik, setAcik] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState<{ sorular: Soru[]; baslik: string } | null>(null);

  const istatistik = useMemo(() => {
    const kova = new Map<string, { deneme: number; dogru: number }>();
    for (const c of cevaplamalar) {
      const g = kova.get(c.soruId) ?? { deneme: 0, dogru: 0 };
      g.deneme += 1;
      if (c.dogru) g.dogru += 1;
      kova.set(c.soruId, g);
    }
    return kova;
  }, [cevaplamalar]);

  const gruplar = useMemo(() => {
    if (bakis === 'yil') return yilaGoreGrupla(sorular);
    if (bakis === 'kaynak') return kaynagaGoreGrupla(sorular);
    return konuyaGoreGrupla(sorular);
  }, [sorular, bakis]);

  if (sorular.length === 0) {
    return (
      <BosDurum baslik="Soru bankası boş"
                aciklama="Soruları görmek için önce bankayı doldurman gerekiyor."
                eylemYazi="İçe aktar" eylemYol="/ice-aktar" />
    );
  }

  if (calisiyor) {
    return (
      <SeansCalistir
        sorular={calisiyor.sorular}
        mod="calisma"
        baslik={calisiyor.baslik}
        anindaGeriBildirim={ayarlar.anindaGeriBildirim}
        onCik={() => setCalisiyor(null)}
      />
    );
  }

  const coz = (grup: Grup) => {
    const uygun = cozulebilir(grup.sorular);
    if (uygun.length === 0) return;
    setCalisiyor({ sorular: karistir(uygun), baslik: grup.baslik });
  };

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Sorular</h1>
          <p>
            Çıkmış sınav sorularını yıla, bankanın tamamını konu ağacına, soruları geldikleri
            kitapçık ve kitaba göre gözden geçir. Her gruptan doğrudan çözmeye başlayabilirsin.
          </p>
        </div>
      </div>
      <DevamEdenler modlar={['calisma']} />

      <div className="sekmeler" role="tablist">
        <button role="tab" aria-selected={bakis === 'yil'}
                className={`sekme ${bakis === 'yil' ? 'etkin' : ''}`}
                onClick={() => { setBakis('yil'); setAcik(null); }}>
          Çıkmış sorular · yıla göre
        </button>
        <button role="tab" aria-selected={bakis === 'konu'}
                className={`sekme ${bakis === 'konu' ? 'etkin' : ''}`}
                onClick={() => { setBakis('konu'); setAcik(null); }}>
          Soru bankası · konuya göre
        </button>
        <button role="tab" aria-selected={bakis === 'kaynak'}
                className={`sekme ${bakis === 'kaynak' ? 'etkin' : ''}`}
                onClick={() => { setBakis('kaynak'); setAcik(null); }}>
          Kaynağa göre
        </button>
      </div>

      {gruplar.length === 0 ? (
        <Kart>
          <p className="sessiz">
            {bakis === 'yil'
              ? 'Bankada yılı belli çıkmış sınav sorusu yok. Sınav kitapçıklarını içe aktarabilirsin.'
              : bakis === 'kaynak'
                ? 'Sorularda kaynak bilgisi yok.'
                : 'Bankadaki sorular henüz konulara yerleştirilmemiş. Soru Bankası ekranındaki “Otomatik sınıflandır” düğmesini kullanabilirsin.'}
          </p>
        </Kart>
      ) : (
        <div className="yigin">
          {gruplar.map((grup) => (
            <GrupKarti key={grup.anahtar} grup={grup} istatistik={istatistik}
                       acik={acik} onAc={setAcik} onCoz={coz} />
          ))}
        </div>
      )}
    </>
  );
}

/* ──────────────────────────────── gruplama ──────────────────────────────── */

function yilaGoreGrupla(sorular: Soru[]): Grup[] {
  const cikmis = sorular.filter((s) => soruTuru(s) === 'cikmis');
  const yillar = [...new Set(cikmis.map((s) => s.yil!))].sort((a, b) => b - a);

  return yillar.map((yil) => {
    const yilinSorulari = cikmis.filter((s) => s.yil === yil);
    const bolumler = [...new Set(yilinSorulari.map((s) => s.bolum ?? 'Tümü'))];
    return {
      anahtar: `yil-${yil}`,
      baslik: `${yil} Genel Yeterlik Sınavı`,
      altBaslik: `${yilinSorulari.length} soru · ${bolumler.join(' · ')}`,
      sorular: [...yilinSorulari].sort((a, b) => (a.no ?? 0) - (b.no ?? 0)),
      altGruplar: bolumler.length > 1
        ? bolumler.map((bolum) => {
            const alt = yilinSorulari.filter((s) => (s.bolum ?? 'Tümü') === bolum);
            return {
              anahtar: `yil-${yil}-${bolum}`,
              baslik: `${yil} · ${bolum}`,
              altBaslik: `${alt.length} soru`,
              sorular: [...alt].sort((a, b) => (a.no ?? 0) - (b.no ?? 0)),
            };
          })
        : undefined,
    };
  });
}

/**
 * Soruların geldiği kitapçık/kitaba göre gruplar; alt gruplar kaynağın kendi
 * bölümleridir (Marka Kılavuzu'nun "Kısım B — 5/1-c kalıpları" bölümü gibi).
 * Kaynakları soru sayısına göre değil, en çok sorusu olan üstte olacak şekilde
 * sıralar; böylece asıl çalışılan setler öne çıkar.
 */
function kaynagaGoreGrupla(sorular: Soru[]): Grup[] {
  const kaynaklar = new Map<string, Soru[]>();
  for (const soru of sorular) {
    const ad = soru.kaynak || 'Kaynağı belirtilmemiş';
    if (!kaynaklar.has(ad)) kaynaklar.set(ad, []);
    kaynaklar.get(ad)!.push(soru);
  }

  return [...kaynaklar.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([ad, liste]) => {
      const bolumler = [...new Set(liste.map((s) => s.bolum).filter((b): b is string => !!b))];
      return {
        anahtar: `kaynak-${ad}`,
        baslik: ad,
        altBaslik: `${liste.length} soru${bolumler.length > 1 ? ` · ${bolumler.length} bölüm` : ''}`,
        sorular: liste,
        altGruplar: bolumler.length > 1
          ? bolumler.map((bolum) => {
              const alt = liste.filter((s) => s.bolum === bolum);
              return {
                anahtar: `kaynak-${ad}-${bolum}`,
                baslik: bolum,
                altBaslik: `${alt.length} soru`,
                sorular: [...alt].sort((a, b) => (a.no ?? 0) - (b.no ?? 0)),
              };
            })
          : undefined,
      };
    });
}

function konuyaGoreGrupla(sorular: Soru[]): Grup[] {
  const gruplar: Grup[] = [];

  for (const alan of AREAS) {
    const alanKonulari = TOPICS.filter((t) => t.areaId === alan.id);
    const altGruplar: Grup[] = [];
    for (const konu of alanKonulari) {
      const konununSorulari = sorular.filter((s) => s.topicId === konu.id);
      if (konununSorulari.length === 0) continue;
      altGruplar.push({
        anahtar: `konu-${konu.id}`,
        baslik: konu.ad,
        altBaslik: `${konununSorulari.length} soru${konu.madde ? ` · ${konu.madde}` : ''}`,
        sorular: konununSorulari,
      });
    }
    if (altGruplar.length === 0) continue;
    gruplar.push({
      anahtar: `alan-${alan.id}`,
      baslik: alan.ad,
      altBaslik: `${altGruplar.reduce((a, g) => a + g.sorular.length, 0)} soru · ${altGruplar.length} konu`,
      sorular: altGruplar.flatMap((g) => g.sorular),
      altGruplar,
    });
  }

  const siniflandirilmamis = sorular.filter((s) => !s.topicId);
  if (siniflandirilmamis.length > 0) {
    gruplar.push({
      anahtar: 'konu-yok',
      baslik: 'Sınıflandırılmamış',
      altBaslik: `${siniflandirilmamis.length} soru · konusu atanmamış`,
      sorular: siniflandirilmamis,
    });
  }
  return gruplar;
}

/* ───────────────────────────────── kartlar ──────────────────────────────── */

function GrupKarti({
  grup, istatistik, acik, onAc, onCoz,
}: {
  grup: Grup;
  istatistik: Map<string, { deneme: number; dogru: number }>;
  acik: string | null;
  onAc: (a: string | null) => void;
  onCoz: (g: Grup) => void;
}) {
  const acikMi = acik === grup.anahtar;
  const olcum = grupOlcumu(grup.sorular, istatistik);

  return (
    <section className="kart">
      <div className="satir aralikli">
        <button className="grup-basi" onClick={() => onAc(acikMi ? null : grup.anahtar)}
                aria-expanded={acikMi}>
          <span className="grup-ok" aria-hidden="true">{acikMi ? '▾' : '▸'}</span>
          <span>
            <span className="grup-ad">{grup.baslik}</span>
            {grup.altBaslik && <span className="minik"> · {grup.altBaslik}</span>}
          </span>
        </button>
        <div className="satir">
          <span className="minik" style={{ minWidth: 110, textAlign: 'right' }}>
            {olcum.cozulen > 0
              ? `${olcum.cozulen}/${grup.sorular.length} çözüldü · ${yuzde(olcum.oran)}`
              : 'hiç çözmedin'}
          </span>
          <div style={{ width: 90 }}>
            <Cubuk oran={olcum.cozulen / Math.max(1, grup.sorular.length)} />
          </div>
          <button className="dugme kucuk birincil" onClick={() => onCoz(grup)}>Çöz</button>
        </div>
      </div>

      {acikMi && (
        <div className="yigin" style={{ marginTop: 16 }}>
          {grup.altGruplar
            ? grup.altGruplar.map((alt) => (
                <AltGrup key={alt.anahtar} grup={alt} istatistik={istatistik} onCoz={onCoz} />
              ))
            : <SoruListesi sorular={grup.sorular} istatistik={istatistik} />}
        </div>
      )}
    </section>
  );
}

function AltGrup({
  grup, istatistik, onCoz,
}: {
  grup: Grup;
  istatistik: Map<string, { deneme: number; dogru: number }>;
  onCoz: (g: Grup) => void;
}) {
  const [acik, setAcik] = useState(false);
  const olcum = grupOlcumu(grup.sorular, istatistik);

  return (
    <div className="alt-grup">
      <div className="satir aralikli">
        <button className="grup-basi" onClick={() => setAcik((a) => !a)} aria-expanded={acik}>
          <span className="grup-ok" aria-hidden="true">{acik ? '▾' : '▸'}</span>
          <span>
            <span style={{ fontWeight: 600, fontSize: '.86rem' }}>{grup.baslik}</span>
            {grup.altBaslik && <span className="minik"> · {grup.altBaslik}</span>}
          </span>
        </button>
        <div className="satir">
          <span className="minik">
            {olcum.cozulen > 0 ? `${yuzde(olcum.oran)} doğru` : '—'}
          </span>
          <button className="dugme kucuk" onClick={() => onCoz(grup)}>Çöz</button>
        </div>
      </div>
      {acik && <div style={{ marginTop: 12 }}><SoruListesi sorular={grup.sorular} istatistik={istatistik} /></div>}
    </div>
  );
}

function SoruListesi({
  sorular, istatistik,
}: {
  sorular: Soru[];
  istatistik: Map<string, { deneme: number; dogru: number }>;
}) {
  const [acikSoru, setAcikSoru] = useState<string | null>(null);
  const [limit, setLimit] = useState(25);

  return (
    <div className="yigin" style={{ gap: 8 }}>
      {sorular.slice(0, limit).map((soru) => {
        const durum = istatistik.get(soru.id);
        const acik = acikSoru === soru.id;
        return (
          <div key={soru.id}>
            <button className="soru-satir" onClick={() => setAcikSoru(acik ? null : soru.id)}
                    aria-expanded={acik}>
              <span className="soru-satir-no">
                {soru.yil ? `${soru.yil}` : 'banka'}{soru.no ? `/${soru.no}` : ''}
              </span>
              <span className="soru-satir-metin">{kisalt(soru.metin, 110)}</span>
              {soru.aciklama && <span className="rozet" title="Gerekçeli çözümü var">çözümlü</span>}
              {durum && (
                <span className={`rozet ${durum.dogru === durum.deneme ? 'dogru' : 'yanlis'}`}>
                  {durum.dogru}/{durum.deneme}
                </span>
              )}
              {soru.topicId && (
                <span className="efsane-nokta" title={TOPIC_BY_ID.get(soru.topicId)?.ad}
                      style={{ background: areaOf(soru.topicId)?.renk }} aria-hidden="true" />
              )}
            </button>
            {acik && (
              <div style={{ marginTop: 8 }}>
                <SoruKarti soru={soru} sira={1} toplam={1} secilen={null} gosterCevap onSec={() => {}} />
              </div>
            )}
          </div>
        );
      })}
      {sorular.length > limit && (
        <button className="dugme kucuk sade" onClick={() => setLimit((l) => l + 50)}>
          {sorular.length - limit} soru daha göster
        </button>
      )}
    </div>
  );
}

function grupOlcumu(
  sorular: Soru[],
  istatistik: Map<string, { deneme: number; dogru: number }>,
) {
  let cozulen = 0;
  let deneme = 0;
  let dogru = 0;
  for (const soru of sorular) {
    const g = istatistik.get(soru.id);
    if (!g) continue;
    cozulen += 1;
    deneme += g.deneme;
    dogru += g.dogru;
  }
  return { cozulen, oran: deneme ? dogru / deneme : 0 };
}
