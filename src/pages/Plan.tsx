import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Kart, Olcut, Cubuk, tarihBicim } from '../components/ui';
import { BuyuklukListesi, yuzde } from '../components/Grafik';
import { calismaPlani, genelIstatistik, gunlukSeri, konuIstatistikleri } from '../lib/stats';
import { areaOf } from '../data/topics';
import { vadesiGelenler } from '../lib/srs';

export default function Plan() {
  const { sorular, cevaplamalar, ayarlar, ayarlariGuncelle, tekrarKartlari } = useStore();

  const konular = useMemo(() => konuIstatistikleri(sorular, cevaplamalar), [sorular, cevaplamalar]);
  const genel = useMemo(() => genelIstatistik(sorular, cevaplamalar), [sorular, cevaplamalar]);
  const seri = useMemo(() => gunlukSeri(cevaplamalar, 14), [cevaplamalar]);

  const sinavTarihi = ayarlar.sinavTarihi ? new Date(ayarlar.sinavTarihi) : null;
  const plan = useMemo(
    () => (sinavTarihi ? calismaPlani(konular, ayarlar.gunlukHedef, sinavTarihi) : null),
    [konular, ayarlar.gunlukHedef, ayarlar.sinavTarihi],
  );

  const cozulmemis = useMemo(() => {
    const cozulen = new Set(cevaplamalar.map((c) => c.soruId));
    return sorular.filter((s) => s.cevap && !s.iptal && !cozulen.has(s.id)).length;
  }, [sorular, cevaplamalar]);

  const vadeSayisi = vadesiGelenler(tekrarKartlari).length;
  const sonIkiHaftaOrtalama = seri.reduce((a, g) => a + g.toplam, 0) / 14;

  // Mevcut tempoyla bankayı bitirmek kaç gün sürer?
  const bitirmeGunu = sonIkiHaftaOrtalama > 0 ? Math.ceil(cozulmemis / sonIkiHaftaOrtalama) : null;

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Çalışma planı</h1>
          <p>Sınav tarihini gir; kalan günlere öncelikli konuları dağıtan bir program üretilsin.</p>
        </div>
      </div>

      <div className="yigin">
        <Kart baslik="Hedefler">
          <div className="alan-satir">
            <div>
              <label htmlFor="p-tarih">Sınav tarihi</label>
              <input id="p-tarih" type="date" value={ayarlar.sinavTarihi ?? ''}
                     onChange={(e) => ayarlariGuncelle({ sinavTarihi: e.target.value || undefined })} />
            </div>
            <div>
              <label htmlFor="p-hedef">Günlük soru hedefi</label>
              <input id="p-hedef" type="number" min={5} max={300} step={5} value={ayarlar.gunlukHedef}
                     onChange={(e) => ayarlariGuncelle({ gunlukHedef: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div>
              <label htmlFor="p-gecme">Hedeflediğin başarı (%)</label>
              <input id="p-gecme" type="number" min={0} max={100} step={5} value={ayarlar.gecmeNotu}
                     onChange={(e) => ayarlariGuncelle({ gecmeNotu: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </div>
          </div>
        </Kart>

        <div className="izgara izgara-4">
          <Olcut etiket="Sınava kalan"
                 deger={plan ? `${plan.kalanGun} gün` : '—'}
                 alt={sinavTarihi ? tarihBicim(sinavTarihi.getTime()) : 'Tarih girilmedi'} />
          <Olcut etiket="Bugünkü ilerleme" deger={`${genel.bugunCozulen} / ${ayarlar.gunlukHedef}`}
                 alt={<Cubuk oran={genel.bugunCozulen / Math.max(1, ayarlar.gunlukHedef)} />} />
          <Olcut etiket="Hiç çözmediğin soru" deger={cozulmemis}
                 alt={bitirmeGunu !== null ? `Bu tempoyla ~${bitirmeGunu} gün` : 'Tempo verisi yok'} />
          <Olcut etiket="Son 14 gün ortalaması" deger={`${sonIkiHaftaOrtalama.toFixed(1)} soru/gün`}
                 alt={`Genel doğruluk ${yuzde(genel.dogrulukOrani)}`} />
        </div>

        {sinavTarihi && plan && plan.kalanGun > 0 && (
          <>
            <TempoUyarisi kalanGun={plan.kalanGun} cozulmemis={cozulmemis}
                          gunlukHedef={ayarlar.gunlukHedef} tempo={sonIkiHaftaOrtalama} />

            <Kart baslik="Önümüzdeki 14 gün"
                  not="Her gün, o an en öncelikli konulardan üçü. Öncelikler çözdükçe güncellenir; plan da kendini yeniler.">
              <div className="tablo-sarmal">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 130 }}>Gün</th>
                      <th>Odak konular</th>
                      <th className="sayi" style={{ width: 90 }}>Hedef</th>
                      <th style={{ width: 80 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.gunler.slice(0, 14).map((g, i) => (
                      <tr key={g.tarih}>
                        <td>
                          <strong>{i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : new Date(g.tarih).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                        </td>
                        <td>
                          <div className="satir" style={{ gap: 6 }}>
                            {g.konular.map((k) => (
                              <span key={k.topicId} className="rozet">
                                <span className="efsane-nokta" style={{ background: areaOf(k.topicId)?.renk }} aria-hidden="true" />
                                {k.ad}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="sayi">{g.konular.reduce((a, k) => a + k.soruSayisi, 0)} soru</td>
                        <td><Link className="dugme kucuk" to="/calisma">Başla</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Kart>
          </>
        )}

        {!sinavTarihi && (
          <div className="bilgi-kutusu">
            Sınav tarihini girdiğinde burada günlük program, tempo uyarısı ve kalan süre hesabı görünecek.
          </div>
        )}

        <div className="izgara izgara-2">
          <Kart baslik="Bu hafta odaklanılacak konular"
                not="Öncelik sırasına göre ilk sekiz konu.">
            <BuyuklukListesi
              birim="%"
              satirlar={[...konular]
                .filter((k) => k.bankaSoruSayisi > 0)
                .sort((a, b) => b.oncelik - a.oncelik)
                .slice(0, 8)
                .map((k) => ({
                  id: k.topicId,
                  etiket: k.ad,
                  deger: k.hakimiyet,
                  altEtiket: `${areaOf(k.topicId)?.kisa ?? ''} · bankada ${k.bankaSoruSayisi} soru · ${k.cozulen} tanesini çözdün`,
                }))}
              bosMesaj="Soru bankası dolunca öneriler burada çıkacak."
            />
          </Kart>

          <Kart baslik="Sınav yaklaşırken">
            <ul className="sade-liste">
              <li>
                <span><strong>Tekrar kuyruğu</strong></span>
                <span className="minik">
                  {vadeSayisi > 0
                    ? `${vadeSayisi} soru bugün tekrar edilmeyi bekliyor. Yeni soru çözmeden önce bunları bitir.`
                    : 'Bugün için tekrar yok. Yeni konulara geçebilirsin.'}
                </span>
              </li>
              <li>
                <span><strong>Deneme sıklığı</strong></span>
                <span className="minik">
                  Son 30 günde çözdüğün deneme sayısını artır: gerçek sınav temposunu ancak
                  süreli deneme çözerek yakalarsın.
                </span>
              </li>
              <li>
                <span><strong>Zaman yönetimi</strong></span>
                <span className="minik">
                  Analiz &gt; Hata analizi sekmesindeki “zaman yönetimi” listesi, sınavda süreni
                  en çok yiyen konuları gösterir.
                </span>
              </li>
              <li>
                <span><strong>Son hafta</strong></span>
                <span className="minik">
                  Yeni konu açma. Yanlışlarını, işaretlediklerini ve tekrar kuyruğunu döngüye al.
                </span>
              </li>
            </ul>
          </Kart>
        </div>
      </div>
    </>
  );
}

function TempoUyarisi({
  kalanGun, cozulmemis, gunlukHedef, tempo,
}: {
  kalanGun: number; cozulmemis: number; gunlukHedef: number; tempo: number;
}) {
  const gerekenTempo = cozulmemis / Math.max(1, kalanGun);
  const yetisir = tempo >= gerekenTempo;

  if (cozulmemis === 0) {
    return <div className="bilgi-kutusu">Bankadaki tüm soruları en az bir kez çözdün. Bundan sonrası tekrar ve deneme.</div>;
  }

  return (
    <div className={`bilgi-kutusu ${yetisir ? '' : 'uyari'}`}>
      Kalan {kalanGun} günde {cozulmemis} soruyu bitirmek için günde <strong>{Math.ceil(gerekenTempo)} soru</strong> çözmen gerekiyor.
      {' '}Son iki haftalık tempon günde {tempo.toFixed(1)} soru.
      {yetisir
        ? ' Bu tempoyla yetişiyorsun.'
        : ` Günlük hedefini ${gunlukHedef}'ten ${Math.ceil(gerekenTempo)}'e çıkarman ya da bankayı önceliğe göre daraltman gerekiyor.`}
    </div>
  );
}
