import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

/// AdMob katmanı: başlatma, ön yükleme (pre-load) ve gösterme.
///
/// Tasarım ilkeleri:
/// * Reklamlar oyun sırasında ASLA yüklenmez; her zaman bir sonraki gösterim
///   için arka planda hazır bekletilir. Böylece ölüm anında ağ/decode maliyeti
///   oyun döngüsüne (FPS) yansımaz.
/// * Bir reklam gösterilip kapandığı anda bir sonraki hemen yüklenmeye başlar.
/// * Yükleme hatasında üstel geri çekilme (exponential backoff) ile tekrar denenir.
/// * Android/iOS dışındaki platformlarda (web, masaüstü, test) her şey no-op'tur.
class AdService {
  AdService._();
  static final AdService instance = AdService._();

  // --- Google'ın resmi TEST reklam birimleri -------------------------------
  // Yayına çıkmadan önce kendi reklam birimi ID'lerinle değiştir.
  static const _androidRewardedId = 'ca-app-pub-3940256099942544/5224354917';
  static const _androidInterstitialId = 'ca-app-pub-3940256099942544/1033173712';
  static const _iosRewardedId = 'ca-app-pub-3940256099942544/1712485313';
  static const _iosInterstitialId = 'ca-app-pub-3940256099942544/4411468910';

  /// Kaç ölümde bir geçiş reklamı gösterileceği.
  static const int deathsPerInterstitial = 4;

  static const int _maxLoadRetries = 6;

  RewardedAd? _rewardedAd;
  InterstitialAd? _interstitialAd;
  bool _rewardedLoading = false;
  bool _interstitialLoading = false;
  int _rewardedRetry = 0;
  int _interstitialRetry = 0;
  int _deathCount = 0;
  bool _initialized = false;
  bool _showingFullScreenAd = false;

  /// UI'daki "İzle & Devam Et" butonunu etkinleştirmek/pasifleştirmek için.
  final ValueNotifier<bool> rewardedReady = ValueNotifier(false);

  bool get isSupported =>
      !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  bool get isRewardedReady => _rewardedAd != null;
  bool get isShowingAd => _showingFullScreenAd;

  String get _rewardedUnitId =>
      Platform.isIOS ? _iosRewardedId : _androidRewardedId;
  String get _interstitialUnitId =>
      Platform.isIOS ? _iosInterstitialId : _androidInterstitialId;

  /// Uygulama açılışında bir kez çağrılır (main.dart). Bekletmeden
  /// (`unawaited`) çağrılabilir; ilk oyun karesini geciktirmez.
  Future<void> initialize() async {
    if (_initialized || !isSupported) return;
    _initialized = true;
    await MobileAds.instance.initialize();
    _loadRewarded();
    _loadInterstitial();
  }

  // -------------------------------------------------------------------------
  // Rewarded (Ödüllü) reklam
  // -------------------------------------------------------------------------

  void _loadRewarded() {
    if (!_initialized || _rewardedAd != null || _rewardedLoading) return;
    _rewardedLoading = true;

    RewardedAd.load(
      adUnitId: _rewardedUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (ad) {
          _rewardedLoading = false;
          _rewardedRetry = 0;
          _rewardedAd = ad;
          rewardedReady.value = true;
        },
        onAdFailedToLoad: (error) {
          _rewardedLoading = false;
          _rewardedAd = null;
          rewardedReady.value = false;
          debugPrint('[AdService] Rewarded yüklenemedi: $error');
          _scheduleRetry(isRewarded: true);
        },
      ),
    );
  }

  /// Ödüllü reklamı gösterir.
  ///
  /// Dönen değer: kullanıcı ödülü hak ettiyse (reklamı sonuna kadar izlediyse)
  /// `true`. Future, reklam ekranı KAPANDIKTAN sonra tamamlanır; böylece oyun
  /// reklam kapanmadan devam ettirilmez.
  Future<bool> showRewarded() async {
    final ad = _rewardedAd;
    if (ad == null) {
      _loadRewarded();
      return false;
    }
    _rewardedAd = null;
    rewardedReady.value = false;

    final completer = Completer<bool>();
    var earned = false;

    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdShowedFullScreenContent: (_) => _showingFullScreenAd = true,
      onAdDismissedFullScreenContent: (ad) {
        _showingFullScreenAd = false;
        ad.dispose();
        _loadRewarded(); // Bir sonraki tur için hemen ön yükle.
        if (!completer.isCompleted) completer.complete(earned);
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        _showingFullScreenAd = false;
        debugPrint('[AdService] Rewarded gösterilemedi: $error');
        ad.dispose();
        _loadRewarded();
        if (!completer.isCompleted) completer.complete(false);
      },
    );

    await ad.show(onUserEarnedReward: (_, _) => earned = true);
    return completer.future;
  }

  // -------------------------------------------------------------------------
  // Interstitial (Geçiş) reklam
  // -------------------------------------------------------------------------

  void _loadInterstitial() {
    if (!_initialized || _interstitialAd != null || _interstitialLoading) {
      return;
    }
    _interstitialLoading = true;

    InterstitialAd.load(
      adUnitId: _interstitialUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialLoading = false;
          _interstitialRetry = 0;
          _interstitialAd = ad;
        },
        onAdFailedToLoad: (error) {
          _interstitialLoading = false;
          _interstitialAd = null;
          debugPrint('[AdService] Interstitial yüklenemedi: $error');
          _scheduleRetry(isRewarded: false);
        },
      ),
    );
  }

  /// Her kesin ölümde (oyuncu "devam et"i kullanmadan yeni tura geçerken)
  /// çağrılır. Her [deathsPerInterstitial] ölümde bir hazır bekleyen geçiş
  /// reklamını gösterir. Reklam gösterildiyse, kapandığında `true` döner.
  ///
  /// Not: "5 saniye sonra geçilebilir" davranışı istemci tarafında değil,
  /// AdMob panelindeki reklam birimi ayarlarıyla (video/skippable) belirlenir.
  Future<bool> registerDeathAndMaybeShowInterstitial() async {
    _deathCount++;
    if (_deathCount % deathsPerInterstitial != 0) return false;

    final ad = _interstitialAd;
    if (ad == null) {
      // Hazır değilse oyuncuyu bekletmeyiz; sayaç bir sonraki ölüme kayar.
      _deathCount--;
      _loadInterstitial();
      return false;
    }
    _interstitialAd = null;

    final completer = Completer<bool>();
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdShowedFullScreenContent: (_) => _showingFullScreenAd = true,
      onAdDismissedFullScreenContent: (ad) {
        _showingFullScreenAd = false;
        ad.dispose();
        _loadInterstitial();
        if (!completer.isCompleted) completer.complete(true);
      },
      onAdFailedToShowFullScreenContent: (ad, error) {
        _showingFullScreenAd = false;
        debugPrint('[AdService] Interstitial gösterilemedi: $error');
        ad.dispose();
        _loadInterstitial();
        if (!completer.isCompleted) completer.complete(false);
      },
    );

    await ad.show();
    return completer.future;
  }

  // -------------------------------------------------------------------------

  void _scheduleRetry({required bool isRewarded}) {
    final attempt = isRewarded ? ++_rewardedRetry : ++_interstitialRetry;
    if (attempt > _maxLoadRetries) {
      // Vazgeçme: uzun bir beklemeden sonra sayacı sıfırlayıp yeniden dene.
      if (isRewarded) {
        _rewardedRetry = 0;
      } else {
        _interstitialRetry = 0;
      }
    }
    // 2, 4, 8, 16, 32, 64 sn (üst sınır 64 sn).
    final delay = Duration(seconds: math.min(64, 1 << math.min(attempt, 6)));
    Timer(delay, isRewarded ? _loadRewarded : _loadInterstitial);
  }

  void dispose() {
    _rewardedAd?.dispose();
    _interstitialAd?.dispose();
    _rewardedAd = null;
    _interstitialAd = null;
    rewardedReady.value = false;
  }
}
