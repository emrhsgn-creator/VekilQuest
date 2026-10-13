/**
 * Cihazdaki soru bankasını uygulamayla gelen gömülü bankayla eşitler.
 *
 * Gömülü banka her yayında değişebilir: yeni sınav eklenir, ayrıştırıcı
 * düzeltilir, soruya görsel eklenir. Eskiden bu değişiklikler yalnızca bankası
 * boş olan yeni kullanıcılara ulaşıyordu; mevcut kullanıcı hatalı kopyayla
 * kalıyordu. Burada açılışta, damga değiştiyse birleştirme yapılıyor.
 *
 * Kurallar:
 *   • Kimliği gömülü bankada olan soru gömülü sürümle yenilenir. Kullanıcının
 *     işaretleri (★) ve elle atadığı konu korunur.
 *   • Kimliği farklı ama aynı soru (aynı yıl + numara + gövde) olan kayıt —
 *     ör. kullanıcının kitapçığı kendi içe aktarmasıyla oluşan kopya — gömülü
 *     soruyla birleştirilir: çözüm geçmişi ve tekrar kartı yeni kimliğe taşınır.
 *   • Daha önce gömülü bankadan gelmiş ama artık bankada olmayan soru silinir.
 *   • Kullanıcının kendi eklediği diğer sorulara dokunulmaz.
 */

import { katla } from './parse.mjs';
import { gurultuyuAyikla } from './bicim.mjs';
import type { Cevaplama, DevamKaydi, Seans, Soru, TekrarKarti } from '../types';

export type BankaDurumu = {
  sorular: Soru[];
  cevaplamalar: Cevaplama[];
  tekrarKartlari: TekrarKarti[];
  seanslar: Seans[];
  devamEdenler: DevamKaydi[];
};

export type BirlestirmeOzeti = {
  eklenen: number;
  guncellenen: number;
  birlesen: number;
  silinen: number;
};

/** Aynı sorunun farklı kimlikli kopyalarını tanımak için içerik anahtarı. */
export function icerikAnahtari(soru: Pick<Soru, 'yil' | 'no' | 'metin'>): string {
  const govde = katla(gurultuyuAyikla(soru.metin ?? '')).replace(/[^a-z0-9]/g, '').slice(0, 160);
  return `${soru.yil ?? ''}|${soru.no ?? ''}|${govde}`;
}

export function gomuluBankayiBirlestir(
  durum: BankaDurumu,
  gomulu: Soru[],
): BankaDurumu & { ozet: BirlestirmeOzeti } {
  const ozet: BirlestirmeOzeti = { eklenen: 0, guncellenen: 0, birlesen: 0, silinen: 0 };
  const gomuluHarita = new Map(gomulu.map((s) => [s.id, s]));
  const anahtarHarita = new Map<string, string>();
  for (const s of gomulu) {
    const anahtar = icerikAnahtari(s);
    // Aynı anahtarı paylaşan iki gömülü soru varsa anahtar güvenilmez: kullanma.
    anahtarHarita.set(anahtar, anahtarHarita.has(anahtar) ? '' : s.id);
  }

  /** eski kimlik -> gömülü bankadaki kimlik */
  const tasima = new Map<string, string>();
  /** gömülü soruya aktarılacak kullanıcı verisi (işaret, elle konu) */
  const kullaniciVerisi = new Map<string, Soru>();
  const kalanlar: Soru[] = [];

  for (const soru of durum.sorular) {
    if (gomuluHarita.has(soru.id)) {
      kullaniciVerisi.set(soru.id, soru);
      ozet.guncellenen += 1;
      continue;
    }
    const hedef = anahtarHarita.get(icerikAnahtari(soru));
    if (hedef) {
      tasima.set(soru.id, hedef);
      if (!kullaniciVerisi.has(hedef)) kullaniciVerisi.set(hedef, soru);
      ozet.birlesen += 1;
      continue;
    }
    if (soru.gomulu) {
      ozet.silinen += 1;
      continue;
    }
    kalanlar.push(soru);
  }

  const yenilenen = gomulu.map((g) => {
    const eski = kullaniciVerisi.get(g.id);
    if (!eski) {
      ozet.eklenen += 1;
      return g;
    }
    const etiketler = [...new Set([...(g.etiketler ?? []), ...(eski.etiketler ?? [])])];
    const elleKonu = eski.topicId && (eski.topicGuven ?? 0) >= 1;
    return {
      ...g,
      etiketler: etiketler.length ? etiketler : undefined,
      ...(elleKonu ? { topicId: eski.topicId, topicGuven: eski.topicGuven } : {}),
      eklenme: eski.eklenme ?? g.eklenme,
    };
  });

  const yeniKimlik = (id: string) => tasima.get(id) ?? id;
  const tasimaVar = tasima.size > 0;

  const cevaplamalar = tasimaVar
    ? durum.cevaplamalar.map((c) => (tasima.has(c.soruId) ? { ...c, soruId: yeniKimlik(c.soruId) } : c))
    : durum.cevaplamalar;

  // Aynı soruya iki tekrar kartı düşerse daha çok çalışılmış olanı kalır.
  let tekrarKartlari = durum.tekrarKartlari;
  if (tasimaVar) {
    const kartlar = new Map<string, TekrarKarti>();
    for (const kart of durum.tekrarKartlari) {
      const soruId = yeniKimlik(kart.soruId);
      const mevcut = kartlar.get(soruId);
      if (!mevcut || kart.tekrarSayisi > mevcut.tekrarSayisi) kartlar.set(soruId, { ...kart, soruId });
    }
    tekrarKartlari = [...kartlar.values()];
  }

  const seanslar = tasimaVar
    ? durum.seanslar.map((s) => ({ ...s, soruIdleri: s.soruIdleri.map(yeniKimlik) }))
    : durum.seanslar;

  const devamEdenler = tasimaVar
    ? durum.devamEdenler.map((d) => ({
      ...d,
      soruIdleri: d.soruIdleri.map(yeniKimlik),
      kayitlar: Object.fromEntries(Object.entries(d.kayitlar).map(([id, k]) => [yeniKimlik(id), k])),
    }))
    : durum.devamEdenler;

  return {
    sorular: [...yenilenen, ...kalanlar],
    cevaplamalar,
    tekrarKartlari,
    seanslar,
    devamEdenler,
    ozet,
  };
}
