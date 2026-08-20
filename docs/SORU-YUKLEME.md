# Çıkmış soruları uygulamaya yükleme

TÜRKPATENT, marka vekilliği sınavının soru kitapçıklarını ve cevap anahtarlarını
[turkpatent.gov.tr/duyurular](https://www.turkpatent.gov.tr/duyurular) adresinde yayımlıyor.
Bu belgeleri indirip aşağıdaki iki yoldan biriyle uygulamaya aktarabilirsin.

---

## Yol 1 — Uygulamadan (tek sınav için en pratik)

1. **İçe aktar** ekranını aç.
2. Soru kitapçığı PDF'ini sol kutuya, cevap anahtarını sağ kutuya sürükle.
   (Cevap anahtarı isteğe bağlıdır; olmadan sorular “cevapsız” kaydedilir ve denemede çıkmaz.)
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
  --kitapcik data/ham/2024-marka-A.pdf \
  --anahtar  data/ham/2024-marka-A-cevap.pdf \
  --yil 2024 \
  --kitapcik-turu A
```

Parametreler:

| Parametre | Açıklama |
|---|---|
| `--kitapcik` | Soru kitapçığı PDF veya TXT (zorunlu) |
| `--anahtar` | Cevap anahtarı PDF veya TXT |
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
