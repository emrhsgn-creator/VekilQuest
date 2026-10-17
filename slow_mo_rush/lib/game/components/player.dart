import 'dart:math' as math;
import 'package:flutter/painting.dart';

import 'package:flame/collisions.dart';
import 'package:flame/components.dart';
import 'package:flame/particles.dart';
import 'package:flutter/services.dart';
import 'package:vibration/vibration.dart';

/// Engel bileşenlerinin (veya hitbox taşıyan alt parçalarının) karıştırdığı
/// işaret: oyuncu yalnızca [Lethal] bir bileşene çarptığında ölür. Böylece
/// ileride eklenecek toplanabilir/sensör hitbox'ları ölüm tetiklemez.
mixin Lethal on PositionComponent {}

/// Tünel içinde sağa doğru otomatik ilerleyen neon küre.
///
/// Zaman yavaşlatma oyunun kendisinde değil, Player'ın bağlı olduğu `World`
/// bileşeninin `timeScale`'inde yapılır (Adım 4). Bu yüzden buradaki `dt`
/// zaten ölçeklenmiş gelir: hareket, iz ve parçacıklar otomatik yavaşlar.
/// Player yalnızca slow-mo'ya *görsel* tepki verir ([slowMoAmount]).
class Player extends PositionComponent with CollisionCallbacks {
  Player({this.onHit})
      : super(
          size: Vector2.all(radius * 2),
          anchor: Anchor.center,
          priority: 10,
        );

  // --- Ayarlar -------------------------------------------------------------
  static const double radius = 13;
  static const double baseSpeed = 640; // px/sn — "ultra hızlı" akış
  static const double maxSpeed = 1150;
  static const double acceleration = 7; // px/sn² — tur uzadıkça hızlanır
  static const int _trailLength = 22;
  static const double _sparkInterval = 0.018;

  static const Color _coreColor = Color(0xFFFFFFFF);
  static const Color _normalGlow = Color(0xFF00F0FF); // neon camgöbeği
  static const Color _slowGlow = Color(0xFFFF2BD6); // neon pembe (slow-mo)
  static const Color _deathColor = Color(0xFFFF2240);

  /// Lethal bir engele çarpıldığında bir kez çağrılır.
  void Function(PositionComponent other)? onHit;

  // --- Durum ---------------------------------------------------------------
  double speed = baseSpeed;
  double distanceTravelled = 0;
  bool isDead = false;

  /// 0 = normal akış, 1 = tam slow-mo. Oyun her karede GERÇEK zamanla
  /// yumuşatarak ayarlar; Player yalnızca renk/iz/şekil için okur.
  double slowMoAmount = 0;

  /// İleri hareketin dünya zaman ölçeğine göre çarpanı. Dünya 0.15'e
  /// yavaşlarken oyuncu yalnızca ~0.5'e yavaşlar; böylece basılı tutmak
  /// engellere göre gerçek bir avantaj sağlar (aksi hâlde her şey aynı oranda
  /// yavaşlar ve sonuç değişmezdi). Oyun her karede ayarlar.
  double forwardTimeFactor = 1;

  double _invulnerableTime = 0;
  double _sparkTimer = 0;
  double _pulse = 0;
  final List<Vector2> _trail = [];
  final math.Random _rng = math.Random();

  bool get isInvulnerable => _invulnerableTime > 0;

  // Paint nesneleri bir kez oluşturulur; render döngüsünde allocation yok.
  final Paint _glowPaint = Paint()
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14);
  final Paint _corePaint = Paint()..color = _coreColor;
  final Paint _ringPaint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2.5;
  final Paint _trailPaint = Paint()
    ..strokeCap = StrokeCap.round
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);

  static bool? _hasVibrator;

  @override
  Future<void> onLoad() async {
    add(CircleHitbox(radius: radius * 0.85, position: Vector2.all(radius * 0.15)));
    try {
      _hasVibrator ??= await Vibration.hasVibrator();
    } catch (_) {
      _hasVibrator = false; // Eklentisi olmayan platform (web/masaüstü).
    }
  }

  // -------------------------------------------------------------------------
  // Fizik
  // -------------------------------------------------------------------------

  @override
  void update(double dt) {
    super.update(dt);
    _pulse += dt;
    if (_invulnerableTime > 0) _invulnerableTime -= dt;
    if (isDead) return;

    final moveDt = dt * forwardTimeFactor;
    speed = math.min(maxSpeed, speed + acceleration * moveDt);
    final dx = speed * moveDt;
    position.x += dx;
    distanceTravelled += dx;

    _trail.insert(0, position.clone());
    if (_trail.length > _trailLength) _trail.removeLast();

    _sparkTimer += dt;
    while (_sparkTimer >= _sparkInterval) {
      _sparkTimer -= _sparkInterval;
      _emitThrusterSpark();
    }
  }

  // -------------------------------------------------------------------------
  // Çarpışma
  // -------------------------------------------------------------------------

  // onCollisionStart yerine onCollision: dokunulmazlık biterken hâlâ engelin
  // içindeysek de ölümü yakalar.
  @override
  void onCollision(Set<Vector2> intersectionPoints, PositionComponent other) {
    super.onCollision(intersectionPoints, other);
    if (isDead || isInvulnerable || other is! Lethal) return;
    die();
    onHit?.call(other);
  }

  // -------------------------------------------------------------------------
  // Juice: kıl payı, ölüm, diriliş
  // -------------------------------------------------------------------------

  /// ObstacleManager, bir engelin yanından ≤10 px ile geçildiğini tespit
  /// ettiğinde çağırır. [closestPoint]: engel üzerindeki en yakın nokta
  /// (parçacıklar oradan oyuncuya doğru saçılır).
  void registerNearMiss(Vector2 closestPoint) {
    if (isDead) return;
    HapticFeedback.lightImpact();

    final away = (position - closestPoint)..normalize();
    parent?.add(
      ParticleSystemComponent(
        position: position.clone(),
        priority: priority - 1,
        particle: _burst(
          count: 16,
          lifespan: 0.45,
          speedRange: (160, 420),
          spread: math.pi * 0.7,
          direction: away.isZero() ? Vector2(0, -1) : away,
          colors: const [_normalGlow, _slowGlow, Color(0xFFFFF35C)],
          size: 2.6,
        ),
      ),
    );
    add(_FloatingLabel('+1 Kıl Payı', Vector2(radius, -radius)));
  }

  /// Oyuncuyu öldürür: gövde gizlenir, kırmızı-neon patlama ve sert titreşim.
  /// Ekranın kırmızı parlaması ve Game Over overlay'i oyun sınıfının işi.
  void die() {
    if (isDead) return;
    isDead = true;
    _trail.clear();
    _heavyVibrate();

    parent?.add(
      ParticleSystemComponent(
        position: position.clone(),
        priority: priority + 1,
        particle: _burst(
          count: 46,
          lifespan: 0.9,
          speedRange: (120, 680),
          spread: math.pi * 2,
          direction: Vector2(1, 0),
          colors: const [_deathColor, _normalGlow, _coreColor],
          size: 3.4,
        ),
      ),
    );
  }

  /// Ödüllü reklam sonrası kaldığı yerden devam: kısa dokunulmazlık penceresi
  /// (yanıp söner) verir, böylece oyuncu aynı engelde tekrar ölmez.
  void revive({double invulnerableFor = 1.6}) {
    isDead = false;
    _invulnerableTime = invulnerableFor;
    _trail.clear();
  }

  /// Yeni tur için tamamen sıfırlar.
  void reset(Vector2 startPosition) {
    position.setFrom(startPosition);
    speed = baseSpeed;
    distanceTravelled = 0;
    isDead = false;
    slowMoAmount = 0;
    forwardTimeFactor = 1;
    _invulnerableTime = 0;
    _sparkTimer = 0;
    _trail.clear();
  }

  Future<void> _heavyVibrate() async {
    if (_hasVibrator ?? false) {
      await Vibration.vibrate(duration: 140, amplitude: 255);
    } else {
      await HapticFeedback.heavyImpact();
    }
  }

  // -------------------------------------------------------------------------
  // Parçacıklar
  // -------------------------------------------------------------------------

  void _emitThrusterSpark() {
    final color = Color.lerp(_normalGlow, _slowGlow, slowMoAmount)!;
    final jitter = (_rng.nextDouble() - 0.5) * radius;
    parent?.add(
      ParticleSystemComponent(
        position: Vector2(position.x - radius * 0.8, position.y + jitter),
        priority: priority - 1,
        particle: AcceleratedParticle(
          lifespan: 0.28,
          speed: Vector2(
            -60 - _rng.nextDouble() * 80,
            (_rng.nextDouble() - 0.5) * 70,
          ),
          child: _fadingDot(color, 1.4 + _rng.nextDouble() * 1.6),
        ),
      ),
    );
  }

  Particle _burst({
    required int count,
    required double lifespan,
    required (double, double) speedRange,
    required double spread,
    required Vector2 direction,
    required List<Color> colors,
    required double size,
  }) {
    final baseAngle = math.atan2(direction.y, direction.x);
    return Particle.generate(
      count: count,
      lifespan: lifespan,
      generator: (_) {
        final angle = baseAngle + (_rng.nextDouble() - 0.5) * spread;
        final v = speedRange.$1 +
            _rng.nextDouble() * (speedRange.$2 - speedRange.$1);
        final velocity = Vector2(math.cos(angle), math.sin(angle))..scale(v);
        return AcceleratedParticle(
          speed: velocity,
          // Sürtünme hissi: hızın tersine ivme.
          acceleration: velocity.scaled(-1.4),
          child: _fadingDot(
            colors[_rng.nextInt(colors.length)],
            size * (0.6 + _rng.nextDouble() * 0.8),
          ),
        );
      },
    );
  }

  Particle _fadingDot(Color color, double dotRadius) {
    final paint = Paint()
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.5);
    return ComputedParticle(
      renderer: (canvas, particle) {
        final t = 1 - particle.progress;
        paint.color = color.withValues(alpha: t);
        canvas.drawCircle(Offset.zero, dotRadius * (0.4 + 0.6 * t), paint);
      },
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  @override
  void render(Canvas canvas) {
    if (isDead) return;
    // Dokunulmazken yanıp sön (gerçek değil oyun zamanıyla, ~8 Hz).
    if (isInvulnerable && (_pulse * 16).floor().isEven) return;

    final glow = Color.lerp(_normalGlow, _slowGlow, slowMoAmount)!;
    final center = Offset(size.x / 2, size.y / 2);

    _renderTrail(canvas, glow);

    // Hız hissi: normal akışta yatay uzama, slow-mo'da kusursuz küre.
    final stretch = (1 - slowMoAmount) * (speed / maxSpeed) * 0.55;
    final breathe = 1 + math.sin(_pulse * 10) * 0.06;

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.scale(1 + stretch, 1 - stretch * 0.35);

    _glowPaint.color = glow.withValues(alpha: 0.85);
    canvas.drawCircle(Offset.zero, radius * 1.7 * breathe, _glowPaint);

    _ringPaint.color = glow;
    canvas.drawCircle(Offset.zero, radius, _ringPaint);
    canvas.drawCircle(Offset.zero, radius * 0.55, _corePaint);

    // Slow-mo'da küreyi çevreleyen ikinci "zaman halkası".
    if (slowMoAmount > 0.05) {
      _ringPaint.color = _slowGlow.withValues(alpha: slowMoAmount * 0.6);
      canvas.drawCircle(
        Offset.zero,
        radius * (1.6 + math.sin(_pulse * 4) * 0.15),
        _ringPaint,
      );
    }
    canvas.restore();
  }

  void _renderTrail(Canvas canvas, Color glow) {
    if (_trail.length < 2) return;
    // _trail dünya koordinatında; yerel koordinata çevir (anchor = center).
    final ox = size.x / 2 - position.x;
    final oy = size.y / 2 - position.y;
    final n = _trail.length;
    for (var i = 0; i < n - 1; i++) {
      final t = 1 - i / n;
      _trailPaint
        ..color = glow.withValues(alpha: t * 0.75)
        ..strokeWidth = radius * 1.4 * t;
      final a = _trail[i];
      final b = _trail[i + 1];
      canvas.drawLine(
        Offset(a.x + ox, a.y + oy),
        Offset(b.x + ox, b.y + oy),
        _trailPaint,
      );
    }
  }
}

/// Oyuncuya bağlı yükselip sönen "+1 Kıl Payı" yazısı. Oyuncunun çocuğu
/// olduğu için ultra hızda bile ekranda kalır.
class _FloatingLabel extends PositionComponent {
  _FloatingLabel(this.text, Vector2 start)
      : super(position: start, anchor: Anchor.bottomLeft, priority: 20);

  final String text;
  static const double _lifetime = 0.7;
  double _age = 0;

  @override
  void update(double dt) {
    super.update(dt);
    _age += dt;
    position.y -= 70 * dt;
    if (_age >= _lifetime) removeFromParent();
  }

  @override
  void render(Canvas canvas) {
    final t = (1 - _age / _lifetime).clamp(0.0, 1.0);
    final pop = 1 + (1 - t) * 0.25;
    canvas.save();
    canvas.scale(pop);
    TextPaint(
      style: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.5,
        color: const Color(0xFFFFF35C).withValues(alpha: t),
        shadows: [
          Shadow(
            color: const Color(0xFFFF2BD6).withValues(alpha: t),
            blurRadius: 8,
          ),
        ],
      ),
    ).render(canvas, text, Vector2.zero(), anchor: Anchor.bottomLeft);
    canvas.restore();
  }
}
