import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
        ...positions.where((p) => p.side == 'buy').map((p) => _buildPositionCard(context, p, colors)),
        const SizedBox(height: CoinDCXSpacing.lg),
        Text(
          'Transaction History',
          style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary),
        ),
        const SizedBox(height: CoinDCXSpacing.sm),
        ...positions.map((p) => _buildTransactionRow(context, p, colors)),
      ],
    );
  }

  Widget _buildTransactionRow(BuildContext context, TradeRecord tx, CoinDCXColorScheme colors) {
    final isBuy = tx.side == 'buy';
    final time = DateTime.fromMillisecondsSinceEpoch(tx.timestamp);
    final timeStr = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    final dateStr = '${time.day}/${time.month}';

    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xs),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
      ),
      child: Row(
        children: [
          Icon(
            isBuy ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
            size: 14,
            color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${tx.side.toUpperCase()} ${tx.symbol}',
                  style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                Text('$dateStr $timeStr · ${tx.chain} · ${tx.status}',
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('\$${(tx.amount * tx.price).toStringAsFixed(2)}',
                style: CoinDCXTypography.numberSm.copyWith(
                  color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary, fontSize: 11)),
              Text('${tx.amount.toStringAsFixed(4)} @ \$${tx.price.toStringAsFixed(4)}',
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 8)),
            ],
          ),
          if (tx.txHash != null) ...[
            const SizedBox(width: 4),
            GestureDetector(
              onTap: () {
                final chain = tx.chain.toLowerCase();
                final explorerUrl = chain == 'solana'
                    ? 'https://solscan.io/tx/${tx.txHash}'
                    : chain == 'ethereum'
                        ? 'https://etherscan.io/tx/${tx.txHash}'
                        : chain == 'base'
                            ? 'https://basescan.org/tx/${tx.txHash}'
                            : chain == 'arbitrum'
                                ? 'https://arbiscan.io/tx/${tx.txHash}'
                                : 'https://solscan.io/tx/${tx.txHash}';
                Clipboard.setData(ClipboardData(text: explorerUrl));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Explorer URL copied: $explorerUrl'), duration: const Duration(seconds: 2)),
                );
              },
              child: Icon(Icons.open_in_new_rounded, size: 12, color: colors.actionBackgroundPrimary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPositionCard(BuildContext context, TradeRecord position, CoinDCXColorScheme colors) {
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
                '${position.amount.toStringAsFixed(4)} @ \$${position.price.toStringAsFixed(4)}',
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
              ),
              if (position.side == 'buy') ...[
                const SizedBox(height: CoinDCXSpacing.xxs),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/chat'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxxs),
                    decoration: BoxDecoration(
                      color: colors.negativeBackgroundSecondary,
                      borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    ),
                    child: Text('Sell', style: CoinDCXTypography.caption.copyWith(color: colors.negativeBackgroundPrimary, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
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
