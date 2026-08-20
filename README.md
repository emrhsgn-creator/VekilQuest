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
| **Kapsam filtresi** | Genel Yeterlik kitapçıkları patent sorularını da taşır; ayarlardan patent soruları çalışma ve analiz dışında tutulur |
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

TÜRKPATENT, Genel Yeterlik Sınavı kitapçıklarını
[duyurular sayfasında](https://www.turkpatent.gov.tr/duyurular) yayımlıyor. Cevap anahtarı
genellikle kitapçığın son sayfasında yer alır ve ayrıştırıcı onu kendisi bulur.

1. **Uygulamadan** — İçe aktar ekranında kitapçık PDF'ini sürükle, yılı gir, “Ayrıştır ve
   önizle” de. Sonucu gözden geçirip kaydet.
2. **Terminalden** (çok sayıda yıl için pratik):

   ```bash
   node tools/pdf-to-json.mjs --kitapcik data/ham/2021-genel-A.pdf --yil 2021 --kitapcik-turu A
   node tools/validate-bank.mjs data/sorular
   ```

   Çıktı `data/sorular/` altına yazılır; uygulamadan “JSON dosyası seç” ile yüklersin.

Ayrıntılar ve sorun giderme: **[docs/SORU-YUKLEME.md](docs/SORU-YUKLEME.md)**

> **Soru metinleri bu depoda yok ve olmamalı.** Kitapçıkların kapağında şu ibare var:
> *“Hangi amaçla olursa olsun, testlerin tamamının veya bir kısmının Türk Patent ve Marka
> Kurumunun yazılı izni olmadan kopya edilmesi … çoğaltılması, yayınlanması ya da kullanılması
> yasaktır.”* Bu yüzden hem `data/ham/` hem `data/sorular/` `.gitignore` içinde. Soru bankan
> yalnızca kendi tarayıcında durur.

### Ayrıştırıcı ne yapıyor

Kitapçık düzeni yıldan yıla değişiyor ve naif bir “satır başındaki numara = yeni soru” kuralı
üç yerde birden patlıyor. Ayrıştırıcı bunları çözer:

| Tuzak | Çözüm |
|---|---|
| Kapaktaki AÇIKLAMALAR listesi de 1-10 diye numaralı | İlk seçenek kümesinden önceki KISALTMALAR/AÇIKLAMALAR bloğu atılır |
| Soru gövdesindeki “1. … 2. …” alt maddeleri | Sorular numaralardan değil **A→E seçenek kümelerinden** yakalanır; alt maddeler numaradan sonra geldiği için elenir |
| Soru ayracı yıla göre değişiyor (`7.` / `7-` / `7)`) | Üçü de tanınır |
| Her sayfanın üstündeki “SORU KİTAPÇIĞI **(A)**” | Parantezli harfler seçenek sayılmaz |
| Türkçe `İ` — JS'te `/kitapçığı/i` deseni `KİTAPÇIĞI` ile eşleşmez | Desenler önce Türkçe-duyarlı katlamadan geçirilir |
| Kitapçık iki bölümlü (60 + 40 soru); biri 1'den, biri 61'den başlıyor | Basılı numaralar esas alınır, süreklilik ölçülüp kaydırma buna göre yapılır |
| Cevap anahtarı bazen 5 sütun sürekli (1-100), bazen bölüm başına paralel (2015) | Numaralar benzersizse tek harita, tekrar ediyorsa sütun-bölüm eşlemesi |
| Gövdesi görsel olan sorulardan artakalan seçenek blokları | Numarası olmayan bloklar soru sayılmaz — yoksa **sonraki bütün cevaplar kayar** |

Ölçülen sonuç (2015, 2017, 2019, 2021 A kitapçıkları): **370 soru, 370'inin cevabı eşleşti,
doğrulayıcıda 0 sorun.** 2017 ve 2021 kitapçıkları tek uyarı bile üretmeden 100/100 çıkıyor.

## Analiz nasıl hesaplanıyor

Uygulamanın çekirdeği `src/lib/stats.ts`. Üç büyüklük ayrı ayrı hesaplanıp birleştirilir:

- **Hâkimiyet** — konuyu ne kadar bildiğin (0–1). Cevaplamalar 45 günlük yarı ömürle
  ağırlıklandırılır, yani eski başarılar zamanla solar. Az veride tahmin Beta(2,2) öncülüyle
  %50'ye çekilir; arayüzde “az veri” rozetiyle işaretlenir.
- **Sınav ağırlığı** — konunun sınavda çıkma yoğunluğu. Başlangıçta taksonomideki tahmine
  dayanır; sen gerçek soruları yükledikçe ölçülen dağılıma kayar (`gozlemGucu`).
- **Öncelik** — `sınav ağırlığı × eksiklik`. “Çok çıkıyor ama bilmiyorum” konularını üste taşır.
  Panel, Analiz ve Çalışma planı bu skoru kullanır.

Konu taksonomisi `src/data/topics.ts` içinde: 10 hukuk alanı, 64 konu. Her konu SMK maddelerine
ve anahtar ifadelere bağlıdır; içe aktarılan sorular bu iki sinyalle otomatik sınıflandırılır
(`src/lib/classify.ts`). Düşük güvenli atamalar arayüzde işaretlenir, tek tıkla düzeltilir.

Sınıflandırma tek tek sorulara bakmakla kalmaz: **kitapçık bölümünü de kullanır.** Genel Yeterlik
kitapçıklarının bir bölümü patent, diğeri marka sorularından oluşuyor ve bu, anahtar kelimelerden
çok daha güçlü bir sinyal. Hangi bölümün patent olduğu sabit kabul edilmez — her bölümün kendi
patent oranı ölçülür, yılın en yüksek oranlı bölümü patent kabul edilip o bölümdeki sorular
patent konularına kısıtlanır. Böylece kural, düzeni farklı gelecek kitapçıklarda da kendini ayarlar.

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
