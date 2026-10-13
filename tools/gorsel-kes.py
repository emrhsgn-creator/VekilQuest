#!/usr/bin/env python3
"""
Sınav kitapçığındaki resimli / tablolu soruları PDF'ten kesip görsel olarak
kaydeder ve soru JSON'una `gorsel` alanını yazar.

Neden gerekli? Metin çıkarma tabloyu, amblemi, tasarım görselini ya da görsel
şıkları taşıyamıyor: "Aşağıdaki görseller…" diye başlayan bir soru düz metinde
anlaşılmaz hâle geliyor. Bu araç sorunun kitapçıktaki bölgesini olduğu gibi
kesiyor; uygulama da bu sorularda metin yerine kitapçıktaki hâlini gösteriyor.

Kullanım (bağımlılık: pip install pymupdf pillow):

  python3 tools/gorsel-kes.py --pdf data/ham/2024-A.pdf \\
      --json data/sorular/2024-marka-A.json --sayfalar 33-56

  --hepsi     Yalnızca görselli değil, bütün soruları kes.
  --kuru      Hiçbir şey yazma, yalnızca hangi soruların kesileceğini raporla.

Nasıl çalışır?
  1. Her sayfada iki sütun var. Soru numarası ("12." ya da "12-") sütunun en
     sol kenarında ve kalın basılıyor; gövde içindeki "1. … 2. …" öncülleri ise
     içeriden başlıyor. Bu yüzden yalnızca sütun kenarındaki numaralar soru
     başı sayılıyor.
  2. Numaralar okuma sırasında (sayfa → sol sütun → sağ sütun → yukarıdan
     aşağı) dizilip JSON'daki soru sırasıyla eşleniyor. Bir sorunun bölgesi
     kendi numarasından bir sonraki numaraya kadar; sütun ya da sayfa
     atlıyorsa birden çok parça alt alta birleştiriliyor.
  3. Bölgede raster görsel, tablo çizgisi ya da sütunlu (tablo düzeninde)
     metin varsa soru "görselli" sayılıyor ve kesiliyor.
"""

import argparse
import json
import re
import sys
from pathlib import Path

import pymupdf
from PIL import Image

UST_SINIR = 75      # bu satırın üstü sayfa başlığı
ALT_PAY = 77        # sayfa yüksekliğinden bu kadar yukarısı sayfa altlığı
DPI = 170
NUMARA = re.compile(r"^(\d{1,3})\s*[.\-](?!\d)")
BOLUM_BASLIGI = re.compile(r"^(PATENT|MARKA|ORTAK|TASARIM|COĞRAFİ İŞARET)\b.*SORULAR", re.I)


def argumanlar():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--pdf", required=True)
    p.add_argument("--json", required=True, help="data/sorular altındaki soru dosyası (yerinde güncellenir)")
    p.add_argument("--sayfalar", required=True, help="Soruların bulunduğu sayfa aralığı, ör. 33-56")
    p.add_argument("--kimlik-onek", default="", help="Yalnızca bu önekle başlayan soruları eşle")
    p.add_argument("--klasor", default="public/veri/gorsel")
    p.add_argument("--hepsi", action="store_true")
    p.add_argument("--kuru", action="store_true")
    return p.parse_args()


# ───────────────────────────────────────────────────────── sayfa geometrisi

class Sayfa:
    def __init__(self, sayfa: pymupdf.Page, no: int):
        self.sayfa = sayfa
        self.no = no
        self.W = sayfa.rect.width
        self.H = sayfa.rect.height
        self.ust = UST_SINIR
        self.alt = self.H - ALT_PAY
        self.orta = self.W / 2

        # Satırları kelime konumlarından kuruyoruz. İki yana yaslı metinde
        # PDF her kelimeyi ayrı parça olarak verebiliyor; bu yüzden PDF'in kendi
        # "satır" kavramına güvenmek yerine aynı taban çizgisindeki kelimeleri
        # sütun sütun gruplayıp soldan sağa diziyoruz.
        self.satirlar = []
        kovalar = {}
        for x0, y0, x1, y1, kelime, *_ in sayfa.get_text("words"):
            if not (self.ust < y0 and y1 < self.alt + 4):
                continue
            sutun = 1 if x0 >= self.orta - 5 else 0
            anahtar = (sutun, round(y1 / 2.5))
            kovalar.setdefault(anahtar, []).append((x0, y0, x1, y1, kelime))
        for (sutun, _), kelimeler in kovalar.items():
            kelimeler.sort()
            # Hücre: aralarında 18pt'den geniş boşluk olmayan kelime dizisi.
            hucreler = [[kelimeler[0]]]
            for k in kelimeler[1:]:
                if k[0] - hucreler[-1][-1][2] > 18:
                    hucreler.append([k])
                else:
                    hucreler[-1].append(k)
            self.satirlar.append({
                "bbox": (kelimeler[0][0], min(k[1] for k in kelimeler),
                         max(k[2] for k in kelimeler), max(k[3] for k in kelimeler)),
                "metin": " ".join(k[4] for k in kelimeler),
                "sutun": sutun,
                "hucreler": [round(h[0][0]) for h in hucreler],
            })

        self.gorseller = [
            pymupdf.Rect(g["bbox"]) for g in sayfa.get_image_info()
            if self.ust < g["bbox"][3] and g["bbox"][1] < self.alt
            and pymupdf.Rect(g["bbox"]).get_area() > 300
        ]
        # Sütun ayıracı (uzun ince dikey çizgi) ve başlık/altlık çizgileri hariç.
        self.cizimler = []
        for c in sayfa.get_drawings():
            r = c["rect"]
            if r.y1 < self.ust or r.y0 > self.alt:
                continue
            if r.height > 250 and r.width < 3:
                continue
            self.cizimler.append(r)

        # Sütun düzeni: ortayı kesen çok satır varsa sayfa tek sütunludur.
        ortayi_kesen = sum(1 for s in self.satirlar
                           if s["bbox"][0] < self.orta - 30 and s["bbox"][2] > self.orta + 30)
        self.tek_sutun = ortayi_kesen > 3
        # Kesim genişliği metinle sınırlı kalmasın: görseller ve tablo
        # çizgileri metinden daha geniş olabiliyor.
        xs0 = [s["bbox"][0] for s in self.satirlar] + [r.x0 for r in self.gorseller + self.cizimler]
        xs1 = [s["bbox"][2] for s in self.satirlar] + [r.x1 for r in self.gorseller + self.cizimler]
        xs0 = xs0 or [40]
        xs1 = xs1 or [self.W - 40]
        self.sol = max(0, min(xs0) - 8)
        self.sag = min(self.W, max(xs1) + 8)

    def sutun_no(self, x0):
        if self.tek_sutun:
            return 0
        return 1 if x0 >= self.orta - 5 else 0

    def sutun_araligi(self, sutun):
        if self.tek_sutun:
            return self.sol, self.sag
        return (self.sol, self.orta - 3) if sutun == 0 else (self.orta + 1, self.sag)

    def sutun_sayisi(self):
        return 1 if self.tek_sutun else 2

    def numara_adaylari(self):
        """Satır başında numara taşıyan satırlar: (sütun, x0, satır)."""
        for s in self.satirlar:
            if NUMARA.match(s["metin"]) or BOLUM_BASLIGI.match(s["metin"]):
                yield (0 if self.tek_sutun else s["sutun"]), s["bbox"][0], s

    def isaretler(self, kenarlar):
        """Sütun kenarındaki soru numaraları ve bölüm başlıkları."""
        cikti = []
        for sutun, x0, s in self.numara_adaylari():
            # Numaralar sağa hizalı basılabiliyor: "9." ile "10." arasında
            # bir rakam genişliği (~5pt) fark var. Öncüller ise ~20pt içeride.
            kenar = kenarlar.get((self.tek_sutun, sutun))
            if kenar is None or not (kenar - 3 <= x0 <= kenar + 9):
                continue
            e = NUMARA.match(s["metin"])
            if e:
                cikti.append({"tur": "soru", "no": int(e.group(1)), "sayfa": self.no,
                              "sutun": sutun, "y": s["bbox"][1]})
            else:
                cikti.append({"tur": "baslik", "sayfa": self.no, "sutun": sutun, "y": s["bbox"][1]})
        return cikti


def sutun_kenarlari(sayfalar):
    """
    Soru numaralarının basıldığı sol hiza, sütun başına.

    Numara sütunun en solunda, gövde ise içeriden başlıyor ("1." x=57, gövde
    x=80; gövdedeki "1. … 2. …" öncülleri x=72; iki basamaklı numaralar
    sağa hizalı olduğu için birkaç punto solda başlıyor). Bu hiza bütün kitapçıkta
    sabit olduğu için belge genelinde ölçülüyor: numaralı satırların en az üç
    kez tekrarlanan en soldaki x'i. Tek bir sayfaya bakmak yetmez — yalnızca
    öncül taşıyan bir devam sütununda öncüller kenar sanılırdı.
    """
    sayac = {}
    for sayfa in sayfalar:
        for sutun, x0, _ in sayfa.numara_adaylari():
            anahtar = (sayfa.tek_sutun, sutun, round(x0))
            sayac[anahtar] = sayac.get(anahtar, 0) + 1
    kenarlar = {}
    for (tek, sutun, x), adet in sayac.items():
        if adet < 3:
            continue
        if (tek, sutun) not in kenarlar or x < kenarlar[(tek, sutun)]:
            kenarlar[(tek, sutun)] = x
    return kenarlar


def okuma_anahtari(isaret):
    return (isaret["sayfa"], isaret["sutun"], isaret["y"])


# ─────────────────────────────────────────────────────────── bölge hesabı

def parcalar(sayfalar, bas, son):
    """`bas` işaretinden `son` işaretine (ya da belge sonuna) kadar sütun parçaları."""
    sira = [(s.no, sutun) for s in sayfalar for sutun in range(s.sutun_sayisi())]
    harita = {s.no: s for s in sayfalar}
    i = sira.index((bas["sayfa"], bas["sutun"]))
    j = sira.index((son["sayfa"], son["sutun"])) if son else len(sira) - 1
    sonuc = []
    for k in range(i, j + 1):
        sayfa_no, sutun = sira[k]
        sayfa = harita[sayfa_no]
        y0 = bas["y"] - 4 if k == i else sayfa.ust
        y1 = son["y"] - 6 if (son and k == j) else sayfa.alt
        x0, x1 = sayfa.sutun_araligi(sutun)
        dikdortgen = pymupdf.Rect(x0, y0, x1, y1)
        icerik = icerik_siniri(sayfa, dikdortgen)
        if icerik is None:
            continue
        # Boşluğu kırp: parçayı içeriğin gerçekten bittiği yere kadar daralt.
        dikdortgen.y1 = min(dikdortgen.y1, icerik.y1 + 6)
        if k != i:
            dikdortgen.y0 = max(dikdortgen.y0, icerik.y0 - 6)
        sonuc.append((sayfa, dikdortgen))
    return sonuc


def icerik_siniri(sayfa, r):
    kutular = [pymupdf.Rect(s["bbox"]) for s in sayfa.satirlar if pymupdf.Rect(s["bbox"]).intersects(r)]
    kutular += [g for g in sayfa.gorseller if g.intersects(r)]
    kutular += [c for c in sayfa.cizimler if c.intersects(r) and c.width > 3]
    if not kutular:
        return None
    birlesik = pymupdf.Rect(kutular[0])
    for k in kutular[1:]:
        birlesik |= k
    return birlesik & r


def gorsel_mi(parca_listesi):
    """Bölgede metne dökülemeyen içerik var mı? Varsa nedenini döndürür."""
    for sayfa, r in parca_listesi:
        if any(g.intersects(r) and (g & r).get_area() > 300 for g in sayfa.gorseller):
            return "resim"
        cizgi = [c for c in sayfa.cizimler if c.intersects(r) and (c.width > 15 or c.height > 15)]
        if len(cizgi) >= 4:
            return "tablo"
        # Çizgisiz tablo: en az üç satırda üç ya da daha fazla hücre ve bu
        # hücrelerin sol kenarları satırlar arasında hizalı. İki yana yaslı
        # metindeki geniş kelime boşlukları satırdan satıra hizalanmaz.
        satirlar = [s for s in sayfa.satirlar
                    if pymupdf.Rect(s["bbox"]).intersects(r) and len(s["hucreler"]) >= 3]
        hizali = 0
        for i, s in enumerate(satirlar):
            for t in satirlar[i + 1:]:
                ortak = sum(1 for x in s["hucreler"] if any(abs(x - y) <= 3 for y in t["hucreler"]))
                if ortak >= 3:
                    hizali += 1
                    break
        if hizali >= 2:
            return "tablo"
    return None


def kes(parca_listesi, hedef):
    resimler = []
    for sayfa, r in parca_listesi:
        pix = sayfa.sayfa.get_pixmap(clip=r, dpi=DPI)
        resimler.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    genislik = max(r.width for r in resimler)
    bosluk = 14
    yukseklik = sum(r.height for r in resimler) + bosluk * (len(resimler) - 1)
    tuval = Image.new("RGB", (genislik, yukseklik), "white")
    y = 0
    for r in resimler:
        tuval.paste(r, (0, y))
        y += r.height + bosluk
    hedef.parent.mkdir(parents=True, exist_ok=True)
    tuval.save(hedef, "WEBP", quality=74, method=6)
    return tuval.size


# ──────────────────────────────────────────────────────────────── ana akış

def main():
    a = argumanlar()
    belge = pymupdf.open(a.pdf)
    bas_s, son_s = (int(x) for x in a.sayfalar.split("-"))
    sayfalar = [Sayfa(belge[i - 1], i) for i in range(bas_s, son_s + 1)]

    kenarlar = sutun_kenarlari(sayfalar)
    isaretler = sorted((i for s in sayfalar for i in s.isaretler(kenarlar)), key=okuma_anahtari)
    soru_isaretleri = [i for i in isaretler if i["tur"] == "soru"]

    veri = json.loads(Path(a.json).read_text(encoding="utf-8"))
    sorular = [s for s in veri["sorular"] if s["id"].startswith(a.kimlik_onek)]

    # Sıralı eşleme: her soru, kalan işaretler arasında numarası tutan ilk
    # işarete bağlanır. Arada kaçırılmış bir soru varsa küçük bir ileri bakış
    # payı onu atlamaya yetiyor.
    eslesme = {}
    j = 0
    for soru in sorular:
        for k in range(j, min(j + 8, len(soru_isaretleri))):
            if soru_isaretleri[k]["no"] == soru["no"]:
                eslesme[soru["id"]] = soru_isaretleri[k]
                j = k + 1
                break

    eksik = [s["id"] for s in sorular if s["id"] not in eslesme]
    rapor = {"eslesen": len(eslesme), "eslesmeyen": eksik, "kesilen": []}

    for soru in sorular:
        isaret = eslesme.get(soru["id"])
        if not isaret:
            continue
        # Bölgenin sonu: bir sonraki soru başı ya da bölüm başlığı. Tablo
        # satırlarındaki "1. 2. 3." gibi numaralar da sütun kenarına düşebiliyor;
        # bu yüzden yalnızca eşlenmiş soru başları ve bu sorudan hemen sonra
        # gelebilecek numaralar (arada eşlenemeyen bir soru olabilir) sınır sayılıyor.
        eslenen = {id(i) for i in eslesme.values()}
        sonraki = next((
            i for i in isaretler
            if okuma_anahtari(i) > okuma_anahtari(isaret)
            and (i["tur"] == "baslik" or id(i) in eslenen or soru["no"] < i["no"] <= soru["no"] + 3)
        ), None)
        bolge = parcalar(sayfalar, isaret, sonraki)
        neden = gorsel_mi(bolge) or ("hepsi" if a.hepsi else None)
        if not neden:
            soru.pop("gorsel", None)
            continue
        yol = f"veri/gorsel/{soru['id']}.webp"
        rapor["kesilen"].append(f"{soru['id']} ({neden}, {len(bolge)} parça)")
        if not a.kuru:
            kes(bolge, Path(a.klasor) / f"{soru['id']}.webp")
            soru["gorsel"] = yol

    if not a.kuru:
        Path(a.json).write_text(json.dumps(veri, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Eşleşen soru: {rapor['eslesen']} / {len(sorular)}")
    if eksik:
        print("Kitapçıkta yeri bulunamayan:", ", ".join(eksik))
    print(f"Kesilen ({len(rapor['kesilen'])}):")
    for satir in rapor["kesilen"]:
        print("  •", satir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
