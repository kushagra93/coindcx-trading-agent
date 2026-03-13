import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../core/api/models.dart';
import '../../../core/utils/formatters.dart';

class ActivityScreen extends ConsumerWidget {
  const ActivityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = CoinDCXTheme.of(context);
    final portfolioRawAsync = ref.watch(portfolioRawProvider);
    final copyActivityAsync = ref.watch(copyActivityProvider);

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      appBar: AppBar(
        title: const Text('Activity'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              ref.invalidate(portfolioRawProvider);
              ref.invalidate(copyActivityProvider);
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        children: [
          // Trade history
          Text('Trade History', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.sm),
          portfolioRawAsync.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (raw) {
              final trades = (raw['trades'] as List<dynamic>?)
                  ?.map((t) => t as Map<String, dynamic>)
                  .toList() ?? [];
              if (trades.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.all(CoinDCXSpacing.lg),
                  child: Text('No trades yet', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundTertiary), textAlign: TextAlign.center),
                );
              }
              return Column(children: trades.map((t) => _buildTradeRow(t, colors)).toList());
            },
          ),

          const SizedBox(height: CoinDCXSpacing.xl),

          // Copy trade activity
          Text('Copy Trade Activity', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.sm),
          copyActivityAsync.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (activities) {
              if (activities.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.all(CoinDCXSpacing.lg),
                  child: Text('No copy trade activity', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundTertiary), textAlign: TextAlign.center),
                );
              }
              return Column(children: activities.map((a) => _buildCopyRow(a, colors)).toList());
            },
          ),
        ],
      ),
    );
  }

  Widget _buildTradeRow(Map<String, dynamic> trade, CoinDCXColorScheme colors) {
    final side = trade['side'] as String? ?? 'buy';
    final symbol = trade['symbol'] as String? ?? '';
    final amount = (trade['amountUsd'] as num?)?.toDouble() ?? (trade['amount'] as num?)?.toDouble() ?? 0;
    final price = (trade['price'] as num?)?.toDouble() ?? 0;
    final isBuy = side == 'buy';

    return Container(
      margin: const EdgeInsets.only(bottom: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Row(
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(
              color: isBuy ? colors.positiveBackgroundSecondary : colors.negativeBackgroundSecondary,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              isBuy ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
              color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
              size: 16,
            ),
          ),
          const SizedBox(width: CoinDCXSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${side.toUpperCase()} $symbol', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 13)),
                Text('@ \$${price.toStringAsFixed(6)}', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
              ],
            ),
          ),
          Text('\$${amount.toStringAsFixed(2)}', style: CoinDCXTypography.numberSm.copyWith(
            color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildCopyRow(CopyActivity activity, CoinDCXColorScheme colors) {
    final isBuy = activity.side == 'buy';
    final executed = activity.status == 'executed';

    return Container(
      margin: const EdgeInsets.only(bottom: CoinDCXSpacing.xs),
      padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xs),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.generalStrokeL1.withValues(alpha: 0.3))),
      ),
      child: Row(
        children: [
          Icon(Icons.people_rounded, color: colors.actionBackgroundPrimary, size: 16),
          const SizedBox(width: CoinDCXSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${activity.side.toUpperCase()} ${activity.tokenSymbol}', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                Text('${shortenAddress(activity.walletAddress)} \u2022 ${timeAgo(activity.timestamp)}',
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('\$${activity.copyAmountUsd.toStringAsFixed(2)}',
                style: CoinDCXTypography.numberSm.copyWith(color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary, fontSize: 12)),
              Text(executed ? 'Executed' : 'Skipped',
                style: CoinDCXTypography.caption.copyWith(color: executed ? colors.positiveBackgroundPrimary : colors.alertBackgroundPrimary, fontSize: 9)),
            ],
          ),
        ],
      ),
    );
  }
}
