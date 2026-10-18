import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../game/slow_mo_game.dart';
import '../services/ad_service.dart';

/// En yüksek skoru cihazda saklar.
class HighScoreStore {
  static const _key = 'high_score';

  /// Skoru kaydeder ve güncel en yüksek skoru döndürür.
  static Future<({int best, bool isNewRecord})> submit(int score) async {
    final prefs = await SharedPreferences.getInstance();
    final previous = prefs.getInt(_key) ?? 0;
    if (score > previous) {
      await prefs.setInt(_key, score);
      return (best: score, isNewRecord: score > 0);
    }
    return (best: previous, isNewRecord: false);
  }
}

/// Game Over overlay'i: skor, en yüksek skor, 3 sn'lik "İzle & Devam Et"
/// teklifi ve "Yeniden Başla".
class GameOverDialog extends StatefulWidget {
  const GameOverDialog({super.key, required this.game});

  final SlowMoGame game;

  @override
  State<GameOverDialog> createState() => _GameOverDialogState();
}

class _GameOverDialogState extends State<GameOverDialog>
    with SingleTickerProviderStateMixin {
  static const _offerDuration = Duration(seconds: 3);
  static const _cyan = Color(0xFF00F0FF);
  static const _pink = Color(0xFFFF2BD6);

  late final AnimationController _countdown;
  int? _best;
  bool _isNewRecord = false;
  bool _offerOpen = false;
  bool _busy = false;

  SlowMoGame get game => widget.game;

  @override
  void initState() {
    super.initState();
    _countdown = AnimationController(vsync: this, duration: _offerDuration)
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed && mounted && !_busy) {
          setState(() => _offerOpen = false);
        }
      });

    // Teklif turda bir kez; reklam henüz yüklenmemiş olsa da sayaç başlar,
    // yüklenirse buton anında etkinleşir.
    if (!game.reviveUsed && AdService.instance.isSupported) {
      _offerOpen = true;
      _countdown.forward();
    }

    unawaited(_saveScore());
  }

  Future<void> _saveScore() async {
    final result = await HighScoreStore.submit(game.score.value);
    if (!mounted) return;
    setState(() {
      _best = result.best;
      _isNewRecord = result.isNewRecord;
    });
  }

  @override
  void dispose() {
    _countdown.dispose();
    super.dispose();
  }

  Future<void> _watchAndRevive() async {
    if (_busy) return;
    setState(() => _busy = true);
    _countdown.stop();
    final revived = await game.watchAdAndRevive();
    if (!mounted) return; // Diriliş overlay'i kaldırdı.
    setState(() {
      _busy = false;
      // Reklam yarıda kapatıldıysa teklif tükenmiş sayılır.
      if (!revived) _offerOpen = false;
    });
  }

  Future<void> _restart() async {
    if (_busy) return;
    setState(() => _busy = true);
    await game.restart();
  }

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutBack,
      builder: (context, t, child) => Opacity(
        opacity: t.clamp(0.0, 1.0),
        child: Transform.scale(scale: 0.85 + 0.15 * t, child: child),
      ),
      child: Material(
        color: const Color(0xCC05010F),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const _NeonText('YANDIN', size: 22, color: Color(0xFFFF2240)),
                  const SizedBox(height: 12),
                  _NeonText('${game.score.value}', size: 72, color: _cyan),
                  const SizedBox(height: 4),
                  _bestLine(),
                  if (game.nearMissCount > 0) ...[
                    const SizedBox(height: 6),
                    Text(
                      '${game.nearMissCount} kıl payı',
                      style: const TextStyle(color: Color(0xFFFFF35C)),
                    ),
                  ],
                  const SizedBox(height: 36),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 200),
                    child: _offerOpen
                        ? _reviveOffer()
                        : const SizedBox(width: double.infinity),
                  ),
                  const SizedBox(height: 16),
                  _NeonButton(
                    label: 'YENİDEN BAŞLA',
                    color: _cyan,
                    filled: !_offerOpen,
                    onPressed: _busy ? null : _restart,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _bestLine() {
    if (_best == null) return const SizedBox(height: 20);
    return Text(
      _isNewRecord ? 'YENİ REKOR!' : 'EN YÜKSEK: $_best',
      style: TextStyle(
        color: _isNewRecord ? _pink : Colors.white70,
        fontWeight: FontWeight.w800,
        letterSpacing: 2,
      ),
    );
  }

  Widget _reviveOffer() {
    return Column(
      children: [
        const Text(
          'Reklam izle, kaldığın yerden devam et\n'
          '(1 turda sadece 1 kez)',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white70, height: 1.4),
        ),
        const SizedBox(height: 14),
        ValueListenableBuilder<bool>(
          valueListenable: AdService.instance.rewardedReady,
          builder: (context, ready, _) => AnimatedBuilder(
            animation: _countdown,
            builder: (context, _) {
              final remaining =
                  (_offerDuration.inSeconds * (1 - _countdown.value)).ceil();
              return Stack(
                alignment: Alignment.center,
                children: [
                  _NeonButton(
                    label: ready
                        ? 'İZLE & DEVAM ET  ($remaining)'
                        : 'REKLAM YÜKLENİYOR…',
                    color: _pink,
                    filled: true,
                    onPressed: ready && !_busy ? _watchAndRevive : null,
                  ),
                  // Butonun altında azalan geri sayım çizgisi.
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: FractionallySizedBox(
                        widthFactor: 1 - _countdown.value,
                        child: Container(height: 3, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _NeonText extends StatelessWidget {
  const _NeonText(this.text, {required this.size, required this.color});

  final String text;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: size,
        fontWeight: FontWeight.w900,
        letterSpacing: size > 40 ? 0 : 4,
        color: Colors.white,
        shadows: [Shadow(color: color, blurRadius: 18)],
      ),
    );
  }
}

class _NeonButton extends StatelessWidget {
  const _NeonButton({
    required this.label,
    required this.color,
    required this.filled,
    required this.onPressed,
  });

  final String label;
  final Color color;
  final bool filled;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    final c = enabled ? color : color.withValues(alpha: 0.35);
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          boxShadow: enabled
              ? [BoxShadow(color: c.withValues(alpha: 0.6), blurRadius: 18)]
              : null,
        ),
        child: TextButton(
          onPressed: onPressed,
          style: TextButton.styleFrom(
            backgroundColor: filled ? c : Colors.transparent,
            foregroundColor: filled ? const Color(0xFF05010F) : c,
            disabledForegroundColor: filled ? Colors.black54 : c,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: c, width: 2),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.5,
            ),
          ),
          child: Text(label),
        ),
      ),
    );
  }
}
