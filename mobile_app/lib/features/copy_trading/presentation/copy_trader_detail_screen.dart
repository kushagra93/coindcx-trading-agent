import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../core/api/models.dart';
import '../../../core/utils/formatters.dart';

class CopyTraderDetailScreen extends ConsumerStatefulWidget {
  final LeaderboardTrader trader;
  const CopyTraderDetailScreen({super.key, required this.trader});

  @override
  ConsumerState<CopyTraderDetailScreen> createState() => _CopyTraderDetailScreenState();
}

class _CopyTraderDetailScreenState extends ConsumerState<CopyTraderDetailScreen> {
  double _budget = 500;
  bool _submitting = false;

  Future<void> _startCopying() async {
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post('/api/v1/copy', body: {
        'walletAddress': widget.trader.walletAddress,
        'buyAmount': _budget,
        'buyMode': 'fixed_buy',
        'sellMethod': 'mirror_sell',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Now copying this trader!')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);
    final t = widget.trader;

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      appBar: AppBar(title: Text(t.name)),
      body: ListView(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        children: [
          // Profile header
          Center(
            child: Column(
              children: [
                Container(
                  width: 72, height: 72,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [colors.actionBackgroundPrimary, colors.actionBackgroundPrimary.withValues(alpha: 0.4)],
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(36),
                  ),
                  child: Center(
                    child: Text(t.name.isNotEmpty ? t.name[0].toUpperCase() : '?',
                      style: CoinDCXTypography.heading3.copyWith(color: Colors.white, fontSize: 28)),
                  ),
                ),
                const SizedBox(height: CoinDCXSpacing.sm),
                Text(t.name, style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary)),
                const SizedBox(height: 2),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(shortenAddress(t.walletAddress), style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: colors.actionBackgroundSecondary,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(t.chain.toUpperCase(), style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
                if (t.twitterUsername != null) ...[
                  const SizedBox(height: 4),
                  Text('@${t.twitterUsername}', style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary)),
                ],
              ],
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.lg),

          // Stats grid
          Row(
            children: [
              Expanded(child: _statCard(colors, '30d P&L', formatPnl(t.pnl30d), t.pnl30d >= 0 ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary)),
              const SizedBox(width: CoinDCXSpacing.sm),
              Expanded(child: _statCard(colors, 'Sharpe', t.sharpe?.toStringAsFixed(2) ?? '-', colors.actionBackgroundPrimary)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          Row(
            children: [
              Expanded(child: _statCard(colors, 'Copiers', '${t.copiers}', colors.generalForegroundPrimary)),
              const SizedBox(width: CoinDCXSpacing.sm),
              Expanded(child: _statCard(colors, 'Win Rate', '${t.winRate30d.toStringAsFixed(0)}%', colors.actionBackgroundPrimary)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.lg),

          // Performance bars (simulated 30-day)
          Text('30-Day Performance', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.sm),
          SizedBox(
            height: 80,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(30, (i) {
                final rng = Random(t.walletAddress.hashCode + i);
                final val = (rng.nextDouble() * 2 - 0.5) * (t.pnl30d.abs() / 30);
                final maxH = 60.0;
                final h = (val.abs() / (t.pnl30d.abs() / 10 + 1)).clamp(0.05, 1.0) * maxH;
                return Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 1),
                    height: h,
                    decoration: BoxDecoration(
                      color: val >= 0 ? colors.positiveBackgroundPrimary.withValues(alpha: 0.7) : colors.negativeBackgroundPrimary.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.xl),

          // Budget slider
          Text('Copy Budget', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.xs),
          Row(
            children: [
              Text('\$${_budget.toInt()}', style: CoinDCXTypography.numberLg.copyWith(color: colors.actionBackgroundPrimary, fontSize: 24)),
              const Spacer(),
              Text('per trade', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary)),
            ],
          ),
          SliderTheme(
            data: SliderThemeData(
              activeTrackColor: colors.actionBackgroundPrimary,
              inactiveTrackColor: colors.generalStrokeL2,
              thumbColor: colors.actionBackgroundPrimary,
            ),
            child: Slider(
              value: _budget,
              min: 100,
              max: 10000,
              divisions: 99,
              onChanged: (v) => setState(() => _budget = v),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('\$100', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
              Text('\$10,000', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xl),

          // Start copying button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _submitting ? null : _startCopying,
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Start Copying'),
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.xl),
        ],
      ),
    );
  }

  Widget _statCard(CoinDCXColorScheme colors, String label, String value, Color valueColor) {
    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        children: [
          Text(value, style: CoinDCXTypography.numberMd.copyWith(color: valueColor, fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(label, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
        ],
      ),
    );
  }
}
