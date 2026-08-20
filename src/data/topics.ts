/**
 * Marka Vekilliği Sınavı konu taksonomisi.
 *
 * Yapı: Alan (area) -> Konu (topic).
 * Her konunun `madde` alanı, 6769 sayılı SMK'daki karşılığını gösterir; içe
 * aktarılan sorular otomatik sınıflandırılırken hem bu madde numaraları hem de
 * `anahtar` kelimeleri kullanılır (bkz. src/lib/classify.ts).
 *
 * `agirlik`: geçmiş sınavlardaki tipik soru yoğunluğuna göre 1-5 arası öncelik.
 * Uygulama gerçek soru bankası yüklendikçe bu ağırlığı ölçülen dağılımla
 * birlikte kullanır; yani başlangıç tahmini, veriyle güncellenir.
 */

export type Area = {
  id: string;
  ad: string;
  kisa: string;
  /** Grafiklerde kullanılan seri rengi; index.css'te açık/koyu tema için ayrı ayrı tanımlı. */
  renk: string;
};

export type Topic = {
  id: string;
  areaId: string;
  ad: string;
  madde?: string;
  agirlik: 1 | 2 | 3 | 4 | 5;
  anahtar: string[];
};

export const AREAS: Area[] = [
  { id: 'marka', ad: 'Marka Hukuku', kisa: 'Marka', renk: 'var(--seri-1)' },
  { id: 'cografi', ad: 'Coğrafi İşaret ve Geleneksel Ürün Adı', kisa: 'Coğrafi İşaret', renk: 'var(--seri-2)' },
  { id: 'tasarim', ad: 'Tasarım Hukuku', kisa: 'Tasarım', renk: 'var(--seri-3)' },
  { id: 'ortak', ad: 'Ortak Hükümler ve Yargılama', kisa: 'Ortak Hükümler', renk: 'var(--seri-4)' },
  { id: 'vekillik', ad: 'Vekillik Mevzuatı ve Kurum', kisa: 'Vekillik', renk: 'var(--seri-5)' },
  { id: 'uluslararasi', ad: 'Uluslararası Mevzuat', kisa: 'Uluslararası', renk: 'var(--seri-6)' },
  { id: 'yonetmelik', ad: 'Uygulama Yönetmeliği ve Usul', kisa: 'Yönetmelik', renk: 'var(--seri-7)' },
  { id: 'temel', ad: 'Temel Hukuk', kisa: 'Temel Hukuk', renk: 'var(--seri-8)' },
  { id: 'uygulama', ad: 'Kurum Uygulaması ve İçtihat', kisa: 'İçtihat', renk: 'var(--seri-9)' },
];

export const TOPICS: Topic[] = [
  // ---------------------------------------------------------------- MARKA
  {
    id: 'marka-isaret', areaId: 'marka', ad: 'Marka olabilecek işaretler', madde: 'SMK m.4', agirlik: 4,
    anahtar: ['marka olabilecek', 'ayırt etme', 'sicilde gösterilebilir', 'ses markası', 'renk markası', 'üç boyutlu marka', 'hareket markası', 'koku markası', 'işaret türleri'],
  },
  {
    id: 'marka-mutlak-ret', areaId: 'marka', ad: 'Mutlak ret nedenleri', madde: 'SMK m.5', agirlik: 5,
    anahtar: ['mutlak ret', 'ayırt edici nitelikten yoksun', 'tanımlayıcı', 'cins çeşit vasıf', 'ticaret alanında herkes tarafından', 'yanıltıcı', 'dinî değer', 'kamu düzenine aykırı', 'malın doğal yapısı', 'muvafakatname', 'kullanım sonucu ayırt edicilik', 'coğrafi işaretten oluşan'],
  },
  {
    id: 'marka-nispi-ret', areaId: 'marka', ad: 'Nispi ret nedenleri', madde: 'SMK m.6', agirlik: 5,
    anahtar: ['nispi ret', 'karıştırılma ihtimali', 'iltibas', 'tanınmış marka', 'eskiye dayalı kullanım', 'gerçek hak sahipliği', 'ticaret unvanı itiraz', 'telif hakkı itiraz', 'kötüniyetli tescil', 'ortak marka garanti markası yenilenmeyen', 'ticari vekil adına'],
  },
  {
    id: 'marka-hak-kapsam', areaId: 'marka', ad: 'Marka hakkının kapsamı ve istisnaları', madde: 'SMK m.7-8', agirlik: 4,
    anahtar: ['tescilden doğan hak', 'önleme yetkisi', 'dürüstçe kullanım', 'kendi adı adresi', 'yedek parça', 'hazırlık hareketleri', 'başvuru eserlerinde', 'sözlükte yer alma'],
  },
  {
    id: 'marka-kullanim', areaId: 'marka', ad: 'Markanın kullanılması ve kullanmama def’i', madde: 'SMK m.9, 19/2', agirlik: 5,
    anahtar: ['ciddi biçimde kullan', 'beş yıl kullanmama', 'kullanım ispatı', 'kullanmama def', 'haklı sebep', 'ayırt edici karakteri değiştirmeden', 'sadece ihracat amacıyla', 'marka sahibinin izniyle kullanım'],
  },
  {
    id: 'marka-ticari-vekil', areaId: 'marka', ad: 'Ticari vekil veya temsilci adına tescil', madde: 'SMK m.10', agirlik: 2,
    anahtar: ['ticari vekil', 'temsilci adına tescil', 'devir talebi', 'haklı sebep göstermeksizin'],
  },
  {
    id: 'marka-basvuru', areaId: 'marka', ad: 'Başvuru şartları, sınıflandırma ve bölünme', madde: 'SMK m.11', agirlik: 4,
    anahtar: ['başvuru şartları', 'başvuru dilekçesi', 'nice sınıflandırma', 'mal ve hizmet listesi', 'başvurunun bölünmesi', 'sınıf ücreti', 'marka örneği'],
  },
  {
    id: 'marka-ruchan', areaId: 'marka', ad: 'Rüçhan hakkı', madde: 'SMK m.12-13', agirlik: 4,
    anahtar: ['rüçhan hakkı', 'rüçhan süresi', 'altı ay içinde', 'sergi rüçhanı', 'paris sözleşmesine taraf', 'rüçhan belgesi', 'öncelik hakkı'],
  },
  {
    id: 'marka-madrid', areaId: 'marka', ad: 'Madrid Protokolü kapsamında başvurular', madde: 'SMK m.14', agirlik: 3,
    anahtar: ['madrid protokol', 'uluslararası tescil', 'esas başvuru', 'merkezi saldırı', 'wipo', 'sonraki belirleme', 'dönüştürme', 'menşe ofis'],
  },
  {
    id: 'marka-sekli-inceleme', areaId: 'marka', ad: 'Şeklî inceleme ve başvuru tarihi', madde: 'SMK m.15-16', agirlik: 3,
    anahtar: ['şeklî inceleme', 'şeklî eksiklik', 'başvuru tarihi', 'iki ay içinde eksiklik', 'başvurunun yayımlanması', 'bültende yayım', 're’sen inceleme'],
  },
  {
    id: 'marka-gorus-itiraz', areaId: 'marka', ad: 'Üçüncü kişi görüşleri ve yayıma itiraz', madde: 'SMK m.17-19', agirlik: 5,
    anahtar: ['üçüncü kişilerin görüş', 'yayıma itiraz', 'iki ay içinde itiraz', 'itirazın incelenmesi', 'itiraz ücreti', 'uzlaşma', 'itiraza karşı görüş', 'kullanım ispatı talebi'],
  },
  {
    id: 'marka-karara-itiraz', areaId: 'marka', ad: 'Karara itiraz ve Yeniden İnceleme ve Değerlendirme Dairesi', madde: 'SMK m.20-21', agirlik: 4,
    anahtar: ['karara itiraz', 'yeniden inceleme ve değerlendirme', 'yidk', 'iki ay içinde karara itiraz', 'nihai karar', 'iptal davası', 'iki ay içinde dava'],
  },
  {
    id: 'marka-tescil-yenileme', areaId: 'marka', ad: 'Tescil, koruma süresi ve yenileme', madde: 'SMK m.22-23', agirlik: 4,
    anahtar: ['tescil belgesi', 'koruma süresi on yıl', 'yenileme talebi', 'altı aylık ek süre', 'kısmi yenileme', 'başvuru tarihinden itibaren on yıl'],
  },
  {
    id: 'marka-lisans-devir', areaId: 'marka', ad: 'Lisans, devir ve hukuki işlemler', madde: 'SMK m.24, 148', agirlik: 4,
    anahtar: ['inhisari lisans', 'inhisari olmayan lisans', 'alt lisans', 'devir sözleşmesi', 'yazılı şekil', 'noter onaylı', 'sicile kayıt', 'rehin', 'haciz', 'teminat', 'miras yoluyla intikal', 'işletmeden bağımsız devir'],
  },
  {
    id: 'marka-hukumsuzluk', areaId: 'marka', ad: 'Hükümsüzlük', madde: 'SMK m.25', agirlik: 5,
    anahtar: ['hükümsüzlük', 'hükümsüzlük davası', 'sessiz kalma', 'beş yıl sessiz', 'menfaati olanlar', 'kısmi hükümsüzlük', 'hükümsüzlük hâlleri'],
  },
  {
    id: 'marka-iptal', areaId: 'marka', ad: 'İptal hâlleri ve Kurum tarafından iptal', madde: 'SMK m.26', agirlik: 4,
    anahtar: ['iptal talebi', 'kurum tarafından iptal', 'jenerik hâle gelme', 'yanıltıcı hâle gelme', 'teknik şartnameye aykırı', 'iptal hâlleri', 'bir ay içinde delil'],
  },
  {
    id: 'marka-sona-erme', areaId: 'marka', ad: 'Hükümsüzlüğün/iptalin etkisi ve sona erme', madde: 'SMK m.27-28', agirlik: 3,
    anahtar: ['geçmişe etkili', 'iptal etkisi ileriye', 'sona erme', 'vazgeçme', 'yenilenmemesi', 'kesinleşmiş karar', 'kararın etkisi'],
  },
  {
    id: 'marka-tecavuz', areaId: 'marka', ad: 'Marka hakkına tecavüz ve cezai hükümler', madde: 'SMK m.29-30', agirlik: 5,
    anahtar: ['tecavüz sayılan fiiller', 'taklit', 'iktibas', 'iltibas suretiyle', 'cezai hüküm', 'bir yıldan üç yıla kadar hapis', 'şikâyete bağlı', 'etkin pişmanlık', 'satışa arz'],
  },
  {
    id: 'marka-garanti-ortak', areaId: 'marka', ad: 'Garanti markası ve ortak marka', madde: 'SMK m.31-32', agirlik: 3,
    anahtar: ['garanti markası', 'ortak marka', 'teknik şartname', 'kontrol ve denetim', 'gruba dâhil işletmeler', 'şartnamenin değiştirilmesi'],
  },

  // ---------------------------------------------------- COĞRAFİ İŞARET / GÜA
  {
    id: 'ci-turler', areaId: 'cografi', ad: 'Menşe adı, mahreç işareti ve geleneksel ürün adı', madde: 'SMK m.33-35', agirlik: 4,
    anahtar: ['menşe adı', 'mahreç işareti', 'geleneksel ürün adı', 'coğrafi sınırları belirlenmiş', 'tüm üretim aşamaları', 'en az bir aşaması', 'tescil edilmeyecek adlar', 'jenerik ad'],
  },
  {
    id: 'ci-basvuru', areaId: 'cografi', ad: 'Coğrafi işaret başvurusu ve itiraz', madde: 'SMK m.36-40', agirlik: 3,
    anahtar: ['başvuru hakkı üretici grubu', 'coğrafi işaret başvuru', 'bültende yayım', 'üç ay içinde itiraz', 'yabancı ülke kaynaklı başvuru', 'kamu kurumu niteliğindeki meslek kuruluş'],
  },
  {
    id: 'ci-tescil-degisiklik', areaId: 'cografi', ad: 'Coğrafi işaret tescili ve değişiklik talepleri', madde: 'SMK m.41-43', agirlik: 2,
    anahtar: ['coğrafi işaret tescil', 'amblem', 'değişiklik talebi', 'tescil ettirende değişiklik'],
  },
  {
    id: 'ci-kullanim-denetim', areaId: 'cografi', ad: 'Coğrafi işaretin kullanımı ve denetimi', madde: 'SMK m.44-49', agirlik: 4,
    anahtar: ['coğrafi işaret koruması', 'amblem kullanımı zorunlu', 'denetim merci', 'denetim raporu', 'yıllık denetim', 'iyiniyetli kullanım', 'markalarla ilişki', 'tescilli coğrafi işaretin kullanımı'],
  },
  {
    id: 'ci-hukumsuzluk-tecavuz', areaId: 'cografi', ad: 'Coğrafi işarette hükümsüzlük ve tecavüz', madde: 'SMK m.50-54', agirlik: 3,
    anahtar: ['coğrafi işaret hükümsüzlük', 'coğrafi işaret tecavüz', 'geleneksel ürün adı tecavüz', 'vazgeçme', 'ününden yararlanma'],
  },

  // ------------------------------------------------------------- TASARIM
  {
    id: 'tasarim-kavram', areaId: 'tasarim', ad: 'Tasarım, ürün, yenilik ve ayırt edicilik', madde: 'SMK m.55-56', agirlik: 4,
    anahtar: ['tasarım ürünün görünümü', 'bileşik ürün', 'yenilik', 'ayırt edici nitelik', 'bilgilenmiş kullanıcı', 'genel izlenim', 'tasarımcının seçenek özgürlüğü', 'görünür kalma'],
  },
  {
    id: 'tasarim-kamuya-sunma', areaId: 'tasarim', ad: 'Kamuya sunma ve açıklamalar', madde: 'SMK m.57-58', agirlik: 3,
    anahtar: ['kamuya sunma', 'on iki aylık', 'sergileme', 'piyasaya sürme', 'teknik fonksiyonun zorunlu kıldığı', 'kamu düzenine aykırı tasarım', 'tescilsiz tasarım üç yıl'],
  },
  {
    id: 'tasarim-hak-kapsam', areaId: 'tasarim', ad: 'Tasarım hakkının kapsamı ve sınırları', madde: 'SMK m.59-60', agirlik: 3,
    anahtar: ['tasarım hakkının kapsamı', 'tescilsiz tasarım kopyalama', 'önceki kullanımdan doğan hak', 'deneme amaçlı', 'eğitim amaçlı'],
  },
  {
    id: 'tasarim-basvuru', areaId: 'tasarim', ad: 'Tasarım başvurusu, çoklu başvuru ve rüçhan', madde: 'SMK m.61-63', agirlik: 3,
    anahtar: ['çoklu başvuru', 'locarno', 'tasarım görsel anlatım', 'tasarım rüçhan altı ay', 'tasarım başvuru şartları'],
  },
  {
    id: 'tasarim-inceleme-tescil', areaId: 'tasarim', ad: 'Tasarımda inceleme, tescil, yayım ve erteleme', madde: 'SMK m.64-66', agirlik: 3,
    anahtar: ['tasarım incelemesi', 'yayımın ertelenmesi', 'otuz ay', 'tasarım bülteni', 'tasarım tescil'],
  },
  {
    id: 'tasarim-itiraz', areaId: 'tasarim', ad: 'Tasarımda karara ve tescile itiraz', madde: 'SMK m.67-68', agirlik: 3,
    anahtar: ['tescile itiraz', 'üç ay içinde tasarım itiraz', 'tasarım karara itiraz', 'tasarım itirazın incelenmesi'],
  },
  {
    id: 'tasarim-sure-yenileme', areaId: 'tasarim', ad: 'Tasarımda koruma süresi ve yenileme', madde: 'SMK m.69', agirlik: 3,
    anahtar: ['beş yıl tasarım', 'yirmi beş yıl', 'tasarım yenileme', 'tasarım koruma süresi'],
  },
  {
    id: 'tasarim-hak-sahipligi', areaId: 'tasarim', ad: 'Tasarımda hak sahipliği, gasp ve çalışan tasarımları', madde: 'SMK m.70-74', agirlik: 3,
    anahtar: ['tasarım hak sahipliği', 'tasarımın gaspı', 'çalışanların tasarımları', 'hizmet ilişkisi tasarım', 'tasarımcı adının belirtilmesi', 'sipariş üzerine tasarım'],
  },
  {
    id: 'tasarim-sona-tecavuz', areaId: 'tasarim', ad: 'Tasarımda lisans, hükümsüzlük ve tecavüz', madde: 'SMK m.75-81', agirlik: 3,
    anahtar: ['tasarım lisans', 'tasarım hükümsüzlük', 'tasarım tecavüz', 'tasarım sona erme'],
  },

  // ------------------------------------------------------ ORTAK HÜKÜMLER
  {
    id: 'ortak-sure-bildirim', areaId: 'ortak', ad: 'Süreler, bildirimler ve ortak temsilci', madde: 'SMK m.146-147', agirlik: 4,
    anahtar: ['süreler ve bildirimler', 'iki ay içinde', 'sürenin başlangıcı', 'tebliğ tarihinden itibaren', 'ortak temsilci', 'birden çok kişi başvuru'],
  },
  {
    id: 'ortak-talepler-tazminat', areaId: 'ortak', ad: 'Tecavüz hâlinde talepler, tazminat ve yoksun kalınan kazanç', madde: 'SMK m.149-151', agirlik: 5,
    anahtar: ['tecavüzün tespiti', 'tecavüzün önlenmesi', 'tecavüzün durdurulması', 'maddi manevi tazminat', 'itibar tazminatı', 'yoksun kalınan kazanç', 'lisans bedeli', 'el konulması', 'mülkiyet hakkı tanınması', 'kararın ilanı'],
  },
  {
    id: 'ortak-tuketilme', areaId: 'ortak', ad: 'Hakkın tüketilmesi', madde: 'SMK m.152', agirlik: 3,
    anahtar: ['hakkın tüketilmesi', 'piyasaya sunulan ürünler', 'ülke içinde piyasaya sürülme', 'paralel ithalat'],
  },
  {
    id: 'ortak-dava-mahkeme', areaId: 'ortak', ad: 'Menfi tespit, görevli/yetkili mahkeme ve zamanaşımı', madde: 'SMK m.153-158', agirlik: 5,
    anahtar: ['dava açılamayacak kişiler', 'tecavüzün mevcut olmadığına ilişkin dava', 'menfi tespit', 'önceki tarihli hakların etkisi', 'görevli mahkeme', 'fikrî ve sınai haklar hukuk mahkemesi', 'yetkili mahkeme', 'davalının yerleşim yeri', 'zamanaşımı', 'lisans alanın dava açması'],
  },
  {
    id: 'ortak-tedbir-ucret', areaId: 'ortak', ad: 'İhtiyati tedbir, tebligat ve ücretler', madde: 'SMK m.159-163', agirlik: 3,
    anahtar: ['ihtiyati tedbir', 'gümrüklerde el koyma', 'işlem yetkisi olan kişiler', 'tebligat', 'ücretler ödenme süresi', 'hızlı imha', 'kararların uygulanması'],
  },

  // ------------------------------------------------------------ VEKİLLİK
  {
    id: 'vekil-sinav-sicil', areaId: 'vekillik', ad: 'Vekillik sınavı, sicil ve vekil olma şartları', madde: 'Vekillik Yönetmeliği', agirlik: 4,
    anahtar: ['vekillik sınavı', 'vekil siciline kayıt', 'sicil kaydının silinmesi', 'vekillik şartları', 'mesleki yeterlilik sınavı', 'vekil olabilme', 'yeminli mali', 'sicil belgesi', 'vekillik yetki belgesi'],
  },
  {
    id: 'vekil-disiplin', areaId: 'vekillik', ad: 'Vekilin yükümlülükleri ve disiplin hükümleri', madde: 'Vekillik Yönetmeliği', agirlik: 4,
    anahtar: ['disiplin cezası', 'uyarma', 'kınama', 'geçici olarak men', 'meslekten çıkarma', 'disiplin kurulu', 'vekilin yükümlülükleri', 'meslek kuralları', 'sır saklama', 'reklam yasağı'],
  },
  {
    id: 'vekil-vekaletname', areaId: 'vekillik', ad: 'Vekâletname, temsil ve işlem yetkisi', madde: 'SMK m.160', agirlik: 4,
    anahtar: ['vekâletname', 'vekil tayini', 'yerleşim yeri yurt dışında', 'vekil ile temsil zorunlu', 'vekilin azli', 'vekâletten çekilme', 'işlem yetkisi'],
  },
  {
    id: 'vekil-kurum', areaId: 'vekillik', ad: 'TÜRKPATENT teşkilatı, organları ve görevleri', madde: '5000 s. Kanun', agirlik: 3,
    anahtar: ['türk patent ve marka kurumu', 'yönetim kurulu', 'danışma kurulu', 'başkanlık', 'markalar dairesi', 'patent dairesi', 'yeniden inceleme ve değerlendirme kurulu', 'kurumun görevleri', '5000 sayılı'],
  },

  // ------------------------------------------------------- ULUSLARARASI
  {
    id: 'ulus-paris', areaId: 'uluslararasi', ad: 'Paris Sözleşmesi', agirlik: 4,
    anahtar: ['paris sözleşmesi', 'ülkesellik ilkesi', 'eşit işlem', 'milli muamele', 'tanınmış marka 6bis', 'telle quelle', 'birlik ülkesi', 'paris birliği'],
  },
  {
    id: 'ulus-madrid', areaId: 'uluslararasi', ad: 'Madrid Anlaşması ve Madrid Protokolü', agirlik: 4,
    anahtar: ['madrid anlaşması', 'madrid protokolü', 'uluslararası sicil', 'esas başvuruya bağımlılık', 'beş yıl bağımlılık', 'merkezi saldırı', 'geçici ret bildirimi', 'wipo uluslararası büro', 'sonraki belirleme'],
  },
  {
    id: 'ulus-trips', areaId: 'uluslararasi', ad: 'TRIPS ve DTÖ düzenlemeleri', agirlik: 3,
    anahtar: ['trips', 'dünya ticaret örgütü', 'en çok gözetilen ulus', 'asgari koruma', 'dtö'],
  },
  {
    id: 'ulus-siniflandirma', areaId: 'uluslararasi', ad: 'Nice, Viyana, Locarno ve Lahey Anlaşmaları', agirlik: 3,
    anahtar: ['nice anlaşması', 'nice sınıflandırması', 'viyana sınıflandırması', 'locarno anlaşması', 'lahey anlaşması', 'strazburg', 'uluslararası sınıflandırma'],
  },
  {
    id: 'ulus-ab', areaId: 'uluslararasi', ad: 'AB marka mevzuatı ve EUIPO', agirlik: 2,
    anahtar: ['euipo', 'avrupa birliği markası', 'ab marka tüzüğü', 'topluluk markası', 'abad', 'avrupa birliği adalet divanı'],
  },

  // --------------------------------------------------------- YÖNETMELİK
  {
    id: 'yon-marka-usul', areaId: 'yonetmelik', ad: 'Yönetmelikte marka işlemleri usulü', madde: 'SMK Uyg. Yön.', agirlik: 4,
    anahtar: ['uygulanmasına dair yönetmelik', 'yönetmelik uyarınca', 'başvuru formu', 'elektronik başvuru', 'epats', 'evrakın kuruma sunulması', 'eksikliğin giderilmesi süresi'],
  },
  {
    id: 'yon-ucret-sure', areaId: 'yonetmelik', ad: 'Ücret tarifesi ve usule ilişkin süreler', madde: 'SMK Uyg. Yön.', agirlik: 3,
    anahtar: ['ücret tebliği', 'ücret tarifesi', 'ücretin ödenmemesi', 'işlemden kaldırılma', 'yeniden yürürlüğe', 'sürenin uzatılması', 'mücbir sebep'],
  },

  // -------------------------------------------------------- TEMEL HUKUK
  {
    id: 'temel-medeni', areaId: 'temel', ad: 'Medeni Hukuk – başlangıç hükümleri ve kişiler hukuku', madde: 'TMK m.1-117', agirlik: 3,
    anahtar: ['medeni kanun', 'dürüstlük kuralı', 'iyiniyet', 'hakkın kötüye kullanılması', 'ispat yükü', 'hak ehliyeti', 'fiil ehliyeti', 'ayırt etme gücü', 'tüzel kişi', 'dernek', 'vakıf', 'yerleşim yeri', 'kişilik hakkı'],
  },
  {
    id: 'temel-borclar', areaId: 'temel', ad: 'Borçlar Hukuku – vekâlet sözleşmesi', madde: 'TBK m.502-514', agirlik: 3,
    anahtar: ['vekâlet sözleşmesi', 'vekilin özen borcu', 'talimata uygun', 'sadakat borcu', 'vekilin hesap verme', 'alt vekil', 'vekâlet ücreti', 'vekâletin sona ermesi', 'azil ve istifa', 'uygun olmayan zamanda'],
  },
  {
    id: 'temel-ticari-isletme', areaId: 'temel', ad: 'Ticari işletme, tacir, ticaret sicili ve unvan', madde: 'TTK m.11-53', agirlik: 3,
    anahtar: ['ticari işletme', 'tacir sıfatı', 'tacir olmanın hükümleri', 'basiretli iş adamı', 'ticaret sicili', 'tescil ve ilan', 'ticaret unvanı', 'işletme adı', 'ticari defterler', 'cari hesap', 'ticari iş', 'ticari hüküm', 'şube'],
  },
  {
    id: 'temel-haksiz-rekabet', areaId: 'temel', ad: 'Haksız rekabet', madde: 'TTK m.54-63', agirlik: 4,
    anahtar: ['haksız rekabet', 'dürüstlük kurallarına aykırı', 'karıştırılmaya yol açan', 'kötüleme', 'aldatıcı beyan', 'iş şartlarına uymama', 'haksız rekabet davaları', 'haksız rekabette zamanaşımı'],
  },

  // -------------------------------------------------- KURUM UYGULAMASI
  {
    id: 'uyg-kilavuz', areaId: 'uygulama', ad: 'TÜRKPATENT Marka İnceleme Kılavuzu', agirlik: 3,
    anahtar: ['inceleme kılavuzu', 'kurum uygulaması', 'kılavuza göre', 'benzerlik değerlendirmesi kriterleri'],
  },
  {
    id: 'uyg-ictihat', areaId: 'uygulama', ad: 'YİDK kararları ve yargı içtihatları', agirlik: 3,
    anahtar: ['yargıtay', 'hukuk genel kurulu', 'bölge adliye mahkemesi', 'içtihat', 'yidk kararı', 'emsal karar'],
  },
];

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));
export const AREA_BY_ID = new Map(AREAS.map((a) => [a.id, a]));

export function topicAd(id: string | undefined): string {
  if (!id) return 'Sınıflandırılmamış';
  return TOPIC_BY_ID.get(id)?.ad ?? 'Sınıflandırılmamış';
}

export function areaOf(topicId: string | undefined): Area | undefined {
  const t = topicId ? TOPIC_BY_ID.get(topicId) : undefined;
  return t ? AREA_BY_ID.get(t.areaId) : undefined;
}

export function areaRenk(topicId: string | undefined): string {
  return areaOf(topicId)?.renk ?? '#94a3b8';
}
