import 'dart:async';

import 'package:flame/game.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'game/slow_mo_game.dart';
import 'overlays/game_over_dialog.dart';
import 'services/ad_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);

  // Beklenmez: reklam SDK'sı açılışı geciktirmesin, arka planda ön yüklesin.
  unawaited(AdService.instance.initialize());

  runApp(const SlowMoRushApp());
}

class SlowMoRushApp extends StatefulWidget {
  const SlowMoRushApp({super.key});

  @override
  State<SlowMoRushApp> createState() => _SlowMoRushAppState();
}

class _SlowMoRushAppState extends State<SlowMoRushApp> {
  // Oyun bir kez oluşturulur; widget yeniden çizilse de durum korunur.
  final SlowMoGame _game = SlowMoGame();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Slow-Mo Rush',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true),
      home: Builder(
        builder: (context) {
          _game.safeTopInset = MediaQuery.paddingOf(context).top;
          return GameWidget<SlowMoGame>(
            game: _game,
            overlayBuilderMap: {
              SlowMoGame.gameOverOverlay: (context, game) =>
                  GameOverDialog(game: game),
            },
          );
        },
      ),
    );
  }
}
