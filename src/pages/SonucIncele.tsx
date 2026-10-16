import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { BosDurum } from '../components/ui';
import { SeansSonucu } from '../components/SeansCalistir';
import { cozulebilir } from '../lib/sec';
import { sinavKarnesi, sinavSorulari } from '../lib/karne';
import type { Mod, SeansKaydi, Soru } from '../types';

const DONUS: Record<Mod, string> = { deneme: '/deneme', calisma: '/calisma', tekrar: '/tekrar' };

/**
 * Bitmiş bir seansın sonuç ekranı: /sonuc/:seansId
 *
 * Seans sırasındaki cevaplar kaydedildiği için sonuç ekranı her zaman
 * yeniden kurulabilir. Sayfa yenilense, sekme kapansa ya da haftalar sonra
 * deneme geçmişinden açılsa da işaretlediğin şıklarla birlikte görünür.
 */
export function SeansSonucSayfasi() {
  const { seansId } = useParams();
  const { seanslar, cevaplamalar, tumSorular } = useStore();
  const navigate = useNavigate();

  const veri = useMemo(() => {
    const seans = seanslar.find((s) => s.id === seansId);
    if (!seans) return null;
    const harita = new Map(tumSorular.map((s) => [s.id, s]));
    const sorular = seans.soruIdleri.flatMap((id) => harita.get(id) ?? []);
    const kayitlar: Record<string, SeansKaydi> = {};
    for (const c of cevaplamalar) {
      if (c.seansId !== seans.id) continue;
      kayitlar[c.soruId] = { secilen: c.secilen, gosterildi: true, sure: c.sure };
    }
    return { seans, sorular, kayitlar };
  }, [seansId, seanslar, cevaplamalar, tumSorular]);

  if (!veri || veri.sorular.length === 0) {
    return (
      <BosDurum baslik="Bu oturumun sonucu bulunamadı"
                aciklama="Oturum silinmiş ya da hiç cevap kaydedilmeden kapatılmış olabilir. Geçmiş denemelerin Deneme sınavı ekranında listelenir."
                eylemYazi="Deneme sınavı ekranına git" eylemYol="/deneme" />
    );
  }

  const { seans, sorular, kayitlar } = veri;
  return (
    <SeansSonucu
      sorular={sorular}
      kayitlar={kayitlar}
      baslik={seans.baslik}
      tarih={seans.bitis ?? seans.baslangic}
      karneYili={seans.karneYili}
      onCik={() => navigate(seans.donusYolu && !seans.donusYolu.startsWith('/devam') ? seans.donusYolu : DONUS[seans.mod])}
    />
  );
}

/**
 * Bir çıkmış sınavın, her soru için ilk çözümüne göre sonucu: /karne/:yil
 * Sınav parça parça çözüldüyse (ör. sonradan eklenen sorular) bütün
 * oturumlardaki cevaplar tek ekranda toplanır.
 */
export function KarneSonucSayfasi() {
  const { yil } = useParams();
  const { sorular, cevaplamalar } = useStore();
  const navigate = useNavigate();

  const veri = useMemo(() => {
    const sinavYili = Number(yil);
    const karne = sinavKarnesi(sinavYili, sinavSorulari(cozulebilir(sorular), sinavYili), cevaplamalar);
    const cozulenler: Soru[] = karne.sorular.filter((s) => karne.ilkCozumler.has(s.id));
    const kayitlar: Record<string, SeansKaydi> = {};
    for (const [id, c] of karne.ilkCozumler) kayitlar[id] = { secilen: c.secilen, gosterildi: true, sure: c.sure };
    return { karne, cozulenler, kayitlar };
  }, [yil, sorular, cevaplamalar]);

  if (veri.cozulenler.length === 0) {
    return (
      <BosDurum baslik={`${yil} sınavını henüz çözmedin`}
                aciklama="Deneme sınavı ekranındaki karne tablosundan sınavı başlatabilirsin."
                eylemYazi="Deneme sınavı ekranına git" eylemYol="/deneme" />
    );
  }

  const { karne, cozulenler, kayitlar } = veri;
  return (
    <SeansSonucu
      sorular={cozulenler}
      kayitlar={kayitlar}
      baslik={`${yil} sınavı`}
      tarih={karne.sonCozum ?? Date.now()}
      not={karne.tamam
        ? 'her soru için ilk çözümün'
        : `her soru için ilk çözümün · ${karne.eksik.length} soru henüz çözülmedi`}
      onCik={() => navigate('/deneme')}
    />
  );
}
