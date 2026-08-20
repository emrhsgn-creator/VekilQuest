import { AREAS, TOPICS } from '../data/topics';
import type { Filtre } from '../lib/sec';
import type { Soru } from '../types';
import { bolumler, yillar } from '../lib/sec';

export function FiltrePaneli({
  filtre, onDegis, sorular, siralamaGoster = true,
}: {
  filtre: Filtre;
  onDegis: (f: Filtre) => void;
  sorular: Soru[];
  siralamaGoster?: boolean;
}) {
  const guncelle = (parca: Partial<Filtre>) => onDegis({ ...filtre, ...parca });
  const konular = filtre.areaId ? TOPICS.filter((t) => t.areaId === filtre.areaId) : TOPICS;

  return (
    <div className="alan-satir">
      <div style={{ flex: '2 1 240px' }}>
        <label htmlFor="f-arama">Metinde ara</label>
        <input id="f-arama" type="search" value={filtre.arama} placeholder="ör. kullanmama def'i"
               onChange={(e) => guncelle({ arama: e.target.value })} />
      </div>
      <div>
        <label htmlFor="f-alan">Hukuk alanı</label>
        <select id="f-alan" value={filtre.areaId}
                onChange={(e) => guncelle({ areaId: e.target.value, topicId: '' })}>
          <option value="">Tümü</option>
          {AREAS.map((a) => <option key={a.id} value={a.id}>{a.ad}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-konu">Konu</label>
        <select id="f-konu" value={filtre.topicId} onChange={(e) => guncelle({ topicId: e.target.value })}>
          <option value="">Tümü</option>
          {konular.map((t) => <option key={t.id} value={t.id}>{t.ad}</option>)}
        </select>
      </div>
      <div style={{ flex: '0 1 120px' }}>
        <label htmlFor="f-yil">Sınav yılı</label>
        <select id="f-yil" value={filtre.yil} onChange={(e) => guncelle({ yil: e.target.value })}>
          <option value="">Tümü</option>
          {yillar(sorular).map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
      {bolumler(sorular).length > 1 && (
        <div style={{ flex: '0 1 150px' }}>
          <label htmlFor="f-bolum">Kitapçık bölümü</label>
          <select id="f-bolum" value={filtre.bolum} onChange={(e) => guncelle({ bolum: e.target.value })}>
            <option value="">Tümü</option>
            {bolumler(sorular).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}
      <div style={{ flex: '0 1 150px' }}>
        <label htmlFor="f-durum">Durum</label>
        <select id="f-durum" value={filtre.durum}
                onChange={(e) => guncelle({ durum: e.target.value as Filtre['durum'] })}>
          <option value="hepsi">Hepsi</option>
          <option value="cozulmemis">Hiç çözmediklerim</option>
          <option value="yanlis">Yanlış yaptıklarım</option>
          <option value="isaretli">İşaretlediklerim</option>
          <option value="cevapsiz">Cevabı eksik olanlar</option>
        </select>
      </div>
      {siralamaGoster && (
        <div style={{ flex: '0 1 150px' }}>
          <label htmlFor="f-sira">Sıralama</label>
          <select id="f-sira" value={filtre.siralama}
                  onChange={(e) => guncelle({ siralama: e.target.value as Filtre['siralama'] })}>
            <option value="karisik">Karışık</option>
            <option value="sirali">Yıl ve soru no</option>
            <option value="zayifOnce">Zayıf konular önce</option>
          </select>
        </div>
      )}
    </div>
  );
}
