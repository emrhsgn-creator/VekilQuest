import 'dart:math' as math;

import 'package:flame/components.dart';
import 'package:flutter/painting.dart';

import '../slow_mo_game.dart';

/// Ekrana sabit (viewport'a bağlı) arayüz: skor, başlangıç ipucu ve ölüm
/// anındaki kırmızı parlama.
class Hud extends PositionComponent with HasGameReference<SlowMoGame> {
  Hud() : super(priority: 100);

  static const Color _cyan = Color(0xFF00F0FF);
  static const Color _pink = Color(0xFFFF2BD6);
  static const Color _red = Color(0xFFFF2240);
  static const double _flashDuration = 0.1; // 100 ms

  double _flash = 0;
  double _time = 0;
  int _shownScore = -1;
  late TextPaint _scorePaint;
  String _scoreText = '0';

  final Paint _flashPaint = Paint();

  final TextPaint _hintPaint = TextPaint(
    style: const TextStyle(
      fontSize: 18,
      fontWeight: FontWeight.w800,
      letterSpacing: 1.5,
      color: Color(0xFFFFFFFF),
      shadows: [Shadow(color: _pink, blurRadius: 12)],
    ),
  );

  @override
  Future<void> onLoad() async {
    _scorePaint = TextPaint(
      style: const TextStyle(
        fontSize: 40,
        fontWeight: FontWeight.w900,
        color: Color(0xFFFFFFFF),
        shadows: [Shadow(color: _cyan, blurRadius: 16)],
      ),
    );
  }

  @override
  void onGameResize(Vector2 size) {
    super.onGameResize(size);
    this.size.setFrom(size);
  }

  /// Ölüm anında çağrılır.
  void flashRed() => _flash = _flashDuration;

  @override
  void update(double dt) {
    super.update(dt);
    _time += dt;
    if (_flash > 0) _flash = math.max(0, _flash - dt);
    final score = game.score.value;
    if (score != _shownScore) {
      _shownScore = score;
      _scoreText = '$score';
    }
  }

  @override
  void render(Canvas canvas) {
    final topInset = game.safeTopInset + 16;
    _scorePaint.render(
      canvas,
      _scoreText,
      Vector2(size.x / 2, topInset),
      anchor: Anchor.topCenter,
    );

    if (game.state == GameState.ready) {
      final pulse = 0.9 + 0.1 * math.sin(_time * 5);
      canvas.save();
      canvas.translate(size.x / 2, size.y * 0.72);
      canvas.scale(pulse);
      _hintPaint.render(
        canvas,
        'BAŞLAMAK İÇİN DOKUN',
        Vector2(0, -16),
        anchor: Anchor.center,
      );
      _hintPaint.render(
        canvas,
        'SÜRÜKLE → TOPU YÖNLENDİR',
        Vector2(0, 16),
        anchor: Anchor.center,
      );
      canvas.restore();
    }

    if (_flash > 0) {
      _flashPaint.color = _red.withValues(alpha: 0.6 * _flash / _flashDuration);
      canvas.drawRect(size.toRect(), _flashPaint);
    }
  }
}
