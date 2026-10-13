import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import { BosDurum } from '../components/ui';
import { SeansCalistir } from '../components/SeansCalistir';
import type { Mod } from '../types';

const DONUS: Record<Mod, string> = { deneme: '/deneme', calisma: '/calisma', tekrar: '/tekrar' };

/** Yarım kalmış bir seansı kaldığı yerden açar: /devam/:seansId */
export default function DevamEt() {
  const { seansId } = useParams();
  const { devamEdenler, tumSorular } = useStore();
  const navigate = useNavigate();

  // Kayıt ve soru listesi açılışta bir kez alınır: seans ilerledikçe kayıt
  // güncellenir, bitince silinir — sonuç ekranı yine de açık kalmalı.
  const [kayit] = useState(() => devamEdenler.find((k) => k.seansId === seansId));
  const [sorular] = useState(() => {
    if (!kayit) return [];
    const harita = new Map(tumSorular.map((s) => [s.id, s]));
    return kayit.soruIdleri.flatMap((id) => harita.get(id) ?? []);
  });

  if (!kayit || sorular.length === 0) {
    return (
      <BosDurum baslik="Bu oturum bulunamadı"
                aciklama="Oturum tamamlanmış ya da silinmiş olabilir."
                eylemYazi="Panele dön" eylemYol="/" />
    );
  }

  return (
    <SeansCalistir
      key={kayit.seansId}
      sorular={sorular}
      mod={kayit.mod}
      baslik={kayit.baslik}
      sureSiniriSn={kayit.sureSiniriSn}
      anindaGeriBildirim={kayit.anindaGeriBildirim}
      filtreOzeti={kayit.filtreOzeti}
      devam={kayit}
      onCik={() => navigate(DONUS[kayit.mod])}
    />
  );
}
