import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../core/api/models.dart';
import '../../../core/utils/formatters.dart';

class StrategyListScreen extends ConsumerWidget {
  const StrategyListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = CoinDCXTheme.of(context);
    final templatesAsync = ref.watch(templatesProvider);
    final strategiesAsync = ref.watch(strategiesProvider);

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      appBar: AppBar(title: const Text('Strategies')),
      body: ListView(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        children: [
          // Templates header
          Row(
            children: [
              Icon(Icons.auto_fix_high_rounded, size: 18, color: colors.actionBackgroundPrimary),
              const SizedBox(width: CoinDCXSpacing.xs),
              Text(
                'Templates',
                style: CoinDCXTypography.heading3.copyWith(
                  color: colors.generalForegroundPrimary,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xxs),
          Text(
            'Pre-built strategies to get started quickly',
            style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary),
          ),
          const SizedBox(height: CoinDCXSpacing.md),
          templatesAsync.when(
            loading: () => const SizedBox(height: 180, child: Center(child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load templates', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (templates) => SizedBox(
              height: 190,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: templates.length,
                separatorBuilder: (_, __) => const SizedBox(width: CoinDCXSpacing.sm),
                itemBuilder: (context, i) => _buildTemplateCard(context, templates[i], colors),
              ),
            ),
          ),

          const SizedBox(height: CoinDCXSpacing.xl),
          Divider(color: colors.generalStrokeL1, height: 1),
          const SizedBox(height: CoinDCXSpacing.xl),

          // Active strategies header
          Row(
            children: [
              Icon(Icons.play_circle_outline_rounded, size: 18, color: colors.actionBackgroundPrimary),
              const SizedBox(width: CoinDCXSpacing.xs),
              Text(
                'Active Strategies',
                style: CoinDCXTypography.heading3.copyWith(
                  color: colors.generalForegroundPrimary,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          strategiesAsync.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load strategies', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (strategies) {
              if (strategies.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(CoinDCXSpacing.xxl),
                  decoration: BoxDecoration(
                    color: colors.generalBackgroundBgL2,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                    border: Border.all(color: colors.generalStrokeL1),
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: colors.generalForegroundTertiary.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                        ),
                        child: Center(
                          child: Icon(Icons.auto_graph_rounded, size: 28, color: colors.generalForegroundTertiary),
                        ),
                      ),
                      const SizedBox(height: CoinDCXSpacing.md),
                      Text(
                        'No active strategies',
                        style: CoinDCXTypography.bodyLarge.copyWith(
                          color: colors.generalForegroundSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: CoinDCXSpacing.xxs),
                      Text(
                        'Choose a template above to get started',
                        style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary),
                      ),
                    ],
                  ),
                );
              }
              return Column(children: strategies.map((s) => _buildStrategyRow(context, ref, s, colors)).toList());
            },
          ),
        ],
      ),
    );
  }

  Widget _buildTemplateCard(BuildContext context, StrategyTemplate template, CoinDCXColorScheme colors) {
    Color riskColor;
    IconData riskIcon;
    switch (template.riskLevel) {
      case 'low':
        riskColor = colors.positiveBackgroundPrimary;
        riskIcon = Icons.shield_outlined;
      case 'high':
        riskColor = colors.negativeBackgroundPrimary;
        riskIcon = Icons.local_fire_department_rounded;
      default:
        riskColor = colors.alertBackgroundPrimary;
        riskIcon = Icons.balance_rounded;
    }

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/strategy-setup', arguments: template),
      child: Container(
        width: 200,
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
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                  ),
                  child: Center(
                    child: Text(template.icon, style: const TextStyle(fontSize: 20)),
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs, vertical: CoinDCXSpacing.xxxs),
                  decoration: BoxDecoration(
                    color: riskColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(riskIcon, size: 10, color: riskColor),
                      const SizedBox(width: 3),
                      Text(
                        template.riskLevel.toUpperCase(),
                        style: CoinDCXTypography.caption.copyWith(
                          color: riskColor,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: CoinDCXSpacing.sm),
            Text(
              template.name,
              style: CoinDCXTypography.bodyMedium.copyWith(
                color: colors.generalForegroundPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: CoinDCXSpacing.xxxs),
            Expanded(
              child: Text(
                template.description,
                style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary,
                  fontSize: 11,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: CoinDCXSpacing.sm),
            // Simulated return + CTA row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs, vertical: CoinDCXSpacing.xxxs),
                  decoration: BoxDecoration(
                    color: colors.positiveBackgroundPrimary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.trending_up_rounded, size: 12, color: colors.positiveBackgroundPrimary),
                      const SizedBox(width: 3),
                      Text(
                        '+${template.simulated90dReturn}%',
                        style: CoinDCXTypography.numberSm.copyWith(
                          color: colors.positiveBackgroundPrimary,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs),
                  decoration: BoxDecoration(
                    color: colors.actionBackgroundPrimary,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                  ),
                  child: Text(
                    'Use',
                    style: CoinDCXTypography.buttonSm.copyWith(
                      color: Colors.white,
                      fontSize: 11,
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

  Widget _buildStrategyRow(BuildContext context, WidgetRef ref, Strategy strategy, CoinDCXColorScheme colors) {
    return Container(
      margin: const EdgeInsets.only(bottom: CoinDCXSpacing.sm),
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(
          color: strategy.enabled
              ? colors.positiveBackgroundPrimary.withValues(alpha: 0.2)
              : colors.generalStrokeL1,
        ),
      ),
      child: Row(
        children: [
          // Status indicator
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: (strategy.enabled ? colors.positiveBackgroundPrimary : colors.generalForegroundTertiary).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
            ),
            child: Center(
              child: Icon(
                strategy.enabled ? Icons.play_arrow_rounded : Icons.pause_rounded,
                color: strategy.enabled ? colors.positiveBackgroundPrimary : colors.generalForegroundTertiary,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: CoinDCXSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  strategy.name,
                  style: CoinDCXTypography.bodyMedium.copyWith(
                    color: colors.generalForegroundPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: CoinDCXSpacing.xxs),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                      ),
                      child: Text(
                        strategy.type.toUpperCase(),
                        style: CoinDCXTypography.caption.copyWith(
                          color: colors.actionBackgroundPrimary,
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: CoinDCXSpacing.xxs),
                    Flexible(
                      child: Text(
                        strategy.tokens.join(', '),
                        style: CoinDCXTypography.caption.copyWith(
                          color: colors.generalForegroundSecondary,
                          fontSize: 10,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: CoinDCXSpacing.xxs),
                    Text(
                      strategy.chain,
                      style: CoinDCXTypography.caption.copyWith(
                        color: colors.generalForegroundTertiary,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: CoinDCXSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatCompact(strategy.budgetUsd),
                style: CoinDCXTypography.numberMd.copyWith(
                  color: colors.generalForegroundPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: CoinDCXSpacing.xxxs),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: _riskLevelColor(strategy.riskLevel, colors).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Text(
                  strategy.riskLevel,
                  style: CoinDCXTypography.caption.copyWith(
                    color: _riskLevelColor(strategy.riskLevel, colors),
                    fontSize: 9,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _riskLevelColor(String level, CoinDCXColorScheme colors) {
    switch (level) {
      case 'conservative':
      case 'low':
        return colors.positiveBackgroundPrimary;
      case 'aggressive':
      case 'high':
        return colors.negativeBackgroundPrimary;
      default:
        return colors.alertBackgroundPrimary;
    }
  }
}
