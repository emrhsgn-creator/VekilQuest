import { useRef, useState } from 'react';
import { useStore } from '../store';
import { Kart, Kip, tarihBicim } from '../components/ui';
import type { Yedek } from '../types';

export default function Ayarlar() {
  const {
    ayarlar, ayarlariGuncelle, yedekAl, yedekYukle,
    ilerlemeyiSifirla, hepsiniSil, tumSorular: sorular, cevaplamalar, seanslar,
  } = useStore();

  const [onay, setOnay] = useState<'ilerleme' | 'hepsi' | null>(null);
  const [bilgi, setBilgi] = useState('');
  const dosyaGiris = useRef<HTMLInputElement>(null);

  const yedekIndir = () => {
    const veri = yedekAl();
    const bag = URL.createObjectURL(new Blob([JSON.stringify(veri)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = bag;
    a.download = `vekilquest-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(bag);
    setBilgi('Yedek indirildi.');
  };

  const yedekGeriYukle = async (dosya: File) => {
    try {
      const veri = JSON.parse(await dosya.text()) as Yedek;
      if (veri.surum !== 1) throw new Error('Tanınmayan yedek sürümü.');
      yedekYukle(veri);
      setBilgi(`Yedek geri yüklendi: ${veri.sorular?.length ?? 0} soru, ${veri.cevaplamalar?.length ?? 0} cevaplama.`);
    } catch (hata) {
      setBilgi(`Yedek okunamadı: ${(hata as Error).message}`);
    }
  };

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Ayarlar</h1>
          <p>Tüm verilerin yalnızca bu tarayıcıda saklanır; hiçbir sunucuya gönderilmez.</p>
        </div>
      </div>

      <div className="yigin">
        <Kart baslik="Sınav ve çalışma">
          <div className="alan-satir">
            <div>
              <label htmlFor="a-tarih">Sınav tarihi</label>
              <input id="a-tarih" type="date" value={ayarlar.sinavTarihi ?? ''}
                     onChange={(e) => ayarlariGuncelle({ sinavTarihi: e.target.value || undefined })} />
            </div>
            <div>
              <label htmlFor="a-hedef">Günlük soru hedefi</label>
              <input id="a-hedef" type="number" min={5} max={300} step={5} value={ayarlar.gunlukHedef}
                     onChange={(e) => ayarlariGuncelle({ gunlukHedef: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div>
              <label htmlFor="a-gecme">Geçme eşiği (%)</label>
              <input id="a-gecme" type="number" min={0} max={100} step={5} value={ayarlar.gecmeNotu}
                     onChange={(e) => ayarlariGuncelle({ gecmeNotu: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </div>
          </div>
          <div className="alan-satir">
            <div>
              <label htmlFor="a-adet">Deneme soru sayısı</label>
              <input id="a-adet" type="number" min={5} max={200} step={5} value={ayarlar.denemeSoruSayisi}
                     onChange={(e) => ayarlariGuncelle({ denemeSoruSayisi: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div>
              <label htmlFor="a-sure">Deneme süresi (dakika)</label>
              <input id="a-sure" type="number" min={5} max={300} step={5} value={ayarlar.denemeSuresiDk}
                     onChange={(e) => ayarlariGuncelle({ denemeSuresiDk: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
          </div>
          <p className="minik">
            Deneme varsayılanları TÜRKPATENT’in ilan ettiği güncel sınav formatına göre ayarlanmalı;
            uygulama bir varsayım dayatmaz, buradan istediğin değeri girersin.
          </p>
        </Kart>

        <Kart baslik="Çözme deneyimi">
          <label className="satir" style={{ gap: 9, fontWeight: 500, marginBottom: 12 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={ayarlar.anindaGeriBildirim}
                   onChange={(e) => ayarlariGuncelle({ anindaGeriBildirim: e.target.checked })} />
            Konu çalışmasında her sorudan sonra doğru cevabı göster
          </label>
          <label className="satir" style={{ gap: 9, fontWeight: 500, marginBottom: 6 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={ayarlar.sadeceMarkaKapsami}
                   onChange={(e) => ayarlariGuncelle({ sadeceMarkaKapsami: e.target.checked })} />
            Yalnızca marka vekilliği kapsamındaki soruları çalış
          </label>
          <p className="minik" style={{ marginTop: 0, marginBottom: 12 }}>
            Genel Yeterlik kitapçıklarının patent bölümü zaten içe aktarılmıyor. Bu seçenek ikinci
            bir güvence: elle eklenen ya da başka bir kaynaktan gelen patent soruları da çalışma,
            deneme ve analiz ekranlarının dışında tutulur.
          </p>
          <div className="alan">
            <label htmlFor="a-tema">Tema</label>
            <select id="a-tema" value={ayarlar.tema} style={{ maxWidth: 220 }}
                    onChange={(e) => ayarlariGuncelle({ tema: e.target.value as typeof ayarlar.tema })}>
              <option value="sistem">Sistem ayarını izle</option>
              <option value="acik">Açık</option>
              <option value="koyu">Koyu</option>
            </select>
          </div>
        </Kart>

        <Kart baslik="Veri" not="Tarayıcı verisi silinirse çalışman kaybolur; düzenli yedek al.">
          <div className="tablo-sarmal" style={{ marginBottom: 16 }}>
            <table>
              <tbody>
                <tr><td>Soru</td><td className="sayi">{sorular.length}</td></tr>
                <tr><td>Cevaplama kaydı</td><td className="sayi">{cevaplamalar.length}</td></tr>
                <tr><td>Seans</td><td className="sayi">{seanslar.length}</td></tr>
                <tr>
                  <td>İlk kayıt</td>
                  <td className="sayi">
                    {cevaplamalar.length ? tarihBicim(Math.min(...cevaplamalar.map((c) => c.zaman))) : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="minik">
            Uygulamayla gelen soru bankası, TÜRKPATENT tarafından yayımlanan Patent ve Marka
            Vekilliği Genel Yeterlik Sınavı kitapçıklarından ayrıştırılmıştır ve kişisel sınav
            hazırlığı amaçlıdır. Soruların hakları Türk Patent ve Marka Kurumuna aittir.
          </p>
          <div className="satir">
            <button className="dugme birincil" onClick={yedekIndir}>Yedek indir</button>
            <input ref={dosyaGiris} type="file" accept=".json" style={{ display: 'none' }}
                   onChange={(e) => { const d = e.target.files?.[0]; if (d) void yedekGeriYukle(d); e.target.value = ''; }} />
            <button className="dugme" onClick={() => dosyaGiris.current?.click()}>Yedekten geri yükle</button>
          </div>
          {bilgi && <div className="bilgi-kutusu" style={{ marginTop: 12 }}>{bilgi}</div>}
        </Kart>

        <Kart baslik="Tehlikeli bölge">
          <div className="satir">
            <button className="dugme tehlike" onClick={() => setOnay('ilerleme')}>
              Çözüm geçmişini sıfırla
            </button>
            <button className="dugme tehlike" onClick={() => setOnay('hepsi')}>
              Her şeyi sil
            </button>
          </div>
          <p className="minik" style={{ marginTop: 10, marginBottom: 0 }}>
            “Çözüm geçmişini sıfırla” soruları korur, yalnızca cevaplamaları, seansları ve tekrar
            kartlarını siler. “Her şeyi sil” soru bankasını da kaldırır.
          </p>
        </Kart>
      </div>

      {onay && (
        <Kip baslik="Emin misin?" onKapat={() => setOnay(null)} genislik={460}>
          <p>
            {onay === 'ilerleme'
              ? `${cevaplamalar.length} cevaplama kaydı, ${seanslar.length} seans ve tüm tekrar kartların silinecek. Soru bankan kalacak.`
              : `${sorular.length} soru, ${cevaplamalar.length} cevaplama ve tüm geçmişin silinecek. Bu işlem geri alınamaz.`}
          </p>
          <p className="minik">Devam etmeden önce yedek almanı öneririm.</p>
          <div className="satir aralikli" style={{ marginTop: 18 }}>
            <button className="dugme" onClick={() => setOnay(null)}>Vazgeç</button>
            <div className="satir">
              <button className="dugme" onClick={yedekIndir}>Önce yedek al</button>
              <button className="dugme tehlike" onClick={() => {
                if (onay === 'ilerleme') ilerlemeyiSifirla(); else hepsiniSil();
                setOnay(null);
                setBilgi(onay === 'ilerleme' ? 'Çözüm geçmişi sıfırlandı.' : 'Tüm veriler silindi.');
              }}>
                Evet, sil
              </button>
            </div>
          </div>
        </Kip>
      )}
    </>
  );
}
