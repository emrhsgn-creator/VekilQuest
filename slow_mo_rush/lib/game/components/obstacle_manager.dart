import 'dart:math' as math;

import 'package:flame/collisions.dart';
import 'package:flame/components.dart';
import 'package:flutter/painting.dart';

import 'player.dart';

/// Tünelin yarı yüksekliği (dünya birimi). Oyuncu her zaman y = 0'da ilerler.
const double kTunnelHalfHeight = 150;

/// Oyuncunun görünür kenarı ile engel arasındaki bu mesafe veya daha azı
/// "kıl payı" sayılır.
const double kNearMissDistance = 10;

/// Bütün engel döngüleri bu vuruşun katlarıdır; engeller aynı ritimde
/// "nefes alır" ve oyuncu ritmi hissedebilir (120 BPM, dünya zamanında).
const double kBeat = 0.5;

/// Prosedürel engel üretimi, geri dönüşüm ve kıl payı tespiti.
///
/// Çarpışmanın kendisi Flame'in hitbox sistemiyle yapılır: engel parçaları
/// [LethalBar] (pasif `RectangleHitbox`), oyuncu aktif `CircleHitbox` taşır.
/// Bu sınıf ayrıca her engeli geçerken oyuncu ile engel arasındaki en küçük
/// boşluğu ölçer; engel geride kaldığında boşluk ≤ [kNearMissDistance] ise
/// kıl payı ödülü verilir. (Ödülü geçiş anında vermek, kıl payı + ölüm
/// çelişkisini önler.)
class ObstacleManager extends Component {
  ObstacleManager({
    required this.player,
    this.onObstaclePassed,
    this.onNearMiss,
    int? seed,
  }) : _rng = math.Random(seed);

  final Player player;
  final void Function()? onObstaclePassed;
  final void Function()? onNearMiss;

  math.Random _rng;

  static const double _firstObstacleOffset = 900;
  static const double _spawnAhead = 1400;
  static const double _despawnBehind = 500;
  static const double _maxDifficultyDistance = 60000;

  double _nextSpawnX = 0;
  final List<Obstacle> _obstacles = [];

  /// 0 (başlangıç) → 1 (en zor). Kat edilen mesafeyle doğrusal artar.
  double get difficulty =>
      (player.distanceTravelled / _maxDifficultyDistance).clamp(0.0, 1.0);

  @override
  void onMount() {
    super.onMount();
    _nextSpawnX = player.position.x + _firstObstacleOffset;
  }

  /// Yeni tur: bütün engelleri kaldırır ve üretimi baştan başlatır.
  void reset({int? seed}) {
    for (final o in _obstacles) {
      o.removeFromParent();
    }
    _obstacles.clear();
    _rng = math.Random(seed);
    _nextSpawnX = player.position.x + _firstObstacleOffset;
  }

  /// Reklamla dirilişte oyuncunun hemen önündeki engelleri temizler; oyuncu
  /// aynı engelin içine geri doğmaz ve toparlanmak için nefes alanı bulur.
  void clearAhead({double distance = 520}) {
    final from = player.position.x - Player.radius - 20;
    final to = player.position.x + distance;
    _obstacles.removeWhere((o) {
      final remove = o.right >= from && o.left <= to;
      if (remove) o.removeFromParent();
      return remove;
    });
    _nextSpawnX = math.max(_nextSpawnX, to + 200);
  }

  @override
  void update(double dt) {
    super.update(dt);
    _spawnUntil(player.position.x + _spawnAhead);
    _trackNearMisses();
    _despawn();
  }

  // Engeller tünel duvarlarının dışına taşmasın (bıçak kolları duvarın içine
  // "girer" gibi görünür). Yalnızca çizimi kırpar; hitbox'lar etkilenmez.
  @override
  void renderTree(Canvas canvas) {
    canvas.save();
    canvas.clipRect(
      const Rect.fromLTRB(-1e9, -kTunnelHalfHeight, 1e9, kTunnelHalfHeight),
    );
    super.renderTree(canvas);
    canvas.restore();
  }

  // -------------------------------------------------------------------------
  // Üretim
  // -------------------------------------------------------------------------

  void _spawnUntil(double limitX) {
    while (_nextSpawnX < limitX) {
      final obstacle = _createObstacle(_nextSpawnX, difficulty);
      _obstacles.add(obstacle);
      add(obstacle);

      final d = difficulty;
      final spacing = _lerp(640, 380, d) + _rng.nextDouble() * 160;
      _nextSpawnX = obstacle.right + spacing;
    }
  }

  Obstacle _createObstacle(double x, double d) {
    // Başlangıçta okunması kolay duvar/kapı; zorluk arttıkça dönen bıçaklar.
    final weights = <double>[
      0.35, // GapWall
      0.30, // HydraulicDoor
      0.20, // RhythmBlock
      _lerp(0.10, 0.40, d), // LaserBlade
    ];
    var roll = _rng.nextDouble() * weights.reduce((a, b) => a + b);
    var kind = 0;
    while (roll > weights[kind]) {
      roll -= weights[kind];
      kind++;
    }
    // Fazı vuruşun sekizde birlerine oturt: engeller birbiriyle senkron.
    final phase = _rng.nextInt(8) / 8;

    switch (kind) {
      case 0:
        final gapHalf = _lerp(78, 50, d);
        final amplitude = _lerp(0, 75, d);
        final maxCenter = kTunnelHalfHeight - gapHalf - amplitude - 8;
        return GapWall(
          x: x + GapWall.wallWidth / 2,
          period: (d < 0.5 ? 8 : 6) * kBeat,
          phase: phase,
          gapHalf: gapHalf,
          gapCenter: _randomRange(-maxCenter, maxCenter),
          amplitude: amplitude,
        );
      case 1:
        final openHalf = _lerp(85, 58, d);
        final maxCenter = kTunnelHalfHeight - openHalf - 10;
        return HydraulicDoor(
          x: x + HydraulicDoor.doorWidth / 2,
          period: (d < 0.4 ? 4 : 3) * kBeat,
          phase: phase,
          openHalf: openHalf,
          gapCenter: _randomRange(-maxCenter, maxCenter),
        );
      case 2:
        return RhythmBlock(
          x: x + RhythmBlock.blockWidth / 2,
          period: (d < 0.6 ? 8 : 6) * kBeat,
          phase: phase,
        );
      default:
        final beats = d < 0.5 ? 4 : (d < 0.8 ? 3 : 2);
        final armLength = _lerp(178, 205, _rng.nextDouble());
        return LaserBlade(
          x: x + armLength,
          fromTop: _rng.nextBool(),
          clockwise: _rng.nextBool(),
          armLength: armLength,
          period: beats * kBeat * 2,
          phase: phase,
        );
    }
  }

  double _randomRange(double a, double b) =>
      b <= a ? (a + b) / 2 : a + _rng.nextDouble() * (b - a);

  void _despawn() {
    final limit = player.position.x - _despawnBehind;
    _obstacles.removeWhere((o) {
      final remove = o.right < limit;
      if (remove) o.removeFromParent();
      return remove;
    });
  }

  // -------------------------------------------------------------------------
  // Kıl payı
  // -------------------------------------------------------------------------

  void _trackNearMisses() {
    if (player.isDead) return;
    final p = player.position;
    final window = Player.radius + kNearMissDistance;

    for (final o in _obstacles) {
      if (o.passed) continue;

      if (p.x - Player.radius > o.right) {
        o.passed = true;
        onObstaclePassed?.call();
        final closest = o.closestPoint;
        if (o.minGap <= kNearMissDistance && closest != null) {
          player.registerNearMiss(closest);
          onNearMiss?.call();
        }
        continue;
      }
      if (p.x + window < o.left) break; // Listede x'e göre sıralılar.

      for (final part in o.parts) {
        final (dist, point) = part.distanceTo(p);
        final gap = dist - Player.radius;
        if (gap < o.minGap) {
          o.minGap = gap;
          o.closestPoint = point;
        }
      }
    }
  }

  static double _lerp(double a, double b, double t) => a + (b - a) * t;
}

// ===========================================================================
// Engeller
// ===========================================================================

/// Bütün engellerin tabanı: kendi döngü saatini (dünya zamanında) tutar ve
/// her karede [animate]'i `0..1` aralığında bir döngü konumuyla çağırır.
abstract class Obstacle extends PositionComponent {
  Obstacle({required double x, required this.period, required double phase})
      : _time = phase * period,
        super(position: Vector2(x, 0));

  final double period;
  double _time;

  /// Engelin yatay yarı genişliği (kıl payı penceresi ve geri dönüşüm için).
  double get halfExtentX;
  double get left => position.x - halfExtentX;
  double get right => position.x + halfExtentX;

  final List<LethalBar> parts = [];

  // Kıl payı takibi (ObstacleManager doldurur).
  bool passed = false;
  double minGap = double.infinity;
  Vector2? closestPoint;

  double get cycle => (_time % period) / period;

  void animate(double cycle);

  @override
  Future<void> onLoad() async {
    animate(cycle); // İlk kareden önce hitbox'lar doğru yerde olsun.
  }

  @override
  void update(double dt) {
    super.update(dt);
    _time += dt;
    animate(cycle);
  }
}

/// Duvara monte edilmiş, iki kollu dönen lazer bıçak. Kol uzunluğu tünel
/// yarı yüksekliğinden büyük olduğu için her turda iki kez merkezi süpürür.
class LaserBlade extends Obstacle {
  LaserBlade({
    required super.x,
    required super.period,
    required super.phase,
    required this.fromTop,
    required this.clockwise,
    required this.armLength,
  });

  final bool fromTop;
  final bool clockwise;
  final double armLength;

  static const Color color = Color(0xFFFF2240);
  late final LethalBar _blade;
  final Paint _hubPaint = Paint()..color = const Color(0xFFFFFFFF);
  final Paint _hubGlow = Paint()
    ..color = color
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10);

  double get _hubY => fromTop ? -kTunnelHalfHeight : kTunnelHalfHeight;

  @override
  double get halfExtentX => armLength;

  @override
  Future<void> onLoad() async {
    _blade = LethalBar(
      color: color,
      size: Vector2(armLength * 2, 9),
      position: Vector2(0, _hubY),
      anchor: Anchor.center,
    );
    parts.add(_blade);
    await add(_blade);
    await super.onLoad();
  }

  @override
  void animate(double cycle) {
    _blade.angle = (clockwise ? 1 : -1) * cycle * math.pi * 2;
  }

  @override
  void render(Canvas canvas) {
    canvas.drawCircle(Offset(0, _hubY), 18, _hubGlow);
    canvas.drawCircle(Offset(0, _hubY), 9, _hubPaint);
  }
}

/// Üstten ve alttan hızla kapanıp yavaşça açılan hidrolik kapı. Kapanmadan
/// hemen önce parlayarak oyuncuyu uyarır (telegraph).
class HydraulicDoor extends Obstacle {
  HydraulicDoor({
    required super.x,
    required super.period,
    required super.phase,
    required this.openHalf,
    this.gapCenter = 0,
  });

  /// Açıkken boşluğun yarı yüksekliği ve boşluğun ortasının y'si.
  final double openHalf;
  final double gapCenter;

  static const double doorWidth = 40;
  static const double _minHeight = 8;
  static const Color color = Color(0xFFFFB800);

  late final LethalBar _top;
  late final LethalBar _bottom;

  @override
  double get halfExtentX => doorWidth / 2;

  @override
  Future<void> onLoad() async {
    _top = LethalBar(
      color: color,
      size: Vector2(doorWidth, _minHeight),
      position: Vector2(0, -kTunnelHalfHeight),
      anchor: Anchor.topCenter,
    );
    _bottom = LethalBar(
      color: color,
      size: Vector2(doorWidth, _minHeight),
      position: Vector2(0, kTunnelHalfHeight),
      anchor: Anchor.bottomCenter,
    );
    parts.addAll([_top, _bottom]);
    await addAll(parts);
    await super.onLoad();
  }

  /// Döngü: açık bekle → sert kapan → kapalı bekle → yavaşça açıl.
  double _gapHalf(double c) {
    final h = openHalf;
    if (c < 0.40) return h;
    if (c < 0.50) {
      final t = (c - 0.40) / 0.10;
      return h * (1 - t * t * t); // easeInCubic: hidrolik "çarpma"
    }
    if (c < 0.62) return 0;
    final t = (c - 0.62) / 0.38;
    return h * (1 - math.pow(1 - t, 3)); // easeOutCubic
  }

  @override
  void animate(double cycle) {
    final gapHalf = _gapHalf(cycle);
    _top.size.y =
        math.max(_minHeight, kTunnelHalfHeight + gapCenter - gapHalf);
    _bottom.size.y =
        math.max(_minHeight, kTunnelHalfHeight - gapCenter - gapHalf);
    // Kapanmadan önceki %15'lik dilimde uyarı parlaması.
    final warn = cycle >= 0.25 && cycle < 0.40
        ? 0.5 + 0.5 * math.sin((cycle - 0.25) * 90)
        : 0.0;
    _top.intensity = _bottom.intensity = 0.65 + 0.35 * warn;
  }
}

/// Tüneli boydan boya kapatan, tek bir boşluğu olan duvar. Zorluk arttıkça
/// boşluk daralır ve yukarı-aşağı salınmaya başlar; top boşluğa
/// yönlendirilerek geçilir.
class GapWall extends Obstacle {
  GapWall({
    required super.x,
    required super.period,
    required super.phase,
    required this.gapHalf,
    required this.gapCenter,
    this.amplitude = 0,
  });

  static const double wallWidth = 34;
  static const Color color = Color(0xFF39FF88);

  final double gapHalf;
  final double gapCenter;
  final double amplitude;

  late final LethalBar _top;
  late final LethalBar _bottom;

  @override
  double get halfExtentX => wallWidth / 2;

  @override
  Future<void> onLoad() async {
    _top = LethalBar(
      color: color,
      size: Vector2(wallWidth, 1),
      position: Vector2(0, -kTunnelHalfHeight),
      anchor: Anchor.topCenter,
    );
    _bottom = LethalBar(
      color: color,
      size: Vector2(wallWidth, 1),
      position: Vector2(0, kTunnelHalfHeight),
      anchor: Anchor.bottomCenter,
    );
    parts.addAll([_top, _bottom]);
    await addAll(parts);
    await super.onLoad();
  }

  @override
  void animate(double cycle) {
    final center = gapCenter + amplitude * math.sin(cycle * math.pi * 2);
    _top.size.y = math.max(1, kTunnelHalfHeight + center - gapHalf);
    _bottom.size.y = math.max(1, kTunnelHalfHeight - center - gapHalf);
  }
}

/// Vuruşa göre üst / orta / alt / orta şeritleri arasında adım atan blok.
/// Orta konum yolu keser; geçiş penceresi blok üstte veya alttayken açılır.
class RhythmBlock extends Obstacle {
  RhythmBlock({
    required super.x,
    required super.period,
    required super.phase,
  });

  static const double blockWidth = 56;
  static const double blockHeight = 110;
  static const double _laneOffset = 92;
  static const Color color = Color(0xFF9D4BFF);
  static const List<double> _lanes = [-_laneOffset, 0, _laneOffset, 0];

  late final LethalBar _block;

  @override
  double get halfExtentX => blockWidth / 2;

  @override
  Future<void> onLoad() async {
    _block = LethalBar(
      color: color,
      size: Vector2(blockWidth, blockHeight),
      anchor: Anchor.center,
    );
    parts.add(_block);
    await add(_block);
    await super.onLoad();
  }

  @override
  void animate(double cycle) {
    final segment = cycle * _lanes.length;
    final index = segment.floor() % _lanes.length;
    final local = segment - segment.floor();
    final from = _lanes[index];
    final to = _lanes[(index + 1) % _lanes.length];
    // Her dilimin %75'i bekleme, son %25'i hızlı adım (easeInOut).
    final t = local < 0.75 ? 0.0 : _easeInOut((local - 0.75) / 0.25);
    _block.position.y = from + (to - from) * t;
    _block.intensity = t > 0 ? 1.0 : 0.75;
  }

  static double _easeInOut(double t) =>
      t < 0.5 ? 2 * t * t : 1 - math.pow(-2 * t + 2, 2) / 2;
}

// ===========================================================================
// Öldürücü parça
// ===========================================================================

/// Neon parlayan, öldürücü dikdörtgen. Hitbox'ı boyutla senkron tutulur
/// (kapılar her karede uzayıp kısalır).
class LethalBar extends PositionComponent with Lethal {
  LethalBar({
    required this.color,
    super.size,
    super.position,
    super.anchor,
  });

  final Color color;

  /// 0..1 parlaklık; uyarı / hareket vurgusu için.
  double intensity = 0.75;

  late final RectangleHitbox _hitbox;
  final Paint _glowPaint = Paint()
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 9);
  final Paint _bodyPaint = Paint();
  final Paint _corePaint = Paint();

  @override
  Future<void> onLoad() async {
    _hitbox = RectangleHitbox(
      size: size.clone(),
      collisionType: CollisionType.passive,
    );
    add(_hitbox);
    size.addListener(() => _hitbox.size.setFrom(size));
  }

  /// [worldPoint]'e bu parçanın (dönmüş olabilir) dikdörtgeni üzerindeki
  /// en yakın nokta ve uzaklık. Nokta içerideyse uzaklık 0'dır.
  (double, Vector2) distanceTo(Vector2 worldPoint) {
    final corners = [
      absolutePositionOf(Vector2.zero()),
      absolutePositionOf(Vector2(size.x, 0)),
      absolutePositionOf(size),
      absolutePositionOf(Vector2(0, size.y)),
    ];
    if (containsPoint(worldPoint)) return (0, worldPoint.clone());

    var best = double.infinity;
    var bestPoint = corners.first;
    for (var i = 0; i < 4; i++) {
      final q = _closestOnSegment(worldPoint, corners[i], corners[(i + 1) % 4]);
      final d = q.distanceTo(worldPoint);
      if (d < best) {
        best = d;
        bestPoint = q;
      }
    }
    return (best, bestPoint);
  }

  static Vector2 _closestOnSegment(Vector2 p, Vector2 a, Vector2 b) {
    final ab = b - a;
    final lengthSq = ab.length2;
    if (lengthSq == 0) return a.clone();
    final t = ((p - a).dot(ab) / lengthSq).clamp(0.0, 1.0);
    return a + ab.scaled(t);
  }

  @override
  void render(Canvas canvas) {
    final rect = size.toRect();
    _glowPaint.color = color.withValues(alpha: 0.55 * intensity);
    canvas.drawRect(rect.inflate(4), _glowPaint);
    _bodyPaint.color = color.withValues(alpha: 0.35 + 0.5 * intensity);
    canvas.drawRect(rect, _bodyPaint);
    // Neon "tüp" çekirdeği: ince açık renkli şerit.
    _corePaint.color =
        Color.lerp(color, const Color(0xFFFFFFFF), 0.6)!.withValues(
      alpha: intensity,
    );
    final core = size.x > size.y
        ? Rect.fromLTWH(0, size.y * 0.35, size.x, size.y * 0.3)
        : Rect.fromLTWH(size.x * 0.35, 0, size.x * 0.3, size.y);
    canvas.drawRect(core, _corePaint);
  }
}
