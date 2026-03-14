import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/theme/app_theme.dart';
import 'core/api/models.dart';
import 'app_shell.dart';
import 'features/token_detail/presentation/token_detail_screen.dart';
import 'features/onboarding/presentation/onboarding_screen.dart';
import 'features/leaderboard/presentation/leaderboard_screen.dart';
import 'features/copy_trading/presentation/copy_trader_detail_screen.dart';
import 'features/copy_trading/presentation/copy_trading_list_screen.dart';
import 'features/strategies/presentation/strategy_list_screen.dart';
import 'features/strategies/presentation/strategy_setup_screen.dart';
import 'features/settings/presentation/settings_screen.dart';
import 'features/activity/presentation/activity_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarBrightness: Brightness.dark,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const ProviderScope(child: TradingAgentApp()));
}

class TradingAgentApp extends StatefulWidget {
  const TradingAgentApp({super.key});

  @override
  State<TradingAgentApp> createState() => _TradingAgentAppState();
}

class _TradingAgentAppState extends State<TradingAgentApp> {
  bool _onboardingChecked = false;
  bool _onboardingComplete = true;

  @override
  void initState() {
    super.initState();
    _checkOnboarding();
  }

  Future<void> _checkOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _onboardingComplete = prefs.getBool('onboarding_complete') ?? true;
      _onboardingChecked = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    const scheme = CoinDCXColors.dark;

    if (!_onboardingChecked) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: buildMaterialTheme(scheme),
        home: Scaffold(
          backgroundColor: scheme.generalBackgroundBgL1,
          body: const Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return CoinDCXTheme(
      colors: scheme,
      child: MaterialApp(
        title: 'CoinDCX Web3',
        debugShowCheckedModeBanner: false,
        theme: buildMaterialTheme(scheme),
        initialRoute: _onboardingComplete ? '/' : '/onboarding',
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
            case '/onboarding':
              return MaterialPageRoute(builder: (_) => const OnboardingScreen());
            case '/leaderboard':
              return MaterialPageRoute(builder: (_) => const LeaderboardScreen());
            case '/copy-trader-detail':
              final trader = settings.arguments as LeaderboardTrader;
              return MaterialPageRoute(
                builder: (_) => CopyTraderDetailScreen(trader: trader),
              );
            case '/copy-trading-list':
              return MaterialPageRoute(builder: (_) => const CopyTradingListScreen());
            case '/strategies':
              return MaterialPageRoute(builder: (_) => const StrategyListScreen());
            case '/strategy-setup':
              final template = settings.arguments as StrategyTemplate;
              return MaterialPageRoute(
                builder: (_) => StrategySetupScreen(template: template),
              );
            case '/settings':
              return MaterialPageRoute(builder: (_) => const SettingsScreen());
            case '/activity':
              return MaterialPageRoute(builder: (_) => const ActivityScreen());
            default:
              return MaterialPageRoute(builder: (_) => const AppShell());
          }
        },
      ),
    );
  }
}
