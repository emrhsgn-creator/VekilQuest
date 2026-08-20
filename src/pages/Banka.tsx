import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { BosDurum, Kart, Kip } from '../components/ui';
import { FiltrePaneli } from '../components/FiltrePaneli';
import { BOS_FILTRE, filtrele, type Filtre } from '../lib/sec';
import { TOPICS, TOPIC_BY_ID, areaOf, kapsamDisiMi } from '../data/topics';
import { kisalt } from '../lib/metin';
import { siniflandir } from '../lib/classify';
import type { Soru } from '../types';

export default function Banka() {
  const { tumSorular: sorular, cevaplamalar, soruGuncelle, soruSil, soruEkle, tumSorulariSiniflandir } = useStore();
  const [filtre, setFiltre] = useState<Filtre>(BOS_FILTRE);
  const [duzenlenen, setDuzenlenen] = useState<Soru | null>(null);
  const [bilgi, setBilgi] = useState('');
  const [sayfa, setSayfa] = useState(0);
  const SAYFA_BOYU = 50;

  const liste = useMemo(
    () => filtrele(sorular, cevaplamalar, filtre).sort(
      (a, b) => (b.yil ?? 0) - (a.yil ?? 0) || (a.no ?? 0) - (b.no ?? 0),
    ),
    [sorular, cevaplamalar, filtre],
  );
  const gorunen = liste.slice(sayfa * SAYFA_BOYU, (sayfa + 1) * SAYFA_BOYU);

  const kapsamDisi = sorular.filter((s) => kapsamDisiMi(s.topicId));
  const siniflandirilmamis = sorular.filter((s) => !s.topicId).length;
  const dusukGuven = sorular.filter((s) => s.topicId && (s.topicGuven ?? 1) < 0.4).length;
  const cevapsiz = sorular.filter((s) => !s.cevap && !s.iptal).length;

  const disaAktar = () => {
    const veri = { surum: 1, disaAktarma: Date.now(), sorular };
    const bag = URL.createObjectURL(new Blob([JSON.stringify(veri, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = bag;
    a.download = `vekilquest-soru-bankasi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(bag);
  };

  const yeniSoru = () => {
    setDuzenlenen({
      id: `el-${Date.now().toString(36)}`,
      kaynak: 'Elle eklendi',
      metin: '',
      secenekler: ['A', 'B', 'C', 'D', 'E'].map((h) => ({ harf: h, metin: '' })),
      cevap: '',
      eklenme: Date.now(),
    });
  };

  if (sorular.length === 0) {
    return (
      <BosDurum baslik="Soru bankası boş"
                aciklama="Sınav kitapçıklarını içe aktarabilir ya da elle soru ekleyebilirsin."
                eylemYazi="İçe aktar" eylemYol="/ice-aktar">
        <button className="dugme" style={{ marginLeft: 8 }} onClick={yeniSoru}>Elle soru ekle</button>
        {duzenlenen && (
          <SoruDuzenle soru={duzenlenen} yeniMi onKapat={() => setDuzenlenen(null)}
                       onKaydet={(s) => { soruEkle([s]); setDuzenlenen(null); }} />
        )}
      </BosDurum>
    );
  }

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Soru bankası</h1>
          <p>{sorular.length} soru · {new Set(sorular.map((s) => s.yil).filter(Boolean)).size} farklı sınav yılı</p>
        </div>
        <div className="satir">
          <button className="dugme" onClick={yeniSoru}>Soru ekle</button>
          <button className="dugme" onClick={disaAktar}>JSON olarak dışa aktar</button>
        </div>
      </div>

      <div className="yigin">
        {(siniflandirilmamis > 0 || cevapsiz > 0 || dusukGuven > 0) && (
          <div className="bilgi-kutusu uyari">
            <div className="satir aralikli">
              <span>
                {siniflandirilmamis > 0 && <><strong>{siniflandirilmamis}</strong> soru henüz bir konuya bağlı değil. </>}
                {dusukGuven > 0 && <><strong>{dusukGuven}</strong> sorunun konu ataması düşük güvenli. </>}
                {cevapsiz > 0 && <><strong>{cevapsiz}</strong> sorunun doğru cevabı girilmemiş — bunlar sınavda çıkmaz.</>}
              </span>
              {(siniflandirilmamis > 0 || dusukGuven > 0) && (
                <button className="dugme kucuk" onClick={() => {
                  const n = tumSorulariSiniflandir();
                  setBilgi(`${n} soru yeniden sınıflandırıldı.`);
                }}>
                  Otomatik sınıflandır
                </button>
              )}
            </div>
          </div>
        )}

        {kapsamDisi.length > 0 && (
          <div className="bilgi-kutusu uyari">
            <div className="satir aralikli">
              <span>
                Bankada marka vekilliği kapsamı dışında <strong>{kapsamDisi.length} patent sorusu</strong> var.
                Bunlar çalışma ve analiz ekranlarında zaten görünmüyor; tamamen kaldırabilirsin.
              </span>
              <button className="dugme kucuk tehlike" onClick={() => {
                soruSil(kapsamDisi.map((s) => s.id));
                setBilgi(`${kapsamDisi.length} patent sorusu bankadan silindi.`);
              }}>
                Patent sorularını sil
              </button>
            </div>
          </div>
        )}

        {bilgi && <div className="bilgi-kutusu">{bilgi}</div>}

        <Kart baslik="Filtrele">
          <FiltrePaneli filtre={filtre} onDegis={(f) => { setFiltre(f); setSayfa(0); }}
                        sorular={sorular} siralamaGoster={false} />
          <div className="satir aralikli">
            <span className="minik">{liste.length} soru listeleniyor.</span>
            <button className="dugme sade kucuk" onClick={() => { setFiltre(BOS_FILTRE); setSayfa(0); }}>
              Filtreyi temizle
            </button>
          </div>
        </Kart>

        <Kart baslik="Sorular">
          <div className="tablo-sarmal">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Sınav</th>
                  <th>Soru</th>
                  <th style={{ width: 200 }}>Konu</th>
                  <th className="sayi" style={{ width: 70 }}>Cevap</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {gorunen.map((s) => (
                  <tr key={s.id}>
                    <td className="minik">
                      {s.yil ?? '—'}{s.kitapcik ? `/${s.kitapcik}` : ''}
                      {s.no ? <div>{s.no}. soru</div> : null}
                    </td>
                    <td>
                      {kisalt(s.metin, 130)}
                      {s.iptal && <span className="rozet uyari" style={{ marginLeft: 6 }}>iptal</span>}
                      {s.etiketler?.includes('işaretli') && <span className="rozet" style={{ marginLeft: 6 }}>★</span>}
                    </td>
                    <td className="minik">
                      {s.topicId ? (
                        <>
                          <span className="efsane-nokta" style={{ background: areaOf(s.topicId)?.renk, display: 'inline-block', marginRight: 6 }} aria-hidden="true" />
                          {TOPIC_BY_ID.get(s.topicId)?.ad}
                          {(s.topicGuven ?? 1) < 0.4 && <span className="rozet uyari" style={{ marginLeft: 6 }}>?</span>}
                        </>
                      ) : <span className="rozet uyari">atanmadı</span>}
                    </td>
                    <td className="sayi">
                      {s.cevap ? <strong>{s.cevap}</strong> : <span className="rozet uyari">yok</span>}
                    </td>
                    <td className="sayi">
                      <button className="dugme kucuk" onClick={() => setDuzenlenen(s)}>Düzenle</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {liste.length > SAYFA_BOYU && (
            <div className="satir aralikli" style={{ marginTop: 14 }}>
              <button className="dugme kucuk" disabled={sayfa === 0} onClick={() => setSayfa((s) => s - 1)}>← Önceki</button>
              <span className="minik">
                {sayfa * SAYFA_BOYU + 1}–{Math.min((sayfa + 1) * SAYFA_BOYU, liste.length)} / {liste.length}
              </span>
              <button className="dugme kucuk" disabled={(sayfa + 1) * SAYFA_BOYU >= liste.length}
                      onClick={() => setSayfa((s) => s + 1)}>Sonraki →</button>
            </div>
          )}
        </Kart>
      </div>

      {duzenlenen && (
        <SoruDuzenle
          soru={duzenlenen}
          yeniMi={!sorular.some((s) => s.id === duzenlenen.id)}
          onKapat={() => setDuzenlenen(null)}
          onKaydet={(s) => {
            if (sorular.some((m) => m.id === s.id)) soruGuncelle(s.id, s);
            else soruEkle([s]);
            setDuzenlenen(null);
          }}
          onSil={() => { soruSil([duzenlenen.id]); setDuzenlenen(null); }}
        />
      )}
    </>
  );
}

function SoruDuzenle({
  soru, yeniMi, onKapat, onKaydet, onSil,
}: {
  soru: Soru;
  yeniMi: boolean;
  onKapat: () => void;
  onKaydet: (s: Soru) => void;
  onSil?: () => void;
}) {
  const [taslak, setTaslak] = useState<Soru>(soru);
  const oneri = useMemo(
    () => siniflandir(taslak.metin, taslak.secenekler.map((o) => o.metin)),
    [taslak.metin, taslak.secenekler],
  );

  const secenekDegis = (harf: string, metin: string) => {
    setTaslak((t) => ({ ...t, secenekler: t.secenekler.map((o) => (o.harf === harf ? { ...o, metin } : o)) }));
  };

  return (
    <Kip baslik={yeniMi ? 'Yeni soru' : 'Soruyu düzenle'} onKapat={onKapat}>
      <div className="alan">
        <label htmlFor="d-metin">Soru metni</label>
        <textarea id="d-metin" rows={4} value={taslak.metin}
                  onChange={(e) => setTaslak({ ...taslak, metin: e.target.value })} />
      </div>

      <div className="alan">
        <label>Seçenekler</label>
        <div className="yigin" style={{ gap: 7 }}>
          {taslak.secenekler.map((o) => (
            <div key={o.harf} className="satir" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <button type="button"
                      className={`dugme kucuk ${taslak.cevap === o.harf ? 'birincil' : ''}`}
                      style={{ minWidth: 38 }}
                      title="Doğru cevap olarak işaretle"
                      onClick={() => setTaslak({ ...taslak, cevap: o.harf })}>
                {o.harf}
              </button>
              <input type="text" value={o.metin} placeholder={`${o.harf} seçeneği`}
                     onChange={(e) => secenekDegis(o.harf, e.target.value)} />
            </div>
          ))}
        </div>
        <p className="minik" style={{ marginTop: 6 }}>
          Doğru cevabı harfine tıklayarak işaretle. Şu anki cevap: {taslak.cevap || '—'}
        </p>
      </div>

      <div className="alan">
        <label htmlFor="d-konu">Konu</label>
        <select id="d-konu" value={taslak.topicId ?? ''}
                onChange={(e) => setTaslak({ ...taslak, topicId: e.target.value || undefined, topicGuven: 1 })}>
          <option value="">Atanmadı</option>
          {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
        </select>
        {oneri.topicId && oneri.topicId !== taslak.topicId && (
          <p className="minik" style={{ marginTop: 6 }}>
            Öneri: <button className="dugme kucuk"
                           onClick={() => setTaslak({ ...taslak, topicId: oneri.topicId, topicGuven: oneri.guven })}>
              {TOPIC_BY_ID.get(oneri.topicId)?.ad}
            </button> (güven %{Math.round(oneri.guven * 100)})
          </p>
        )}
      </div>

      <div className="alan">
        <label htmlFor="d-aciklama">Açıklama / gerekçe (isteğe bağlı)</label>
        <textarea id="d-aciklama" rows={3} value={taslak.aciklama ?? ''}
                  placeholder="Doğru cevabın dayandığı madde ve kısa gerekçe."
                  onChange={(e) => setTaslak({ ...taslak, aciklama: e.target.value })} />
      </div>

      <div className="alan-satir">
        <div>
          <label htmlFor="d-yil">Yıl</label>
          <input id="d-yil" type="number" value={taslak.yil ?? ''}
                 onChange={(e) => setTaslak({ ...taslak, yil: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <label htmlFor="d-no">Soru no</label>
          <input id="d-no" type="number" value={taslak.no ?? ''}
                 onChange={(e) => setTaslak({ ...taslak, no: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
        <div>
          <label htmlFor="d-kaynak">Kaynak</label>
          <input id="d-kaynak" type="text" value={taslak.kaynak}
                 onChange={(e) => setTaslak({ ...taslak, kaynak: e.target.value })} />
        </div>
      </div>

      <label className="satir" style={{ gap: 8, fontWeight: 500 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={!!taslak.iptal}
               onChange={(e) => setTaslak({ ...taslak, iptal: e.target.checked || undefined })} />
        Bu soru Kurum tarafından iptal edildi (istatistiklere katılmaz)
      </label>

      <div className="satir aralikli" style={{ marginTop: 18 }}>
        {onSil ? <button className="dugme tehlike" onClick={onSil}>Sil</button> : <span />}
        <div className="satir">
          <button className="dugme" onClick={onKapat}>Vazgeç</button>
          <button className="dugme birincil" onClick={() => onKaydet(taslak)}
                  disabled={!taslak.metin.trim()}>Kaydet</button>
        </div>
      </div>
    </Kip>
  );
}
