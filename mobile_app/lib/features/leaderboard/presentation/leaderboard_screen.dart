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
          // Filters
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
            child: Row(
              children: [
                _buildPill(colors, 'Sharpe', _sort == 'sharpe', () => setState(() => _sort = 'sharpe')),
                const SizedBox(width: 6),
                _buildPill(colors, 'PnL', _sort == 'pnl', () => setState(() => _sort = 'pnl')),
                const SizedBox(width: 6),
                _buildPill(colors, 'Copiers', _sort == 'copiers', () => setState(() => _sort = 'copiers')),
                const Spacer(),
                _buildPill(colors, '7d', _period == '7d', () => setState(() => _period = '7d')),
                const SizedBox(width: 6),
                _buildPill(colors, '30d', _period == '30d', () => setState(() => _period = '30d')),
              ],
            ),
          ),
          // KOL toggle
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
            child: Row(
              children: [
                Text('KOL Traders Only', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary, fontSize: 13)),
                const SizedBox(width: 8),
                SizedBox(
                  height: 24,
                  child: Switch.adaptive(
                    value: _showKols,
                    onChanged: (v) => setState(() => _showKols = v),
                    activeTrackColor: colors.actionBackgroundPrimary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
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
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
      itemCount: traders.length,
      itemBuilder: (context, i) => _buildTraderRow(traders[i], colors),
    );
  }

  Widget _buildTraderRow(LeaderboardTrader trader, CoinDCXColorScheme colors) {
    final pnl = _period == '7d' ? trader.pnl7d : trader.pnl30d;
    final winRate = _period == '7d' ? trader.winRate7d : trader.winRate30d;
    final isPositive = pnl >= 0;

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/copy-trader-detail', arguments: trader),
      child: Container(
        margin: const EdgeInsets.only(bottom: CoinDCXSpacing.xs),
        padding: const EdgeInsets.all(CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          color: colors.generalBackgroundBgL2,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
          border: Border.all(color: colors.generalStrokeL1),
        ),
        child: Row(
          children: [
            // Rank
            SizedBox(
              width: 32,
              child: trader.rank <= 3
                  ? Text(
                      trader.rank == 1 ? '\u{1F947}' : trader.rank == 2 ? '\u{1F948}' : '\u{1F949}',
                      style: const TextStyle(fontSize: 20),
                      textAlign: TextAlign.center,
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
              width: 36, height: 36,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [colors.actionBackgroundPrimary, colors.actionBackgroundPrimary.withValues(alpha: 0.5)],
                ),
                borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
              ),
              child: Center(
                child: Text(
                  trader.name.isNotEmpty ? trader.name[0].toUpperCase() : '?',
                  style: CoinDCXTypography.buttonSm.copyWith(color: Colors.white, fontSize: 14),
                ),
              ),
            ),
            const SizedBox(width: CoinDCXSpacing.sm),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(trader.name, style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 13), overflow: TextOverflow.ellipsis),
                  Row(
                    children: [
                      Text('Win ${winRate.toStringAsFixed(0)}%', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
                      if (trader.sharpe != null) ...[
                        const SizedBox(width: 6),
                        Text('Sharpe ${trader.sharpe!.toStringAsFixed(2)}', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            // PnL + Copy
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  formatPnl(pnl),
                  style: CoinDCXTypography.numberSm.copyWith(
                    color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                    fontSize: 13, fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: colors.actionBackgroundPrimary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                  ),
                  child: Text('COPY', style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPill(CoinDCXColorScheme colors, String label, bool active, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: active ? colors.actionBackgroundPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
          border: active ? null : Border.all(color: colors.generalStrokeL2),
        ),
        child: Text(label, style: CoinDCXTypography.caption.copyWith(
          color: active ? Colors.white : colors.generalForegroundTertiary,
          fontSize: 11, fontWeight: active ? FontWeight.w600 : FontWeight.w400,
        )),
      ),
    );
  }
}
