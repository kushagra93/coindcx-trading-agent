import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../shared/widgets/score_badge.dart';

class TokenDetailScreen extends ConsumerWidget {
  final TokenMetrics token;

  const TokenDetailScreen({super.key, required this.token});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = CoinDCXTheme.of(context);
    final screeningAsync = ref.watch(tokenScreenProvider(token.symbol));
    final isPositive = (token.priceChange24h ?? 0) >= 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(token.symbol.toUpperCase()),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(tokenScreenProvider(token.symbol)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        children: [
          // Price header
          Container(
            padding: const EdgeInsets.all(CoinDCXSpacing.lg),
            decoration: BoxDecoration(
              color: colors.generalBackgroundBgL2,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusLg),
              border: Border.all(color: colors.generalStrokeL1),
            ),
            child: Column(
              children: [
                Text(
                  token.name,
                  style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary),
                ),
                const SizedBox(height: CoinDCXSpacing.xxs),
                Text(
                  _formatPrice(token.priceUsd),
                  style: CoinDCXTypography.numberLg.copyWith(
                    color: colors.generalForegroundPrimary,
                    fontSize: 32,
                  ),
                ),
                const SizedBox(height: CoinDCXSpacing.xs),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs),
                  decoration: BoxDecoration(
                    color: isPositive ? colors.positiveBackgroundSecondary : colors.negativeBackgroundSecondary,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                  ),
                  child: Text(
                    '${isPositive ? '+' : ''}${(token.priceChange24h ?? 0).toStringAsFixed(2)}% (24h)',
                    style: CoinDCXTypography.buttonSm.copyWith(
                      color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: CoinDCXSpacing.md),

          // Market stats
          _buildStatsGrid(colors),

          const SizedBox(height: CoinDCXSpacing.md),

          // Safety screening
          screeningAsync.when(
            loading: () => _buildScreeningLoading(colors),
            error: (err, _) => _buildScreeningError(colors, err, ref),
            data: (result) => result != null ? _buildScreeningResult(colors, result) : const SizedBox.shrink(),
          ),

          const SizedBox(height: CoinDCXSpacing.lg),

          // Trade button
          ElevatedButton(
            onPressed: () {
              Navigator.pushNamed(context, '/chat');
            },
            child: Text('Trade ${token.symbol.toUpperCase()}'),
          ),
          const SizedBox(height: CoinDCXSpacing.xxl),
        ],
      ),
    );
  }

  Widget _buildStatsGrid(CoinDCXColorScheme colors) {
    final stats = <String, String>{
      'Chain': token.chain,
      'Volume 24h': _formatLargeNumber(token.volume24h),
      'Liquidity': _formatLargeNumber(token.liquidity),
      'Market Cap': _formatLargeNumber(token.marketCap),
      'FDV': _formatLargeNumber(token.fdv),
      if (token.pairAgeHours != null)
        'Pair Age': '${(token.pairAgeHours! / 24).toStringAsFixed(1)}d',
    };

    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Market Stats',
            style: CoinDCXTypography.buttonMd.copyWith(color: colors.generalForegroundPrimary),
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          ...stats.entries.map((e) => Padding(
            padding: const EdgeInsets.symmetric(vertical: CoinDCXSpacing.xxs),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(e.key, style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary)),
                Text(e.value, style: CoinDCXTypography.numberMd.copyWith(color: colors.generalForegroundPrimary)),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildScreeningLoading(CoinDCXColorScheme colors) {
    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.lg),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: CoinDCXSpacing.sm),
          Text(
            'Running safety analysis...',
            style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildScreeningError(CoinDCXColorScheme colors, Object err, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.negativeBackgroundSecondary,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
      ),
      child: Column(
        children: [
          Text(
            'Screening unavailable',
            style: CoinDCXTypography.bodyMedium.copyWith(color: colors.negativeBackgroundPrimary),
          ),
          const SizedBox(height: CoinDCXSpacing.xs),
          TextButton(
            onPressed: () => ref.invalidate(tokenScreenProvider(token.symbol)),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildScreeningResult(CoinDCXColorScheme colors, ScreeningResult result) {
    return Container(
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Safety Analysis',
                style: CoinDCXTypography.buttonMd.copyWith(color: colors.generalForegroundPrimary),
              ),
              ScoreBadge(score: result.score, verdict: result.verdict),
            ],
          ),
          if (result.flags.isNotEmpty) ...[
            const SizedBox(height: CoinDCXSpacing.sm),
            ...result.flags.map((flag) => Padding(
              padding: const EdgeInsets.only(bottom: CoinDCXSpacing.xxs),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    flag.startsWith('+') ? Icons.check_circle_rounded : Icons.info_rounded,
                    size: 14,
                    color: flag.startsWith('+')
                        ? colors.positiveBackgroundPrimary
                        : colors.alertBackgroundPrimary,
                  ),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  Expanded(
                    child: Text(
                      flag,
                      style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundSecondary),
                    ),
                  ),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }

  String _formatPrice(double price) {
    if (price >= 1.0) return '\$${price.toStringAsFixed(2)}';
    if (price >= 0.01) return '\$${price.toStringAsFixed(4)}';
    return '\$${price.toStringAsFixed(8)}';
  }

  String _formatLargeNumber(double? value) {
    if (value == null) return '—';
    if (value >= 1e9) return '\$${(value / 1e9).toStringAsFixed(2)}B';
    if (value >= 1e6) return '\$${(value / 1e6).toStringAsFixed(2)}M';
    if (value >= 1e3) return '\$${(value / 1e3).toStringAsFixed(1)}K';
    return '\$${value.toStringAsFixed(2)}';
  }
}
