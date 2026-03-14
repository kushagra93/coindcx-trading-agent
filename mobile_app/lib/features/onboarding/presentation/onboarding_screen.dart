import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int _step = 0;
  final _pageController = PageController();

  // Step 1: Chain + deposit
  String _selectedChain = 'solana';
  double _deposit = 500;

  // Step 2: Trading path
  String _tradingPath = 'auto'; // 'copy' or 'auto'

  // Step 3: Risk
  String _riskLevel = 'moderate';

  bool _activating = false;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _next() {
    if (_step < 4) {
      setState(() => _step++);
    }
  }

  void _back() {
    if (_step > 0) {
      setState(() => _step--);
    }
  }

  Future<void> _activate() async {
    setState(() => _activating = true);
    final api = ref.read(apiClientProvider);
    try {
      await api.put('/api/v1/risk', body: {
        'riskLevel': _riskLevel,
        'dailyLossLimitUsd': _riskLevel == 'conservative' ? 500 : _riskLevel == 'aggressive' ? 5000 : 1000,
        'maxPerTradePct': _riskLevel == 'conservative' ? 3 : _riskLevel == 'aggressive' ? 10 : 5,
      });
      await api.post('/api/v1/agent/start');

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('onboarding_complete', true);

      if (mounted) {
        Navigator.pushReplacementNamed(context, '/');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Setup failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _activating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      body: SafeArea(
        child: Column(
          children: [
            // Progress bar
            Padding(
              padding: const EdgeInsets.all(CoinDCXSpacing.md),
              child: Row(
                children: List.generate(5, (i) {
                  return Expanded(
                    child: Container(
                      height: 3,
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      decoration: BoxDecoration(
                        color: i <= _step ? colors.actionBackgroundPrimary : colors.generalStrokeL2,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  );
                }),
              ),
            ),
            // Content
            Expanded(child: _buildStep(colors)),
            // Navigation
            Padding(
              padding: const EdgeInsets.all(CoinDCXSpacing.md),
              child: Row(
                children: [
                  if (_step > 0)
                    TextButton(
                      onPressed: _back,
                      child: Text('Back', style: TextStyle(color: colors.generalForegroundSecondary)),
                    ),
                  const Expanded(child: SizedBox.shrink()),
                  if (_step < 4)
                    SizedBox(
                      width: 120,
                      child: ElevatedButton(
                        onPressed: _next,
                        child: const Text('Continue'),
                      ),
                    )
                  else
                    SizedBox(
                      width: 160,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _activating ? null : _activate,
                        child: _activating
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Activate Agent'),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep(CoinDCXColorScheme colors) {
    switch (_step) {
      case 0: return _buildWelcome(colors);
      case 1: return _buildChainDeposit(colors);
      case 2: return _buildTradingPath(colors);
      case 3: return _buildRiskLevel(colors);
      case 4: return _buildReview(colors);
      default: return const SizedBox();
    }
  }

  // Step 0: Welcome
  Widget _buildWelcome(CoinDCXColorScheme colors) {
    return PageView(
      controller: _pageController,
      children: [
        _welcomeSlide(colors, Icons.auto_awesome_rounded, 'AI-Powered Trading', 'Let our agent analyze tokens, track whales, and execute trades 24/7.'),
        _welcomeSlide(colors, Icons.people_rounded, 'Copy Top Traders', 'Follow the best-performing wallets and mirror their moves automatically.'),
        _welcomeSlide(colors, Icons.shield_rounded, 'Built-in Safety', 'Risk controls, daily loss limits, and AI screening protect your portfolio.'),
      ],
    );
  }

  Widget _welcomeSlide(CoinDCXColorScheme colors, IconData icon, String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.all(CoinDCXSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80, height: 80,
            decoration: BoxDecoration(
              color: colors.actionBackgroundPrimary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(40),
            ),
            child: Icon(icon, color: colors.actionBackgroundPrimary, size: 40),
          ),
          const SizedBox(height: CoinDCXSpacing.xl),
          Text(title, style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 22), textAlign: TextAlign.center),
          const SizedBox(height: CoinDCXSpacing.sm),
          Text(subtitle, style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary, fontSize: 14), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  // Step 1: Chain + Deposit
  Widget _buildChainDeposit(CoinDCXColorScheme colors) {
    return Padding(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Choose Your Chain', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 18)),
          const SizedBox(height: CoinDCXSpacing.sm),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: ['solana', 'ethereum', 'base', 'arbitrum', 'polygon'].map((chain) {
              final active = _selectedChain == chain;
              return GestureDetector(
                onTap: () => setState(() => _selectedChain = chain),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: active ? colors.actionBackgroundPrimary : Colors.transparent,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    border: Border.all(color: active ? colors.actionBackgroundPrimary : colors.generalStrokeL2),
                  ),
                  child: Text(chain[0].toUpperCase() + chain.substring(1),
                    style: CoinDCXTypography.buttonSm.copyWith(color: active ? Colors.white : colors.generalForegroundSecondary, fontSize: 13)),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: CoinDCXSpacing.xl),
          Text('Starting Budget', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 18)),
          const SizedBox(height: CoinDCXSpacing.sm),
          Row(
            children: [100, 500, 1000, 5000].map((amount) {
              final active = _deposit == amount;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _deposit = amount.toDouble()),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: active ? colors.actionBackgroundPrimary.withValues(alpha: 0.15) : colors.generalBackgroundBgL2,
                      borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                      border: Border.all(color: active ? colors.actionBackgroundPrimary : colors.generalStrokeL2),
                    ),
                    child: Text('\$$amount', style: CoinDCXTypography.numberSm.copyWith(
                      color: active ? colors.actionBackgroundPrimary : colors.generalForegroundSecondary, fontSize: 14),
                      textAlign: TextAlign.center),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // Step 2: Trading path
  Widget _buildTradingPath(CoinDCXColorScheme colors) {
    return Padding(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Choose Your Path', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 18)),
          const SizedBox(height: CoinDCXSpacing.sm),
          Text('How do you want to trade?', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
          const SizedBox(height: CoinDCXSpacing.lg),
          _pathCard(colors, 'copy', Icons.people_rounded, 'Copy Trading',
            'Follow top traders and automatically copy their moves.'),
          const SizedBox(height: CoinDCXSpacing.sm),
          _pathCard(colors, 'auto', Icons.auto_graph_rounded, 'Auto-Trade Templates',
            'Use pre-built strategies like DCA, momentum, and grid trading.'),
        ],
      ),
    );
  }

  Widget _pathCard(CoinDCXColorScheme colors, String value, IconData icon, String title, String desc) {
    final active = _tradingPath == value;
    return GestureDetector(
      onTap: () => setState(() => _tradingPath = value),
      child: Container(
        padding: const EdgeInsets.all(CoinDCXSpacing.lg),
        decoration: BoxDecoration(
          color: active ? colors.actionBackgroundPrimary.withValues(alpha: 0.08) : colors.generalBackgroundBgL2,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusLg),
          border: Border.all(color: active ? colors.actionBackgroundPrimary : colors.generalStrokeL1, width: active ? 1.5 : 1),
        ),
        child: Row(
          children: [
            Icon(icon, color: active ? colors.actionBackgroundPrimary : colors.generalForegroundTertiary, size: 32),
            const SizedBox(width: CoinDCXSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
                  Text(desc, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundSecondary, fontSize: 11)),
                ],
              ),
            ),
            if (active) Icon(Icons.check_circle_rounded, color: colors.actionBackgroundPrimary, size: 22),
          ],
        ),
      ),
    );
  }

  // Step 3: Risk level
  Widget _buildRiskLevel(CoinDCXColorScheme colors) {
    return Padding(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Set Your Risk Level', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 18)),
          const SizedBox(height: CoinDCXSpacing.sm),
          Text('This controls position sizing and loss limits', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
          const SizedBox(height: CoinDCXSpacing.lg),
          _riskCard(colors, 'conservative', 'Conservative', 'Smaller positions, tight stops. Best for preserving capital.',
            colors.positiveBackgroundPrimary, Icons.shield_rounded),
          const SizedBox(height: CoinDCXSpacing.sm),
          _riskCard(colors, 'moderate', 'Moderate', 'Balanced approach with reasonable position sizes.',
            colors.alertBackgroundPrimary, Icons.balance_rounded),
          const SizedBox(height: CoinDCXSpacing.sm),
          _riskCard(colors, 'aggressive', 'Aggressive', 'Larger positions, wider stops. Higher risk, higher potential reward.',
            colors.negativeBackgroundPrimary, Icons.bolt_rounded),
        ],
      ),
    );
  }

  Widget _riskCard(CoinDCXColorScheme colors, String value, String title, String desc, Color accent, IconData icon) {
    final active = _riskLevel == value;
    return GestureDetector(
      onTap: () => setState(() => _riskLevel = value),
      child: Container(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        decoration: BoxDecoration(
          color: active ? accent.withValues(alpha: 0.08) : colors.generalBackgroundBgL2,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
          border: Border.all(color: active ? accent : colors.generalStrokeL1, width: active ? 1.5 : 1),
        ),
        child: Row(
          children: [
            Icon(icon, color: active ? accent : colors.generalForegroundTertiary, size: 28),
            const SizedBox(width: CoinDCXSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 14)),
                  Text(desc, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundSecondary, fontSize: 11)),
                ],
              ),
            ),
            if (active) Icon(Icons.check_circle_rounded, color: accent, size: 22),
          ],
        ),
      ),
    );
  }

  // Step 4: Review
  Widget _buildReview(CoinDCXColorScheme colors) {
    return Padding(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Review & Activate', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 18)),
          const SizedBox(height: CoinDCXSpacing.sm),
          Text('Confirm your settings before starting the agent', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
          const SizedBox(height: CoinDCXSpacing.lg),
          Container(
            padding: const EdgeInsets.all(CoinDCXSpacing.lg),
            decoration: BoxDecoration(
              color: colors.generalBackgroundBgL2,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusLg),
              border: Border.all(color: colors.generalStrokeL1),
            ),
            child: Column(
              children: [
                _reviewRow(colors, 'Chain', _selectedChain[0].toUpperCase() + _selectedChain.substring(1)),
                Divider(color: colors.generalStrokeL1),
                _reviewRow(colors, 'Budget', '\$${_deposit.toInt()}'),
                Divider(color: colors.generalStrokeL1),
                _reviewRow(colors, 'Strategy', _tradingPath == 'copy' ? 'Copy Trading' : 'Auto-Trade'),
                Divider(color: colors.generalStrokeL1),
                _reviewRow(colors, 'Risk Level', _riskLevel[0].toUpperCase() + _riskLevel.substring(1)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _reviewRow(CoinDCXColorScheme colors, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: CoinDCXSpacing.xs),
      child: Row(
        children: [
          Text(label, style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary, fontSize: 13)),
          const Spacer(),
          Text(value, style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
