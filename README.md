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
| **Kapsam filtresi** | Genel Yeterlik kitapçıklarının patent bölümü içe aktarılmaz; yalnızca marka, coğrafi işaret ve ortak sorular bankaya girer |
| **Çalışma planı** | Sınav tarihine göre günlük program, tempo uyarısı, kalan iş hesabı |
| **Soru bankası** | Arama, düzenleme, elle soru ekleme, otomatik konu sınıflandırma, JSON dışa aktarma |
| **İçe aktar** | PDF/metin ayrıştırma, önizleme ve düzeltme, JSON ve yedek yükleme; gömülü bankayı yeniden yükleme |
| **Mevzuat** | Sınav kapsamındaki 101 SMK maddesi, konu eşleşmeleri ve kaynak bağlantıları |

## Hızlı başlangıç

```bash
npm install
npm run dev      # http://localhost:5173
```

Uygulama **ilk açılışta 166 soruluk bankayı kendisi yükler** — siteye giren hiç kimsenin elle
içe aktarma yapması gerekmez. Banka yalnızca boşken yüklenir, yani kendi eklediğin sorular ya da
çözüm geçmişin hiçbir zaman ezilmez.

Diğer komutlar:

```bash
npm test           # ayrıştırıcı testleri
npm run build      # dist/ üretir
npx tsc -b         # tip denetimi
npm run banka:uret # data/sorular/*.json -> public/veri/soru-bankasi.json
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

### Soru bankası ve telif

Uygulamayla birlikte **166 soruluk bir banka dağıtılıyor** (`public/veri/soru-bankasi.json`),
TÜRKPATENT'in kendi sitesinde yayımladığı Genel Yeterlik Sınavı kitapçıklarından ayrıştırılmış.
Amaç kişisel sınav hazırlığı; soruların hakları Türk Patent ve Marka Kurumuna aittir.

Kitapçıkların kapağında şu ibare bulunuyor: *“Hangi amaçla olursa olsun, testlerin tamamının veya
bir kısmının Türk Patent ve Marka Kurumunun yazılı izni olmadan kopya edilmesi … çoğaltılması,
yayınlanması ya da kullanılması yasaktır.”* Bankayı depoya dahil etmek bilinçli bir tercihtir ve
tek dosyayı silmekle geri alınabilir:

```bash
rm public/veri/soru-bankasi.json   # uygulama boş bankayla açılır, içe aktarma çalışmaya devam eder
```

Ham PDF'ler (`data/ham/`) ve ara çıktılar (`data/sorular/`) depoya girmez; bunlar
`npm run banka:uret` ile yeniden üretilebilir.

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

Ölçülen sonuç (2015, 2017, 2019, 2021 A kitapçıkları): **370 soru ayrıştırıldı, 370'inin cevabı
eşleşti, doğrulayıcıda 0 sorun.** 2017 ve 2021 kitapçıkları tek uyarı bile üretmeden 100/100
çıkıyor. Bunların **166'sı marka vekilliği kapsamında**; patent bölümleri içe aktarılmaz.

### Marka kapsamı

Genel Yeterlik kitapçıkları iki sınav taşır: bir bölüm patent, diğeri marka / coğrafi işaret /
tasarım. Marka vekilliğine hazırlanan biri için patent bölümü kapsam dışıdır ve **hiç içe
aktarılmaz.**

Karar tek tek sorulara değil bölümün tamamına bakılarak verilir (`bolumKapsamlari`): tek bir
soruda "patent" kelimesinin geçmesi onu patent sorusu yapmaz, ama kırk sorunun tamamında
geçiyorsa bölüm patent bölümüdür. Eşik oransal olduğu için 2015'in karma **ORTAK** bölümü
elenmez — o sorular marka adayının da kapsamındadır.

| Yıl | Bölüm | Soru | Sonuç |
|---|---|---|---|
| 2015 | PATENT | 25 | elendi |
| 2015 | MARKA · ORTAK | 25 · 23 | alındı |
| 2017 | 1. kitapçık · 2. kitapçık | 60 · 40 | elendi · alındı |
| 2019 | 1. kitapçık · 2. kitapçık | 59 · 38 | elendi · alındı |
| 2021 | 1. kitapçık · 2. kitapçık | 60 · 40 | elendi · alındı |

Hepsini yine de istersen: içe aktarma ekranındaki onay kutusunu kapat ya da
`node tools/pdf-to-json.mjs … --kapsam hepsi`. Bankaya patent sorusu girdiyse Soru Bankası
ekranındaki “Patent sorularını sil” düğmesiyle temizleyebilirsin.

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
