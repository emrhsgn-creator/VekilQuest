import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flame/components.dart';
import 'package:flutter/painting.dart';

import '../slow_mo_game.dart';

/// Ekrana sabit (viewport'a bağlı) arayüz: zaman enerjisi barı, skor,
/// başlangıç ipucu, slow-mo vinyeti ve ölüm anındaki kırmızı parlama.
///
/// Viewport bileşenleri dünya zaman ölçeğinden etkilenmez; bar ve parlama
/// gerçek zamanla akar.
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

  final Paint _barBack = Paint()..color = const Color(0x33FFFFFF);
  final Paint _barFill = Paint();
  final Paint _barGlow = Paint()
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
  final Paint _flashPaint = Paint();
  final Paint _vignettePaint = Paint();
  final Paint _layerPaint = Paint();

  final TextPaint _labelPaint = TextPaint(
    style: const TextStyle(
      fontSize: 11,
      fontWeight: FontWeight.w700,
      letterSpacing: 3,
      color: Color(0xAAFFFFFF),
    ),
  );
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
    _vignettePaint.shader = ui.Gradient.radial(
      size.toOffset() / 2,
      size.length / 2,
      [const Color(0x00000000), _pink.withValues(alpha: 0.45)],
      [0.55, 1.0],
    );
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
    final slow = game.slowMoAmount;
    if (slow > 0.01) {
      _layerPaint.color = Color.fromRGBO(0, 0, 0, slow);
      canvas.saveLayer(size.toRect(), _layerPaint);
      canvas.drawRect(size.toRect(), _vignettePaint);
      canvas.restore();
    }

    final topInset = game.safeTopInset + 16;
    _renderStaminaBar(canvas, topInset);
    _scorePaint.render(
      canvas,
      _scoreText,
      Vector2(size.x / 2, topInset + 34),
      anchor: Anchor.topCenter,
    );

    if (game.state == GameState.ready) {
      final pulse = 0.9 + 0.1 * math.sin(_time * 5);
      canvas.save();
      canvas.translate(size.x / 2, size.y * 0.72);
      canvas.scale(pulse);
      _hintPaint.render(
        canvas,
        'DOKUN → ZAMAN YAVAŞLAR',
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

  void _renderStaminaBar(Canvas canvas, double top) {
    final width = math.min(size.x * 0.6, 320.0);
    const height = 10.0;
    final left = (size.x - width) / 2;
    final back = RRect.fromLTRBR(
      left, top + 14, left + width, top + 14 + height, const Radius.circular(5),
    );

    _labelPaint.render(canvas, 'ZAMAN', Vector2(size.x / 2, top), anchor: Anchor.topCenter);
    canvas.drawRRect(back, _barBack);

    final ratio = game.staminaRatio;
    if (ratio <= 0) return;

    // Tükendiyse kırmızı yanıp söner; kullanılıyorsa pembe, doluyorsa camgöbeği.
    final Color color;
    if (game.isExhausted) {
      color = (_time * 8).floor().isEven ? _red : _red.withValues(alpha: 0.4);
    } else {
      color = Color.lerp(_cyan, _pink, game.slowMoAmount)!;
    }
    final fill = RRect.fromLTRBR(
      left, back.top, left + width * ratio, back.bottom, const Radius.circular(5),
    );
    _barGlow.color = color.withValues(alpha: 0.8);
    canvas.drawRRect(fill, _barGlow);
    _barFill.color = color;
    canvas.drawRRect(fill, _barFill);
  }
}
