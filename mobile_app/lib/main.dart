import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/api/models.dart';
import 'app_shell.dart';
import 'features/token_detail/presentation/token_detail_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarBrightness: Brightness.dark,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const ProviderScope(child: TradingAgentApp()));
}

class TradingAgentApp extends StatelessWidget {
  const TradingAgentApp({super.key});

  @override
  Widget build(BuildContext context) {
    const scheme = CoinDCXColors.dark;

    return CoinDCXTheme(
      colors: scheme,
      child: MaterialApp(
        title: 'CoinDCX Web3',
        debugShowCheckedModeBanner: false,
        theme: buildMaterialTheme(scheme),
        initialRoute: '/',
        onGenerateRoute: (settings) {
          switch (settings.name) {
            case '/':
              return MaterialPageRoute(builder: (_) => const AppShell());
            case '/chat':
              return MaterialPageRoute(builder: (_) => const AppShell());
            case '/token-detail':
              final token = settings.arguments as TokenMetrics;
              return MaterialPageRoute(
                builder: (_) => TokenDetailScreen(token: token),
              );
            default:
              return MaterialPageRoute(builder: (_) => const AppShell());
          }
        },
      ),
    );
  }
}
