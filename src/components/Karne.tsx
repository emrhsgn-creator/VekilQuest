import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { cozulebilir, yillar } from '../lib/sec';
import { sinavKarnesi, sinavSorulari, type SinavKarnesi } from '../lib/karne';
import { Cubuk, Kart, Olcut, tarihBicim } from './ui';
import type { Soru } from '../types';

function durumRozeti(k: SinavKarnesi, gecmeNotu: number) {
  if (k.cozulen === 0) return <span className="rozet">Çözülmedi</span>;
  if (!k.tamam) return <span className="rozet uyari">{k.eksik.length} soru eksik</span>;
  const gecti = k.puan >= gecmeNotu;
  return <span className={`rozet ${gecti ? 'dogru' : 'yanlis'}`}>{gecti ? 'Geçer' : 'Kalır'}</span>;
}

/**
 * Bütün çıkmış sınavların karnesi: her yıl için ne kadarını çözdüğün ve ilk
 * çözümlerine göre puanın. Eksik sorusu kalan sınav, yalnızca eksikler
 * çözülerek tamamlanabilir.
 */
export function SinavKarneleri({ onEksikCoz, onBasla }: {
  onEksikCoz: (yil: number, eksik: Soru[], toplam: number) => void;
  onBasla: (yil: number) => void;
}) {
  const { sorular, cevaplamalar, ayarlar } = useStore();
  const karneler = useMemo(() => {
    const havuz = cozulebilir(sorular);
    return yillar(havuz).map((yil) => sinavKarnesi(yil, sinavSorulari(havuz, yil), cevaplamalar));
  }, [sorular, cevaplamalar]);

  if (karneler.length === 0) return null;
  return (
    <Kart baslik="Çıkmış sınav karneleri"
          not="Her soru için ilk çözümün esas alınır; sınavı parça parça çözsen de toplam sonuç burada birleşir. Puan sınavın tüm soruları üzerinden hesaplanır, eksikler tamamlanana kadar geçicidir.">
      <div className="tablo-sarmal">
        <table>
          <thead>
            <tr>
              <th>Sınav</th>
              <th>Çözülen</th>
              <th className="sayi">Doğru</th>
              <th className="sayi">Yanlış</th>
              <th className="sayi">Boş</th>
              <th className="sayi">Puan</th>
              <th className="sayi">Durum</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {karneler.map((k) => (
              <tr key={k.yil}>
                <td><strong>{k.yil}</strong></td>
                <td style={{ minWidth: 120 }}>
                  <div className="minik">{k.cozulen} / {k.toplam}</div>
                  <Cubuk oran={k.toplam ? k.cozulen / k.toplam : 0} />
                </td>
                <td className="sayi">{k.dogru}</td>
                <td className="sayi">{k.yanlis}</td>
                <td className="sayi">{k.bos}</td>
                <td className="sayi">{k.cozulen ? k.puan.toLocaleString('tr-TR') : '–'}</td>
                <td className="sayi">{durumRozeti(k, ayarlar.gecmeNotu)}</td>
                <td className="sayi">
                  <div className="satir" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                  {k.cozulen > 0 && (
                    <Link className="dugme kucuk" to={`/karne/${k.yil}`}
                          title="Her soru için ilk çözümün, işaretlediğin şık ve doğru cevapla">
                      Sonucu gör
                    </Link>
                  )}
                  {k.cozulen > 0 && k.eksik.length > 0 && (
                    <button className="dugme birincil kucuk" type="button"
                            onClick={() => onEksikCoz(k.yil, k.eksik, k.toplam)}>
                      Eksik {k.eksik.length} soruyu çöz
                    </button>
                  )}
                  {k.cozulen === 0 && (
                    <button className="dugme kucuk" type="button" onClick={() => onBasla(k.yil)}>
                      Sınavı başlat
                    </button>
                  )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Kart>
  );
}

/**
 * Tek bir sınavın toplam sonucu — eksik sorular çözüldükten sonra sonuç
 * ekranında gösterilir: önceki çözümlerle bu oturum birleştirilir.
 */
export function SinavKarnesiKarti({ yil, buOturumdakiler }: { yil: number; buOturumdakiler: Soru[] }) {
  const { sorular, cevaplamalar, ayarlar } = useStore();
  const k = useMemo(
    () => sinavKarnesi(yil, sinavSorulari(cozulebilir(sorular), yil), cevaplamalar),
    [yil, sorular, cevaplamalar],
  );
  const yeni = new Set(buOturumdakiler.map((s) => s.id));
  const oncekiler = k.cozulen - [...k.ilkCozumler.keys()].filter((id) => yeni.has(id)).length;
  const gecti = k.puan >= ayarlar.gecmeNotu;

  return (
    <Kart baslik={`${yil} sınavının toplam sonucu`}
          not={`${oncekiler} soru önceki çözümlerinden, ${k.cozulen - oncekiler} soru bu oturumdan.`}>
      <div className="izgara izgara-4">
        <Olcut etiket="Toplam puan" deger={k.puan.toLocaleString('tr-TR')}
               alt={k.tamam ? `Geçme eşiğin ${ayarlar.gecmeNotu}` : `${k.eksik.length} soru hâlâ eksik`}
               renk={k.tamam ? (gecti ? 'var(--dogru)' : 'var(--yanlis)') : undefined} />
        <Olcut etiket="Doğru" deger={k.dogru} alt={`${k.toplam} soru üzerinden`} renk="var(--dogru)" />
        <Olcut etiket="Yanlış" deger={k.yanlis} alt={`${k.bos} boş`} renk="var(--yanlis)" />
        <Olcut etiket="Çözülen" deger={`${k.cozulen} / ${k.toplam}`}
               alt={k.sonCozum ? `Son çözüm ${tarihBicim(k.sonCozum)}` : undefined} />
      </div>
      {k.tamam && (
        <div className={`bilgi-kutusu ${gecti ? '' : 'uyari'}`} style={{ marginTop: 14 }}>
          {gecti
            ? `${yil} sınavını tamamladın: ${k.toplam} soruda ${k.dogru} doğru, puanın ${k.puan.toLocaleString('tr-TR')} — ${ayarlar.gecmeNotu} eşiğinin üzerinde.`
            : `${yil} sınavını tamamladın: ${k.toplam} soruda ${k.dogru} doğru, puanın ${k.puan.toLocaleString('tr-TR')} — ${ayarlar.gecmeNotu} eşiğinin ${(ayarlar.gecmeNotu - k.puan).toLocaleString('tr-TR')} puan altında.`}
        </div>
      )}
    </Kart>
  );
}
