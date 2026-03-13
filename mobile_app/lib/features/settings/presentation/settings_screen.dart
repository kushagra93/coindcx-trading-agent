import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';


class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  // Agent
  bool _agentRunning = false;
  bool _agentLoading = true;

  // Risk
  String _riskLevel = 'moderate';
  double _dailyLossLimit = 1000;
  double _maxPerTrade = 5;
  bool _riskLoading = true;

  // Notifications
  bool _tradeNotifications = true;
  bool _pnlAlerts = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final api = ref.read(apiClientProvider);
    try {
      final status = await api.get('/api/v1/agent/status');
      if (mounted) {
        setState(() {
          _agentRunning = status['running'] as bool? ?? false;
          _agentLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _agentLoading = false);
    }
    try {
      final risk = await api.get('/api/v1/risk');
      final settings = risk['settings'] as Map<String, dynamic>? ?? risk;
      if (mounted) {
        setState(() {
          _riskLevel = settings['riskLevel'] as String? ?? 'moderate';
          _dailyLossLimit = (settings['dailyLossLimitUsd'] as num?)?.toDouble() ?? 1000;
          _maxPerTrade = (settings['maxPerTradePct'] as num?)?.toDouble() ?? 5;
          _riskLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _riskLoading = false);
    }
  }

  Future<void> _toggleAgent() async {
    final api = ref.read(apiClientProvider);
    setState(() => _agentLoading = true);
    try {
      if (_agentRunning) {
        await api.post('/api/v1/agent/stop');
      } else {
        await api.post('/api/v1/agent/start');
      }
      setState(() {
        _agentRunning = !_agentRunning;
        _agentLoading = false;
      });
    } catch (e) {
      setState(() => _agentLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _saveRisk() async {
    final api = ref.read(apiClientProvider);
    try {
      await api.put('/api/v1/risk', body: {
        'riskLevel': _riskLevel,
        'dailyLossLimitUsd': _dailyLossLimit,
        'maxPerTradePct': _maxPerTrade,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Risk settings saved')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);
    final chainsAsync = ref.watch(chainsProvider);

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        children: [
          // ─── Agent Control ───
          _sectionHeader(colors, 'Agent Control', Icons.smart_toy_rounded),
          const SizedBox(height: CoinDCXSpacing.sm),
          Container(
            padding: const EdgeInsets.all(CoinDCXSpacing.md),
            decoration: _cardDecoration(colors),
            child: Row(
              children: [
                Container(
                  width: 10, height: 10,
                  decoration: BoxDecoration(
                    color: _agentRunning ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                    borderRadius: BorderRadius.circular(5),
                  ),
                ),
                const SizedBox(width: CoinDCXSpacing.sm),
                Expanded(
                  child: Text(
                    _agentRunning ? 'Agent Running' : 'Agent Stopped',
                    style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 14),
                  ),
                ),
                _agentLoading
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                    : Switch.adaptive(
                        value: _agentRunning,
                        onChanged: (_) => _toggleAgent(),
                        activeTrackColor: colors.positiveBackgroundPrimary,
                      ),
              ],
            ),
          ),

          const SizedBox(height: CoinDCXSpacing.xl),

          // ─── Risk Settings ───
          _sectionHeader(colors, 'Risk Settings', Icons.shield_rounded),
          const SizedBox(height: CoinDCXSpacing.sm),
          if (_riskLoading)
            const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator()))
          else ...[
            Container(
              padding: const EdgeInsets.all(CoinDCXSpacing.md),
              decoration: _cardDecoration(colors),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Risk Level', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary, fontSize: 12)),
                  const SizedBox(height: CoinDCXSpacing.sm),
                  Row(
                    children: ['conservative', 'moderate', 'aggressive'].map((level) {
                      final active = _riskLevel == level;
                      Color color;
                      switch (level) {
                        case 'conservative': color = colors.positiveBackgroundPrimary;
                        case 'aggressive': color = colors.negativeBackgroundPrimary;
                        default: color = colors.alertBackgroundPrimary;
                      }
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _riskLevel = level),
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: active ? color.withValues(alpha: 0.15) : Colors.transparent,
                              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                              border: Border.all(color: active ? color : colors.generalStrokeL2),
                            ),
                            child: Text(
                              level[0].toUpperCase() + level.substring(1),
                              style: CoinDCXTypography.caption.copyWith(color: active ? color : colors.generalForegroundTertiary, fontSize: 11, fontWeight: active ? FontWeight.w600 : FontWeight.w400),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: CoinDCXSpacing.lg),

                  // Daily loss limit
                  Row(
                    children: [
                      Text('Daily Loss Limit', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary, fontSize: 12)),
                      const Spacer(),
                      Text('\$${_dailyLossLimit.toInt()}', style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 13)),
                    ],
                  ),
                  SliderTheme(
                    data: SliderThemeData(activeTrackColor: colors.actionBackgroundPrimary, inactiveTrackColor: colors.generalStrokeL2, thumbColor: colors.actionBackgroundPrimary),
                    child: Slider(value: _dailyLossLimit, min: 100, max: 10000, divisions: 99, onChanged: (v) => setState(() => _dailyLossLimit = v)),
                  ),

                  // Max per trade
                  Row(
                    children: [
                      Text('Max Per Trade', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary, fontSize: 12)),
                      const Spacer(),
                      Text('${_maxPerTrade.toStringAsFixed(0)}%', style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 13)),
                    ],
                  ),
                  SliderTheme(
                    data: SliderThemeData(activeTrackColor: colors.actionBackgroundPrimary, inactiveTrackColor: colors.generalStrokeL2, thumbColor: colors.actionBackgroundPrimary),
                    child: Slider(value: _maxPerTrade, min: 1, max: 25, divisions: 24, onChanged: (v) => setState(() => _maxPerTrade = v)),
                  ),
                  const SizedBox(height: CoinDCXSpacing.sm),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(onPressed: _saveRisk, child: const Text('Save Risk Settings')),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: CoinDCXSpacing.xl),

          // ─── Notifications ───
          _sectionHeader(colors, 'Notifications', Icons.notifications_rounded),
          const SizedBox(height: CoinDCXSpacing.sm),
          Container(
            padding: const EdgeInsets.all(CoinDCXSpacing.md),
            decoration: _cardDecoration(colors),
            child: Column(
              children: [
                _toggleRow(colors, 'Trade Executions', _tradeNotifications, (v) => setState(() => _tradeNotifications = v)),
                Divider(height: 1, color: colors.generalStrokeL1),
                _toggleRow(colors, 'P&L Alerts', _pnlAlerts, (v) => setState(() => _pnlAlerts = v)),
              ],
            ),
          ),

          const SizedBox(height: CoinDCXSpacing.xl),

          // ─── Supported Chains ───
          _sectionHeader(colors, 'Supported Chains', Icons.link_rounded),
          const SizedBox(height: CoinDCXSpacing.sm),
          chainsAsync.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load chains', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (chains) => Wrap(
              spacing: 6,
              runSpacing: 6,
              children: chains.map((c) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: colors.generalBackgroundBgL2,
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                  border: Border.all(color: colors.generalStrokeL1),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(c.name, style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                    const SizedBox(width: 4),
                    Text(c.nativeToken, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                  ],
                ),
              )).toList(),
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.xxl),
        ],
      ),
    );
  }

  Widget _sectionHeader(CoinDCXColorScheme colors, String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: colors.actionBackgroundPrimary, size: 18),
        const SizedBox(width: CoinDCXSpacing.xs),
        Text(title, style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
      ],
    );
  }

  BoxDecoration _cardDecoration(CoinDCXColorScheme colors) {
    return BoxDecoration(
      color: colors.generalBackgroundBgL2,
      borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
      border: Border.all(color: colors.generalStrokeL1),
    );
  }

  Widget _toggleRow(CoinDCXColorScheme colors, String label, bool value, ValueChanged<bool> onChanged) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: CoinDCXSpacing.xs),
      child: Row(
        children: [
          Expanded(child: Text(label, style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 13))),
          Switch.adaptive(value: value, onChanged: onChanged, activeTrackColor: colors.actionBackgroundPrimary),
        ],
      ),
    );
  }
}
