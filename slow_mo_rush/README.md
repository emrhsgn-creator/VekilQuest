# Slow-Mo Rush

Tek parmakla oynanan hypercasual refleks oyunu (Flutter + Flame).
Basılı tut: zaman yavaşlar. Bırak: ultra hız. Enerji barı 2,5 saniyelik yavaşlatma hakkı verir.

## Çalıştırma

```bash
cd slow_mo_rush
flutter pub get
flutter run          # bağlı Android/iOS cihaz veya emülatör
flutter test         # oyun mantığı testleri
```

## Yapı

| Dosya | İşlev |
|---|---|
| `lib/main.dart` | Uygulama girişi, dikey yön kilidi, AdMob ön yükleme, overlay kaydı |
| `lib/game/slow_mo_game.dart` | Ana `FlameGame`: dokunma, zaman ölçeği, enerji, kamera, ölüm/diriliş |
| `lib/game/components/player.dart` | Neon küre: hareket, iz, parçacıklar, kıl payı ve ölüm efektleri |
| `lib/game/components/obstacle_manager.dart` | Prosedürel engeller, hitbox'lar, kıl payı tespiti |
| `lib/game/components/tunnel.dart` | Sonsuz neon tünel |
| `lib/game/components/hud.dart` | Enerji barı, skor, slow-mo vinyeti, kırmızı parlama |
| `lib/overlays/game_over_dialog.dart` | Skor, en yüksek skor, "İzle & Devam Et", "Yeniden Başla" |
| `lib/services/ad_service.dart` | AdMob ödüllü + geçiş reklamları (ön yüklemeli) |

## Yayından önce yapılacaklar

Şu an her yerde **Google'ın test reklam kimlikleri** kullanılıyor. Kendi AdMob hesabındaki kimliklerle değiştir:

- **App ID (Android):** `android/app/src/main/AndroidManifest.xml` → `com.google.android.gms.ads.APPLICATION_ID`
- **App ID (iOS):** `ios/Runner/Info.plist` → `GADApplicationIdentifier`
- **Reklam birimleri:** `lib/services/ad_service.dart` içindeki `_android*Id` / `_ios*Id` sabitleri
- **iOS SKAdNetwork:** Google'ın [üçüncü taraf listesini](https://developers.google.com/admob/ios/3p-skadnetworks) `Info.plist`'e ekle
- **Paket adı:** `com.slowmorush.slow_mo_rush` (Android `applicationId`, iOS bundle ID); kendi alan adınla değiştir
- AB/UK kullanıcıları için AdMob panelinden GDPR onay mesajını (UMP) yapılandır

Geçiş reklamının "5 saniye sonra geçilebilir" olması koddan değil, AdMob panelindeki reklam birimi ayarlarından belirlenir.
