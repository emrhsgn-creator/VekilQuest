/**
 * pdfjs sayfasından düz metin çıkarma — tarayıcıdaki içe aktarma ekranı ve
 * terminal aracı aynı kuralları kullansın diye ortak.
 *
 * Satır yapısı Y koordinatından yeniden kuruluyor; aksi hâlde seçenekler tek
 * satıra yapışıyor.
 *
 * Sayfa başlığı ve altlığı ("MARKA VEKİLLİĞİ SINAVI SORU KİTAPÇIĞI (A)",
 * "Diğer sayfaya geçiniz.", sayfa numarası) konumlarından ayıklanıyor. Desen
 * eşleyerek ayıklamak yetmiyor: pdfjs altlığı bazen "Diğer sayfay" + "a
 * geçiniz." gibi parçalara bölüyor ve bu parçalar o sütundaki son seçeneğin
 * arkasına ekleniyordu. Ölçülen kitapçıklarda gövde metni sayfanın üst
 * %9,5'i ile alt %9,5'inin dışında kalıyor (2024: gövde 82–760pt, altlık
 * 769pt+; 2015: gövde 87–760pt, altlık 780pt+; A4 = 842pt).
 */

const UST_PAY = 0.05;
const ALT_PAY = 0.088;

/**
 * @param {{ getTextContent: () => Promise<{items: any[]}>, getViewport: (o: {scale:number}) => {height:number} }} sayfa
 * @param {{ kenarlariAt?: boolean }} [secenekler]
 */
export async function sayfaMetni(sayfa, { kenarlariAt = true } = {}) {
  const icerik = await sayfa.getTextContent();
  const yukseklik = sayfa.getViewport({ scale: 1 }).height;
  const ustSinir = yukseklik * UST_PAY;
  const altSinir = yukseklik * (1 - ALT_PAY);

  const satirlar = [];
  let sonY = null;
  let satir = '';
  for (const oge of icerik.items) {
    if (!('str' in oge)) continue;
    const taban = oge.transform[5];
    // Taban çizgisinin sayfanın üstünden uzaklığı.
    const ustten = yukseklik - taban;
    if (kenarlariAt && oge.str.trim() && (ustten < ustSinir || ustten > altSinir)) continue;
    const y = Math.round(taban);
    if (sonY !== null && Math.abs(y - sonY) > 2) {
      satirlar.push(satir.trim());
      satir = '';
    }
    satir += oge.str + (oge.hasEOL ? ' ' : '');
    sonY = y;
  }
  if (satir.trim()) satirlar.push(satir.trim());
  return satirlar.join('\n');
}
