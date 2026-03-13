import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../core/api/models.dart';
import '../../../core/utils/formatters.dart';

class CopyTradingListScreen extends ConsumerWidget {
  const CopyTradingListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = CoinDCXTheme.of(context);
    final configsAsync = ref.watch(copyConfigsProvider);
    final activityAsync = ref.watch(copyActivityProvider);

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      appBar: AppBar(
        title: const Text('Copy Trading'),
        actions: [
          IconButton(
            icon: const Icon(Icons.leaderboard_rounded),
            onPressed: () => Navigator.pushNamed(context, '/leaderboard'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        children: [
          // Active configs
          Text('Active Copies', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.sm),
          configsAsync.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (configs) {
              if (configs.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(CoinDCXSpacing.xl),
                  decoration: BoxDecoration(
                    color: colors.generalBackgroundBgL2,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                    border: Border.all(color: colors.generalStrokeL1),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.people_outline_rounded, size: 40, color: colors.generalForegroundTertiary),
                      const SizedBox(height: CoinDCXSpacing.sm),
                      Text('No active copy trades', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
                      const SizedBox(height: CoinDCXSpacing.sm),
                      TextButton(
                        onPressed: () => Navigator.pushNamed(context, '/leaderboard'),
                        child: const Text('Find Traders'),
                      ),
                    ],
                  ),
                );
              }
              return Column(children: configs.map((c) => _buildConfigCard(context, ref, c, colors)).toList());
            },
          ),

          const SizedBox(height: CoinDCXSpacing.xl),

          // Activity feed
          Text('Recent Activity', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.sm),
          activityAsync.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (activities) {
              if (activities.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.all(CoinDCXSpacing.lg),
                  child: Text('No copy activity yet', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundTertiary), textAlign: TextAlign.center),
                );
              }
              return Column(children: activities.map((a) => _buildActivityRow(a, colors)).toList());
            },
          ),
        ],
      ),
    );
  }

  Widget _buildConfigCard(BuildContext context, WidgetRef ref, CopyTradeConfig config, CoinDCXColorScheme colors) {
    final isPositive = config.totalPnl >= 0;
    return Container(
      margin: const EdgeInsets.only(bottom: CoinDCXSpacing.sm),
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(
                  color: colors.actionBackgroundSecondary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Center(child: Text(config.walletName[0].toUpperCase(), style: CoinDCXTypography.buttonSm.copyWith(color: colors.actionBackgroundPrimary, fontSize: 13))),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(config.walletName, style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 13)),
                    Text(shortenAddress(config.walletAddress), style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: config.enabled ? colors.positiveBackgroundPrimary.withValues(alpha: 0.15) : colors.generalStrokeL2,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(config.enabled ? 'ACTIVE' : 'PAUSED', style: CoinDCXTypography.caption.copyWith(
                  color: config.enabled ? colors.positiveBackgroundPrimary : colors.generalForegroundTertiary,
                  fontSize: 9, fontWeight: FontWeight.w600,
                )),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          Row(
            children: [
              _miniStat(colors, 'P&L', formatPnl(config.totalPnl), isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary),
              const SizedBox(width: CoinDCXSpacing.md),
              _miniStat(colors, 'Copied', formatCompact(config.totalCopied), colors.generalForegroundPrimary),
              const SizedBox(width: CoinDCXSpacing.md),
              _miniStat(colors, 'Per Trade', '\$${config.buyAmount.toInt()}', colors.generalForegroundPrimary),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              _actionBtn(colors, config.enabled ? 'Pause' : 'Resume', colors.alertBackgroundPrimary, () async {
                final api = ref.read(apiClientProvider);
                await api.put('/api/v1/copy/${config.walletAddress}', body: {'enabled': !config.enabled});
                ref.invalidate(copyConfigsProvider);
              }),
              const SizedBox(width: 8),
              _actionBtn(colors, 'Stop', colors.negativeBackgroundPrimary, () async {
                final api = ref.read(apiClientProvider);
                await api.delete('/api/v1/copy/${config.walletAddress}');
                ref.invalidate(copyConfigsProvider);
              }),
            ],
          ),
        ],
      ),
    );
  }

  Widget _miniStat(CoinDCXColorScheme colors, String label, String value, Color valueColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
        Text(value, style: CoinDCXTypography.numberSm.copyWith(color: valueColor, fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _actionBtn(CoinDCXColorScheme colors, String label, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
        ),
        child: Text(label, style: CoinDCXTypography.caption.copyWith(color: color, fontSize: 10, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _buildActivityRow(CopyActivity activity, CoinDCXColorScheme colors) {
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
          Icon(
            isBuy ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
            color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
            size: 16,
          ),
          const SizedBox(width: CoinDCXSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${activity.side.toUpperCase()} ${activity.tokenSymbol}', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                Text(timeAgo(activity.timestamp), style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('\$${activity.copyAmountUsd.toStringAsFixed(2)}', style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: executed ? colors.positiveBackgroundPrimary.withValues(alpha: 0.15) : colors.alertBackgroundPrimary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  executed ? 'Executed' : activity.skipReason ?? 'Skipped',
                  style: CoinDCXTypography.caption.copyWith(
                    color: executed ? colors.positiveBackgroundPrimary : colors.alertBackgroundPrimary,
                    fontSize: 8,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
