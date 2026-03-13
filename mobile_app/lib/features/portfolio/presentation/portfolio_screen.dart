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
        data: (portfolio) {
          if (portfolio.holdings.isEmpty && portfolio.history.isEmpty) {
            return _buildEmptyState(context, colors);
          }
          return _buildPortfolio(context, portfolio, colors);
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

  Widget _buildPortfolio(BuildContext context, PortfolioData portfolio, CoinDCXColorScheme colors) {
    final net = portfolio.totalInvested - portfolio.totalSold;

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
                '\$${portfolio.totalInvested.toStringAsFixed(2)}',
                style: CoinDCXTypography.numberLg.copyWith(
                  color: colors.generalForegroundPrimary,
                  fontSize: 28,
                ),
              ),
              Text(
                'Total Invested',
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
              ),
              const SizedBox(height: CoinDCXSpacing.sm),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _summaryChip('Invested', '\$${portfolio.totalInvested.toStringAsFixed(0)}', colors.actionBackgroundPrimary, colors),
                  _summaryChip('Sold', '\$${portfolio.totalSold.toStringAsFixed(0)}', colors.negativeBackgroundPrimary, colors),
                  _summaryChip('Net', '\$${net.toStringAsFixed(0)}', net >= 0 ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary, colors),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: CoinDCXSpacing.lg),

        // Holdings
        if (portfolio.holdings.isNotEmpty) ...[
          Row(
            children: [
              Text(
                'Holdings',
                style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary),
              ),
              const SizedBox(width: CoinDCXSpacing.xs),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: colors.actionBackgroundPrimary.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Text(
                  '${portfolio.holdings.length}',
                  style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          ...portfolio.holdings.map((h) => _buildHoldingCard(context, h, colors)),
        ],

        const SizedBox(height: CoinDCXSpacing.lg),

        // Transaction History
        if (portfolio.history.isNotEmpty) ...[
          Row(
            children: [
              Text(
                'Transaction History',
                style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary),
              ),
              const SizedBox(width: CoinDCXSpacing.xs),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: colors.generalForegroundTertiary.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Text(
                  '${portfolio.history.length}',
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          ...portfolio.history.map((t) => _buildTransactionRow(context, t, colors)),
        ],
      ],
    );
  }

  Widget _summaryChip(String label, String value, Color accent, CoinDCXColorScheme colors) {
    return Column(
      children: [
        Text(value, style: CoinDCXTypography.numberSm.copyWith(color: accent, fontSize: 14, fontWeight: FontWeight.w700)),
        Text(label, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
      ],
    );
  }

  Widget _buildHoldingCard(BuildContext context, TradeRecord holding, CoinDCXColorScheme colors) {
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
              color: colors.positiveBackgroundSecondary,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
            ),
            child: Center(
              child: Text(
                holding.symbol.isNotEmpty ? holding.symbol[0].toUpperCase() : '?',
                style: CoinDCXTypography.heading3.copyWith(color: colors.positiveBackgroundPrimary),
              ),
            ),
          ),
          const SizedBox(width: CoinDCXSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        holding.symbol.toUpperCase(),
                        style: CoinDCXTypography.bodyLarge.copyWith(color: colors.generalForegroundPrimary),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (holding.tradeCount > 1) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: colors.actionBackgroundPrimary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                        ),
                        child: Text(
                          '${holding.tradeCount} buys',
                          style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ],
                ),
                Text(
                  '${holding.chain} · Avg \$${holding.price.toStringAsFixed(holding.price < 0.01 ? 8 : 4)}',
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '\$${holding.costBasis.toStringAsFixed(2)}',
                style: CoinDCXTypography.numberMd.copyWith(color: colors.generalForegroundPrimary),
              ),
              Text(
                _formatAmount(holding.amount),
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
              ),
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
          ),
        ],
      ),
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
              Text('\$${tx.costBasis.toStringAsFixed(2)}',
                style: CoinDCXTypography.numberSm.copyWith(
                  color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary, fontSize: 11)),
              Text('${_formatAmount(tx.amount)} @ \$${tx.price.toStringAsFixed(tx.price < 0.01 ? 8 : 4)}',
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

  String _formatAmount(double amount) {
    if (amount >= 1000000) return '${(amount / 1000000).toStringAsFixed(2)}M';
    if (amount >= 1000) return '${(amount / 1000).toStringAsFixed(2)}K';
    if (amount >= 1) return amount.toStringAsFixed(4);
    return amount.toStringAsFixed(8);
  }
}
