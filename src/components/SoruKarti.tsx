import { useEffect, useState } from 'react';
import type { Soru } from '../types';
import { TOPIC_BY_ID, areaOf } from '../data/topics';
import { SMK_BY_NO } from '../data/smk';
import { satirlaraAyir } from '../lib/bicim.mjs';

export type SoruDurumu = {
  secilen: string | null;
  gosterCevap: boolean;
};

export function SoruKarti({
  soru, sira, toplam, secilen, gosterCevap, onSec, onIsaretle, isaretli,
}: {
  soru: Soru;
  sira: number;
  toplam: number;
  secilen: string | null;
  gosterCevap: boolean;
  onSec: (harf: string) => void;
  onIsaretle?: () => void;
  isaretli?: boolean;
}) {
  const konu = soru.topicId ? TOPIC_BY_ID.get(soru.topicId) : undefined;
  const alan = areaOf(soru.topicId);
  const dogruMu = secilen !== null && secilen === soru.cevap;

  // Klavye ile A-E seçimi
  useEffect(() => {
    const dinleyici = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const hedef = e.target as HTMLElement | null;
      if (hedef && ['INPUT', 'TEXTAREA', 'SELECT'].includes(hedef.tagName)) return;
      const harf = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E'].includes(harf) && soru.secenekler.some((o) => o.harf === harf)) {
        onSec(harf);
      }
    };
    window.addEventListener('keydown', dinleyici);
    return () => window.removeEventListener('keydown', dinleyici);
  }, [onSec, soru]);

  return (
    <article className="kart">
      <div className="soru-ust">
        <span className="rozet vurgu">{sira} / {toplam}</span>
        {soru.yil && <span className="rozet">{soru.yil}{soru.kitapcik ? ` · ${soru.kitapcik}` : ''}{soru.no ? ` · ${soru.no}. soru` : ''}</span>}
        {konu && (
          <span className="rozet" title={alan?.ad}>
            <span className="efsane-nokta" style={{ background: alan?.renk }} aria-hidden="true" />
            {konu.ad}
          </span>
        )}
        {soru.iptal && <span className="rozet uyari">İptal edilmiş soru</span>}
        <span className="buyur" />
        {onIsaretle && (
          <button className={`dugme kucuk ${isaretli ? '' : 'sade'}`} onClick={onIsaretle}
                  title="Sonra tekrar bakmak için işaretle">
            {isaretli ? '★ İşaretli' : '☆ İşaretle'}
          </button>
        )}
      </div>

      {soru.gorsel ? <SoruGorseli soru={soru} /> : <SoruMetni metin={soru.metin} />}

      <div className="secenekler">
        {soru.secenekler.map((secenek) => {
          const bu = secenek.harf;
          let sinif = 'secenek';
          if (gosterCevap) {
            if (bu === soru.cevap) sinif += ' dogru';
            else if (bu === secilen) sinif += ' yanlis';
          } else if (bu === secilen) {
            sinif += ' secili';
          }
          return (
            <button key={bu} className={sinif} onClick={() => onSec(bu)} disabled={gosterCevap} type="button">
              <span className="harf">{bu}</span>
              <span>
                {secenek.metin || (soru.gorsel
                  ? <span className="sessiz">Görsel şık — yukarıdaki kitapçık görüntüsünde</span>
                  : null)}
              </span>
            </button>
          );
        })}
      </div>

      {gosterCevap && (
        <div className={`geri-bildirim ${dogruMu ? 'dogru' : 'yanlis'}`}>
          <strong>
            {secilen === null ? 'Boş bıraktın.' : dogruMu ? 'Doğru.' : 'Yanlış.'}
            {' '}Doğru cevap: {soru.cevap}
          </strong>
          {soru.aciklama && <p style={{ margin: '6px 0 0' }}>{soru.aciklama}</p>}
          <MevzuatAtiflari soru={soru} />
        </div>
      )}
    </article>
  );
}

/**
 * Soru gövdesi. Öncüller ("1. … 2. …", "I. … II. …", "a) … b) …") asılı
 * girintili ayrı satırlar olarak, soru cümlesi ayrı paragraf olarak basılır.
 */
export function SoruMetni({ metin }: { metin: string }) {
  return (
    <div className="soru-govde">
      {satirlaraAyir(metin).map((satir, i) => {
        if (satir.tur === 'bosluk') return <div key={i} className="soru-ara" aria-hidden="true" />;
        if (satir.tur === 'oncul') {
          return (
            <div key={i} className="oncul">
              <span className="oncul-isaret">{satir.isaret}</span>
              <span>{satir.metin}</span>
            </div>
          );
        }
        return <p key={i}>{satir.metin}</p>;
      })}
    </div>
  );
}

/**
 * Tablo, amblem, tasarım görseli gibi metne dökülemeyen içerik taşıyan
 * sorular kitapçıktaki hâliyle gösterilir. PDF'ten çıkan metin bu sorularda
 * eksik ya da karışık olduğu için ikinci planda, istenirse açılır.
 */
function SoruGorseli({ soru }: { soru: Soru }) {
  const [metinAcik, setMetinAcik] = useState(false);
  const [hata, setHata] = useState(false);
  useEffect(() => { setMetinAcik(false); setHata(false); }, [soru.id]);

  if (hata) return <SoruMetni metin={soru.metin} />;
  return (
    <div className="soru-gorsel-kutu">
      <figure className="soru-gorsel">
        <img
          src={`${import.meta.env.BASE_URL}${soru.gorsel}`}
          alt={`${soru.no ? `${soru.no}. ` : ''}sorunun kitapçıktaki hâli: ${soru.metin.slice(0, 160)}`}
          onError={() => setHata(true)}
          decoding="async"
        />
      </figure>
      <button type="button" className="dugme kucuk sade" onClick={() => setMetinAcik((a) => !a)}
              aria-expanded={metinAcik}>
        {metinAcik ? 'Metni gizle' : 'Metin olarak göster'}
      </button>
      {metinAcik && <SoruMetni metin={soru.metin} />}
    </div>
  );
}

function MevzuatAtiflari({ soru }: { soru: Soru }) {
  const maddeler = soru.smkMaddeleri ?? [];
  if (maddeler.length === 0 && !soru.atiflar?.length) return null;
  return (
    <div className="satir minik" style={{ marginTop: 8 }}>
      <span>İlgili mevzuat:</span>
      {maddeler.map((no) => (
        <span key={no} className="rozet" title={SMK_BY_NO.get(no)?.baslik}>
          SMK m.{no}
        </span>
      ))}
      {soru.atiflar?.map((a) => <span key={a} className="rozet">{a}</span>)}
    </div>
  );
}

/** Sınav modunda soru numaralarını gösteren gezinme paleti. */
export function SoruPaleti({
  toplam, aktif, cevaplananlar, isaretliler, onGit,
}: {
  toplam: number;
  aktif: number;
  cevaplananlar: Set<number>;
  isaretliler: Set<number>;
  onGit: (i: number) => void;
}) {
  return (
    <div className="palet">
      {Array.from({ length: toplam }, (_, i) => (
        <button key={i} type="button" onClick={() => onGit(i)}
                className={[
                  cevaplananlar.has(i) ? 'cevaplandi' : '',
                  isaretliler.has(i) ? 'isaretli' : '',
                  i === aktif ? 'aktif' : '',
                ].filter(Boolean).join(' ')}
                aria-label={`${i + 1}. soruya git`}>
          {i + 1}
        </button>
      ))}
    </div>
  );
}

export function useSoruDurumlari(soruIdleri: string[]) {
  const [durumlar, setDurumlar] = useState<Record<string, SoruDurumu>>({});
  useEffect(() => { setDurumlar({}); }, [soruIdleri.join('|')]);
  return [durumlar, setDurumlar] as const;
}
