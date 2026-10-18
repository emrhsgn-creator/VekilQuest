import 'package:flame/components.dart';
import 'package:flame/game.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:slow_mo_rush/game/components/obstacle_manager.dart';
import 'package:slow_mo_rush/game/slow_mo_game.dart';
import 'package:slow_mo_rush/overlays/game_over_dialog.dart';

/// Gerçek kare döngüsünü ~60 FPS adımlarla ilerletir.
Future<void> advance(WidgetTester tester, double seconds) async {
  final frames = (seconds * 60).round();
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(microseconds: 16667));
  }
}

Future<SlowMoGame> pumpGame(WidgetTester tester) async {
  final game = SlowMoGame();
  await tester.pumpWidget(
    MaterialApp(
      home: GameWidget<SlowMoGame>(
        game: game,
        overlayBuilderMap: {
          SlowMoGame.gameOverOverlay: (context, g) => GameOverDialog(game: g),
        },
      ),
    ),
  );
  await advance(tester, 0.2);
  return game;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('başlangıçta dünya donuk; ilk dokunuş oyunu normal hızda başlatır',
      (tester) async {
    final game = await pumpGame(tester);
    expect(game.state, GameState.ready);
    expect(game.world.timeScale, 0);

    final finger = await tester.startGesture(const Offset(400, 300));
    await advance(tester, 0.5);
    expect(game.state, GameState.playing);
    // Yavaşlatma yok: parmak ekrandayken de dünya tam hızda akar.
    expect(game.world.timeScale, 1);
    expect(game.player.position.x, greaterThan(150));
    await finger.up();
  });

  testWidgets('sürüklemek topu yukarı-aşağı yönlendirir, tünelden çıkamaz', (
    tester,
  ) async {
    final game = await pumpGame(tester);
    game.obstacles.removeFromParent();
    expect(game.player.position.y, 0);

    final finger = await tester.startGesture(const Offset(400, 300));
    for (var i = 0; i < 10; i++) {
      await finger.moveBy(const Offset(0, -10));
      await advance(tester, 1 / 60);
    }
    await advance(tester, 0.2);
    expect(game.player.position.y, lessThan(-50), reason: 'yukarı gitmeli');

    // Çok aşağı sürükle: tünel duvarında durmalı.
    for (var i = 0; i < 40; i++) {
      await finger.moveBy(const Offset(0, 40));
      await advance(tester, 1 / 60);
    }
    await advance(tester, 0.3);
    expect(game.player.position.y, greaterThan(100));
    expect(
      game.player.position.y,
      lessThanOrEqualTo(kTunnelHalfHeight - 13),
    );

    // Parmak kalkınca top olduğu yerde kalır.
    final y = game.player.position.y;
    await finger.up();
    await advance(tester, 0.5);
    expect(game.player.position.y, y);
  });

  testWidgets('engele çarpınca Game Over, Yeniden Başla sıfırlar', (
    tester,
  ) async {
    final game = await pumpGame(tester);
    // Oyuncunun hemen önüne öldürücü bir duvar koy.
    await game.world.add(
      LethalBar(
        color: const Color(0xFFFF0000),
        size: Vector2(20, 300),
        position: Vector2(120, 0),
        anchor: Anchor.center,
      ),
    );

    final finger = await tester.startGesture(const Offset(400, 300));
    await finger.up();
    await advance(tester, 1);

    expect(game.state, GameState.gameOver);
    expect(game.player.isDead, isTrue);
    expect(game.overlays.isActive(SlowMoGame.gameOverOverlay), isTrue);
    expect(find.text('YANDIN'), findsOneWidget);
    // Reklam desteklenmeyen platformda devam teklifi gösterilmez.
    expect(find.textContaining('İZLE & DEVAM ET'), findsNothing);

    await tester.tap(find.text('YENİDEN BAŞLA'));
    await advance(tester, 0.3);
    expect(game.state, GameState.ready);
    expect(game.player.isDead, isFalse);
    expect(game.score.value, 0);
    expect(game.overlays.isActive(SlowMoGame.gameOverOverlay), isFalse);
  });

  test('en yüksek skor yalnızca aşılınca güncellenir', () async {
    expect(await HighScoreStore.submit(5), (best: 5, isNewRecord: true));
    expect(await HighScoreStore.submit(3), (best: 5, isNewRecord: false));
    expect(await HighScoreStore.submit(9), (best: 9, isNewRecord: true));
  });
}
