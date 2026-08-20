import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { BosDurum, Kart, Olcut, sureBicim } from '../components/ui';
import { BuyuklukListesi, CizgiGrafik, Halka, YiginCubuk, yuzde } from '../components/Grafik';
import {
  alanIstatistikleri, genelIstatistik, gunlukSeri, inatciSorular,
  konuAdi, konuIstatistikleri, yilBazliPerformans, type KonuIstatistigi,
} from '../lib/stats';
import { AREAS, areaOf } from '../data/topics';
import { kisalt, trSirala } from '../lib/metin';

type Sekme = 'genel' | 'konu' | 'agirlik' | 'zaman' | 'hata';

export default function Analiz() {
  const { sorular, cevaplamalar } = useStore();
  const [sekme, setSekme] = useState<Sekme>('genel');

  const genel = useMemo(() => genelIstatistik(sorular, cevaplamalar), [sorular, cevaplamalar]);
  const konular = useMemo(() => konuIstatistikleri(sorular, cevaplamalar), [sorular, cevaplamalar]);
  const alanlar = useMemo(() => alanIstatistikleri(konular), [konular]);

  if (sorular.length === 0) {
    return (
      <BosDurum baslik="Analiz için veri yok"
                aciklama="Soru bankasını doldurup birkaç soru çözdüğünde konu bazlı analiz burada oluşur."
                eylemYazi="İçe aktar" eylemYol="/ice-aktar" />
    );
  }

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Analiz</h1>
          <p>
            Hangi konuda eksiğin var, hangisi sınavda çok çıkıyor ve zaman içinde nereye gidiyorsun —
            hepsi tek yerde.
          </p>
        </div>
      </div>

      <div className="sekmeler" role="tablist">
        {([
          ['genel', 'Genel bakış'],
          ['konu', 'Konu bazlı eksikler'],
          ['agirlik', 'Sınav ağırlığı'],
          ['zaman', 'Zaman ve yıl'],
          ['hata', 'Hata analizi'],
        ] as [Sekme, string][]).map(([id, ad]) => (
          <button key={id} role="tab" aria-selected={sekme === id}
                  className={`sekme ${sekme === id ? 'etkin' : ''}`}
                  onClick={() => setSekme(id)}>{ad}</button>
        ))}
      </div>

      {sekme === 'genel' && <GenelBakis genel={genel} konular={konular} alanlar={alanlar} />}
      {sekme === 'konu' && <KonuBazli konular={konular} />}
      {sekme === 'agirlik' && <SinavAgirligi konular={konular} alanlar={alanlar} />}
      {sekme === 'zaman' && <ZamanVeYil />}
      {sekme === 'hata' && <HataAnalizi />}
    </>
  );
}

/* ------------------------------------------------------------ genel bakış */

function GenelBakis({
  genel, konular, alanlar,
}: {
  genel: ReturnType<typeof genelIstatistik>;
  konular: KonuIstatistigi[];
  alanlar: ReturnType<typeof alanIstatistikleri>;
}) {
  const oncelikli = [...konular].filter((k) => k.bankaSoruSayisi > 0)
    .sort((a, b) => b.oncelik - a.oncelik).slice(0, 5);
  const guclu = [...konular].filter((k) => k.cozulen >= 5)
    .sort((a, b) => b.hakimiyet - a.hakimiyet).slice(0, 5);

  const kapsam = konular.filter((k) => k.cozulen > 0).length;
  const toplamKonu = konular.filter((k) => k.bankaSoruSayisi > 0).length;

  return (
    <div className="yigin">
      <div className="izgara izgara-4">
        <div className="kart" style={{ display: 'grid', placeItems: 'center' }}>
          <Halka oran={genel.dogrulukOrani} etiket="Genel doğruluk" />
        </div>
        <Olcut etiket="Çözülen soru" deger={genel.toplamCevaplama}
               alt={`${genel.cevaplananBenzersiz} farklı soru`} />
        <Olcut etiket="Konu kapsamı" deger={`${kapsam} / ${toplamKonu}`}
               alt="dokunduğun konu sayısı" />
        <Olcut etiket="Soru başı süre" deger={sureBicim(genel.ortalamaSure)}
               alt={`Toplam ${sureBicim(genel.ortalamaSure * genel.toplamCevaplama)}`} />
      </div>

      <div className="izgara izgara-2">
        <Kart baslik="Şu an en öncelikli 5 konu"
              not="Öncelik = sınav ağırlığı × eksiklik.">
          <BuyuklukListesi
            birim="%"
            satirlar={oncelikli.map((k) => ({
              id: k.topicId,
              etiket: k.ad,
              deger: k.hakimiyet,
              altEtiket: `${areaOf(k.topicId)?.kisa ?? ''} · ${k.cozulen
                ? `${k.dogru}/${k.cozulen} doğru`
                : 'hiç çözmedin'} · bankada ${k.bankaSoruSayisi} soru`,
              rozet: k.cozulen === 0 ? 'yeni' : undefined,
            }))}
          />
          <p className="minik" style={{ marginTop: 12, marginBottom: 0 }}>
            Çubuk = hâkimiyet tahmini (0 = hiç bilmiyorsun, 100 = oturmuş).
            Az veriyle tahmin %50'ye yakın durur; çözdükçe keskinleşir.
          </p>
        </Kart>

        <Kart baslik="Oturmuş konular" not="En az 5 soru çözdüğün, hâkimiyeti yüksek konular.">
          {guclu.length === 0 ? (
            <p className="sessiz">Henüz hiçbir konuda 5 soru çözmedin.</p>
          ) : (
            <BuyuklukListesi
              birim="%"
              satirlar={guclu.map((k) => ({
                id: k.topicId,
                etiket: k.ad,
                deger: k.hakimiyet,
                altEtiket: `${areaOf(k.topicId)?.kisa ?? ''} · ${k.dogru}/${k.cozulen} doğru`,
              }))}
            />
          )}
        </Kart>
      </div>

      <Kart baslik="Hukuk alanlarına göre durum">
        <div className="tablo-sarmal">
          <table>
            <thead>
              <tr>
                <th>Alan</th>
                <th className="sayi">Bankadaki soru</th>
                <th className="sayi">Çözdüğün</th>
                <th className="sayi">Doğruluk</th>
                <th className="sayi">Hâkimiyet</th>
              </tr>
            </thead>
            <tbody>
              {alanlar.map((a) => (
                <tr key={a.alan.id}>
                  <td>
                    <span className="efsane-nokta" style={{ background: a.alan.renk, display: 'inline-block', marginRight: 7 }} aria-hidden="true" />
                    {a.alan.ad}
                  </td>
                  <td className="sayi">{a.bankaSoruSayisi}</td>
                  <td className="sayi">{a.cozulen}</td>
                  <td className="sayi">{a.cozulen ? yuzde(a.dogrulukOrani) : '—'}</td>
                  <td className="sayi">{yuzde(a.hakimiyet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kart>
    </div>
  );
}

/* -------------------------------------------------------- konu bazlı liste */

function KonuBazli({ konular }: { konular: KonuIstatistigi[] }) {
  const [sirala, setSirala] = useState<'oncelik' | 'hakimiyet' | 'cozulen' | 'ad'>('oncelik');
  const [alanFiltre, setAlanFiltre] = useState('');

  const liste = useMemo(() => {
    let l = konular.filter((k) => k.bankaSoruSayisi > 0 || k.cozulen > 0);
    if (alanFiltre) l = l.filter((k) => k.areaId === alanFiltre);
    const siralayici = {
      oncelik: (a: KonuIstatistigi, b: KonuIstatistigi) => b.oncelik - a.oncelik,
      hakimiyet: (a: KonuIstatistigi, b: KonuIstatistigi) => a.hakimiyet - b.hakimiyet,
      cozulen: (a: KonuIstatistigi, b: KonuIstatistigi) => b.cozulen - a.cozulen,
      ad: (a: KonuIstatistigi, b: KonuIstatistigi) => trSirala(a.ad, b.ad),
    }[sirala];
    return [...l].sort(siralayici);
  }, [konular, sirala, alanFiltre]);

  return (
    <div className="yigin">
      <Kart baslik="Konu bazlı değerlendirme"
            not="Hâkimiyet, yakın tarihli cevaplara daha çok ağırlık verir; eski başarılar zamanla solar."
            eylem={
              <div className="satir">
                <select value={alanFiltre} onChange={(e) => setAlanFiltre(e.target.value)} style={{ width: 180 }}>
                  <option value="">Tüm alanlar</option>
                  {AREAS.map((a) => <option key={a.id} value={a.id}>{a.ad}</option>)}
                </select>
                <select value={sirala} onChange={(e) => setSirala(e.target.value as typeof sirala)} style={{ width: 150 }}>
                  <option value="oncelik">Önceliğe göre</option>
                  <option value="hakimiyet">En zayıf önce</option>
                  <option value="cozulen">En çok çözülen</option>
                  <option value="ad">Alfabetik</option>
                </select>
              </div>
            }>
        <div className="tablo-sarmal">
          <table>
            <thead>
              <tr>
                <th>Konu</th>
                <th className="sayi">Banka</th>
                <th className="sayi">Çözülen</th>
                <th className="sayi">D / Y / B</th>
                <th className="sayi">Doğruluk</th>
                <th className="sayi">Hâkimiyet</th>
                <th className="sayi">Süre</th>
                <th className="sayi">Öncelik</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liste.map((k) => (
                <tr key={k.topicId}>
                  <td>
                    <span className="efsane-nokta" style={{ background: areaOf(k.topicId)?.renk, display: 'inline-block', marginRight: 7 }} aria-hidden="true" />
                    {k.ad}
                    {k.veriGucu < 0.35 && k.cozulen > 0 && (
                      <span className="rozet" style={{ marginLeft: 6 }} title="Bu konuda az soru çözdün, tahmin kesin değil">az veri</span>
                    )}
                  </td>
                  <td className="sayi">{k.bankaSoruSayisi}</td>
                  <td className="sayi">{k.cozulen}</td>
                  <td className="sayi">{k.dogru} / {k.yanlis} / {k.bos}</td>
                  <td className="sayi">{k.cozulen ? yuzde(k.dogrulukOrani) : '—'}</td>
                  <td className="sayi">{yuzde(k.hakimiyet)}</td>
                  <td className="sayi">{k.cozulen ? sureBicim(k.ortalamaSure) : '—'}</td>
                  <td className="sayi">
                    <span className={`rozet ${k.oncelik > 0.66 ? 'yanlis' : k.oncelik > 0.33 ? 'uyari' : ''}`}>
                      {k.oncelik > 0.66 ? 'yüksek' : k.oncelik > 0.33 ? 'orta' : 'düşük'}
                    </span>
                  </td>
                  <td className="sayi">
                    <Link className="dugme kucuk" to="/calisma">Çalış</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kart>
    </div>
  );
}

/* -------------------------------------------------------- sınav ağırlıkları */

function SinavAgirligi({
  konular, alanlar,
}: {
  konular: KonuIstatistigi[];
  alanlar: ReturnType<typeof alanIstatistikleri>;
}) {
  const dagilim = alanlar
    .map((a) => ({ id: a.alan.id, etiket: a.alan.ad, deger: a.bankaSoruSayisi, renk: a.alan.renk }))
    .sort((a, b) => b.deger - a.deger);

  const enCok = [...konular].sort((a, b) => b.bankaSoruSayisi - a.bankaSoruSayisi)
    .filter((k) => k.bankaSoruSayisi > 0).slice(0, 15);

  const toplam = konular.reduce((a, k) => a + k.bankaSoruSayisi, 0);

  return (
    <div className="yigin">
      <div className="bilgi-kutusu">
        Bu sekme, <strong>yüklediğin gerçek sınav sorularının</strong> konu dağılımını gösterir.
        Banka büyüdükçe uygulamanın “sınav ağırlığı” tahmini de bu dağılıma yaklaşır; küçükken
        taksonomideki başlangıç tahminine yaslanır. Şu an bankada {toplam} sınıflandırılmış soru var.
      </div>

      <Kart baslik="Alanlara göre soru dağılımı" not="Bankadaki tüm soruların hukuk alanlarına dağılımı.">
        <YiginCubuk dilimler={dagilim} />
      </Kart>

      <div className="izgara izgara-2">
        <Kart baslik="En çok soru çıkan konular" not="Bankadaki soru sayısına göre ilk 15 konu.">
          <BuyuklukListesi
            satirlar={enCok.map((k) => ({
              id: k.topicId,
              etiket: k.ad,
              deger: k.bankaSoruSayisi,
              altEtiket: `${areaOf(k.topicId)?.kisa ?? ''} · bankanın %${((k.bankaSoruSayisi / Math.max(1, toplam)) * 100).toFixed(1)}'i`,
            }))}
            birim=" soru"
          />
        </Kart>

        <Kart baslik="Ağırlık – hâkimiyet uyumsuzluğu"
              not="Sınavda çok çıkan ama senin zayıf olduğun konular. Buradaki her satır doğrudan puan kaybı demek.">
          <BuyuklukListesi
            birim="%"
            bosMesaj="Yeterli veri toplandığında burası dolacak."
            satirlar={[...konular]
              .filter((k) => k.bankaSoruSayisi >= 3)
              .sort((a, b) => b.oncelik - a.oncelik)
              .slice(0, 10)
              .map((k) => ({
                id: k.topicId,
                etiket: k.ad,
                deger: k.oncelik,
                altEtiket: `Hâkimiyet ${yuzde(k.hakimiyet)} · bankada ${k.bankaSoruSayisi} soru`,
                renk: 'var(--seri-8)',
              }))}
          />
        </Kart>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- zaman ve yıllar */

function ZamanVeYil() {
  const { sorular, cevaplamalar } = useStore();
  const [pencere, setPencere] = useState(60);

  const seri = useMemo(() => gunlukSeri(cevaplamalar, pencere), [cevaplamalar, pencere]);
  const yillar = useMemo(() => yilBazliPerformans(sorular, cevaplamalar), [sorular, cevaplamalar]);
  const dolu = seri.filter((g) => g.toplam > 0);

  // Kümülatif doğruluk: gürültüyü azaltıp gerçek eğilimi gösterir.
  const kumulatif = useMemo(() => {
    let toplam = 0;
    let dogru = 0;
    return dolu.map((g) => {
      toplam += g.toplam;
      dogru += g.dogru;
      return {
        etiket: new Date(g.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
        deger: dogru / toplam,
        ipucu: `Kümülatif: ${dogru}/${toplam} · ${yuzde(dogru / toplam)}`,
      };
    });
  }, [dolu]);

  return (
    <div className="yigin">
      <Kart baslik="Doğruluk eğilimi"
            not="Günlük oran dalgalıdır; kümülatif eğri asıl yönü gösterir."
            eylem={
              <select value={pencere} onChange={(e) => setPencere(Number(e.target.value))} style={{ width: 130 }}>
                <option value={30}>Son 30 gün</option>
                <option value={60}>Son 60 gün</option>
                <option value={90}>Son 90 gün</option>
              </select>
            }>
        <CizgiGrafik baslik="Kümülatif doğruluk oranı" yMaks={1} yBicim={yuzde} noktalar={kumulatif} />
      </Kart>

      <div className="izgara izgara-2">
        <Kart baslik="Günlük doğruluk" not="Yalnızca soru çözdüğün günler.">
          <CizgiGrafik
            baslik="Günlük doğruluk"
            yMaks={1}
            yBicim={yuzde}
            noktalar={dolu.map((g) => ({
              etiket: new Date(g.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
              deger: g.oran,
              ipucu: `${g.dogru}/${g.toplam} doğru`,
            }))}
          />
        </Kart>

        <Kart baslik="Sınav yılına göre performans"
              not="Bir yılın soruları belirgin şekilde düşükse o yılın konu vurgusuna bakmakta fayda var.">
          {yillar.length === 0 ? (
            <p className="sessiz">Sorularda yıl bilgisi yok ya da henüz çözmedin.</p>
          ) : (
            <BuyuklukListesi
              birim="%"
              satirlar={yillar.map((y) => ({
                id: String(y.yil),
                etiket: `${y.yil} sınavı`,
                deger: y.oran,
                altEtiket: `${y.dogru}/${y.toplam} doğru`,
              }))}
            />
          )}
        </Kart>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- hata analizi */

function HataAnalizi() {
  const { sorular, cevaplamalar } = useStore();

  const inatcilar = useMemo(() => inatciSorular(sorular, cevaplamalar, 2), [sorular, cevaplamalar]);

  // Boş bırakma eğilimi: hangi konularda cevap veremiyorsun?
  const bosEgilimi = useMemo(() => {
    const soruTopic = new Map(sorular.map((s) => [s.id, s.topicId]));
    const kova = new Map<string, { toplam: number; bos: number }>();
    for (const c of cevaplamalar) {
      const t = soruTopic.get(c.soruId);
      if (!t) continue;
      const g = kova.get(t) ?? { toplam: 0, bos: 0 };
      g.toplam += 1;
      if (c.secilen === null) g.bos += 1;
      kova.set(t, g);
    }
    return [...kova.entries()]
      .filter(([, g]) => g.bos > 0)
      .map(([t, g]) => ({ topicId: t, ...g, oran: g.bos / g.toplam }))
      .sort((a, b) => b.oran - a.oran)
      .slice(0, 8);
  }, [sorular, cevaplamalar]);

  // Yavaş konular: zaman yönetimi sorunu nerede?
  const yavaslar = useMemo(() => {
    const konular = konuIstatistikleri(sorular, cevaplamalar)
      .filter((k) => k.cozulen >= 3)
      .sort((a, b) => b.ortalamaSure - a.ortalamaSure)
      .slice(0, 8);
    return konular;
  }, [sorular, cevaplamalar]);

  if (cevaplamalar.length === 0) {
    return <p className="sessiz">Hata analizi için önce soru çözmen gerekiyor.</p>;
  }

  return (
    <div className="yigin">
      <div className="izgara izgara-2">
        <Kart baslik="Israrla yanlış yaptığın sorular"
              not="Aynı soruyu tekrar tekrar kaçırıyorsan, altındaki kuralı yanlış öğrenmiş olabilirsin.">
          {inatcilar.length === 0 ? (
            <p className="sessiz">Aynı soruyu iki kez kaçırdığın olmamış.</p>
          ) : (
            <ul className="sade-liste">
              {inatcilar.slice(0, 10).map((x) => (
                <li key={x.soru.id}>
                  <span>{kisalt(x.soru.metin, 100)}</span>
                  <span className="minik">
                    {konuAdi(x.soru.topicId)} · {x.yanlis}/{x.deneme} kez yanlış · doğru cevap {x.soru.cevap}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Kart>

        <Kart baslik="Boş bırakma eğilimi"
              not="Boş bırakmak, yanlış yapmaktan farklı bir eksiktir: konuyu hiç tanımıyorsun demektir.">
          {bosEgilimi.length === 0 ? (
            <p className="sessiz">Hiç soru boş bırakmamışsın.</p>
          ) : (
            <BuyuklukListesi
              birim="%"
              satirlar={bosEgilimi.map((b) => ({
                id: b.topicId,
                etiket: konuAdi(b.topicId),
                deger: b.oran,
                altEtiket: `${areaOf(b.topicId)?.kisa ?? ''} · ${b.bos}/${b.toplam} soru boş`,
              }))}
            />
          )}
        </Kart>
      </div>

      <Kart baslik="Zaman yönetimi" not="Soru başına en çok vakit harcadığın konular. Sınavda süre burada erir.">
        <BuyuklukListesi
          satirlar={yavaslar.map((k) => ({
            id: k.topicId,
            etiket: k.ad,
            deger: Math.round(k.ortalamaSure / 1000),
            altEtiket: `${areaOf(k.topicId)?.kisa ?? ''} · ${k.cozulen} soru · ${yuzde(k.dogrulukOrani)} doğru`,
          }))}
          birim=" sn"
          bosMesaj="Süre analizi için konu başına en az 3 soru çözmelisin."
        />
      </Kart>
    </div>
  );
}
