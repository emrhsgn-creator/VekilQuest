/**
 * 6769 sayılı Sınai Mülkiyet Kanunu madde indeksi.
 *
 * Marka vekilliği sınavının kapsamına giren kitaplar alınmıştır:
 * 1. Kitap (Marka), 2. Kitap (Coğrafi İşaret ve Geleneksel Ürün Adı),
 * 3. Kitap (Tasarım) ve 5. Kitap (Ortak ve Diğer Hükümler).
 * Patent ve faydalı modele ilişkin 4. Kitap (m.82-145) kapsam dışıdır.
 *
 * Kaynak: bedesten.adalet.gov.tr madde ağacı (mevzuatId 104221).
 * Tam metin için: https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=6769&MevzuatTur=1&MevzuatTertip=5
 */

export type SmkMadde = {
  no: number;
  baslik: string;
  kitap: string;
  kisim?: string;
  topicId?: string;
};

export const SMK_MADDELER: SmkMadde[] = [
  { no: 1, baslik: 'Amaç ve kapsam', kitap: 'Başlangıç Hükümleri' },
  { no: 2, baslik: 'Tanımlar', kitap: 'Başlangıç Hükümleri' },
  { no: 3, baslik: 'Korumadan yararlanacak kişiler', kitap: 'Başlangıç Hükümleri' },

  { no: 4, baslik: 'Marka olabilecek işaretler', kitap: 'Marka', kisim: 'Marka Hakkı ve Kapsamı', topicId: 'marka-isaret' },
  { no: 5, baslik: 'Marka tescilinde mutlak ret nedenleri', kitap: 'Marka', kisim: 'Marka Hakkı ve Kapsamı', topicId: 'marka-mutlak-ret' },
  { no: 6, baslik: 'Marka tescilinde nispi ret nedenleri', kitap: 'Marka', kisim: 'Marka Hakkı ve Kapsamı', topicId: 'marka-nispi-ret' },
  { no: 7, baslik: 'Marka tescilinden doğan hakların kapsamı ve istisnaları', kitap: 'Marka', kisim: 'Marka Hakkı ve Kapsamı', topicId: 'marka-hak-kapsam' },
  { no: 8, baslik: 'Markanın başvuru eserlerinde yer alması', kitap: 'Marka', kisim: 'Marka Hakkı ve Kapsamı', topicId: 'marka-hak-kapsam' },
  { no: 9, baslik: 'Markanın kullanılması', kitap: 'Marka', kisim: 'Marka Hakkı ve Kapsamı', topicId: 'marka-kullanim' },
  { no: 10, baslik: 'Ticari vekil veya temsilci adına tescilli markaya ilişkin talepler', kitap: 'Marka', kisim: 'Marka Hakkı ve Kapsamı', topicId: 'marka-ticari-vekil' },
  { no: 11, baslik: 'Başvuru şartları, sınıflandırma ve bölünme', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-basvuru' },
  { no: 12, baslik: 'Rüçhan hakkı ve etkisi', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-ruchan' },
  { no: 13, baslik: 'Rüçhan hakkının talep edilmesi ve hükmü', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-ruchan' },
  { no: 14, baslik: 'Madrid Protokolü kapsamında yapılan uluslararası marka başvuruları', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-madrid' },
  { no: 15, baslik: 'Şeklî inceleme, şeklî eksikliklerin giderilmesi ve başvuru tarihi', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-sekli-inceleme' },
  { no: 16, baslik: 'Başvurunun mutlak ret nedenleri açısından incelenmesi ve yayımlanması', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-sekli-inceleme' },
  { no: 17, baslik: 'Üçüncü kişilerin görüşleri', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-gorus-itiraz' },
  { no: 18, baslik: 'Yayıma itiraz', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-gorus-itiraz' },
  { no: 19, baslik: 'Yayıma itirazın incelenmesi', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-gorus-itiraz' },
  { no: 20, baslik: 'Karara itiraz', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-karara-itiraz' },
  { no: 21, baslik: 'Karara itirazların incelenmesi', kitap: 'Marka', kisim: 'Başvuru ve İtiraz', topicId: 'marka-karara-itiraz' },
  { no: 22, baslik: 'Tescil', kitap: 'Marka', kisim: 'Tescil, Koruma Süresi ve Yenileme', topicId: 'marka-tescil-yenileme' },
  { no: 23, baslik: 'Koruma süresi ve yenileme', kitap: 'Marka', kisim: 'Tescil, Koruma Süresi ve Yenileme', topicId: 'marka-tescil-yenileme' },
  { no: 24, baslik: 'Lisans', kitap: 'Marka', kisim: 'Lisans', topicId: 'marka-lisans-devir' },
  { no: 25, baslik: 'Hükümsüzlük hâlleri ve hükümsüzlük talebi', kitap: 'Marka', kisim: 'Hakkın Sona Ermesi', topicId: 'marka-hukumsuzluk' },
  { no: 26, baslik: 'İptal hâlleri ve iptal talebi', kitap: 'Marka', kisim: 'Hakkın Sona Ermesi', topicId: 'marka-iptal' },
  { no: 27, baslik: 'Hükümsüzlüğün ve iptalin etkisi', kitap: 'Marka', kisim: 'Hakkın Sona Ermesi', topicId: 'marka-sona-erme' },
  { no: 28, baslik: 'Sona erme ve sonuçları', kitap: 'Marka', kisim: 'Hakkın Sona Ermesi', topicId: 'marka-sona-erme' },
  { no: 29, baslik: 'Marka hakkına tecavüz sayılan fiiller', kitap: 'Marka', kisim: 'Marka Hakkına Tecavüz', topicId: 'marka-tecavuz' },
  { no: 30, baslik: 'Marka hakkına tecavüze ilişkin cezai hükümler', kitap: 'Marka', kisim: 'Marka Hakkına Tecavüz', topicId: 'marka-tecavuz' },
  { no: 31, baslik: 'Garanti markası ve ortak marka', kitap: 'Marka', kisim: 'Garanti Markası ve Ortak Marka', topicId: 'marka-garanti-ortak' },
  { no: 32, baslik: 'Garanti markası veya ortak marka teknik şartnamesi', kitap: 'Marka', kisim: 'Garanti Markası ve Ortak Marka', topicId: 'marka-garanti-ortak' },

  { no: 33, baslik: 'Koruma kapsamındaki ürünler', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-turler' },
  { no: 34, baslik: 'Menşe adı, mahreç işareti ve geleneksel ürün adı', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-turler' },
  { no: 35, baslik: 'Tescil edilmeyecek adlar', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-turler' },
  { no: 36, baslik: 'Başvuru hakkı', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-basvuru' },
  { no: 37, baslik: 'Başvuru şartları', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-basvuru' },
  { no: 38, baslik: 'Başvurunun incelenmesi ve yayımı', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-basvuru' },
  { no: 39, baslik: 'Yabancı ülke kaynaklı başvurular', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-basvuru' },
  { no: 40, baslik: 'İtiraz ve itirazın incelenmesi', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-basvuru' },
  { no: 41, baslik: 'Tescil', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-tescil-degisiklik' },
  { no: 42, baslik: 'Değişiklik talepleri', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-tescil-degisiklik' },
  { no: 43, baslik: 'Başvuru yapan veya tescil ettirenlerde değişiklik', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-tescil-degisiklik' },
  { no: 44, baslik: 'Coğrafi işaret korumasının elde edilmesi ve tescilden doğan hakların kapsamı', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-kullanim-denetim' },
  { no: 45, baslik: 'Geleneksel ürün adı korumasının elde edilmesi ve tescilden doğan hakkın kapsamı', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-kullanim-denetim' },
  { no: 46, baslik: 'Tescilli coğrafi işaretin ve geleneksel ürün adının kullanımı', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-kullanim-denetim' },
  { no: 47, baslik: 'İyiniyetli kullanım', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-kullanim-denetim' },
  { no: 48, baslik: 'Markalarla ilişki', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-kullanim-denetim' },
  { no: 49, baslik: 'Kullanımın denetimi', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-kullanim-denetim' },
  { no: 50, baslik: 'Hükümsüzlük talebi ve hükümsüzlük hâlleri', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-hukumsuzluk-tecavuz' },
  { no: 51, baslik: 'Hükümsüzlüğün etkisi', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-hukumsuzluk-tecavuz' },
  { no: 52, baslik: 'Tescilin sağladığı hak ve sorumluluktan vazgeçme', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-hukumsuzluk-tecavuz' },
  { no: 53, baslik: 'Coğrafi işaret hakkına tecavüz sayılan fiiller', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-hukumsuzluk-tecavuz' },
  { no: 54, baslik: 'Geleneksel ürün adı hakkına tecavüz sayılan fiiller', kitap: 'Coğrafi İşaret ve GÜA', topicId: 'ci-hukumsuzluk-tecavuz' },

  { no: 55, baslik: 'Tasarım ve ürün', kitap: 'Tasarım', topicId: 'tasarim-kavram' },
  { no: 56, baslik: 'Yenilik ve ayırt edicilik', kitap: 'Tasarım', topicId: 'tasarim-kavram' },
  { no: 57, baslik: 'Kamuya sunma', kitap: 'Tasarım', topicId: 'tasarim-kamuya-sunma' },
  { no: 58, baslik: 'Koruma kapsamı dışındaki tasarımlar', kitap: 'Tasarım', topicId: 'tasarim-kamuya-sunma' },
  { no: 59, baslik: 'Tasarım hakkının kapsamı ve sınırları', kitap: 'Tasarım', topicId: 'tasarim-hak-kapsam' },
  { no: 60, baslik: 'Önceki kullanımdan doğan hak', kitap: 'Tasarım', topicId: 'tasarim-hak-kapsam' },
  { no: 61, baslik: 'Başvuru şartları, sınıflandırma ve çoklu başvuru', kitap: 'Tasarım', topicId: 'tasarim-basvuru' },
  { no: 62, baslik: 'Rüçhan hakkı ve etkisi', kitap: 'Tasarım', topicId: 'tasarim-basvuru' },
  { no: 63, baslik: 'Rüçhan hakkının talep edilmesi ve hükmü', kitap: 'Tasarım', topicId: 'tasarim-basvuru' },
  { no: 64, baslik: 'İnceleme', kitap: 'Tasarım', topicId: 'tasarim-inceleme-tescil' },
  { no: 65, baslik: 'Tescil ve yayım', kitap: 'Tasarım', topicId: 'tasarim-inceleme-tescil' },
  { no: 66, baslik: 'Yayımın ertelenmesi', kitap: 'Tasarım', topicId: 'tasarim-inceleme-tescil' },
  { no: 67, baslik: 'Karara ve tescile itiraz', kitap: 'Tasarım', topicId: 'tasarim-itiraz' },
  { no: 68, baslik: 'İtirazın incelenmesi', kitap: 'Tasarım', topicId: 'tasarim-itiraz' },
  { no: 69, baslik: 'Tasarımın koruma süresi ve yenileme', kitap: 'Tasarım', topicId: 'tasarim-sure-yenileme' },
  { no: 70, baslik: 'Hak sahipliği', kitap: 'Tasarım', topicId: 'tasarim-hak-sahipligi' },
  { no: 71, baslik: 'Tasarımın gaspı', kitap: 'Tasarım', topicId: 'tasarim-hak-sahipligi' },
  { no: 72, baslik: 'Gaspın sona erdirilmesinin sonuçları', kitap: 'Tasarım', topicId: 'tasarim-hak-sahipligi' },
  { no: 73, baslik: 'Hizmet ilişkisi ile diğer iş görme ilişkilerindeki hak sahipliği', kitap: 'Tasarım', topicId: 'tasarim-hak-sahipligi' },
  { no: 74, baslik: 'Çalışanlar tarafından yapılan tasarımlara ilişkin hak talebinde bedel', kitap: 'Tasarım', topicId: 'tasarim-hak-sahipligi' },
  { no: 75, baslik: 'Lisans', kitap: 'Tasarım', topicId: 'tasarim-sona-tecavuz' },
  { no: 76, baslik: 'Hakkın devrinden veya lisans vermekten doğan sorumluluk', kitap: 'Tasarım', topicId: 'tasarim-sona-tecavuz' },
  { no: 77, baslik: 'Hükümsüzlük hâlleri', kitap: 'Tasarım', topicId: 'tasarim-sona-tecavuz' },
  { no: 78, baslik: 'Hükümsüzlük talebi', kitap: 'Tasarım', topicId: 'tasarim-sona-tecavuz' },
  { no: 79, baslik: 'Hükümsüzlüğün etkisi', kitap: 'Tasarım', topicId: 'tasarim-sona-tecavuz' },
  { no: 80, baslik: 'Sona erme ve sonuçları', kitap: 'Tasarım', topicId: 'tasarim-sona-tecavuz' },
  { no: 81, baslik: 'Tasarım hakkına tecavüz sayılan fiiller', kitap: 'Tasarım', topicId: 'tasarim-sona-tecavuz' },

  { no: 146, baslik: 'Süreler ve bildirimler', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-sure-bildirim' },
  { no: 147, baslik: 'Ortak temsilci', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-sure-bildirim' },
  { no: 148, baslik: 'Hukuki işlemler', kitap: 'Ortak ve Diğer Hükümler', topicId: 'marka-lisans-devir' },
  { no: 149, baslik: 'Sınai mülkiyet hakkı tecavüze uğrayan hak sahibinin ileri sürebileceği talepler', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-talepler-tazminat' },
  { no: 150, baslik: 'Tazminat', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-talepler-tazminat' },
  { no: 151, baslik: 'Yoksun kalınan kazanç', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-talepler-tazminat' },
  { no: 152, baslik: 'Hakkın tüketilmesi', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-tuketilme' },
  { no: 153, baslik: 'Dava açılamayacak kişiler', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-dava-mahkeme' },
  { no: 154, baslik: 'Tecavüzün mevcut olmadığına ilişkin dava ve şartları', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-dava-mahkeme' },
  { no: 155, baslik: 'Önceki tarihli hakların etkisi', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-dava-mahkeme' },
  { no: 156, baslik: 'Görevli ve yetkili mahkeme', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-dava-mahkeme' },
  { no: 157, baslik: 'Zamanaşımı', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-dava-mahkeme' },
  { no: 158, baslik: 'Lisans alanın dava açması ve şartları', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-dava-mahkeme' },
  { no: 159, baslik: 'İhtiyati tedbir talebi ve ihtiyati tedbirin niteliği', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-tedbir-ucret' },
  { no: 160, baslik: 'İşlem yetkisi olan kişiler ve tebligat', kitap: 'Ortak ve Diğer Hükümler', topicId: 'vekil-vekaletname' },
  { no: 161, baslik: 'Ücretler, ödenme süreleri ve sonuçları', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-tedbir-ucret' },
  { no: 162, baslik: 'Kararların uygulanması', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-tedbir-ucret' },
  { no: 163, baslik: 'Hızlı imha prosedürü', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ortak-tedbir-ucret' },
  { no: 164, baslik: 'Geleneksel ürün adlarına uygulanacak hükümler', kitap: 'Ortak ve Diğer Hükümler', topicId: 'ci-hukumsuzluk-tecavuz' },
  { no: 165, baslik: 'Yönetmelik', kitap: 'Ortak ve Diğer Hükümler', topicId: 'yon-marka-usul' },
];

export const SMK_BY_NO = new Map(SMK_MADDELER.map((m) => [m.no, m]));

/** Serbest metinde geçen "m.6", "madde 6/1", "6769 s. SMK m. 25" gibi atıfları yakalar. */
const MADDE_RE = /(?:madde|m\.|md\.)\s*(\d{1,3})(?:\s*\/\s*\d+)?/gi;

export function maddeAtiflari(metin: string): number[] {
  const bulunan = new Set<number>();
  for (const eslesme of metin.matchAll(MADDE_RE)) {
    const no = Number(eslesme[1]);
    if (SMK_BY_NO.has(no)) bulunan.add(no);
  }
  return [...bulunan].sort((a, b) => a - b);
}
