import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Kart, BosDurum } from '../components/ui';
import { FiltrePaneli } from '../components/FiltrePaneli';
import { SeansCalistir } from '../components/SeansCalistir';
import { BOS_FILTRE, cozulebilir, filtrele, karistir, zayifOnceSec, type Filtre } from '../lib/sec';
import { konuIstatistikleri } from '../lib/stats';
import { AREAS, TOPICS } from '../data/topics';
import { areaOf } from '../data/topics';

export default function Calisma() {
  const { sorular, cevaplamalar, ayarlar } = useStore();
  const [filtre, setFiltre] = useState<Filtre>(BOS_FILTRE);
  const [adet, setAdet] = useState(20);
  const [calisiyor, setCalisiyor] = useState<{ sorular: typeof sorular; baslik: string } | null>(null);

  const konular = useMemo(() => konuIstatistikleri(sorular, cevaplamalar), [sorular, cevaplamalar]);
  const uygun = useMemo(
    () => cozulebilir(filtrele(sorular, cevaplamalar, filtre)),
    [sorular, cevaplamalar, filtre],
  );

  if (sorular.length === 0) {
    return (
      <BosDurum baslik="Soru bankası boş"
                aciklama="Konu çalışması için önce soruları içe aktarman gerekiyor."
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
        filtreOzeti={filtreOzeti(filtre)}
        onCik={() => setCalisiyor(null)}
      />
    );
  }

  const basla = () => {
    const oncelikler = new Map(konular.map((k) => [k.topicId, k.oncelik]));
    let secilen = uygun;
    if (filtre.siralama === 'zayifOnce') {
      secilen = zayifOnceSec(uygun, oncelikler, adet);
    } else if (filtre.siralama === 'sirali') {
      secilen = [...uygun].sort((a, b) => (a.yil ?? 0) - (b.yil ?? 0) || (a.no ?? 0) - (b.no ?? 0)).slice(0, adet);
    } else {
      secilen = karistir(uygun).slice(0, adet);
    }
    if (secilen.length === 0) return;
    setCalisiyor({ sorular: secilen, baslik: filtreOzeti(filtre) || 'Konu çalışması' });
  };

  // Konu kartları: her konunun banka sayısı ve hâkimiyeti
  const konuKartlari = AREAS.map((alan) => ({
    alan,
    konular: konular
      .filter((k) => k.areaId === alan.id && k.bankaSoruSayisi > 0)
      .sort((a, b) => b.oncelik - a.oncelik),
  })).filter((g) => g.konular.length > 0);

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Konu çalışması</h1>
          <p>Filtrele, soru sayısını seç ve çözmeye başla. Her sorudan sonra doğru cevabı ve gerekçesini görürsün.</p>
        </div>
      </div>

      <div className="yigin">
        <Kart baslik="Ne çalışayım?">
          <FiltrePaneli filtre={filtre} onDegis={setFiltre} sorular={sorular} />
          <div className="satir aralikli" style={{ marginTop: 6 }}>
            <div className="satir">
              <label htmlFor="adet" style={{ margin: 0 }}>Soru sayısı</label>
              <input id="adet" type="number" min={5} max={200} step={5} value={adet}
                     style={{ width: 90 }}
                     onChange={(e) => setAdet(Math.max(1, Number(e.target.value) || 1))} />
              <span className="minik">Filtreye uyan {uygun.length} soru var.</span>
            </div>
            <div className="satir">
              <button className="dugme sade" onClick={() => setFiltre(BOS_FILTRE)}>Filtreyi temizle</button>
              <button className="dugme birincil buyuk" onClick={basla} disabled={uygun.length === 0}>
                {uygun.length === 0 ? 'Uygun soru yok' : `${Math.min(adet, uygun.length)} soru çöz`}
              </button>
            </div>
          </div>
        </Kart>

        <Kart baslik="Konu listesi" not="Her konunun yanında bankadaki soru sayısı ve hâkimiyet tahminin var.">
          <div className="yigin">
            {konuKartlari.map(({ alan, konular: liste }) => (
              <div key={alan.id}>
                <div className="satir" style={{ marginBottom: 8 }}>
                  <span className="efsane-nokta" style={{ background: alan.renk, width: 10, height: 10 }} aria-hidden="true" />
                  <strong style={{ fontSize: '.88rem' }}>{alan.ad}</strong>
                  <span className="minik">{liste.reduce((a, k) => a + k.bankaSoruSayisi, 0)} soru</span>
                </div>
                <div className="izgara izgara-3">
                  {liste.map((k) => (
                    <button key={k.topicId} className="kart konu-kart"
                            onClick={() => { setFiltre({ ...BOS_FILTRE, topicId: k.topicId }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      <div className="konu-ad">{k.ad}</div>
                      <div className="satir aralikli minik">
                        <span>{k.bankaSoruSayisi} soru</span>
                        <span>{k.cozulen ? `%${Math.round(k.dogrulukOrani * 100)} doğru` : 'çözülmedi'}</span>
                      </div>
                      <div className="cubuk" style={{ marginTop: 6 }}>
                        <span style={{ width: `${k.hakimiyet * 100}%`, background: areaOf(k.topicId)?.renk }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {konuKartlari.length === 0 && (
              <p className="sessiz">
                Bankadaki sorular henüz konulara yerleştirilmemiş.
                Soru bankası ekranındaki “Otomatik sınıflandır” düğmesini kullanabilirsin.
              </p>
            )}
          </div>
        </Kart>
      </div>
    </>
  );
}

function filtreOzeti(f: Filtre): string {
  const parcalar: string[] = [];
  if (f.topicId) parcalar.push(TOPICS.find((t) => t.id === f.topicId)?.ad ?? '');
  else if (f.areaId) parcalar.push(AREAS.find((a) => a.id === f.areaId)?.ad ?? '');
  if (f.yil) parcalar.push(`${f.yil} sınavı`);
  if (f.durum === 'yanlis') parcalar.push('yanlış yaptıklarım');
  if (f.durum === 'cozulmemis') parcalar.push('hiç çözmediklerim');
  if (f.durum === 'isaretli') parcalar.push('işaretlediklerim');
  if (f.arama) parcalar.push(`“${f.arama}”`);
  return parcalar.filter(Boolean).join(' · ');
}
