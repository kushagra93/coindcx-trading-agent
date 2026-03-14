import 'package:flutter/material.dart';
import '../../core/api/models.dart';
import '../../core/theme/app_theme.dart';

class TokenCard extends StatelessWidget {
  final TokenMetrics token;
  final VoidCallback? onTap;

  const TokenCard({super.key, required this.token, this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);
    final isPositive = (token.priceChange24h ?? 0) >= 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        decoration: BoxDecoration(
          color: colors.generalBackgroundBgL2,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
          border: Border.all(color: colors.generalStrokeL1),
        ),
        child: Row(
          children: [
            _buildTokenAvatar(colors),
            const SizedBox(width: CoinDCXSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    token.symbol.toUpperCase(),
                    style: CoinDCXTypography.bodyLarge.copyWith(color: colors.generalForegroundPrimary),
                  ),
                  const SizedBox(height: CoinDCXSpacing.xxxs),
                  Text(
                    '${token.name} · ${token.chain}',
                    style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _formatPrice(token.priceUsd),
                  style: CoinDCXTypography.numberMd.copyWith(color: colors.generalForegroundPrimary),
                ),
                const SizedBox(height: CoinDCXSpacing.xxxs),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs, vertical: CoinDCXSpacing.xxxs),
                  decoration: BoxDecoration(
                    color: isPositive
                        ? colors.positiveBackgroundSecondary
                        : colors.negativeBackgroundSecondary,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                  ),
                  child: Text(
                    '${isPositive ? '+' : ''}${(token.priceChange24h ?? 0).toStringAsFixed(2)}%',
                    style: CoinDCXTypography.caption.copyWith(
                      color: isPositive
                          ? colors.positiveBackgroundPrimary
                          : colors.negativeBackgroundPrimary,
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

  Widget _buildTokenAvatar(CoinDCXColorScheme colors) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: colors.actionBackgroundSecondary,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
      ),
      child: Center(
        child: Text(
          token.symbol.isNotEmpty ? token.symbol[0].toUpperCase() : '?',
          style: CoinDCXTypography.bodyLarge.copyWith(color: colors.actionBackgroundPrimary),
        ),
      ),
    );
  }

  String _formatPrice(double price) {
    if (price >= 1.0) return '\$${price.toStringAsFixed(2)}';
    if (price >= 0.01) return '\$${price.toStringAsFixed(4)}';
    return '\$${price.toStringAsFixed(8)}';
  }
}
