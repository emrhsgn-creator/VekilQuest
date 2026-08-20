/**
 * Grafik bileşenleri — bağımlılıksız, tema duyarlı SVG.
 *
 * Renk kuralları:
 *   • Büyüklük (doğruluk oranı, soru sayısı, yoğunluk) tek hüe ramp ile.
 *   • Kimlik (hukuk alanı) doğrulanmış kategorik palet ile ve her zaman
 *     metin etiketi eşliğinde — renk tek başına anlam taşımaz.
 *   • İki farklı ölçek asla tek grafikte birleştirilmez; ayrı grafik açılır.
 */

import { useId, useState } from 'react';

export function yuzde(oran: number, basamak = 0): string {
  return `%${(oran * 100).toFixed(basamak)}`;
}

/* ------------------------------------------------------- büyüklük listesi */

export type BuyuklukSatiri = {
  id: string;
  etiket: string;
  deger: number;
  /** 0-1 arası oransal gösterim için; verilmezse deger/enBuyuk kullanılır. */
  oran?: number;
  altEtiket?: string;
  renk?: string;
  rozet?: string;
};

export function BuyuklukListesi({
  satirlar, birim = '', bosMesaj = 'Henüz veri yok.', onTikla, maksSatir,
}: {
  satirlar: BuyuklukSatiri[];
  birim?: string;
  bosMesaj?: string;
  onTikla?: (id: string) => void;
  maksSatir?: number;
}) {
  if (satirlar.length === 0) return <p className="sessiz">{bosMesaj}</p>;
  const gosterilen = maksSatir ? satirlar.slice(0, maksSatir) : satirlar;
  const enBuyuk = Math.max(...satirlar.map((s) => s.deger), 1e-9);

  return (
    <div className="buyukluk-listesi">
      {gosterilen.map((s) => {
        const oran = s.oran ?? s.deger / enBuyuk;
        const govde = (
          <>
            <div className="bl-ust">
              <span className="bl-etiket">{s.etiket}</span>
              {s.rozet && <span className="rozet">{s.rozet}</span>}
              <span className="bl-deger">
                {birim === '%' ? yuzde(s.deger) : `${Math.round(s.deger * 100) / 100}${birim}`}
              </span>
            </div>
            <div className="cubuk">
              <span style={{ width: `${Math.max(1.5, oran * 100)}%`, background: s.renk ?? 'var(--ramp-4)' }} />
            </div>
            {s.altEtiket && <div className="minik">{s.altEtiket}</div>}
          </>
        );
        return onTikla ? (
          <button key={s.id} className="bl-satir tiklanir" onClick={() => onTikla(s.id)} type="button">
            {govde}
          </button>
        ) : (
          <div key={s.id} className="bl-satir">{govde}</div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ çizgi grafik */

export function CizgiGrafik({
  noktalar, yBicim = (v: number) => String(Math.round(v)), yMaks, yukseklik = 160, baslik,
}: {
  noktalar: { etiket: string; deger: number; ipucu?: string }[];
  yBicim?: (v: number) => string;
  yMaks?: number;
  yukseklik?: number;
  baslik?: string;
}) {
  const [odak, setOdak] = useState<number | null>(null);
  const kimlik = useId();

  if (noktalar.length < 2) return <p className="sessiz">Eğilim için en az iki günlük veri gerekiyor.</p>;

  const G = { ust: 12, sag: 12, alt: 26, sol: 42 };
  const W = 640;
  const H = yukseklik;
  const ic = { g: W - G.sol - G.sag, y: H - G.ust - G.alt };
  const tavan = yMaks ?? Math.max(...noktalar.map((n) => n.deger), 1);

  const x = (i: number) => G.sol + (i / (noktalar.length - 1)) * ic.g;
  const y = (v: number) => G.ust + ic.y - (v / tavan) * ic.y;

  const cizgi = noktalar.map((n, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(n.deger).toFixed(1)}`).join(' ');
  const alan = `${cizgi} L${x(noktalar.length - 1).toFixed(1)},${G.ust + ic.y} L${G.sol},${G.ust + ic.y} Z`;
  const izgara = [0, 0.5, 1];

  return (
    <div className="grafik-sarmal">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={baslik ?? 'Çizgi grafik'} className="grafik"
           onMouseLeave={() => setOdak(null)}>
        <defs>
          <linearGradient id={`dolgu-${kimlik}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ramp-4)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--ramp-4)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {izgara.map((o) => (
          <g key={o}>
            <line x1={G.sol} x2={W - G.sag} y1={y(tavan * o)} y2={y(tavan * o)}
                  stroke="var(--kenar)" strokeWidth="1" />
            <text x={G.sol - 8} y={y(tavan * o) + 4} textAnchor="end"
                  fontSize="10" fill="var(--metin-3)">{yBicim(tavan * o)}</text>
          </g>
        ))}

        <path d={alan} fill={`url(#dolgu-${kimlik})`} />
        <path d={cizgi} fill="none" stroke="var(--ramp-4)" strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" />

        {odak !== null && (
          <>
            <line x1={x(odak)} x2={x(odak)} y1={G.ust} y2={G.ust + ic.y}
                  stroke="var(--kenar-guclu)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(odak)} cy={y(noktalar[odak].deger)} r="5"
                    fill="var(--ramp-4)" stroke="var(--yuzey)" strokeWidth="2" />
          </>
        )}

        {noktalar.map((n, i) => (
          <rect key={i} x={x(i) - ic.g / (noktalar.length - 1) / 2} y={G.ust}
                width={ic.g / (noktalar.length - 1)} height={ic.y}
                fill="transparent" onMouseEnter={() => setOdak(i)}>
            <title>{n.ipucu ?? `${n.etiket}: ${yBicim(n.deger)}`}</title>
          </rect>
        ))}

        <text x={G.sol} y={H - 8} fontSize="10" fill="var(--metin-3)">{noktalar[0].etiket}</text>
        <text x={W - G.sag} y={H - 8} fontSize="10" fill="var(--metin-3)" textAnchor="end">
          {noktalar[noktalar.length - 1].etiket}
        </text>
      </svg>
      {odak !== null && (
        <div className="grafik-ipucu">
          <strong>{noktalar[odak].etiket}</strong> · {noktalar[odak].ipucu ?? yBicim(noktalar[odak].deger)}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ sütun grafik */

export function SutunGrafik({
  sutunlar, yukseklik = 140, baslik,
}: {
  sutunlar: { etiket: string; deger: number; ipucu?: string }[];
  yukseklik?: number;
  baslik?: string;
}) {
  if (sutunlar.length === 0) return <p className="sessiz">Henüz veri yok.</p>;
  const W = 640;
  const H = yukseklik;
  const G = { ust: 10, sag: 8, alt: 22, sol: 32 };
  const ic = { g: W - G.sol - G.sag, y: H - G.ust - G.alt };
  const tavan = Math.max(...sutunlar.map((s) => s.deger), 1);
  // 2px yüzey boşluğu bırakacak şekilde sütun genişliği
  const adim = ic.g / sutunlar.length;
  const genislik = Math.max(2, adim - 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={baslik ?? 'Sütun grafik'} className="grafik">
      <line x1={G.sol} x2={W - G.sag} y1={G.ust + ic.y} y2={G.ust + ic.y} stroke="var(--kenar)" strokeWidth="1" />
      <text x={G.sol - 6} y={G.ust + 8} textAnchor="end" fontSize="10" fill="var(--metin-3)">{tavan}</text>
      {sutunlar.map((s, i) => {
        const h = (s.deger / tavan) * ic.y;
        return (
          <rect key={i} x={G.sol + i * adim + (adim - genislik) / 2} y={G.ust + ic.y - h}
                width={genislik} height={Math.max(h, s.deger > 0 ? 2 : 0)} rx="3"
                fill={s.deger > 0 ? 'var(--ramp-4)' : 'var(--yuzey-2)'}>
            <title>{s.ipucu ?? `${s.etiket}: ${s.deger}`}</title>
          </rect>
        );
      })}
      <text x={G.sol} y={H - 6} fontSize="10" fill="var(--metin-3)">{sutunlar[0].etiket}</text>
      <text x={W - G.sag} y={H - 6} fontSize="10" fill="var(--metin-3)" textAnchor="end">
        {sutunlar[sutunlar.length - 1].etiket}
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------- yığın çubuk */

/** Alan dağılımı gibi bütünün parçalarını tek satırda gösterir; efsane zorunlu. */
export function YiginCubuk({
  dilimler,
}: {
  dilimler: { id: string; etiket: string; deger: number; renk: string }[];
}) {
  const toplam = dilimler.reduce((a, d) => a + d.deger, 0);
  if (toplam === 0) return <p className="sessiz">Bankada sınıflandırılmış soru yok.</p>;
  const gorunur = dilimler.filter((d) => d.deger > 0);

  return (
    <div className="yigin-sarmal">
      <div className="yigin-cubuk" role="img" aria-label="Alan dağılımı">
        {gorunur.map((d) => (
          <span key={d.id} style={{ flex: d.deger, background: d.renk }} title={`${d.etiket}: ${d.deger}`} />
        ))}
      </div>
      <ul className="efsane">
        {gorunur.map((d) => (
          <li key={d.id}>
            <span className="efsane-nokta" style={{ background: d.renk }} aria-hidden="true" />
            <span className="efsane-ad">{d.etiket}</span>
            <span className="efsane-deger">{d.deger} · {yuzde(d.deger / toplam)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- ısı takvimi */

export function IsiTakvimi({
  gunler,
}: {
  gunler: { gun: string; tarih: number; toplam: number }[];
}) {
  const tavan = Math.max(...gunler.map((g) => g.toplam), 1);
  const basamak = (n: number) => {
    if (n === 0) return 'var(--yuzey-2)';
    const o = n / tavan;
    if (o <= 0.25) return 'var(--ramp-1)';
    if (o <= 0.5) return 'var(--ramp-2)';
    if (o <= 0.75) return 'var(--ramp-3)';
    return 'var(--ramp-4)';
  };
  return (
    <>
      <div className="isi-izgara" role="img" aria-label="Günlük çalışma yoğunluğu">
        {gunler.map((g) => (
          <div key={g.gun} className="isi-hucre" style={{ background: basamak(g.toplam) }}
               title={`${new Date(g.tarih).toLocaleDateString('tr-TR')}: ${g.toplam} soru`} />
        ))}
      </div>
      <div className="satir minik" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
        <span>az</span>
        {['var(--yuzey-2)', 'var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)', 'var(--ramp-4)'].map((r) => (
          <span key={r} className="isi-hucre" style={{ background: r, width: 11, height: 11, display: 'inline-block' }} />
        ))}
        <span>çok</span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ halka */

/** Tek bir oranı gösteren halka — doğruluk gibi başlık niteliğindeki değerler için. */
export function Halka({ oran, etiket, boyut = 108 }: { oran: number; etiket?: string; boyut?: number }) {
  const kalinlik = 9;
  const r = (boyut - kalinlik) / 2;
  const cevre = 2 * Math.PI * r;
  return (
    <div className="halka-sarmal" style={{ width: boyut }}>
      <svg width={boyut} height={boyut} viewBox={`0 0 ${boyut} ${boyut}`} role="img"
           aria-label={`${etiket ?? 'Oran'}: ${yuzde(oran)}`}>
        <circle cx={boyut / 2} cy={boyut / 2} r={r} fill="none"
                stroke="var(--yuzey-2)" strokeWidth={kalinlik} />
        <circle cx={boyut / 2} cy={boyut / 2} r={r} fill="none"
                stroke="var(--ramp-4)" strokeWidth={kalinlik} strokeLinecap="round"
                strokeDasharray={`${cevre * Math.min(1, Math.max(0, oran))} ${cevre}`}
                transform={`rotate(-90 ${boyut / 2} ${boyut / 2})`} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
              fontSize={boyut * 0.2} fontWeight="680" fill="var(--metin)">{yuzde(oran)}</text>
      </svg>
      {etiket && <div className="minik" style={{ textAlign: 'center' }}>{etiket}</div>}
    </div>
  );
}
