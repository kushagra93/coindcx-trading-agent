import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../core/api/models.dart';

class StrategySetupScreen extends ConsumerStatefulWidget {
  final StrategyTemplate template;
  const StrategySetupScreen({super.key, required this.template});

  @override
  ConsumerState<StrategySetupScreen> createState() => _StrategySetupScreenState();
}

class _StrategySetupScreenState extends ConsumerState<StrategySetupScreen> {
  final Set<String> _selectedTokens = {'SOL'};
  double _budget = 1000;
  double _aggressiveness = 50;
  bool _submitting = false;

  String get _riskLabel {
    if (_aggressiveness < 33) return 'Conservative';
    if (_aggressiveness < 66) return 'Moderate';
    return 'Aggressive';
  }

  String get _riskLevel {
    if (_aggressiveness < 33) return 'low';
    if (_aggressiveness < 66) return 'moderate';
    return 'high';
  }

  int get _estimatedReturn {
    final base = widget.template.simulated90dReturn;
    return (base * (0.5 + _aggressiveness / 100)).round();
  }

  Future<void> _activate() async {
    setState(() => _submitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post('/api/v1/strategies', body: {
        'type': widget.template.type,
        'name': widget.template.name,
        'chain': 'solana',
        'tokens': _selectedTokens.toList(),
        'budgetUsd': _budget,
        'riskLevel': _riskLevel,
        'maxPerTradePct': _aggressiveness < 33 ? 3 : _aggressiveness < 66 ? 5 : 10,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Strategy activated!')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);
    final t = widget.template;

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      appBar: AppBar(title: Text(t.name)),
      body: ListView(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        children: [
          // Template info
          Container(
            padding: const EdgeInsets.all(CoinDCXSpacing.md),
            decoration: BoxDecoration(
              color: colors.actionBackgroundPrimary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
              border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                Text(t.icon, style: const TextStyle(fontSize: 32)),
                const SizedBox(width: CoinDCXSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.name, style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 16)),
                      Text(t.description, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundSecondary, fontSize: 11)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.xl),

          // Token selector
          Text('Select Tokens', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.sm),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ['SOL', 'ETH', 'BTC', 'ARB', 'MATIC', 'AVAX', 'BASE', 'OP'].map((token) {
              final selected = _selectedTokens.contains(token);
              return GestureDetector(
                onTap: () {
                  setState(() {
                    if (selected) { _selectedTokens.remove(token); } else { _selectedTokens.add(token); }
                  });
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: selected ? colors.actionBackgroundPrimary : Colors.transparent,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    border: Border.all(color: selected ? colors.actionBackgroundPrimary : colors.generalStrokeL2),
                  ),
                  child: Text(token, style: CoinDCXTypography.buttonSm.copyWith(
                    color: selected ? Colors.white : colors.generalForegroundSecondary, fontSize: 12)),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: CoinDCXSpacing.xl),

          // Budget slider
          Text('Budget', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
          const SizedBox(height: CoinDCXSpacing.xs),
          Text('\$${_budget.toInt()}', style: CoinDCXTypography.numberLg.copyWith(color: colors.actionBackgroundPrimary, fontSize: 28)),
          SliderTheme(
            data: SliderThemeData(
              activeTrackColor: colors.actionBackgroundPrimary,
              inactiveTrackColor: colors.generalStrokeL2,
              thumbColor: colors.actionBackgroundPrimary,
            ),
            child: Slider(
              value: _budget,
              min: 100,
              max: 50000,
              divisions: 499,
              onChanged: (v) => setState(() => _budget = v),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('\$100', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
              Text('\$50,000', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xl),

          // Aggressiveness slider
          Row(
            children: [
              Text('Aggressiveness', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: _riskLevel == 'low' ? colors.positiveBackgroundPrimary.withValues(alpha: 0.15)
                      : _riskLevel == 'high' ? colors.negativeBackgroundPrimary.withValues(alpha: 0.15)
                      : colors.alertBackgroundPrimary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(_riskLabel, style: CoinDCXTypography.caption.copyWith(
                  color: _riskLevel == 'low' ? colors.positiveBackgroundPrimary
                      : _riskLevel == 'high' ? colors.negativeBackgroundPrimary
                      : colors.alertBackgroundPrimary,
                  fontSize: 10, fontWeight: FontWeight.w600,
                )),
              ),
            ],
          ),
          SliderTheme(
            data: SliderThemeData(
              activeTrackColor: _riskLevel == 'low' ? colors.positiveBackgroundPrimary
                  : _riskLevel == 'high' ? colors.negativeBackgroundPrimary
                  : colors.alertBackgroundPrimary,
              inactiveTrackColor: colors.generalStrokeL2,
              thumbColor: _riskLevel == 'low' ? colors.positiveBackgroundPrimary
                  : _riskLevel == 'high' ? colors.negativeBackgroundPrimary
                  : colors.alertBackgroundPrimary,
            ),
            child: Slider(
              value: _aggressiveness,
              min: 0,
              max: 100,
              divisions: 100,
              onChanged: (v) => setState(() => _aggressiveness = v),
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.lg),

          // Estimated return
          Container(
            padding: const EdgeInsets.all(CoinDCXSpacing.md),
            decoration: BoxDecoration(
              color: colors.generalBackgroundBgL2,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
              border: Border.all(color: colors.generalStrokeL1),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.trending_up_rounded, color: colors.positiveBackgroundPrimary, size: 20),
                const SizedBox(width: 8),
                Text('Est. 90d Return: ', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary, fontSize: 13)),
                Text('+$_estimatedReturn%', style: CoinDCXTypography.numberMd.copyWith(color: colors.positiveBackgroundPrimary, fontSize: 18, fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.xl),

          // Activate button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _submitting || _selectedTokens.isEmpty ? null : _activate,
              child: _submitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Activate Strategy'),
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.xl),
        ],
      ),
    );
  }
}
