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
| **Sorular** | Çıkmış soruları yıl ve kitapçık bölümüne göre, bankanın tamamını konu ağacına göre gözden geçirme; her gruptan doğrudan çözme |
| **Konu çalışması** | Konu / alan / yıl / durum filtresiyle soru seti kurup anında geri bildirimle çözme |
| **Deneme sınavı** | Süreli, geri bildirimsiz, soru paletli gerçek sınav simülasyonu; karışık deneme gerçek sınavın konu dağılımını taklit eder |
| **Sınav karneleri** | Her çıkmış sınav için ne kadarını çözdüğün ve ilk çözümlerine göre puanın; bankaya sonradan eklenen soruları "Eksik N soruyu çöz" ile tamamlayıp önceki çözümlerinle birleşik toplam sonucu görürsün |
| **Duraklat / devam et** | Her seans duraklatılabilir; sayfadan çıkılsa ya da tarayıcı kapansa bile kaldığın sorudan, kalan süren korunarak Panel'deki “Yarım kalan oturumlar”dan devam edilir |
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

Uygulamayla birlikte **425 soruluk bir banka dağıtılıyor** (`public/veri/soru-bankasi.json`):
TÜRKPATENT'in kendi sitesinde yayımladığı 2015, 2017, 2019, 2021 Genel Yeterlik ve 2024 Marka
Vekilliği sınav kitapçıklarının marka vekilliği kapsamındaki soruları (290 soru) ile Marka İnceleme Kılavuzu'na dayanan
135 soruluk çalışma seti. Resimli/tablolu soruların kitapçıktan kesilmiş görselleri
`public/veri/gorsel/` altında.
Amaç kişisel sınav hazırlığı; soruların hakları Türk Patent ve Marka Kurumuna aittir.

Kitapçıkların kapağında şu ibare bulunuyor: *“Hangi amaçla olursa olsun, testlerin tamamının veya
bir kısmının Türk Patent ve Marka Kurumunun yazılı izni olmadan kopya edilmesi … çoğaltılması,
yayınlanması ya da kullanılması yasaktır.”* Bankayı depoya dahil etmek bilinçli bir tercihtir ve
tek dosyayı silmekle geri alınabilir:

```bash
rm -r public/veri/soru-bankasi.json public/veri/gorsel   # uygulama boş bankayla açılır, içe aktarma çalışmaya devam eder
```

Banka her yayında güncellenebilir. Uygulama açılışta içerik damgasına bakar ve değiştiyse
cihazdaki kopyayı eşitler: yeni sorular eklenir, düzeltilen sorular yenilenir, aynı kitapçığı
daha önce kendin içe aktardıysan o kopya gömülü sürümle birleşir ve çözüm geçmişin yeni soruya
taşınır. Kendi eklediğin diğer sorulara ve işaretlerine dokunulmaz (`src/lib/bankaGuncelle.ts`).

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
| Metni görsel olan boş şık (`C)` hemen altında `D) 986`) | Şık işaretinin önündeki boşluk tüketilmeden (lookbehind) aranır; aksi hâlde sonraki şık kaçıyor, şıklar sonraki sorudan ödünç alınıyor ve o soru kayboluyordu (2019/68–69) |
| Numaradan sonra boşluksuz büyük harf (2019: `67.Bir başvuru…`) | Soru başı sayılır |
| Sayfa altlığı (“Diğer sayfaya geçiniz.”) pdfjs'te parçalara bölünüp son seçeneğe yapışıyor | Sayfanın üst/alt kenar bandındaki metin konumundan atılır (`src/lib/pdfMetin.mjs`) |
| Tireden sonra boşluksuz numara (2015: `15-6098 sayılı…`) | Tanınır; `1-1 1-2` gibi görsel numaraları tanınmaz |
| 2024: patent ve marka kitapçığı tek PDF'te, anahtar 4 sütun (patent 1–30 · 31–60, marka 1–30 · 31–60) | Sütun sayısı bölüm sayısının katıysa ardışık sütunlar aynı bölüme bağlanır |

Ölçülen sonuç (2015, 2017, 2019, 2021, 2024 A kitapçıkları): marka vekilliği kapsamındaki
**290 sorunun tamamı ayrıştırıldı ve cevabı eşleşti**; patent soruları içe aktarılmaz.

### Öncüllü sorular, resimli ve tablolu sorular

PDF metni tek paragrafa dökülüyor. İki ek adım bunu düzeltir:

- **Öncüller** (`1. … 2. …`, `I. … II. …`, `a) … b) …`) ayrı satırlara alınır, liste sonrasındaki
  soru cümlesi ayrı paragrafa iner (`src/lib/bicim.mjs`). Düz yazıdaki sayılar (“25. ve 35.
  sınıflar”, “SMK m. 6/5”) öncül sayılmaz; zincir 1'den başlayıp ardışık gitmek zorunda.
- **Görsel ve tablolar** — amblem, tasarım görselleri, görsel şıklar, tablolar metne dökülemez.
  `tools/gorsel-kes.py` sorunun kitapçıktaki bölgesini (sütun ya da sayfa atlasa bile) kesip
  `public/veri/gorsel/` altına yazar; uygulama bu sorularda kitapçıktaki hâlini gösterir:

  ```bash
  pip install pymupdf pillow
  python3 tools/gorsel-kes.py --pdf data/ham/2024-A.pdf --json data/sorular/2024-marka-A.json --sayfalar 33-56
  ```

  Soru başları sütun kenarındaki numaralardan bulunur ve JSON'daki sırayla eşlenir; bölgede
  raster görsel, tablo çizgisi ya da hizalı sütunlu metin varsa kesilir. Bütün sınavlarda
  her soru kitapçıktaki yerine eşlendi; 33 soru kesildi (2015: 2, 2017: 4, 2019: 7, 2021: 7,
  2024: 13).

Otomatik sınıflandırmanın açıkça yanıldığı sorular `tools/konu-duzeltmeleri.json` ile elle
düzeltilir; `npm run banka:uret` bunu uygular.

### Çözümlü soru bankaları

Yayınevi kitaplarının düzeni farklıdır (`… SORULARI` / `… CEVAPLARI` başlıkları, düzyazı içinde
`CEVAP: X` işaretleri, gerekçeli çözümler). `--tur cozumlu` bu düzeni ayrıştırır ve kitabın
gerekçelerini soruların açıklama alanına yazar. Ayrıntı: [docs/SORU-YUKLEME.md](docs/SORU-YUKLEME.md).

Ticari soru bankaları uygulamayla **dağıtılmaz**; üretilen JSON içe aktarma ekranından
kendi tarayıcına yüklenir.

### Marka kapsamı

Genel Yeterlik kitapçıkları iki sınav taşır: bir bölüm patent, diğeri marka / coğrafi işaret /
tasarım. Marka vekilliğine hazırlanan biri için patent soruları kapsam dışıdır ve **içe
aktarılmaz.**

Karar tek tek sorulara değil bölümün tamamına bakılarak verilir (`bolumKapsamlari`): tek bir
soruda "patent" kelimesinin geçmesi onu patent sorusu yapmaz, ama kırk sorunun tamamında
geçiyorsa bölüm patent bölümüdür. Eşik oransal olduğu için 2015'in karma **ORTAK** bölümü
elenmez — o sorular marka adayının da kapsamındadır.

**Patent kitapçığının ortak bölümü.** 2017–2021'de 1. kitapçık yalnızca patent değil: 1–40
patent ve faydalı model, ardından **41–46 tasarım, 47–48 vekillik mevzuatı, 49–60 genel hukuk**
(Medeni, Borçlar, Ticaret, haksız rekabet). Bu 20 soru marka adayının da kapsamında; 2024'ten
itibaren ayrı yapılan Marka Vekilliği Sınavı'nın 41–60'ı da tam bu bölüm (2024'te patent ve
marka sınavlarının 41–60'ı birebir aynı sorular). Kitapçıkta bu kısım için başlık olmadığından
sınır ölçülerek bulunur (`patentDisiKuyrukBasi`): patent soruları başta tek blok durduğu için
her olası kesim noktasında "öncesi patent, sonrası patent dışı" uyumu sayılır, kuyruğa sızan
patent sorusu ayrıca cezalanır. Tek soru tahmini (`patentSorusuMu`) güçlü patent ifadelerine
bakar ("patent", "buluş", "istem", "faydalı model"…; "TÜRKPATENT" ve "Patent ve Marka
Vekilleri" sayılmaz). Üç yılda da sınır tam 41'de bulunuyor.

Bu sorularda konu ataması da kitapçıktaki yere göre daraltılır: 41–46 yalnızca tasarım ve
uluslararası mevzuat, 47–48 vekillik / ortak hükümler / uluslararası, 49–60 yalnızca genel hukuk
konularına düşebilir (`tools/konu-duzeltmeleri.json` → `alanKurallari`).

| Yıl | Bölüm | Soru | Sonuç |
|---|---|---|---|
| 2015 | PATENT | 25 | elendi |
| 2015 | MARKA · ORTAK | 25 · 25 | alındı |
| 2017 | 1. kitapçık · 2. kitapçık | 40 + 20 · 40 | 1–40 elendi, 41–60 alındı · alındı |
| 2019 | 1. kitapçık · 2. kitapçık | 39 + 20 · 40 | 1–40 elendi, 41–60 alındı · alındı |
| 2021 | 1. kitapçık · 2. kitapçık | 40 + 20 · 40 | 1–40 elendi, 41–60 alındı · alındı |
| 2024 | Patent Vekilliği · Marka Vekilliği | 60 · 60 | elendi (41–60'ı marka sınavıyla aynı) · alındı |

Hepsini yine de istersen: içe aktarma ekranındaki onay kutusunu kapat ya da
`node tools/pdf-to-json.mjs … --kapsam hepsi`. Patent kitapçığının ortak bölümünü de istemiyorsan
(ör. 2024'te, aynı sorular marka sınavında da olduğu için): `--patent-kuyrugu alma`. Bankaya patent sorusu girdiyse Soru Bankası
ekranındaki “Patent sorularını sil” düğmesiyle temizleyebilirsin.

## Karışık deneme neden rastgele değil

Saf rastgele seçim, **bankanın** konu dağılımını yansıtır — sınavınkini değil. Bankada tasarım
sorusu bolsa denemeniz tasarım ağırlıklı çıkar, oysa gerçek sınavda o oran farklıdır.

`gercekciDenemeSec` bunun yerine çıkmış soruları sayıp gerçek dağılımı çıkarır ve her konuya
sınavdaki payı kadar kota ayırır. Kotalar en büyük kalan yöntemiyle tam sayıya yuvarlanır; bir
konuda yeterli soru yoksa açık kalan kontenjan havuzdan tamamlanır, böylece set her hâlükârda
istenen uzunlukta çıkar. Ölçülen dağılım deneme kurma ekranında görünür — 100 soruluk bir
denemede mutlak ret nedenlerinden ~17,7, nispi ret nedenlerinden ~12,8 soru gelir.

Bunun çalışması için bankada **yılı belli çıkmış sorular** bulunmalı. Sorular `tur` alanıyla
ayrılır (`cikmis` / `banka`); alan yoksa yıl bilgisinden türetilir.

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
  lib/pdfMetin.mjs   PDF sayfa metni; başlık/altlık bandını konumdan atar (ortak)
  lib/bicim.mjs      Öncülleri satırlara bölme, sayfa artıklarını ayıklama (ortak)
  lib/bankaGuncelle.ts  Gömülü bankayı cihazdaki kopyayla eşitleme
  lib/karne.ts       Çıkmış sınav karnesi: eksik sorular ve birleşik toplam sonuç
  lib/classify.ts    Otomatik konu sınıflandırma
  lib/stats.ts       Hâkimiyet, sınav ağırlığı, öncelik, plan
  lib/srs.ts         Aralıklı tekrar (SM-2 türevi)
  components/        Grafikler, soru kartı, seans motoru
  pages/             Ekranlar
tools/
  pdf-to-json.mjs    Toplu PDF → JSON dönüştürücü (--sayfalar, --bolum-adi)
  gorsel-kes.py      Resimli/tablolu soruları kitapçıktan kesme
  kilavuz-to-json.mjs  Marka Kılavuzu çalışma kitapçığı dönüştürücü
  konu-duzeltmeleri.json  Elle konu atamaları
  validate-bank.mjs  Soru bankası şema denetimi
  parse.test.mjs     Ayrıştırıcı testleri
```

## Sorumluluk reddi

Bu uygulama bir çalışma aracıdır; hukuki görüş vermez. Soru içeriklerinin doğruluğundan ve
yüklenen materyallerin kullanım koşullarından kullanıcı sorumludur. Sınav formatı, soru sayısı
ve süresi TÜRKPATENT'in ilan ettiği güncel duyuruya göre Ayarlar ekranından girilmelidir;
uygulama bir varsayım dayatmaz.
