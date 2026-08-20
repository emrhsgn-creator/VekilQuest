/** Türkçe metin normalleştirme yardımcıları. */

const HARF_ESLEME: Record<string, string> = {
  ı: 'i', İ: 'i', I: 'i', i: 'i',
  ş: 's', Ş: 's', ğ: 'g', Ğ: 'g',
  ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c',
  â: 'a', Â: 'a', î: 'i', Î: 'i', û: 'u', Û: 'u',
};

/** Küçük harfe indirger, Türkçe karakterleri sadeleştirir, boşlukları tekler. */
export function normalize(metin: string): string {
  let cikti = '';
  for (const harf of metin) {
    cikti += HARF_ESLEME[harf] ?? harf.toLowerCase();
  }
  return cikti.replace(/[^\wçğıöşü\s./-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Türkçe alfabetik sıralama için karşılaştırıcı. */
export const trSirala = new Intl.Collator('tr').compare;

export function kisalt(metin: string, uzunluk = 120): string {
  const temiz = metin.replace(/\s+/g, ' ').trim();
  return temiz.length <= uzunluk ? temiz : temiz.slice(0, uzunluk - 1) + '…';
}
