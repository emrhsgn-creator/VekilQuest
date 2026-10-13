import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Kart, sayacBicim } from './ui';
import type { Mod } from '../types';

const MOD_ADI: Record<Mod, string> = { deneme: 'Deneme', calisma: 'Çalışma', tekrar: 'Tekrar' };

/**
 * Yarım bırakılmış seansların listesi. Duraklatılan ya da sayfadan çıkılan
 * her seans burada görünür; "Devam et" kaldığı sorudan, kalan süresiyle açar.
 */
export function DevamEdenler({ modlar }: { modlar?: Mod[] }) {
  const { devamEdenler, devamSil } = useStore();
  const liste = devamEdenler.filter((k) => !modlar || modlar.includes(k.mod));
  if (liste.length === 0) return null;

  return (
    <Kart baslik="Yarım kalan oturumlar" not="Kaldığın sorudan, kalan süren korunarak devam edersin.">
      <div className="yigin">
        {liste.map((k) => {
          const cevaplanan = Object.values(k.kayitlar).filter((c) => c.secilen !== null).length;
          return (
            <div key={k.seansId} className="devam-satir">
              <div className="devam-bilgi">
                <strong>{k.baslik}</strong>
                <span className="minik">
                  {MOD_ADI[k.mod]} · {cevaplanan}/{k.soruIdleri.length} cevaplandı · {k.indeks + 1}. soruda
                  {k.kalanSn !== undefined ? ` · kalan süre ${sayacBicim(k.kalanSn)}` : ''}
                  {' · '}{new Date(k.guncelleme).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <div className="satir">
                <Link className="dugme birincil kucuk" to={`/devam/${k.seansId}`}>▶ Devam et</Link>
                <button className="dugme sade kucuk" type="button"
                        onClick={() => {
                          if (window.confirm(`"${k.baslik}" oturumu silinsin mi? Bu oturumdaki işaretlemelerin kaybolur.`)) {
                            devamSil(k.seansId);
                          }
                        }}>
                  Sil
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Kart>
  );
}
