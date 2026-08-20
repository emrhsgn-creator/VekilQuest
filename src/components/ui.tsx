import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Kart({ baslik, not, eylem, children, className = '' }: {
  baslik?: ReactNode; not?: ReactNode; eylem?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`kart ${className}`}>
      {(baslik || eylem) && (
        <header className="kart-basi">
          <div>
            <h3>{baslik}</h3>
            {not && <div className="not">{not}</div>}
          </div>
          {eylem}
        </header>
      )}
      {children}
    </section>
  );
}

export function Olcut({ etiket, deger, alt, renk }: {
  etiket: string; deger: ReactNode; alt?: ReactNode; renk?: string;
}) {
  return (
    <div className="kart olcut">
      <span className="olcut-etiket">{etiket}</span>
      <span className="olcut-deger" style={renk ? { color: renk } : undefined}>{deger}</span>
      {alt && <span className="olcut-alt">{alt}</span>}
    </div>
  );
}

export function BosDurum({ baslik, aciklama, eylemYazi, eylemYol, children }: {
  baslik: string; aciklama: string; eylemYazi?: string; eylemYol?: string; children?: ReactNode;
}) {
  return (
    <div className="kart bos-durum">
      <h3>{baslik}</h3>
      <p>{aciklama}</p>
      {eylemYol && eylemYazi && <Link className="dugme birincil" to={eylemYol}>{eylemYazi}</Link>}
      {children}
    </div>
  );
}

export function Cubuk({ oran, renk }: { oran: number; renk?: string }) {
  return (
    <div className="cubuk">
      <span style={{ width: `${Math.min(100, Math.max(0, oran * 100))}%`, background: renk ?? 'var(--ramp-4)' }} />
    </div>
  );
}

export function Kip({ baslik, onKapat, children, genislik }: {
  baslik: ReactNode; onKapat: () => void; children: ReactNode; genislik?: number;
}) {
  return (
    <div className="ortu" onClick={onKapat} role="presentation">
      <div className="kip" style={genislik ? { width: `min(${genislik}px, 100%)` } : undefined}
           onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="satir aralikli" style={{ marginBottom: 16 }}>
          <h2>{baslik}</h2>
          <button className="dugme sade kucuk" onClick={onKapat} aria-label="Kapat">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function sureBicim(ms: number): string {
  const toplamSaniye = Math.max(0, Math.round(ms / 1000));
  const dk = Math.floor(toplamSaniye / 60);
  const sn = toplamSaniye % 60;
  if (dk >= 60) {
    const sa = Math.floor(dk / 60);
    return `${sa}s ${dk % 60}dk`;
  }
  return dk > 0 ? `${dk}dk ${sn}sn` : `${sn}sn`;
}

export function sayacBicim(saniye: number): string {
  const s = Math.max(0, Math.floor(saniye));
  const sa = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  const sn = s % 60;
  const iki = (n: number) => String(n).padStart(2, '0');
  return sa > 0 ? `${sa}:${iki(dk)}:${iki(sn)}` : `${iki(dk)}:${iki(sn)}`;
}

export function tarihBicim(zaman: number): string {
  return new Date(zaman).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}
