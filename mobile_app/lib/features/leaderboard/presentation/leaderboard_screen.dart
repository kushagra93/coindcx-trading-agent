import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../core/api/models.dart';
import '../../../core/utils/formatters.dart';

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen> {
  String _sort = 'sharpe';
  String _period = '7d';
  bool _showKols = false;

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      appBar: AppBar(title: const Text('Leaderboard')),
      body: Column(
        children: [
          // Sort & Period filters
          Padding(
            padding: const EdgeInsets.fromLTRB(
              CoinDCXSpacing.md, CoinDCXSpacing.sm, CoinDCXSpacing.md, CoinDCXSpacing.xs,
            ),
            child: Row(
              children: [
                // Sort by label
                Text(
                  'Sort',
                  style: CoinDCXTypography.caption.copyWith(
                    color: colors.generalForegroundTertiary,
                  ),
                ),
                const SizedBox(width: CoinDCXSpacing.xs),
                _buildPill(colors, 'Sharpe', _sort == 'sharpe', () => setState(() => _sort = 'sharpe')),
                const SizedBox(width: CoinDCXSpacing.xs),
                _buildPill(colors, 'PnL', _sort == 'pnl', () => setState(() => _sort = 'pnl')),
                const SizedBox(width: CoinDCXSpacing.xs),
                _buildPill(colors, 'Copiers', _sort == 'copiers', () => setState(() => _sort = 'copiers')),
                const Spacer(),
                // Period label
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                  decoration: BoxDecoration(
                    color: colors.generalBackgroundBgL2,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    border: Border.all(color: colors.generalStrokeL1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildPeriodToggle(colors, '7d', _period == '7d', () => setState(() => _period = '7d')),
                      _buildPeriodToggle(colors, '30d', _period == '30d', () => setState(() => _period = '30d')),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // KOL toggle row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs),
              decoration: BoxDecoration(
                color: _showKols ? colors.alertBackgroundPrimary.withValues(alpha: 0.08) : Colors.transparent,
                borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                border: Border.all(
                  color: _showKols ? colors.alertBackgroundPrimary.withValues(alpha: 0.25) : colors.generalStrokeL1,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.verified_rounded,
                    size: 14,
                    color: _showKols ? colors.alertBackgroundPrimary : colors.generalForegroundTertiary,
                  ),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  Text(
                    'KOL Traders Only',
                    style: CoinDCXTypography.bodySmall.copyWith(
                      color: _showKols ? colors.alertBackgroundPrimary : colors.generalForegroundSecondary,
                      fontWeight: _showKols ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    height: 28,
                    child: Switch.adaptive(
                      value: _showKols,
                      onChanged: (v) => setState(() => _showKols = v),
                      activeTrackColor: colors.alertBackgroundPrimary,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          // Column header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
            child: Row(
              children: [
                SizedBox(
                  width: 36,
                  child: Text(
                    '#',
                    style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(width: CoinDCXSpacing.sm + 36 + CoinDCXSpacing.sm), // avatar + gaps
                Expanded(
                  child: Text(
                    'Trader',
                    style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                  ),
                ),
                Text(
                  _period == '7d' ? '7D PnL' : '30D PnL',
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                ),
              ],
            ),
          ),
          Divider(color: colors.generalStrokeL1, height: CoinDCXSpacing.md),
          // List
          Expanded(child: _buildList(colors)),
        ],
      ),
    );
  }

  Widget _buildList(CoinDCXColorScheme colors) {
    if (_showKols) {
      final kolAsync = ref.watch(kolLeaderboardProvider);
      return kolAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load', style: TextStyle(color: colors.negativeBackgroundPrimary))),
        data: (traders) => _buildTraderList(traders, colors),
      );
    }

    final params = (sort: _sort, period: _period);
    final leaderboardAsync = ref.watch(leaderboardProvider(params));
    return leaderboardAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Failed to load', style: TextStyle(color: colors.negativeBackgroundPrimary))),
      data: (traders) => _buildTraderList(traders, colors),
    );
  }

  Widget _buildTraderList(List<LeaderboardTrader> traders, CoinDCXColorScheme colors) {
    if (traders.isEmpty) {
      return Center(
        child: Text('No traders found', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.xxs),
      itemCount: traders.length,
      separatorBuilder: (_, __) => const SizedBox(height: CoinDCXSpacing.xs),
      itemBuilder: (context, i) => _buildTraderRow(traders[i], i, colors),
    );
  }

  Widget _buildTraderRow(LeaderboardTrader trader, int index, CoinDCXColorScheme colors) {
    final pnl = _period == '7d' ? trader.pnl7d : trader.pnl30d;
    final winRate = _period == '7d' ? trader.winRate7d : trader.winRate30d;
    final isPositive = pnl >= 0;
    final isTop3 = trader.rank <= 3;

    // Gold, silver, bronze colors for top 3
    Color? rankAccent;
    if (trader.rank == 1) rankAccent = const Color(0xFFFFD700);
    if (trader.rank == 2) rankAccent = const Color(0xFFC0C0C0);
    if (trader.rank == 3) rankAccent = const Color(0xFFCD7F32);

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/copy-trader-detail', arguments: trader),
      child: Container(
        padding: const EdgeInsets.all(CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          color: colors.generalBackgroundBgL2,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
          border: Border.all(
            color: isTop3 ? rankAccent!.withValues(alpha: 0.35) : colors.generalStrokeL1,
          ),
        ),
        child: Row(
          children: [
            // Rank indicator
            SizedBox(
              width: 36,
              child: isTop3
                  ? Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            rankAccent!,
                            rankAccent.withValues(alpha: 0.5),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                      ),
                      child: Center(
                        child: Text(
                          '${trader.rank}',
                          style: CoinDCXTypography.buttonSm.copyWith(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    )
                  : Text(
                      '${trader.rank}',
                      style: CoinDCXTypography.numberMd.copyWith(color: colors.generalForegroundTertiary),
                      textAlign: TextAlign.center,
                    ),
            ),
            const SizedBox(width: CoinDCXSpacing.sm),
            // Avatar
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    colors.actionBackgroundPrimary,
                    colors.actionBackgroundPrimary.withValues(alpha: 0.5),
                  ],
                ),
                borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
              ),
              child: Center(
                child: Text(
                  trader.name.isNotEmpty ? trader.name[0].toUpperCase() : '?',
                  style: CoinDCXTypography.buttonMd.copyWith(color: Colors.white),
                ),
              ),
            ),
            const SizedBox(width: CoinDCXSpacing.sm),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    trader.name,
                    style: CoinDCXTypography.bodyMedium.copyWith(
                      color: colors.generalForegroundPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: CoinDCXSpacing.xxxs),
                  Row(
                    children: [
                      _buildStatBadge(
                        colors,
                        'Win ${winRate.toStringAsFixed(0)}%',
                        winRate >= 50 ? colors.positiveBackgroundPrimary : colors.generalForegroundTertiary,
                      ),
                      if (trader.sharpe != null) ...[
                        const SizedBox(width: CoinDCXSpacing.xxs),
                        _buildStatBadge(
                          colors,
                          'Sharpe ${trader.sharpe!.toStringAsFixed(2)}',
                          trader.sharpe! >= 1 ? colors.positiveBackgroundPrimary : colors.generalForegroundTertiary,
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            // PnL + Copy button
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  formatPnl(pnl),
                  style: CoinDCXTypography.numberMd.copyWith(
                    color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: CoinDCXSpacing.xxs),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxxs),
                  decoration: BoxDecoration(
                    color: colors.actionBackgroundPrimary,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                  ),
                  child: Text(
                    'COPY',
                    style: CoinDCXTypography.caption.copyWith(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatBadge(CoinDCXColorScheme colors, String text, Color accent) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
      ),
      child: Text(
        text,
        style: CoinDCXTypography.caption.copyWith(
          color: accent,
          fontSize: 10,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildPill(CoinDCXColorScheme colors, String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs),
        decoration: BoxDecoration(
          color: active ? colors.actionBackgroundPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
          border: active ? null : Border.all(color: colors.generalStrokeL2),
        ),
        child: Text(
          label,
          style: CoinDCXTypography.caption.copyWith(
            color: active ? Colors.white : colors.generalForegroundTertiary,
            fontWeight: active ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }

  Widget _buildPeriodToggle(CoinDCXColorScheme colors, String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs),
        decoration: BoxDecoration(
          color: active ? colors.actionBackgroundPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
        ),
        child: Text(
          label,
          style: CoinDCXTypography.caption.copyWith(
            color: active ? Colors.white : colors.generalForegroundTertiary,
            fontWeight: active ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}
