import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';

class PortfolioScreen extends ConsumerWidget {
  const PortfolioScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = CoinDCXTheme.of(context);
    final portfolioAsync = ref.watch(portfolioProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Portfolio'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(portfolioProvider),
          ),
        ],
      ),
      body: portfolioAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(CoinDCXSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.account_balance_wallet_rounded, size: 48, color: colors.generalForegroundTertiary),
                const SizedBox(height: CoinDCXSpacing.md),
                Text(
                  'Could not load portfolio',
                  style: CoinDCXTypography.bodyLarge.copyWith(color: colors.generalForegroundSecondary),
                ),
                const SizedBox(height: CoinDCXSpacing.md),
                TextButton(
                  onPressed: () => ref.invalidate(portfolioProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (positions) {
          if (positions.isEmpty) {
            return _buildEmptyState(context, colors);
          }
          return _buildPositions(context, positions, colors);
        },
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, CoinDCXColorScheme colors) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(CoinDCXSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.account_balance_wallet_outlined, size: 64, color: colors.generalForegroundTertiary),
            const SizedBox(height: CoinDCXSpacing.lg),
            Text(
              'No positions yet',
              style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary),
            ),
            const SizedBox(height: CoinDCXSpacing.xs),
            Text(
              'Start trading to see your portfolio here. Use the AI assistant to discover tokens and make trades.',
              style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: CoinDCXSpacing.xl),
            ElevatedButton(
              onPressed: () => Navigator.pushNamed(context, '/chat'),
              child: const Text('Start Trading'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPositions(BuildContext context, List<TradeRecord> positions, CoinDCXColorScheme colors) {
    return ListView(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      children: [
        // Summary card
        Container(
          padding: const EdgeInsets.all(CoinDCXSpacing.lg),
          decoration: BoxDecoration(
            color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusLg),
            border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              Text(
                '${positions.length} Active Positions',
                style: CoinDCXTypography.bodyLarge.copyWith(color: colors.generalForegroundPrimary),
              ),
              const SizedBox(height: CoinDCXSpacing.xxs),
              Text(
                '\$${_totalValue(positions).toStringAsFixed(2)}',
                style: CoinDCXTypography.numberLg.copyWith(
                  color: colors.generalForegroundPrimary,
                  fontSize: 28,
                ),
              ),
              Text(
                'Total Value',
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
              ),
            ],
          ),
        ),
        const SizedBox(height: CoinDCXSpacing.lg),
        Text(
          'Positions',
          style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary),
        ),
        const SizedBox(height: CoinDCXSpacing.sm),
        ...positions.map((p) => _buildPositionCard(p, colors)),
      ],
    );
  }

  Widget _buildPositionCard(TradeRecord position, CoinDCXColorScheme colors) {
    return Container(
      margin: const EdgeInsets.only(bottom: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: position.side == 'buy'
                  ? colors.positiveBackgroundSecondary
                  : colors.negativeBackgroundSecondary,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
            ),
            child: Icon(
              position.side == 'buy' ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
              color: position.side == 'buy'
                  ? colors.positiveBackgroundPrimary
                  : colors.negativeBackgroundPrimary,
              size: 20,
            ),
          ),
          const SizedBox(width: CoinDCXSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  position.symbol.toUpperCase(),
                  style: CoinDCXTypography.bodyLarge.copyWith(color: colors.generalForegroundPrimary),
                ),
                Text(
                  '${position.side.toUpperCase()} · ${position.chain}',
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '\$${(position.amount * position.price).toStringAsFixed(2)}',
                style: CoinDCXTypography.numberMd.copyWith(color: colors.generalForegroundPrimary),
              ),
              Text(
                '${position.amount} @ \$${position.price.toStringAsFixed(4)}',
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
              ),
            ],
          ),
        ],
      ),
    );
  }

  double _totalValue(List<TradeRecord> positions) {
    return positions.fold(0.0, (sum, p) => sum + (p.amount * p.price));
  }
}
