import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';
import 'features/discovery/presentation/discovery_screen.dart';
import 'features/chat/presentation/chat_screen.dart';
import 'features/portfolio/presentation/portfolio_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;

  final _screens = const [
    DiscoveryScreen(),
    ChatScreen(),
    PortfolioScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: colors.generalStrokeL1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.explore_rounded),
              label: 'Discover',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.smart_toy_rounded),
              label: 'AI Chat',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.account_balance_wallet_rounded),
              label: 'Portfolio',
            ),
          ],
        ),
      ),
    );
  }
}
