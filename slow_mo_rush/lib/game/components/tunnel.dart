import 'package:flame/components.dart';
import 'package:flutter/painting.dart';

import '../slow_mo_game.dart';
import 'obstacle_manager.dart';

/// Sonsuz neon tünel: yalnızca kameranın gördüğü aralığı çizer, bu yüzden
/// mesafe ne olursa olsun maliyeti sabittir. Dikey "kaburga" çizgileri hız
/// hissini verir.
class Tunnel extends Component with HasGameReference<SlowMoGame> {
  Tunnel() : super(priority: -10);

  static const double _ribSpacing = 120;
  static const Color _wallColor = Color(0xFF00F0FF);

  final Paint _wallGlow = Paint()
    ..strokeWidth = 10
    ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10);
  final Paint _wallCore = Paint()..strokeWidth = 2.5;
  final Paint _ribPaint = Paint()..strokeWidth = 1.5;
  final Paint _floorPaint = Paint();

  @override
  void render(Canvas canvas) {
    final view = game.camera.visibleWorldRect;
    const h = kTunnelHalfHeight;
    const color = _wallColor;

    // Tünel içi zemin: hafif koyu bant.
    _floorPaint.color = color.withValues(alpha: 0.05);
    canvas.drawRect(Rect.fromLTRB(view.left, -h, view.right, h), _floorPaint);

    // Kaburgalar.
    _ribPaint.color = color.withValues(alpha: 0.12);
    var x = (view.left / _ribSpacing).floorToDouble() * _ribSpacing;
    for (; x <= view.right; x += _ribSpacing) {
      canvas.drawLine(Offset(x, -h), Offset(x, h), _ribPaint);
    }

    // Duvarlar.
    _wallGlow.color = color.withValues(alpha: 0.6);
    _wallCore.color = color;
    for (final y in const [-h, h]) {
      final a = Offset(view.left, y);
      final b = Offset(view.right, y);
      canvas.drawLine(a, b, _wallGlow);
      canvas.drawLine(a, b, _wallCore);
    }
  }
}
