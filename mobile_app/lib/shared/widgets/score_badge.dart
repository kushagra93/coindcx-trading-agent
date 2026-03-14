import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class ScoreBadge extends StatelessWidget {
  final int score;
  final String verdict;

  const ScoreBadge({super.key, required this.score, required this.verdict});

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);
    final (bg, fg) = _colors(colors);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_icon(), size: 14, color: fg),
          const SizedBox(width: CoinDCXSpacing.xxs),
          Text(
            '$score/100 $verdict',
            style: CoinDCXTypography.buttonSm.copyWith(color: fg),
          ),
        ],
      ),
    );
  }

  (Color, Color) _colors(CoinDCXColorScheme c) {
    if (score >= 70) return (c.positiveBackgroundSecondary, c.positiveBackgroundPrimary);
    if (score >= 40) return (c.alertBackgroundSecondary, c.alertBackgroundPrimary);
    return (c.negativeBackgroundSecondary, c.negativeBackgroundPrimary);
  }

  IconData _icon() {
    if (score >= 70) return Icons.verified_rounded;
    if (score >= 40) return Icons.warning_amber_rounded;
    return Icons.dangerous_rounded;
  }
}
