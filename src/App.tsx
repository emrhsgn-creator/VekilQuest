import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useMemo } from 'react';
import { useStore } from './store';
import { vadesiGelenler } from './lib/srs';
import Panel from './pages/Panel';
import Calisma from './pages/Calisma';
import Deneme from './pages/Deneme';
import Tekrar from './pages/Tekrar';
import Analiz from './pages/Analiz';
import Banka from './pages/Banka';
import IceAktar from './pages/IceAktar';
import Plan from './pages/Plan';
import Mevzuat from './pages/Mevzuat';
import Ayarlar from './pages/Ayarlar';

export default function App() {
  const { hazir, sorular, tekrarKartlari } = useStore();

  const vadeSayisi = useMemo(() => {
    const mevcut = new Set(sorular.map((s) => s.id));
    return vadesiGelenler(tekrarKartlari).filter((k) => mevcut.has(k.soruId)).length;
  }, [tekrarKartlari, sorular]);

  if (!hazir) {
    return <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--metin-2)' }}>Yükleniyor…</div>;
  }

  return (
    <div className="kabuk">
      <nav className="yan">
        <div className="yan-ic">
        <div className="marka">
          <span style={{ fontSize: 22 }} aria-hidden="true">⚖️</span>
          <div>
            <div className="marka-ad">VekilQuest</div>
            <div className="marka-alt">Marka vekilliği çalışma</div>
          </div>
        </div>

        <div className="yan-baslik">Çalış</div>
        <Bag yol="/" ad="Panel" />
        <Bag yol="/calisma" ad="Konu çalışması" />
        <Bag yol="/deneme" ad="Deneme sınavı" />
        <Bag yol="/tekrar" ad="Tekrar" rozet={vadeSayisi || undefined} />

        <div className="yan-baslik">Değerlendir</div>
        <Bag yol="/analiz" ad="Analiz" />
        <Bag yol="/plan" ad="Çalışma planı" />

        <div className="yan-baslik">Kaynak</div>
        <Bag yol="/banka" ad="Soru bankası" rozet={sorular.length || undefined} />
        <Bag yol="/ice-aktar" ad="İçe aktar" />
        <Bag yol="/mevzuat" ad="Mevzuat" />
        <Bag yol="/ayarlar" ad="Ayarlar" />
        </div>
      </nav>

      <main className="icerik">
        <Routes>
          <Route path="/" element={<Panel />} />
          <Route path="/calisma" element={<Calisma />} />
          <Route path="/deneme" element={<Deneme />} />
          <Route path="/tekrar" element={<Tekrar />} />
          <Route path="/analiz" element={<Analiz />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/banka" element={<Banka />} />
          <Route path="/ice-aktar" element={<IceAktar />} />
          <Route path="/mevzuat" element={<Mevzuat />} />
          <Route path="/ayarlar" element={<Ayarlar />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Bag({ yol, ad, rozet }: { yol: string; ad: string; rozet?: number }) {
  return (
    <NavLink to={yol} end={yol === '/'}
             className={({ isActive }) => `nav-oge ${isActive ? 'etkin' : ''}`}>
      <span>{ad}</span>
      {rozet !== undefined && <span className="rozet">{rozet}</span>}
    </NavLink>
  );
}
