import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { DevamEdenler } from '../components/DevamEdenler';
import { BosDurum, Kart, Olcut } from '../components/ui';
import { SeansCalistir } from '../components/SeansCalistir';
import { BuyuklukListesi } from '../components/Grafik';
import { vadesiGelenler } from '../lib/srs';
import { inatciSorular } from '../lib/stats';
import { kisalt } from '../lib/metin';
import { konuAdi } from '../lib/stats';
import type { Soru } from '../types';

export default function Tekrar() {
  const { sorular, cevaplamalar, tekrarKartlari } = useStore();
  const [aktif, setAktif] = useState<{ sorular: Soru[]; baslik: string } | null>(null);

  const soruById = useMemo(() => new Map(sorular.map((s) => [s.id, s])), [sorular]);

  const vadeliler = useMemo(
    () => vadesiGelenler(tekrarKartlari)
      .map((k) => soruById.get(k.soruId))
      .filter((s): s is Soru => !!s && !!s.cevap && !s.iptal),
    [tekrarKartlari, soruById],
  );

  const inatcilar = useMemo(
    () => inatciSorular(sorular, cevaplamalar, 2).filter((x) => x.soru.cevap && !x.soru.iptal),
    [sorular, cevaplamalar],
  );

  const isaretliler = useMemo(
    () => sorular.filter((s) => s.etiketler?.includes('işaretli') && s.cevap && !s.iptal),
    [sorular],
  );

  const yaklasan = useMemo(() => {
    const simdi = Date.now();
    const yediGun = simdi + 7 * 86_400_000;
    return tekrarKartlari.filter((k) => k.vade > simdi && k.vade <= yediGun).length;
  }, [tekrarKartlari]);

  if (aktif) {
    return (
      <SeansCalistir sorular={aktif.sorular} mod="tekrar" baslik={aktif.baslik}
                     anindaGeriBildirim onCik={() => setAktif(null)} />
    );
  }

  if (tekrarKartlari.length === 0) {
    return (
      <BosDurum baslik="Tekrar kuyruğu henüz oluşmadı"
                aciklama="Soru çözdükçe her soru için bir tekrar kartı açılır. Yanlış yaptıkların sık, doğru bildiklerin giderek seyrek sorulur."
                eylemYazi="Konu çalışmasına başla" eylemYol="/calisma" />
    );
  }

  return (
    <>
      <div className="sayfa-basi">
        <div>
          <h1>Tekrar</h1>
          <p>
            Aralıklı tekrar: bildiğin soruların arası açılır, takıldıkların sık sık önüne gelir.
            Sınav öncesi en verimli çalışma biçimi bu.
          </p>
        </div>
        <button className="dugme birincil buyuk" disabled={vadeliler.length === 0}
                onClick={() => setAktif({ sorular: vadeliler.slice(0, 40), baslik: 'Günün tekrarı' })}>
          {vadeliler.length ? `${Math.min(40, vadeliler.length)} soruyu tekrar et` : 'Bugün tekrar yok'}
        </button>
      </div>
      <DevamEdenler modlar={['tekrar']} />

      <div className="yigin">
        <div className="izgara izgara-4">
          <Olcut etiket="Bugün vadesi gelen" deger={vadeliler.length} renk={vadeliler.length ? 'var(--vurgu)' : undefined} />
          <Olcut etiket="Önümüzdeki 7 gün" deger={yaklasan} alt="planlanmış tekrar" />
          <Olcut etiket="Israrla yanlış" deger={inatcilar.length} alt="en az 2 kez yanlış" />
          <Olcut etiket="İşaretlediklerin" deger={isaretliler.length} />
        </div>

        {vadeliler.length === 0 && (
          <div className="bilgi-kutusu">
            Bugünlük tekrar kuyruğun boş. Aşağıdaki listelerden birini seçip yine de çalışabilirsin.
          </div>
        )}

        <div className="izgara izgara-2">
          <Kart baslik="Israrla yanlış yaptıkların"
                not="Aynı soruyu birden çok kez kaçırıyorsan altındaki kural henüz oturmamış demektir."
                eylem={
                  <button className="dugme kucuk" disabled={inatcilar.length === 0}
                          onClick={() => setAktif({ sorular: inatcilar.slice(0, 30).map((x) => x.soru), baslik: 'Israrla yanlışlar' })}>
                    Çöz
                  </button>
                }>
            {inatcilar.length === 0 ? (
              <p className="sessiz">Aynı soruyu iki kez kaçırdığın olmamış.</p>
            ) : (
              <BuyuklukListesi
                maksSatir={8}
                satirlar={inatcilar.slice(0, 8).map((x) => ({
                  id: x.soru.id,
                  etiket: kisalt(x.soru.metin, 70),
                  deger: x.oran,
                  altEtiket: `${konuAdi(x.soru.topicId)} · ${x.yanlis}/${x.deneme} yanlış`,
                  renk: 'var(--seri-8)',
                }))}
                birim="%"
              />
            )}
          </Kart>

          <Kart baslik="İşaretlediğin sorular"
                not="Çözerken ★ ile işaretlediklerin."
                eylem={
                  <button className="dugme kucuk" disabled={isaretliler.length === 0}
                          onClick={() => setAktif({ sorular: isaretliler.slice(0, 30), baslik: 'İşaretlediklerim' })}>
                    Çöz
                  </button>
                }>
            {isaretliler.length === 0 ? (
              <p className="sessiz">Henüz soru işaretlemedin. Çözerken sağ üstteki ☆ ile işaretleyebilirsin.</p>
            ) : (
              <ul className="sade-liste">
                {isaretliler.slice(0, 8).map((s) => (
                  <li key={s.id}>
                    <span>{kisalt(s.metin, 80)}</span>
                    <span className="minik">{konuAdi(s.topicId)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Kart>
        </div>
      </div>
    </>
  );
}
