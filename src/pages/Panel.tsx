import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { Kart, Olcut, BosDurum, Cubuk, tarihBicim } from '../components/ui';
import { BuyuklukListesi, CizgiGrafik, IsiTakvimi, SutunGrafik, yuzde } from '../components/Grafik';
import {
  genelIstatistik, gunlukSeri, konuIstatistikleri,
} from '../lib/stats';
import { vadesiGelenler } from '../lib/srs';
import { areaOf } from '../data/topics';

export default function Panel() {
  const { sorular, cevaplamalar, ayarlar, tekrarKartlari } = useStore();

  const genel = useMemo(() => genelIstatistik(sorular, cevaplamalar), [sorular, cevaplamalar]);
  const konular = useMemo(() => konuIstatistikleri(sorular, cevaplamalar), [sorular, cevaplamalar]);
  const seri = useMemo(() => gunlukSeri(cevaplamalar, 30), [cevaplamalar]);
  const vadeSayisi = useMemo(() => {
    const mevcut = new Set(sorular.map((s) => s.id));
    return vadesiGelenler(tekrarKartlari).filter((k) => mevcut.has(k.soruId)).length;
  }, [tekrarKartlari, sorular]);

  const kalanGun = ayarlar.sinavTarihi
    ? Math.ceil((new Date(ayarlar.sinavTarihi).getTime() - Date.now()) / 86_400_000)
    : null;

  if (sorular.length === 0) {
    return (
      <>
        <div className="sayfa-basi">
          <div>
            <h1>Panel</h1>
            <p>Marka vekilliği sınavına hazırlık için soru çöz, konu bazlı eksiklerini gör.</p>
          </div>
        </div>
        <BosDurum
          baslik="Önce soru bankasını doldur"
          aciklama="Uygulamayla gelen soru bankası yüklenemedi. İçe aktarma ekranından yeniden deneyebilir, kendi PDF'lerini ayrıştırabilir ya da JSON yedeği yükleyebilirsin."
          eylemYazi="İçe aktarma ekranını aç"
          eylemYol="/ice-aktar"
        />
      </>
    );
  }

  const enZayif = [...konular]
    .filter((k) => k.bankaSoruSayisi > 0)
    .sort((a, b) => b.oncelik - a.oncelik)
    .slice(0, 6)
    .map((k) => ({
      id: k.topicId,
      etiket: k.ad,
      deger: k.hakimiyet,
      altEtiket: `${areaOf(k.topicId)?.kisa ?? ''} · ${k.cozulen
        ? `${k.dogru}/${k.cozulen} doğru`
        : 'hiç çözmedin'} · bankada ${k.bankaSoruSayisi} soru`,
      rozet: k.cozulen === 0 ? 'yeni' : undefined,
    }));

  const gunlukIlerleme = Math.min(1, genel.bugunCozulen / Math.max(1, ayarlar.gunlukHedef));

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Panel</h1>
          <p>
            {kalanGun !== null
              ? `Sınava ${kalanGun > 0 ? `${kalanGun} gün` : 'geçmiş bir tarih'} kaldı (${tarihBicim(new Date(ayarlar.sinavTarihi!).getTime())}).`
              : 'Ayarlardan sınav tarihini girersen kalan gün ve çalışma planı hesaplanır.'}
          </p>
        </div>
        <div className="satir">
          <Link className="dugme" to="/calisma">Konu çalış</Link>
          <Link className="dugme birincil" to="/deneme">Deneme başlat</Link>
        </div>
      </div>

      <div className="yigin">
        <div className="izgara izgara-4">
          <Olcut etiket="Bankadaki soru" deger={genel.bankaToplam}
                 alt={`${genel.cevaplananBenzersiz} tanesini çözdün`} />
          <Olcut etiket="Genel doğruluk" deger={yuzde(genel.dogrulukOrani)}
                 alt={`${genel.dogru} doğru · ${genel.yanlis} yanlış · ${genel.bos} boş`} />
          <Olcut etiket="Bugün" deger={`${genel.bugunCozulen} / ${ayarlar.gunlukHedef}`}
                 alt={<Cubuk oran={gunlukIlerleme} />} />
          <Olcut etiket="Çalışma serisi" deger={`${genel.serisi} gün`}
                 alt={vadeSayisi > 0 ? `${vadeSayisi} soru tekrara hazır` : 'Tekrar kuyruğu boş'} />
        </div>

        {vadeSayisi > 0 && (
          <div className="bilgi-kutusu">
            Aralıklı tekrar kuyruğunda <strong>{vadeSayisi} soru</strong> var. Unutma eğrisine göre
            şimdi tekrar edersen kalıcılığı en yüksek. <Link to="/tekrar">Tekrara başla →</Link>
          </div>
        )}

        <div className="izgara izgara-2">
          <Kart baslik="Öncelikli konular"
                not="Sınav ağırlığı yüksek, hâkimiyetin düşük olan konular."
                eylem={<Link className="dugme kucuk" to="/analiz">Tümü</Link>}>
            <BuyuklukListesi satirlar={enZayif} birim="%"
                             bosMesaj="Konu analizi için önce birkaç soru çöz." />
            <p className="minik" style={{ marginTop: 12, marginBottom: 0 }}>
              Çubuk uzunluğu = hâkimiyet tahmini. Kısa çubuk, öncelikli konu demek.
            </p>
          </Kart>

          <Kart baslik="Son 30 gün" not="Günlük çözülen soru sayısı.">
            <SutunGrafik
              sutunlar={seri.map((g) => ({
                etiket: new Date(g.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                deger: g.toplam,
                ipucu: `${new Date(g.tarih).toLocaleDateString('tr-TR')}: ${g.toplam} soru${g.toplam ? ` · ${yuzde(g.oran)} doğru` : ''}`,
              }))}
            />
            <div style={{ marginTop: 16 }}>
              <IsiTakvimi gunler={seri} />
            </div>
          </Kart>
        </div>

        <Kart baslik="Doğruluk eğilimi" not="Soru çözdüğün günlerin doğruluk oranı.">
          <CizgiGrafik
            baslik="Günlük doğruluk oranı"
            yMaks={1}
            yBicim={(v) => yuzde(v)}
            noktalar={seri
              .filter((g) => g.toplam > 0)
              .map((g) => ({
                etiket: new Date(g.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
                deger: g.oran,
                ipucu: `${g.dogru}/${g.toplam} doğru · ${yuzde(g.oran)}`,
              }))}
          />
        </Kart>
      </div>
    </>
  );
}
