import 'dart:async';
import 'dart:math' as math;

import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flame/game.dart';
import 'package:flutter/widgets.dart';

import '../services/ad_service.dart';
import 'components/hud.dart';
import 'components/obstacle_manager.dart';
import 'components/player.dart';
import 'components/tunnel.dart';

enum GameState { ready, playing, gameOver }

/// Bütün oyun dünyası bu bileşenin altında yaşar; `timeScale` slow-mo'yu
/// tüm alt ağaca (oyuncu, engeller, parçacıklar) tek noktadan uygular.
class SlowMoWorld extends World with HasTimeScale {}

class SlowMoGame extends FlameGame<SlowMoWorld>
    with HasCollisionDetection, TapCallbacks {
  SlowMoGame() : super(world: SlowMoWorld());

  static const String gameOverOverlay = 'gameOver';

  // --- Zaman ayarları ------------------------------------------------------
  /// Basılı tutarken dünyanın (engellerin) hızı: %85 yavaşlama.
  static const double worldSlowScale = 0.15;

  /// Basılı tutarken oyuncunun kendi ileri hareketinin hızı. Dünyadan daha az
  /// yavaşladığı için slow-mo, engellere göre gerçek bir zamanlama avantajı.
  static const double playerSlowScale = 0.5;

  static const double maxStamina = 2.5; // sn (gerçek zaman)
  static const double staminaRegenPerSecond = 0.55;
  static const double _exhaustRecoverMin = 0.25;

  static const double _slowInRate = 14; // yumuşatma hızları (1/sn)
  static const double _slowOutRate = 9;
  static const double _slowZoomBoost = 0.14; // slow-mo'da %14 yakınlaşma
  static const double _visibleWorldWidth = 760;
  static const double _visibleWorldHeight = 520;
  static const Duration _gameOverDelay = Duration(milliseconds: 100);

  // --- Bileşenler ----------------------------------------------------------
  late final Player player;
  late final ObstacleManager obstacles;
  late final Hud hud;

  // --- Durum ---------------------------------------------------------------
  GameState state = GameState.ready;
  final ValueNotifier<int> score = ValueNotifier(0);
  int nearMissCount = 0;

  double stamina = maxStamina;
  bool _exhausted = false;
  double slowMoAmount = 0; // 0..1, gerçek zamanla yumuşatılmış
  bool _reviveUsed = false;
  final Set<int> _pointers = {};

  /// Çentik/Dynamic Island altına bar çizmemek için (main.dart ayarlar).
  double safeTopInset = 0;

  double _baseZoom = 1;
  double _shakeTime = 0;
  final math.Random _rng = math.Random();

  bool get isHolding => _pointers.isNotEmpty;
  bool get isExhausted => _exhausted;
  double get staminaRatio => (stamina / maxStamina).clamp(0.0, 1.0);

  /// "İzle & Devam Et" yalnızca turda bir kez ve reklam hazırsa.
  bool get canRevive =>
      state == GameState.gameOver &&
      !_reviveUsed &&
      AdService.instance.isRewardedReady;

  @override
  Color backgroundColor() => const Color(0xFF05010F);

  @override
  Future<void> onLoad() async {
    camera.viewfinder.anchor = const Anchor(0.28, 0.5);

    player = Player(onHit: (_) => _onPlayerHit());
    obstacles = ObstacleManager(
      player: player,
      onObstaclePassed: () => score.value++,
      onNearMiss: () {
        nearMissCount++;
        score.value++;
      },
    );
    hud = Hud();

    await world.addAll([Tunnel(), obstacles, player]);
    await camera.viewport.add(hud);
    _followPlayer();
  }

  @override
  void onGameResize(Vector2 size) {
    super.onGameResize(size);
    _baseZoom = math.min(
      size.x / _visibleWorldWidth,
      size.y / _visibleWorldHeight,
    );
  }

  // -------------------------------------------------------------------------
  // Girdi: tek parmak — basılı tut = slow-mo
  // -------------------------------------------------------------------------

  @override
  void onTapDown(TapDownEvent event) {
    _pointers.add(event.pointerId);
    if (state == GameState.ready) state = GameState.playing;
  }

  @override
  void onTapUp(TapUpEvent event) => _release(event.pointerId);

  @override
  void onTapCancel(TapCancelEvent event) => _release(event.pointerId);

  void _release(int pointerId) {
    _pointers.remove(pointerId);
    if (_pointers.isEmpty && _exhausted && stamina >= _exhaustRecoverMin) {
      _exhausted = false;
    }
  }

  @override
  void lifecycleStateChange(AppLifecycleState state) {
    super.lifecycleStateChange(state);
    // Arka plana geçerken "tap up" kaybolabilir; parmak takılı kalmasın.
    if (state != AppLifecycleState.resumed) _pointers.clear();
  }

  // -------------------------------------------------------------------------
  // Döngü
  // -------------------------------------------------------------------------

  @override
  void update(double dt) {
    final slowRequested = state == GameState.playing && _updateStamina(dt);

    final target = slowRequested ? 1.0 : 0.0;
    final rate = target > slowMoAmount ? _slowInRate : _slowOutRate;
    slowMoAmount += (target - slowMoAmount) * (1 - math.exp(-rate * dt));
    if ((target - slowMoAmount).abs() < 0.001) slowMoAmount = target;

    final worldScale = state == GameState.ready
        ? 0.0
        : _lerp(1, worldSlowScale, slowMoAmount);
    world.timeScale = worldScale;
    player
      ..slowMoAmount = slowMoAmount
      ..forwardTimeFactor = worldScale > 0
          ? _lerp(1, playerSlowScale, slowMoAmount) / worldScale
          : 1;

    super.update(dt);

    if (_shakeTime > 0) _shakeTime = math.max(0, _shakeTime - dt);
    _followPlayer();
  }

  /// Enerjiyi gerçek zamanla tüketir/doldurur. Slow-mo aktifse `true`.
  bool _updateStamina(double dt) {
    if (isHolding && !_exhausted) {
      stamina -= dt;
      if (stamina <= 0) {
        stamina = 0;
        _exhausted = true; // Zaman mecburen hızlanır; parmak kaldırılmalı.
        return false;
      }
      return true;
    }
    // Bar yalnızca parmak kaldırıldığında dolar.
    if (isHolding) return false;
    stamina = math.min(maxStamina, stamina + staminaRegenPerSecond * dt);
    if (_exhausted && stamina >= _exhaustRecoverMin) {
      _exhausted = false;
    }
    return false;
  }

  void _followPlayer() {
    final vf = camera.viewfinder;
    vf.zoom = _baseZoom * (1 + _slowZoomBoost * slowMoAmount);
    // Not: Viewfinder.position bir kopya döndürür; yerinde değiştirilemez.
    var shakeX = 0.0;
    var shakeY = 0.0;
    if (_shakeTime > 0) {
      final strength = 9 * _shakeTime / 0.3;
      shakeX = (_rng.nextDouble() - 0.5) * strength;
      shakeY = (_rng.nextDouble() - 0.5) * strength;
    }
    vf.position = Vector2(player.position.x + shakeX, shakeY);
  }

  // -------------------------------------------------------------------------
  // Ölüm, diriliş, yeniden başlama
  // -------------------------------------------------------------------------

  void _onPlayerHit() {
    if (state != GameState.playing) return;
    state = GameState.gameOver;
    _pointers.clear();
    hud.flashRed(); // 100 ms kırmızı parlama (titreşim Player.die içinde)
    _shakeTime = 0.3;
    Future.delayed(_gameOverDelay, () {
      if (state == GameState.gameOver) overlays.add(gameOverOverlay);
    });
  }

  /// Ödüllü reklamı gösterir; ödül kazanıldıysa kaldığı yerden tam enerjiyle
  /// devam eder. Turda yalnızca bir kez kullanılabilir.
  Future<bool> watchAdAndRevive() async {
    if (!canRevive) return false;

    pauseEngine();
    final earned = await AdService.instance.showRewarded();
    resumeEngine();
    if (!earned || state != GameState.gameOver) return false;

    _reviveUsed = true;
    overlays.remove(gameOverOverlay);
    obstacles.clearAhead();
    player.revive();
    stamina = maxStamina;
    _exhausted = false;
    slowMoAmount = 0;
    _pointers.clear();
    // Oyuncu hazır olunca dokunarak başlasın.
    state = GameState.ready;
    return true;
  }

  /// Yeni tur. Her 4 kesin ölümde bir, önceden yüklenmiş geçiş reklamı araya
  /// girer (motor bu sırada duraklatılır).
  Future<void> restart() async {
    overlays.remove(gameOverOverlay);
    pauseEngine();
    await AdService.instance.registerDeathAndMaybeShowInterstitial();
    resumeEngine();

    player.reset(Vector2.zero());
    obstacles.reset();
    score.value = 0;
    nearMissCount = 0;
    stamina = maxStamina;
    _exhausted = false;
    _reviveUsed = false;
    slowMoAmount = 0;
    _shakeTime = 0;
    _pointers.clear();
    state = GameState.ready;
    _followPlayer();
  }

  static double _lerp(double a, double b, double t) => a + (b - a) * t;
}
