import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Kart } from '../components/ui';
import { SMK_MADDELER, type SmkMadde } from '../data/smk';
import { AREAS, TOPICS, TOPIC_BY_ID, areaOf } from '../data/topics';
import { normalize } from '../lib/metin';
import { konuIstatistikleri } from '../lib/stats';
import { yuzde } from '../components/Grafik';

const MEVZUAT_BAGLARI = [
  {
    ad: '6769 sayılı Sınai Mülkiyet Kanunu',
    url: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6769&MevzuatTur=1&MevzuatTertip=5',
    aciklama: 'Sınavın omurgası. Marka, coğrafi işaret, tasarım ve ortak hükümler.',
  },
  {
    ad: 'Sınai Mülkiyet Kanununun Uygulanmasına Dair Yönetmelik',
    url: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=23375&MevzuatTur=7&MevzuatTertip=5',
    aciklama: 'Süreler, şekli şartlar, başvuru unsurları ve işlem ayrıntıları.',
  },
  {
    ad: 'Patent Vekilliği ve Marka Vekilliği Sınav, Sicil ve Disiplin Yönetmeliği',
    url: 'https://www.mevzuat.gov.tr/',
    aciklama: 'Vekillik şartları, sicil, disiplin cezaları ve sınav usulü.',
  },
  {
    ad: '5000 sayılı Türk Patent ve Marka Kurumu Kuruluş Kanunu',
    url: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=5000&MevzuatTur=1&MevzuatTertip=5',
    aciklama: 'Kurumun teşkilatı, organları ve görevleri.',
  },
  {
    ad: '6102 sayılı Türk Ticaret Kanunu (m.11-63)',
    url: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6102&MevzuatTur=1&MevzuatTertip=5',
    aciklama: 'Ticari işletme, tacir, ticaret unvanı ve haksız rekabet.',
  },
  {
    ad: '6098 sayılı Türk Borçlar Kanunu (m.502-514)',
    url: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6098&MevzuatTur=1&MevzuatTertip=5',
    aciklama: 'Vekâlet sözleşmesi hükümleri.',
  },
  {
    ad: 'TÜRKPATENT — duyurular ve sınav kitapçıkları',
    url: 'https://www.turkpatent.gov.tr/duyurular',
    aciklama: 'Çıkmış soru kitapçıkları ve cevap anahtarları buradan yayımlanır.',
  },
  {
    ad: 'TÜRKPATENT Marka İnceleme Kılavuzu',
    url: 'https://www.turkpatent.gov.tr/marka',
    aciklama: 'Kurumun mutlak/nispi ret değerlendirme ölçütleri.',
  },
];

export default function Mevzuat() {
  const { sorular, cevaplamalar } = useStore();
  const [arama, setArama] = useState('');
  const [kitap, setKitap] = useState('');

  const konular = useMemo(() => konuIstatistikleri(sorular, cevaplamalar), [sorular, cevaplamalar]);
  const konuById = useMemo(() => new Map(konular.map((k) => [k.topicId, k])), [konular]);

  // Her maddeye kaç soru dokunuyor?
  const maddeSoruSayisi = useMemo(() => {
    const kova = new Map<number, number>();
    for (const s of sorular) {
      for (const no of s.smkMaddeleri ?? []) kova.set(no, (kova.get(no) ?? 0) + 1);
    }
    return kova;
  }, [sorular]);

  const kitaplar = useMemo(() => [...new Set(SMK_MADDELER.map((m) => m.kitap))], []);

  const liste = useMemo(() => {
    const a = normalize(arama);
    return SMK_MADDELER.filter((m) => {
      if (kitap && m.kitap !== kitap) return false;
      if (!a) return true;
      return normalize(`${m.no} ${m.baslik} ${m.kitap} ${m.kisim ?? ''}`).includes(a);
    });
  }, [arama, kitap]);

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Mevzuat</h1>
          <p>
            Sınav kapsamındaki 6769 sayılı SMK maddeleri ve her maddenin uygulamadaki konu karşılığı.
            Bir maddede zayıfsan, o konuya ait soruları buradan görebilirsin.
          </p>
        </div>
      </div>

      <div className="yigin">
        <Kart baslik="Kaynak mevzuat" not="Resmî metinlere doğrudan bağlantılar.">
          <div className="izgara izgara-2">
            {MEVZUAT_BAGLARI.map((m) => (
              <a key={m.ad} className="kaynak-bag" href={m.url} target="_blank" rel="noreferrer">
                <strong>{m.ad}</strong>
                <span className="minik">{m.aciklama}</span>
              </a>
            ))}
          </div>
        </Kart>

        <Kart baslik="SMK madde indeksi"
              not={`Sınav kapsamındaki ${SMK_MADDELER.length} madde. Patent ve faydalı modele ilişkin 4. Kitap (m.82-145) kapsam dışı.`}
              eylem={
                <div className="satir">
                  <input type="search" value={arama} placeholder="madde no veya başlık ara"
                         style={{ width: 200 }} onChange={(e) => setArama(e.target.value)} />
                  <select value={kitap} onChange={(e) => setKitap(e.target.value)} style={{ width: 180 }}>
                    <option value="">Tüm kitaplar</option>
                    {kitaplar.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              }>
          <div className="tablo-sarmal">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Madde</th>
                  <th>Başlık</th>
                  <th style={{ width: 230 }}>Konu</th>
                  <th className="sayi" style={{ width: 90 }}>Bankadaki soru</th>
                  <th className="sayi" style={{ width: 100 }}>Hâkimiyetin</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((m) => <MaddeSatiri key={m.no} madde={m}
                                               soruSayisi={maddeSoruSayisi.get(m.no) ?? 0}
                                               hakimiyet={m.topicId ? konuById.get(m.topicId)?.hakimiyet : undefined}
                                               cozulen={m.topicId ? konuById.get(m.topicId)?.cozulen ?? 0 : 0} />)}
              </tbody>
            </table>
          </div>
        </Kart>

        <Kart baslik="Konu – mevzuat eşleşmesi"
              not="Taksonomideki her konunun dayandığı temel düzenleme.">
          <div className="izgara izgara-2">
            {AREAS.map((alan) => (
              <div key={alan.id}>
                <div className="satir" style={{ marginBottom: 8 }}>
                  <span className="efsane-nokta" style={{ background: alan.renk, width: 10, height: 10 }} aria-hidden="true" />
                  <strong style={{ fontSize: '.85rem' }}>{alan.ad}</strong>
                </div>
                <ul className="sade-liste">
                  {TOPICS.filter((t) => t.areaId === alan.id).map((t) => (
                    <li key={t.id}>
                      <span>{t.ad}</span>
                      <span className="minik">{t.madde ?? 'Mevzuat dışı kaynak'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Kart>
      </div>
    </>
  );
}

function MaddeSatiri({
  madde, soruSayisi, hakimiyet, cozulen,
}: {
  madde: SmkMadde; soruSayisi: number; hakimiyet?: number; cozulen: number;
}) {
  const konu = madde.topicId ? TOPIC_BY_ID.get(madde.topicId) : undefined;
  return (
    <tr>
      <td className="mono">m.{madde.no}</td>
      <td>
        {madde.baslik}
        <div className="minik">{madde.kitap}{madde.kisim ? ` · ${madde.kisim}` : ''}</div>
      </td>
      <td className="minik">
        {konu ? (
          <>
            <span className="efsane-nokta" style={{ background: areaOf(madde.topicId)?.renk, display: 'inline-block', marginRight: 6 }} aria-hidden="true" />
            {konu.ad}
          </>
        ) : '—'}
      </td>
      <td className="sayi">{soruSayisi || '—'}</td>
      <td className="sayi">{cozulen > 0 && hakimiyet !== undefined ? yuzde(hakimiyet) : '—'}</td>
    </tr>
  );
}
