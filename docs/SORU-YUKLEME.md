# Çıkmış soruları uygulamaya yükleme

TÜRKPATENT, marka vekilliği sınavının soru kitapçıklarını ve cevap anahtarlarını
[turkpatent.gov.tr/duyurular](https://www.turkpatent.gov.tr/duyurular) adresinde yayımlıyor.
Bu belgeleri indirip aşağıdaki iki yoldan biriyle uygulamaya aktarabilirsin.

---

## Yol 1 — Uygulamadan (tek sınav için en pratik)

1. **İçe aktar** ekranını aç.
2. Soru kitapçığı PDF'ini sol kutuya sürükle. **Cevap anahtarı çoğu kitapçığın son sayfasında
   yer alır ve otomatik bulunur** — ayrı bir dosyaysa sağ kutuya yükle.
3. Sınav yılı ve kitapçık türünü gir. Dosya adında yıl geçiyorsa otomatik doldurulur.
4. **Ayrıştır ve önizle**.
5. Önizleme ekranında raporu oku:
   - *Ayrıştırılan soru* — bulunan soru sayısı. Gerçek soru sayısıyla uyuşmuyorsa kitapçık düzeni
     farklıdır; “Metni elle yapıştır” bölümünü kullan.
   - *Cevabı eksik* — cevap anahtarıyla eşleşmeyenler. Her satırdaki açılır menüden elle seçebilirsin.
   - *Sorunlu olanlar* düğmesi yalnızca düzeltme gerektirenleri gösterir.
6. **Bankaya ekle**. Sorular otomatik olarak konulara yerleştirilir.

Aynı yıl ve kitapçığı tekrar aktarırsan mevcut kayıtlar güncellenir, çözüm geçmişin korunur.

## Yol 2 — Terminalden (birçok yılı toplu aktarmak için)

PDF'leri `data/ham/` klasörüne koy (bu klasör `.gitignore`'da, depoya girmez):

```bash
node tools/pdf-to-json.mjs \
  --kitapcik data/ham/2021-genel-A.pdf \
  --yil 2021 \
  --kitapcik-turu A
```

Parametreler:

| Parametre | Açıklama |
|---|---|
| `--kitapcik` | Soru kitapçığı PDF veya TXT (zorunlu) |
| `--anahtar` | Cevap anahtarı PDF veya TXT — kitapçığın içindeyse gerekmez |
| `--yil` | Sınav yılı, ör. `2024` |
| `--kitapcik-turu` | `A` veya `B` |
| `--oturum` | Aynı yılda birden fazla oturum varsa |
| `--cikti` | Çıktı dosyası (varsayılan `data/sorular/<yil>-marka-<tür>.json`) |

Sonra:

```bash
node tools/validate-bank.mjs data/sorular   # şema ve tutarlılık denetimi
```

Üretilen JSON'u uygulamadan **İçe aktar → JSON dosyası seç** ile yükle.

---

## Ayrıştırma sorunları

**“Metinde numaralandırılmış soru bulunamadı”**
PDF taranmış görüntü olabilir; metin katmanı yoktur. Çözüm: PDF'i bir PDF okuyucuda açıp metni
kopyala ve “Metni elle yapıştır” alanına yapıştır. Ya da PDF'e OCR uygula
(`ocrmypdf giris.pdf cikis.pdf`) ve yeniden dene.

**Soru sayısı eksik çıkıyor**
Kitapçıkta iki sütunlu düzen varsa satır sırası bozulabilir. Metni elle yapıştırma yolu
genellikle daha iyi sonuç verir.

**Seçenekler birbirine karışmış**
Önizleme ekranında ilgili soruyu gör, sonra Soru bankası ekranından düzenle. Ayrıştırıcı
`A)` `B)` … düzenini arar; kitapçıkta `a.` `b.` gibi bir biçim varsa metni yapıştırmadan önce
toplu değiştirmen gerekebilir.

**Cevap anahtarı eşleşmiyor**
Anahtar tablo hâlindeyse sütunlar karışabilir. `1-C 2-A 3-E` biçiminde düz metin olarak
yapıştırmak en güvenli yoldur. Ayrıştırıcı `1-A`, `1. A`, `1) A`, `1 A` ve `1 | A`
biçimlerinin hepsini tanır.

**İptal edilen sorular**
Cevap anahtarında `12-İPTAL` gibi geçen sorular otomatik olarak iptal işaretlenir ve
istatistiklere katılmaz. Sonradan Soru bankası ekranından da işaretleyebilirsin.

---

## Konu sınıflandırması

İçe aktarılan sorularda konu bilgisi bulunmaz; uygulama iki sinyale bakar:

1. **Madde atıfları** — “6 ncı maddesi”, “m.25”, “madde 18” gibi ifadeler yakalanır ve
   `src/data/smk.ts`'deki madde–konu eşleşmesi kullanılır. Güçlü sinyaldir.
2. **Anahtar ifadeler** — her konuya bağlı ifadeler (`src/data/topics.ts`). Uzun ifadeler
   kısa olanlardan daha ayırt edici sayılır.

Sonuç bir güven skoruyla gelir. Güveni %40'ın altında kalan atamalar Soru bankası ekranında
`?` rozetiyle işaretlenir. **Otomatik sınıflandır** düğmesi, elle atadıkların dışındaki tüm
soruları yeniden değerlendirir.

Bir konu sürekli yanlış eşleşiyorsa `src/data/topics.ts` içindeki `anahtar` dizisine ayırt edici
bir ifade eklemek kalıcı çözümdür.

---

## Genel Yeterlik kitapçıklarının yapısı

2017 ve sonrasındaki kitapçıklar tek dosyada iki sınav taşıyor:

| Bölüm | Soru | Numaralandırma | İçerik |
|---|---|---|---|
| 1. kitapçık | 60 | 1–60 | Patent ve faydalı model |
| 2. kitapçık | 40 | 61–100 (bazı yıllarda 1–40) | Marka, coğrafi işaret, tasarım |
| Cevap anahtarı | — | 1–100 | Kitapçığın son sayfası |

2015 kitapçığı bunun yerine `PATENT SORULARI` / `MARKA SORULARI` / `ORTAK SORULAR` başlıklarıyla
üçe ayrılmış; her bölüm 1'den yeniden numaralanıyor ve cevap anahtarı üç paralel sütun hâlinde.
Ayrıştırıcı iki düzeni de tanır.

Dikkat: bölüm başlıkları **sayfa üstbilgisi** olarak basıldığı için bölümün ortasında beliriyor,
başında değil. Bu yüzden bölüm sınırı başlıktan değil, numaralandırmanın 1'e dönmesinden anlaşılır.

## Marka kapsamı

Kitapçıkların yarısından fazlası patent sorusu ve bunlar **hiç içe aktarılmaz.** İçe aktarma
ekranındaki *“Patent sorularını alma”* kutusu varsayılan olarak işaretlidir; terminal aracında
aynı davranış `--kapsam marka` (varsayılan) ile gelir.

Kapsam kararı bölüm bazında verilir, tek tek sorulara göre değil. Böylece:

- Patent bölümündeki bir marka sorusu yanlışlıkla elenmez — bölümün tamamı elenir ya da kalır.
- 2015'in karma **ORTAK** bölümü korunur; o sorular marka adayının da kapsamındadır.

Hepsini istiyorsan onay kutusunu kaldır ya da `--kapsam hepsi` ver. Bankaya sonradan patent
sorusu girdiyse Soru Bankası ekranındaki **“Patent sorularını sil”** düğmesiyle temizleyebilirsin.
Ayrıca **Ayarlar → “Yalnızca marka vekilliği kapsamındaki soruları çalış”** ikinci bir güvence
olarak durur.

## Telif

Kitapçıkların kapağında şu ibare var: *“Hangi amaçla olursa olsun, testlerin tamamının veya bir
kısmının Türk Patent ve Marka Kurumunun yazılı izni olmadan kopya edilmesi, fotoğrafının
çekilmesi, herhangi bir yolla çoğaltılması, yayınlanması ya da kullanılması yasaktır.”*

Bu nedenle `data/ham/` ve `data/sorular/` klasörleri `.gitignore` içindedir; ne ham PDF'ler ne de
ayrıştırılmış soru metinleri depoya girer. Soru bankan yalnızca kendi tarayıcının IndexedDB'sinde
durur ve Ayarlar ekranından aldığın yedek dosyasıyla taşınır.
