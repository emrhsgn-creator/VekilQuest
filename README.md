# VekilQuest

**→ [emrhsgn-creator.github.io/VekilQuest](https://emrhsgn-creator.github.io/VekilQuest/)**

Marka vekilliği sınavına hazırlık için soru çözme, **konu analizi** ve **eksik tespiti** uygulaması.
Çıkmış sınav sorularını yükler, konularına göre çözer, hangi konuda ne kadar hâkim olduğunu
ölçülü biçimde görürsün.

Veriler tamamen tarayıcında (IndexedDB) saklanır. Sunucu yok, hesap yok, yüklediğin PDF'ler
cihazından çıkmaz.

---

## Ne yapar

| Bölüm | İşlevi |
|---|---|
| **Panel** | Günlük hedef, çalışma serisi, öncelikli konular, 30 günlük ısı takvimi |
| **Konu çalışması** | Konu / alan / yıl / durum filtresiyle soru seti kurup anında geri bildirimle çözme |
| **Deneme sınavı** | Süreli, geri bildirimsiz, soru paletli gerçek sınav simülasyonu; deneme geçmişi ve ortalaması |
| **Tekrar** | SM-2 türevi aralıklı tekrar; ısrarla yanlış yapılanlar ve işaretlediklerin |
| **Analiz** | Konu bazlı hâkimiyet, sınav ağırlığı, zaman/yıl eğilimi, hata ve süre analizi |
| **Çalışma planı** | Sınav tarihine göre günlük program, tempo uyarısı, kalan iş hesabı |
| **Soru bankası** | Arama, düzenleme, elle soru ekleme, otomatik konu sınıflandırma, JSON dışa aktarma |
| **İçe aktar** | PDF/metin ayrıştırma, önizleme ve düzeltme, JSON ve yedek yükleme |
| **Mevzuat** | Sınav kapsamındaki 101 SMK maddesi, konu eşleşmeleri ve kaynak bağlantıları |

## Hızlı başlangıç

```bash
npm install
npm run dev      # http://localhost:5173
```

Uygulama açıldığında **İçe aktar → “Örnek soruları yükle”** ile 32 soruluk bir set yükleyip
tüm ekranları hemen deneyebilirsin. Bu sorular resmî sınav sorusu değildir; mevzuata dayanılarak
yazılmış hazırlık sorularıdır ve gerçek kitapçıkları yükledikten sonra silebilirsin.

Diğer komutlar:

```bash
npm test          # ayrıştırıcı testleri
npm run build     # dist/ üretir
npx tsc -b        # tip denetimi
```

## Çıkmış soruları yükleme

TÜRKPATENT, sınav soru kitapçıklarını ve cevap anahtarlarını
[duyurular sayfasında](https://www.turkpatent.gov.tr/duyurular) yayımlıyor. Bu dosyaları indirip
uygulamaya iki yoldan aktarabilirsin — ayrıntılar için **[docs/SORU-YUKLEME.md](docs/SORU-YUKLEME.md)**.

Kısaca:

1. **Uygulamadan** — İçe aktar ekranında kitapçık ve cevap anahtarı PDF'lerini sürükle, yılı gir,
   “Ayrıştır ve önizle” de. Ayrıştırma sonucunu gözden geçirip düzelttikten sonra kaydet.
2. **Terminalden** (çok sayıda yıl için pratik):

   ```bash
   node tools/pdf-to-json.mjs \
     --kitapcik data/ham/2024-marka-A.pdf \
     --anahtar  data/ham/2024-marka-A-cevap.pdf \
     --yil 2024 --kitapcik-turu A
   ```

   Çıktı `data/sorular/` altına JSON olarak yazılır; uygulamadan “JSON dosyası seç” ile yüklersin.

> Ham PDF'ler `.gitignore` ile depo dışında tutulur. Telif durumunu kendin değerlendirmeden
> soru metinlerini herkese açık bir depoya koymamanı öneririm.

## Analiz nasıl hesaplanıyor

Uygulamanın çekirdeği `src/lib/stats.ts`. Üç büyüklük ayrı ayrı hesaplanıp birleştirilir:

- **Hâkimiyet** — konuyu ne kadar bildiğin (0–1). Cevaplamalar 45 günlük yarı ömürle
  ağırlıklandırılır, yani eski başarılar zamanla solar. Az veride tahmin Beta(2,2) öncülüyle
  %50'ye çekilir; arayüzde “az veri” rozetiyle işaretlenir.
- **Sınav ağırlığı** — konunun sınavda çıkma yoğunluğu. Başlangıçta taksonomideki tahmine
  dayanır; sen gerçek soruları yükledikçe ölçülen dağılıma kayar (`gozlemGucu`).
- **Öncelik** — `sınav ağırlığı × eksiklik`. “Çok çıkıyor ama bilmiyorum” konularını üste taşır.
  Panel, Analiz ve Çalışma planı bu skoru kullanır.

Konu taksonomisi `src/data/topics.ts` içinde: 9 hukuk alanı, 55 konu. Her konu SMK maddelerine
ve anahtar ifadelere bağlıdır; içe aktarılan sorular bu iki sinyalle otomatik sınıflandırılır
(`src/lib/classify.ts`). Düşük güvenli atamalar arayüzde işaretlenir, tek tıkla düzeltilir.

## Yayınlama

`main` dalına her push'ta GitHub Actions derleyip GitHub Pages'e yayınlar
(`.github/workflows/deploy.yml`): testler ve tip denetimi geçmeden yayın yapılmaz.
Yayın adresi [emrhsgn-creator.github.io/VekilQuest](https://emrhsgn-creator.github.io/VekilQuest/).

`vite.config.ts` içinde `base: './'` olduğu için uygulama hem kök dizinde hem `/<repo>/`
alt yolunda çalışır; yönlendirme `HashRouter` ile yapıldığından statik sunumda sunucu
yapılandırması gerekmez.

Uygulama tamamen istemci tarafında çalıştığı için yayınlanan sayfa yalnızca kodu barındırır;
soruların ve çözüm geçmişinin hiçbiri sunucuya gitmez.

## Veri güvenliği

Her şey tarayıcının IndexedDB'sinde. Tarayıcı verisi silinirse çalışman kaybolur —
**Ayarlar → Yedek indir** ile düzenli yedek al. Yedek dosyası soruları, tüm çözüm geçmişini,
seansları, tekrar kartlarını ve ayarları içerir; başka bir cihazda geri yüklenebilir.

## Proje yapısı

```
src/
  data/topics.ts     Konu taksonomisi (9 alan, 55 konu)
  data/smk.ts        SMK madde indeksi (kapsam içi 101 madde)
  lib/parse.mjs      Kitapçık/cevap anahtarı ayrıştırıcı (tarayıcı + terminal ortak)
  lib/classify.ts    Otomatik konu sınıflandırma
  lib/stats.ts       Hâkimiyet, sınav ağırlığı, öncelik, plan
  lib/srs.ts         Aralıklı tekrar (SM-2 türevi)
  components/        Grafikler, soru kartı, seans motoru
  pages/             Ekranlar
tools/
  pdf-to-json.mjs    Toplu PDF → JSON dönüştürücü
  validate-bank.mjs  Soru bankası şema denetimi
  parse.test.mjs     Ayrıştırıcı testleri
```

## Sorumluluk reddi

Bu uygulama bir çalışma aracıdır; hukuki görüş vermez. Soru içeriklerinin doğruluğundan ve
yüklenen materyallerin kullanım koşullarından kullanıcı sorumludur. Sınav formatı, soru sayısı
ve süresi TÜRKPATENT'in ilan ettiği güncel duyuruya göre Ayarlar ekranından girilmelidir;
uygulama bir varsayım dayatmaz.
