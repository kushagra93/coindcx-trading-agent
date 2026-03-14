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
            icon: const Icon(Icons.history_rounded),
            onPressed: () => Navigator.pushNamed(context, '/activity'),
          ),
          IconButton(
            icon: const Icon(Icons.settings_rounded),
            onPressed: () => Navigator.pushNamed(context, '/settings'),
          ),
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
          final hasWallet = portfolio.wallet != null && (portfolio.wallet!.sol > 0 || portfolio.wallet!.tokens.isNotEmpty);
          if (portfolio.holdings.isEmpty && portfolio.history.isEmpty && !hasWallet) {
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
    final isNetPositive = net >= 0;

    return ListView(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      children: [
        // Summary card -- hero section
        Container(
          padding: const EdgeInsets.all(CoinDCXSpacing.lg),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                colors.actionBackgroundPrimary.withValues(alpha: 0.15),
                colors.actionBackgroundPrimary.withValues(alpha: 0.05),
              ],
            ),
            borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusLg),
            border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.25)),
          ),
          child: Column(
            children: [
              Text(
                'Total Invested',
                style: CoinDCXTypography.bodySmall.copyWith(
                  color: colors.generalForegroundSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: CoinDCXSpacing.xxs),
              Text(
                '\$${portfolio.totalInvested.toStringAsFixed(2)}',
                style: CoinDCXTypography.numberLg.copyWith(
                  color: colors.generalForegroundPrimary,
                  fontSize: 36,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: CoinDCXSpacing.md),
              // P&L row
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: CoinDCXSpacing.md,
                  vertical: CoinDCXSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: colors.generalBackgroundBgL2.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                ),
                child: Row(
                  children: [
                    _summaryColumn(
                      'Invested',
                      '\$${portfolio.totalInvested.toStringAsFixed(0)}',
                      colors.actionBackgroundPrimary,
                      colors,
                    ),
                    _verticalDivider(colors),
                    _summaryColumn(
                      'Sold',
                      '\$${portfolio.totalSold.toStringAsFixed(0)}',
                      colors.generalForegroundSecondary,
                      colors,
                    ),
                    _verticalDivider(colors),
                    _summaryColumn(
                      'Net P&L',
                      '${isNetPositive ? '+' : ''}\$${net.toStringAsFixed(0)}',
                      isNetPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                      colors,
                      showArrow: true,
                      isPositive: isNetPositive,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: CoinDCXSpacing.xl),

        // On-chain wallet balances
        if (portfolio.wallet != null) ...[
          _buildSectionHeader(
            colors,
            'Wallet',
            Icons.account_balance_wallet_outlined,
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF9945FF).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                  ),
                  child: Text(
                    'ON-CHAIN',
                    style: CoinDCXTypography.caption.copyWith(
                      color: const Color(0xFF9945FF),
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: CoinDCXSpacing.xs),
                GestureDetector(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: portfolio.wallet!.viewUrl ?? portfolio.wallet!.publicKey));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Solscan URL copied!'), duration: Duration(seconds: 2)),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs, vertical: CoinDCXSpacing.xxxs),
                    decoration: BoxDecoration(
                      color: colors.generalBackgroundBgL3,
                      borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${portfolio.wallet!.publicKey.substring(0, 4)}...${portfolio.wallet!.publicKey.substring(portfolio.wallet!.publicKey.length - 4)}',
                          style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontSize: 10),
                        ),
                        const SizedBox(width: 2),
                        Icon(Icons.copy_rounded, size: 10, color: colors.actionBackgroundPrimary),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          Container(
            decoration: BoxDecoration(
              color: colors.generalBackgroundBgL2,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
              border: Border.all(color: const Color(0xFF9945FF).withValues(alpha: 0.15)),
            ),
            child: Column(
              children: [
                _buildWalletBalanceRow('SOL', portfolio.wallet!.sol, null, colors, isFirst: true),
                ...portfolio.wallet!.tokens.asMap().entries.map(
                  (entry) => _buildWalletBalanceRow(
                    entry.value.symbol,
                    entry.value.uiAmount,
                    entry.value.mint,
                    colors,
                    isLast: entry.key == portfolio.wallet!.tokens.length - 1,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.xl),
        ],

        // Holdings
        if (portfolio.holdings.isNotEmpty) ...[
          _buildSectionHeader(
            colors,
            'Holdings',
            Icons.pie_chart_outline_rounded,
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs, vertical: CoinDCXSpacing.xxxs),
              decoration: BoxDecoration(
                color: colors.actionBackgroundPrimary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
              ),
              child: Text(
                '${portfolio.holdings.length}',
                style: CoinDCXTypography.caption.copyWith(
                  color: colors.actionBackgroundPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          ...portfolio.holdings.map((h) => _buildHoldingCard(context, h, colors)),
        ],

        const SizedBox(height: CoinDCXSpacing.lg),

        // Transaction History
        if (portfolio.history.isNotEmpty) ...[
          _buildSectionHeader(
            colors,
            'Transaction History',
            Icons.receipt_long_rounded,
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs, vertical: CoinDCXSpacing.xxxs),
              decoration: BoxDecoration(
                color: colors.generalForegroundTertiary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
              ),
              child: Text(
                '${portfolio.history.length}',
                style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          Container(
            decoration: BoxDecoration(
              color: colors.generalBackgroundBgL2,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
              border: Border.all(color: colors.generalStrokeL1),
            ),
            child: Column(
              children: portfolio.history.asMap().entries.map((entry) {
                final isLast = entry.key == portfolio.history.length - 1;
                return Column(
                  children: [
                    _buildTransactionRow(context, entry.value, colors),
                    if (!isLast)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
                        child: Divider(height: 1, color: colors.generalStrokeL1),
                      ),
                  ],
                );
              }).toList(),
            ),
          ),
        ],
        const SizedBox(height: CoinDCXSpacing.xxl),
      ],
    );
  }

  Widget _buildSectionHeader(CoinDCXColorScheme colors, String title, IconData icon, {Widget? trailing}) {
    return Row(
      children: [
        Icon(icon, size: 18, color: colors.actionBackgroundPrimary),
        const SizedBox(width: CoinDCXSpacing.xs),
        Text(
          title,
          style: CoinDCXTypography.heading3.copyWith(
            color: colors.generalForegroundPrimary,
            fontSize: 16,
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: CoinDCXSpacing.xs),
          trailing,
        ],
        const Spacer(),
      ],
    );
  }

  Widget _summaryColumn(String label, String value, Color accent, CoinDCXColorScheme colors, {bool showArrow = false, bool isPositive = true}) {
    return Expanded(
      child: Column(
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (showArrow) ...[
                Icon(
                  isPositive ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                  size: 14,
                  color: accent,
                ),
                const SizedBox(width: CoinDCXSpacing.xxxs),
              ],
              Text(
                value,
                style: CoinDCXTypography.numberMd.copyWith(
                  color: accent,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xxxs),
          Text(
            label,
            style: CoinDCXTypography.caption.copyWith(
              color: colors.generalForegroundTertiary,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }

  Widget _verticalDivider(CoinDCXColorScheme colors) {
    return Container(
      width: 1,
      height: 32,
      margin: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs),
      color: colors.generalStrokeL2,
    );
  }

  Widget _buildHoldingCard(BuildContext context, TradeRecord holding, CoinDCXColorScheme colors) {
    return Container(
      margin: const EdgeInsets.only(bottom: CoinDCXSpacing.sm),
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colors.positiveBackgroundSecondary,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
            ),
            child: Center(
              child: Text(
                holding.symbol.isNotEmpty ? holding.symbol[0].toUpperCase() : '?',
                style: CoinDCXTypography.heading3.copyWith(
                  color: colors.positiveBackgroundPrimary,
                  fontSize: 18,
                ),
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
                        style: CoinDCXTypography.bodyLarge.copyWith(
                          color: colors.generalForegroundPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (holding.tradeCount > 1) ...[
                      const SizedBox(width: CoinDCXSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: colors.actionBackgroundPrimary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                        ),
                        child: Text(
                          '${holding.tradeCount} buys',
                          style: CoinDCXTypography.caption.copyWith(
                            color: colors.actionBackgroundPrimary,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: CoinDCXSpacing.xxxs),
                Text(
                  '${holding.chain}  ·  Avg \$${holding.price.toStringAsFixed(holding.price < 0.01 ? 8 : 4)}',
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                ),
              ],
            ),
          ),
          const SizedBox(width: CoinDCXSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '\$${holding.costBasis.toStringAsFixed(2)}',
                style: CoinDCXTypography.numberMd.copyWith(
                  color: colors.generalForegroundPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: CoinDCXSpacing.xxxs),
              Text(
                _formatAmount(holding.amount),
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
              ),
              const SizedBox(height: CoinDCXSpacing.xs),
              GestureDetector(
                onTap: () => Navigator.pushNamed(context, '/chat'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.xxs),
                  decoration: BoxDecoration(
                    color: colors.negativeBackgroundSecondary,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    border: Border.all(color: colors.negativeBackgroundPrimary.withValues(alpha: 0.25)),
                  ),
                  child: Text(
                    'Sell',
                    style: CoinDCXTypography.buttonSm.copyWith(
                      color: colors.negativeBackgroundPrimary,
                      fontSize: 11,
                    ),
                  ),
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

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
      child: Row(
        children: [
          // Direction icon
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: (isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
            ),
            child: Center(
              child: Icon(
                isBuy ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                size: 16,
                color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
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
                    Text(
                      '${tx.side.toUpperCase()} ${tx.symbol}',
                      style: CoinDCXTypography.bodySmall.copyWith(
                        color: colors.generalForegroundPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: CoinDCXSpacing.xs),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: tx.status == 'completed'
                            ? colors.positiveBackgroundPrimary.withValues(alpha: 0.1)
                            : colors.alertBackgroundPrimary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                      ),
                      child: Text(
                        tx.status,
                        style: CoinDCXTypography.caption.copyWith(
                          color: tx.status == 'completed'
                              ? colors.positiveBackgroundPrimary
                              : colors.alertBackgroundPrimary,
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: CoinDCXSpacing.xxxs),
                Text(
                  '$dateStr  $timeStr  ·  ${tx.chain}',
                  style: CoinDCXTypography.caption.copyWith(
                    color: colors.generalForegroundTertiary,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '\$${tx.costBasis.toStringAsFixed(2)}',
                style: CoinDCXTypography.numberSm.copyWith(
                  color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: CoinDCXSpacing.xxxs),
              Text(
                '${_formatAmount(tx.amount)} @ \$${tx.price.toStringAsFixed(tx.price < 0.01 ? 8 : 4)}',
                style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary,
                  fontSize: 9,
                ),
              ),
            ],
          ),
          if (tx.txHash != null || tx.txUrl != null) ...[
            const SizedBox(width: CoinDCXSpacing.xs),
            GestureDetector(
              onTap: () {
                final explorerUrl = tx.txUrl ?? 'https://solscan.io/tx/${tx.txHash}';
                Clipboard.setData(ClipboardData(text: explorerUrl));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Solscan URL copied: $explorerUrl'), duration: const Duration(seconds: 2)),
                );
              },
              child: Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Center(
                  child: Icon(Icons.open_in_new_rounded, size: 12, color: colors.actionBackgroundPrimary),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildWalletBalanceRow(String symbol, double amount, String? mint, CoinDCXColorScheme colors, {bool isFirst = false, bool isLast = false}) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF9945FF), Color(0xFF14F195)]),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Center(
                  child: Text(
                    symbol.isNotEmpty ? symbol[0] : '?',
                    style: CoinDCXTypography.buttonSm.copyWith(color: Colors.white, fontSize: 13),
                  ),
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      symbol,
                      style: CoinDCXTypography.bodyMedium.copyWith(
                        color: colors.generalForegroundPrimary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (mint != null)
                      Text(
                        '${mint.substring(0, 6)}...${mint.substring(mint.length - 4)}',
                        style: CoinDCXTypography.caption.copyWith(
                          color: colors.generalForegroundTertiary,
                          fontSize: 10,
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                _formatAmount(amount),
                style: CoinDCXTypography.numberMd.copyWith(
                  color: colors.generalForegroundPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        if (!isLast)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
            child: Divider(height: 1, color: const Color(0xFF9945FF).withValues(alpha: 0.1)),
          ),
      ],
    );
  }

  String _formatAmount(double amount) {
    if (amount >= 1000000) return '${(amount / 1000000).toStringAsFixed(2)}M';
    if (amount >= 1000) return '${(amount / 1000).toStringAsFixed(2)}K';
    if (amount >= 1) return amount.toStringAsFixed(4);
    return amount.toStringAsFixed(8);
  }
}
