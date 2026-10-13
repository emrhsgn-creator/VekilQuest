/**
 * Tarayıcı içinde PDF'ten metin çıkarma.
 *
 * pdfjs-dist yaklaşık 1 MB; yalnızca kullanıcı gerçekten PDF yüklediğinde
 * indirilsin diye dinamik import ediliyor. Böylece ilk açılış hafif kalıyor.
 */

import { sayfaMetni } from './pdfMetin.mjs';

type PdfModulu = typeof import('pdfjs-dist');
let pdfjsSozu: Promise<PdfModulu> | null = null;

async function pdfjsGetir(): Promise<PdfModulu> {
  if (!pdfjsSozu) {
    pdfjsSozu = (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
      ]);
      // Worker yerel olarak paketleniyor; CDN'e ihtiyaç yok, çevrimdışı çalışır.
      pdfjs.GlobalWorkerOptions.workerPort = new worker.default();
      return pdfjs;
    })();
  }
  return pdfjsSozu;
}

export async function pdfMetniCikar(
  dosya: File,
  ilerleme?: (sayfa: number, toplam: number) => void,
): Promise<string> {
  const pdfjs = await pdfjsGetir();
  const tampon = await dosya.arrayBuffer();
  const belge = await pdfjs.getDocument({ data: tampon, useSystemFonts: true }).promise;
  const sayfalar: string[] = [];

  for (let i = 1; i <= belge.numPages; i++) {
    sayfalar.push(await sayfaMetni(await belge.getPage(i)));
    ilerleme?.(i, belge.numPages);
  }

  return sayfalar.join('\n\n');
}

export function pdfMi(dosya: File): boolean {
  return dosya.type === 'application/pdf' || dosya.name.toLowerCase().endsWith('.pdf');
}
