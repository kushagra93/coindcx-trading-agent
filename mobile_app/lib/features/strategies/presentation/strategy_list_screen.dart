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
          // Templates
          Text('Templates', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.xs),
          Text('Pre-built strategies to get started', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary)),
          const SizedBox(height: CoinDCXSpacing.sm),
          templatesAsync.when(
            loading: () => const SizedBox(height: 130, child: Center(child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load templates', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (templates) => SizedBox(
              height: 150,
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

          // Active strategies
          Text('Active Strategies', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.sm),
          strategiesAsync.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load strategies', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (strategies) {
              if (strategies.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(CoinDCXSpacing.xl),
                  decoration: BoxDecoration(
                    color: colors.generalBackgroundBgL2,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                    border: Border.all(color: colors.generalStrokeL1),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.auto_graph_rounded, size: 40, color: colors.generalForegroundTertiary),
                      const SizedBox(height: CoinDCXSpacing.sm),
                      Text('No active strategies', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
                      const SizedBox(height: CoinDCXSpacing.xs),
                      Text('Choose a template above to get started', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary)),
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
    switch (template.riskLevel) {
      case 'low': riskColor = colors.positiveBackgroundPrimary;
      case 'high': riskColor = colors.negativeBackgroundPrimary;
      default: riskColor = colors.alertBackgroundPrimary;
    }

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/strategy-setup', arguments: template),
      child: Container(
        width: 170,
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
                Text(template.icon, style: const TextStyle(fontSize: 22)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: riskColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(template.riskLevel.toUpperCase(), style: CoinDCXTypography.caption.copyWith(color: riskColor, fontSize: 8, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: CoinDCXSpacing.sm),
            Text(template.name, style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 13)),
            const SizedBox(height: 2),
            Expanded(
              child: Text(template.description, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            ),
            Text('+${template.simulated90dReturn}% simulated 90d', style: CoinDCXTypography.caption.copyWith(color: colors.positiveBackgroundPrimary, fontSize: 10, fontWeight: FontWeight.w600)),
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
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Row(
        children: [
          Icon(
            strategy.enabled ? Icons.play_circle_filled_rounded : Icons.pause_circle_filled_rounded,
            color: strategy.enabled ? colors.positiveBackgroundPrimary : colors.generalForegroundTertiary,
            size: 28,
          ),
          const SizedBox(width: CoinDCXSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(strategy.name, style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 13)),
                Row(
                  children: [
                    Text(strategy.type.toUpperCase(), style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                    const SizedBox(width: 6),
                    Text(strategy.tokens.join(', '), style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontSize: 9)),
                    const SizedBox(width: 6),
                    Text(strategy.chain, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(formatCompact(strategy.budgetUsd), style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 13)),
              Text(strategy.riskLevel, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
            ],
          ),
        ],
      ),
    );
  }
}
