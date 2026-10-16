import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { DevamEdenler } from '../components/DevamEdenler';
import { SinavKarneleri } from '../components/Karne';
import { sinavSorulari } from '../lib/karne';
import { BosDurum, Kart, Olcut, sureBicim, tarihBicim } from '../components/ui';
import { SeansCalistir } from '../components/SeansCalistir';
import { BuyuklukListesi, yuzde } from '../components/Grafik';
import { konuAdi } from '../lib/stats';
import {
  cikmisSorular, cozulebilir, gercekciDenemeSec, karistir, sinavKonuDagilimi, yillar, zayifOnceSec,
} from '../lib/sec';
import { konuIstatistikleri } from '../lib/stats';
import type { Soru } from '../types';

type Kaynak = 'gercek-sinav' | 'karisik' | 'zayif';

export default function Deneme() {
  const { sorular, cevaplamalar, seanslar, ayarlar } = useStore();
  const [kaynak, setKaynak] = useState<Kaynak>('karisik');
  const [yil, setYil] = useState<string>('');
  const [soruSayisi, setSoruSayisi] = useState(ayarlar.denemeSoruSayisi);
  const [sureDk, setSureDk] = useState(ayarlar.denemeSuresiDk);
  const [aktif, setAktif] = useState<{
    sorular: Soru[]; baslik: string; sureSn: number; karneYili?: number;
  } | null>(null);

  const havuz = useMemo(() => cozulebilir(sorular), [sorular]);
  const mevcutYillar = useMemo(() => yillar(havuz), [havuz]);
  const konular = useMemo(() => konuIstatistikleri(sorular, cevaplamalar), [sorular, cevaplamalar]);

  // Gerçek sınavın konu dağılımı: çıkmış soruların sayımı. Tahmin değil, ölçüm.
  const dagilim = useMemo(() => sinavKonuDagilimi(sorular), [sorular]);

  const gecmisDenemeler = useMemo(() => {
    const seansCevaplari = new Map<string, { toplam: number; dogru: number; sure: number }>();
    for (const c of cevaplamalar) {
      const g = seansCevaplari.get(c.seansId) ?? { toplam: 0, dogru: 0, sure: 0 };
      g.toplam += 1;
      if (c.dogru) g.dogru += 1;
      g.sure += c.sure;
      seansCevaplari.set(c.seansId, g);
    }
    return seanslar
      .filter((s) => s.mod === 'deneme' && s.bitis)
      .map((s) => ({ seans: s, ...(seansCevaplari.get(s.id) ?? { toplam: 0, dogru: 0, sure: 0 }) }))
      .sort((a, b) => b.seans.baslangic - a.seans.baslangic);
  }, [seanslar, cevaplamalar]);

  if (havuz.length === 0) {
    return (
      <BosDurum baslik="Deneme için cevaplı soru gerekiyor"
                aciklama="Bankada cevabı belirlenmiş soru bulunmuyor. Kitapçığı cevap anahtarıyla birlikte içe aktarırsan deneme çözebilirsin."
                eylemYazi="İçe aktar" eylemYol="/ice-aktar" />
    );
  }

  if (aktif) {
    return (
      <SeansCalistir
        sorular={aktif.sorular}
        mod="deneme"
        baslik={aktif.baslik}
        sureSiniriSn={aktif.sureSn}
        karneYili={aktif.karneYili}
        anindaGeriBildirim={false}
        onCik={() => setAktif(null)}
      />
    );
  }

  const yilHavuzu = yil ? havuz.filter((s) => String(s.yil) === yil) : havuz;

  const basla = () => {
    let secilen: Soru[];
    let baslik: string;
    if (kaynak === 'gercek-sinav' && yil) {
      // Gerçek sınav: soruları kitapçıktaki sırasıyla, tamamı (bölümlü
      // kitapçıklarda önce bölüm, sonra numara).
      secilen = sinavSorulari(havuz, Number(yil));
      baslik = `${yil} Marka Vekilliği Sınavı`;
    } else if (kaynak === 'zayif') {
      const oncelikler = new Map(konular.map((k) => [k.topicId, k.oncelik]));
      secilen = zayifOnceSec(havuz, oncelikler, soruSayisi);
      baslik = 'Zayıf konu ağırlıklı deneme';
    } else {
      // Karışık deneme, gerçek sınavın konu dağılımını taklit eder: saf
      // rastgele seçim bankanın dağılımını yansıtır, sınavınkini değil.
      secilen = dagilim.size > 0
        ? gercekciDenemeSec(yilHavuzu, dagilim, soruSayisi)
        : karistir(yilHavuzu).slice(0, soruSayisi);
      baslik = yil ? `${yil} soruları · karışık deneme` : 'Karışık deneme';
    }
    if (secilen.length > 0) setAktif({ sorular: secilen, baslik, sureSn: sureDk * 60 });
  };

  // Karne tablosundan: bir sınavın yalnızca hiç çözülmemiş soruları. Süre,
  // ayarlanan deneme süresinden soru sayısına orantılı (en az üç dakika).
  const eksikleriCoz = (sinavYili: number, eksik: Soru[], toplam: number) => {
    setAktif({
      sorular: eksik,
      baslik: `${sinavYili} sınavı · eksik ${eksik.length} soru`,
      sureSn: Math.max(180, Math.ceil((sureDk * 60 * eksik.length) / Math.max(1, toplam))),
      karneYili: sinavYili,
    });
  };
  const sinaviBaslat = (sinavYili: number) => {
    setAktif({
      sorular: sinavSorulari(havuz, sinavYili),
      baslik: `${sinavYili} Marka Vekilliği Sınavı`,
      sureSn: sureDk * 60,
    });
  };

  const secilecekSayi = kaynak === 'gercek-sinav' && yil ? yilHavuzu.length : Math.min(soruSayisi, yilHavuzu.length);

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Deneme sınavı</h1>
          <p>
            Gerçek sınav koşulları: geri bildirim yok, süre işliyor, soru paletiyle ileri geri gezinebilirsin.
            Sonuçlar ancak sınav bitince açılır.
          </p>
        </div>
      </div>
      <DevamEdenler modlar={['deneme']} />
      <SinavKarneleri onEksikCoz={eksikleriCoz} onBasla={sinaviBaslat} />

      <div className="yigin">
        <Kart baslik="Deneme kur">
          <div className="alan">
            <label>Soru kaynağı</label>
            <div className="satir">
              {([
                ['gercek-sinav', 'Gerçek sınav (bir yılın tamamı)'],
                ['karisik', 'Karışık deneme (sınav dağılımıyla)'],
                ['zayif', 'Zayıf konu ağırlıklı'],
              ] as [Kaynak, string][]).map(([deger, etiket]) => (
                <button key={deger} type="button"
                        className={`dugme ${kaynak === deger ? 'birincil' : ''}`}
                        onClick={() => setKaynak(deger)}>
                  {etiket}
                </button>
              ))}
            </div>
          </div>

          <div className="alan-satir">
            {kaynak !== 'zayif' && (
              <div>
                <label htmlFor="d-yil">Sınav yılı</label>
                <select id="d-yil" value={yil} onChange={(e) => setYil(e.target.value)}>
                  <option value="">{kaynak === 'gercek-sinav' ? 'Yıl seç' : 'Tüm yıllar'}</option>
                  {mevcutYillar.map((y) => (
                    <option key={y} value={String(y)}>
                      {y} ({havuz.filter((s) => s.yil === y).length} soru)
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!(kaynak === 'gercek-sinav' && yil) && (
              <div>
                <label htmlFor="d-adet">Soru sayısı</label>
                <input id="d-adet" type="number" min={5} max={200} step={5} value={soruSayisi}
                       onChange={(e) => setSoruSayisi(Math.max(1, Number(e.target.value) || 1))} />
              </div>
            )}
            <div>
              <label htmlFor="d-sure">Süre (dakika)</label>
              <input id="d-sure" type="number" min={5} max={300} step={5} value={sureDk}
                     onChange={(e) => setSureDk(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          {kaynak === 'gercek-sinav' && !yil && (
            <div className="bilgi-kutusu uyari">Gerçek sınav modunda bir yıl seçmelisin.</div>
          )}

          {kaynak === 'karisik' && dagilim.size > 0 && (
            <div className="bilgi-kutusu" style={{ marginTop: 14 }}>
              Sorular rastgele değil, <strong>çıkmış sınavların konu dağılımına göre</strong>
              {' '}seçilir. Her konuya sınavdaki payı kadar yer ayrılır; bir konuda yeterli soru
              yoksa açık kalan kontenjan havuzdan tamamlanır.
            </div>
          )}
          {kaynak === 'karisik' && dagilim.size === 0 && (
            <div className="bilgi-kutusu uyari" style={{ marginTop: 14 }}>
              Bankada yılı belli çıkmış sınav sorusu yok; dağılım hesaplanamıyor, sorular
              rastgele seçilecek.
            </div>
          )}

          <div className="satir aralikli" style={{ marginTop: 14 }}>
            <span className="minik">
              {secilecekSayi} soru · {sureDk} dakika · soru başına {Math.round((sureDk * 60) / Math.max(1, secilecekSayi))} saniye
            </span>
            <button className="dugme birincil buyuk" onClick={basla}
                    disabled={secilecekSayi === 0 || (kaynak === 'gercek-sinav' && !yil)}>
              Sınavı başlat
            </button>
          </div>
        </Kart>

        {kaynak === 'karisik' && dagilim.size > 0 && (
          <Kart baslik="Sınavın konu dağılımı"
                not={`${cikmisSorular(sorular).length} çıkmış sorunun sayımı. Denemedeki soru sayıları bu oranlara göre paylaştırılır.`}>
            <BuyuklukListesi
              maksSatir={10}
              birim=" soru"
              satirlar={[...dagilim]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([topicId, oran]) => ({
                  id: topicId,
                  etiket: konuAdi(topicId),
                  deger: Math.round(oran * soruSayisi * 10) / 10,
                  altEtiket: `Sınavın %${(oran * 100).toFixed(1)}'i`,
                }))}
            />
            <p className="minik" style={{ marginTop: 12, marginBottom: 0 }}>
              Çubuk uzunluğu = {soruSayisi} soruluk bir denemede o konudan beklenen soru sayısı.
            </p>
          </Kart>
        )}

        {gecmisDenemeler.length > 0 && (
          <>
            <div className="izgara izgara-3">
              <Olcut etiket="Çözülen deneme" deger={gecmisDenemeler.length} />
              <Olcut etiket="Son deneme"
                     deger={yuzde(gecmisDenemeler[0].toplam ? gecmisDenemeler[0].dogru / gecmisDenemeler[0].toplam : 0)}
                     alt={tarihBicim(gecmisDenemeler[0].seans.baslangic)} />
              <Olcut etiket="Deneme ortalaması"
                     deger={yuzde(
                       gecmisDenemeler.reduce((a, d) => a + (d.toplam ? d.dogru / d.toplam : 0), 0) / gecmisDenemeler.length,
                     )}
                     alt={`Geçme eşiğin: ${ayarlar.gecmeNotu}`} />
            </div>

            <Kart baslik="Deneme geçmişi">
              <div className="tablo-sarmal">
                <table>
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Deneme</th>
                      <th className="sayi">Soru</th>
                      <th className="sayi">Doğru</th>
                      <th className="sayi">Başarı</th>
                      <th className="sayi">Süre</th>
                      <th className="sayi">Durum</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {gecmisDenemeler.map((d) => {
                      const oran = d.toplam ? d.dogru / d.toplam : 0;
                      const gecti = oran * 100 >= ayarlar.gecmeNotu;
                      return (
                        <tr key={d.seans.id}>
                          <td>{tarihBicim(d.seans.baslangic)}</td>
                          <td>{d.seans.baslik}</td>
                          <td className="sayi">{d.toplam}</td>
                          <td className="sayi">{d.dogru}</td>
                          <td className="sayi">{yuzde(oran)}</td>
                          <td className="sayi">{sureBicim(d.sure)}</td>
                          <td className="sayi">
                            <span className={`rozet ${gecti ? 'dogru' : 'yanlis'}`}>{gecti ? 'Geçer' : 'Kalır'}</span>
                          </td>
                          <td className="sayi">
                            <Link className="dugme kucuk" to={`/sonuc/${d.seans.id}`}>Sonucu gör</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Kart>
          </>
        )}
      </div>
    </>
  );
}
