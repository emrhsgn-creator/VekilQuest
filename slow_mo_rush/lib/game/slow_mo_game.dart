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

/// Bütün oyun dünyası bu bileşenin altında yaşar; `timeScale` başlangıçta
/// (ilk dokunuşa kadar) tüm alt ağacı tek noktadan dondurur.
class SlowMoWorld extends World with HasTimeScale {}

class SlowMoGame extends FlameGame<SlowMoWorld>
    with HasCollisionDetection, DragCallbacks {
  SlowMoGame() : super(world: SlowMoWorld());

  static const String gameOverOverlay = 'gameOver';

  // --- Ayarlar -------------------------------------------------------------
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

  bool _reviveUsed = false;
  final Set<int> _pointers = {};

  /// Topu yönlendiren parmak (ilk değen) ve topun gitmek istediği y.
  int? _steerPointer;
  double _targetY = 0;

  /// Parmak 1 piksel kayınca top dünyada kaç birim kayar (ekran ölçeğine göre).
  static const double steerSensitivity = 1.25;

  /// Topun dikey hareket hız sınırı (dünya birimi / saniye). Çok hızlı
  /// bir kaydırmada topun ince bir engelin içinden "ışınlanmasını" önler.
  static const double maxSteerSpeed = 1600;
  static const double _steerMargin = 3;

  /// Çentik/Dynamic Island altına bar çizmemek için (main.dart ayarlar).
  double safeTopInset = 0;

  double _baseZoom = 1;
  double _shakeTime = 0;
  final math.Random _rng = math.Random();

  bool get isHolding => _pointers.isNotEmpty;
  bool get reviveUsed => _reviveUsed;

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
  // Girdi: tek parmak — sürükle = topu yukarı-aşağı yönlendir
  // -------------------------------------------------------------------------

  @override
  void onDragStart(DragStartEvent event) {
    super.onDragStart(event);
    _pointers.add(event.pointerId);
    if (_steerPointer == null) {
      _steerPointer = event.pointerId;
      _targetY = player.position.y;
    }
    if (state == GameState.ready) state = GameState.playing;
  }

  @override
  void onDragUpdate(DragUpdateEvent event) {
    super.onDragUpdate(event);
    if (event.pointerId != _steerPointer || state != GameState.playing) return;
    // Göreli kontrol: parmağın ekrandaki kayması kadar top da kayar; parmağı
    // ekranın neresine koyduğun önemli değil.
    final dy = event.deviceDelta.y / camera.viewfinder.zoom * steerSensitivity;
    final limit = kTunnelHalfHeight - Player.radius - _steerMargin;
    _targetY = (_targetY + dy).clamp(-limit, limit);
  }

  @override
  void onDragEnd(DragEndEvent event) {
    super.onDragEnd(event);
    _release(event.pointerId);
  }

  @override
  void onDragCancel(DragCancelEvent event) {
    super.onDragCancel(event);
    _release(event.pointerId);
  }

  void _release(int pointerId) {
    _pointers.remove(pointerId);
    if (pointerId == _steerPointer) {
      // Başka parmak hâlâ ekrandaysa yönlendirmeyi o devralır.
      _steerPointer = _pointers.isEmpty ? null : _pointers.first;
      _targetY = player.position.y;
    }
  }

  @override
  void lifecycleStateChange(AppLifecycleState state) {
    super.lifecycleStateChange(state);
    // Arka plana geçerken "tap up" kaybolabilir; parmak takılı kalmasın.
    if (state != AppLifecycleState.resumed && isLoaded) _clearPointers();
  }

  // -------------------------------------------------------------------------
  // Döngü
  // -------------------------------------------------------------------------

  @override
  void update(double dt) {
    world.timeScale = state == GameState.ready ? 0 : 1;

    if (state == GameState.playing && !player.isDead) {
      final y = player.position.y;
      final step = maxSteerSpeed * dt;
      player.position.y = y + (_targetY - y).clamp(-step, step);
    }

    super.update(dt);

    if (_shakeTime > 0) _shakeTime = math.max(0, _shakeTime - dt);
    _followPlayer();
  }

  void _followPlayer() {
    final vf = camera.viewfinder;
    vf.zoom = _baseZoom;
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
    _clearPointers();
    hud.flashRed(); // 100 ms kırmızı parlama (titreşim Player.die içinde)
    _shakeTime = 0.3;
    Future.delayed(_gameOverDelay, () {
      if (state == GameState.gameOver) overlays.add(gameOverOverlay);
    });
  }

  /// Ödüllü reklamı gösterir; ödül kazanıldıysa kaldığı yerden devam eder. Turda yalnızca bir kez kullanılabilir.
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
    _clearPointers();
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
    _reviveUsed = false;
    _shakeTime = 0;
    _clearPointers();
    state = GameState.ready;
    _followPlayer();
  }

  void _clearPointers() {
    _pointers.clear();
    _steerPointer = null;
    _targetY = player.position.y;
  }

}
