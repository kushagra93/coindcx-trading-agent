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
                // Animated status indicator
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: (_agentRunning ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                  ),
                  child: Center(
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: _agentRunning ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                        boxShadow: [
                          BoxShadow(
                            color: (_agentRunning ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary).withValues(alpha: 0.4),
                            blurRadius: 6,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: CoinDCXSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _agentRunning ? 'Agent Running' : 'Agent Stopped',
                        style: CoinDCXTypography.bodyMedium.copyWith(
                          color: colors.generalForegroundPrimary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: CoinDCXSpacing.xxxs),
                      Text(
                        _agentRunning ? 'Actively monitoring markets' : 'Toggle to start trading',
                        style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                      ),
                    ],
                  ),
                ),
                _agentLoading
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                    : Transform.scale(
                        scale: 1.1,
                        child: Switch.adaptive(
                          value: _agentRunning,
                          onChanged: (_) => _toggleAgent(),
                          activeTrackColor: colors.positiveBackgroundPrimary,
                        ),
                      ),
              ],
            ),
          ),

          const SizedBox(height: CoinDCXSpacing.xl),
          Divider(color: colors.generalStrokeL1, height: 1),
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
                  Text(
                    'Risk Level',
                    style: CoinDCXTypography.bodySmall.copyWith(
                      color: colors.generalForegroundSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: CoinDCXSpacing.sm),
                  Row(
                    children: ['conservative', 'moderate', 'aggressive'].map((level) {
                      final active = _riskLevel == level;
                      Color color;
                      IconData icon;
                      switch (level) {
                        case 'conservative':
                          color = colors.positiveBackgroundPrimary;
                          icon = Icons.shield_outlined;
                        case 'aggressive':
                          color = colors.negativeBackgroundPrimary;
                          icon = Icons.local_fire_department_rounded;
                        default:
                          color = colors.alertBackgroundPrimary;
                          icon = Icons.balance_rounded;
                      }
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _riskLevel = level),
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            padding: const EdgeInsets.symmetric(vertical: CoinDCXSpacing.sm),
                            decoration: BoxDecoration(
                              color: active ? color.withValues(alpha: 0.12) : Colors.transparent,
                              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                              border: Border.all(
                                color: active ? color : colors.generalStrokeL2,
                                width: active ? 1.5 : 1.0,
                              ),
                            ),
                            child: Column(
                              children: [
                                Icon(icon, size: 18, color: active ? color : colors.generalForegroundTertiary),
                                const SizedBox(height: CoinDCXSpacing.xxs),
                                Text(
                                  level[0].toUpperCase() + level.substring(1),
                                  style: CoinDCXTypography.caption.copyWith(
                                    color: active ? color : colors.generalForegroundTertiary,
                                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CoinDCXSpacing.sm),
            // Daily loss limit card
            Container(
              padding: const EdgeInsets.all(CoinDCXSpacing.md),
              decoration: _cardDecoration(colors),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.trending_down_rounded, size: 16, color: colors.negativeBackgroundPrimary),
                      const SizedBox(width: CoinDCXSpacing.xs),
                      Text(
                        'Daily Loss Limit',
                        style: CoinDCXTypography.bodySmall.copyWith(
                          color: colors.generalForegroundSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxxs),
                        decoration: BoxDecoration(
                          color: colors.generalBackgroundBgL3,
                          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                        ),
                        child: Text(
                          '\$${_dailyLossLimit.toInt()}',
                          style: CoinDCXTypography.numberMd.copyWith(
                            color: colors.generalForegroundPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: CoinDCXSpacing.xs),
                  SliderTheme(
                    data: SliderThemeData(
                      activeTrackColor: colors.actionBackgroundPrimary,
                      inactiveTrackColor: colors.generalStrokeL2,
                      thumbColor: colors.actionBackgroundPrimary,
                      overlayColor: colors.actionBackgroundPrimary.withValues(alpha: 0.12),
                      trackHeight: 4,
                    ),
                    child: Slider(
                      value: _dailyLossLimit,
                      min: 100,
                      max: 10000,
                      divisions: 99,
                      onChanged: (v) => setState(() => _dailyLossLimit = v),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('\$100', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
                        Text('\$10,000', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CoinDCXSpacing.sm),
            // Max per trade card
            Container(
              padding: const EdgeInsets.all(CoinDCXSpacing.md),
              decoration: _cardDecoration(colors),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.pie_chart_outline_rounded, size: 16, color: colors.actionBackgroundPrimary),
                      const SizedBox(width: CoinDCXSpacing.xs),
                      Text(
                        'Max Per Trade',
                        style: CoinDCXTypography.bodySmall.copyWith(
                          color: colors.generalForegroundSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxxs),
                        decoration: BoxDecoration(
                          color: colors.generalBackgroundBgL3,
                          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                        ),
                        child: Text(
                          '${_maxPerTrade.toStringAsFixed(0)}%',
                          style: CoinDCXTypography.numberMd.copyWith(
                            color: colors.generalForegroundPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: CoinDCXSpacing.xs),
                  SliderTheme(
                    data: SliderThemeData(
                      activeTrackColor: colors.actionBackgroundPrimary,
                      inactiveTrackColor: colors.generalStrokeL2,
                      thumbColor: colors.actionBackgroundPrimary,
                      overlayColor: colors.actionBackgroundPrimary.withValues(alpha: 0.12),
                      trackHeight: 4,
                    ),
                    child: Slider(
                      value: _maxPerTrade,
                      min: 1,
                      max: 25,
                      divisions: 24,
                      onChanged: (v) => setState(() => _maxPerTrade = v),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('1%', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
                        Text('25%', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CoinDCXSpacing.md),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saveRisk,
                child: const Text('Save Risk Settings'),
              ),
            ),
          ],

          const SizedBox(height: CoinDCXSpacing.xl),
          Divider(color: colors.generalStrokeL1, height: 1),
          const SizedBox(height: CoinDCXSpacing.xl),

          // ─── Notifications ───
          _sectionHeader(colors, 'Notifications', Icons.notifications_rounded),
          const SizedBox(height: CoinDCXSpacing.sm),
          Container(
            decoration: _cardDecoration(colors),
            child: Column(
              children: [
                _toggleRow(
                  colors,
                  'Trade Executions',
                  'Get notified when trades are placed',
                  Icons.swap_horiz_rounded,
                  _tradeNotifications,
                  (v) => setState(() => _tradeNotifications = v),
                  isFirst: true,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
                  child: Divider(height: 1, color: colors.generalStrokeL1),
                ),
                _toggleRow(
                  colors,
                  'P&L Alerts',
                  'Daily profit and loss summaries',
                  Icons.analytics_outlined,
                  _pnlAlerts,
                  (v) => setState(() => _pnlAlerts = v),
                  isLast: true,
                ),
              ],
            ),
          ),

          const SizedBox(height: CoinDCXSpacing.xl),
          Divider(color: colors.generalStrokeL1, height: 1),
          const SizedBox(height: CoinDCXSpacing.xl),

          // ─── Supported Chains ───
          _sectionHeader(colors, 'Supported Chains', Icons.link_rounded),
          const SizedBox(height: CoinDCXSpacing.sm),
          chainsAsync.when(
            loading: () => const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
            error: (e, _) => Text('Failed to load chains', style: TextStyle(color: colors.negativeBackgroundPrimary)),
            data: (chains) => Wrap(
              spacing: CoinDCXSpacing.xs,
              runSpacing: CoinDCXSpacing.xs,
              children: chains.map((c) => Container(
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xs),
                decoration: BoxDecoration(
                  color: colors.generalBackgroundBgL2,
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
                  border: Border.all(color: colors.generalStrokeL1),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                      ),
                      child: Center(
                        child: Text(
                          c.nativeToken.isNotEmpty ? c.nativeToken[0] : '?',
                          style: CoinDCXTypography.caption.copyWith(
                            color: colors.actionBackgroundPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: CoinDCXSpacing.xs),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          c.name,
                          style: CoinDCXTypography.bodySmall.copyWith(
                            color: colors.generalForegroundPrimary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          c.nativeToken,
                          style: CoinDCXTypography.caption.copyWith(
                            color: colors.generalForegroundTertiary,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
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
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
          ),
          child: Center(
            child: Icon(icon, color: colors.actionBackgroundPrimary, size: 16),
          ),
        ),
        const SizedBox(width: CoinDCXSpacing.sm),
        Text(
          title,
          style: CoinDCXTypography.heading3.copyWith(
            color: colors.generalForegroundPrimary,
            fontSize: 16,
          ),
        ),
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

  Widget _toggleRow(
    CoinDCXColorScheme colors,
    String label,
    String subtitle,
    IconData icon,
    bool value,
    ValueChanged<bool> onChanged, {
    bool isFirst = false,
    bool isLast = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: CoinDCXSpacing.md,
        vertical: CoinDCXSpacing.sm,
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: colors.generalForegroundSecondary),
          const SizedBox(width: CoinDCXSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: CoinDCXTypography.bodyMedium.copyWith(
                    color: colors.generalForegroundPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: CoinDCXSpacing.xxxs),
                Text(
                  subtitle,
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                ),
              ],
            ),
          ),
          Transform.scale(
            scale: 1.1,
            child: Switch.adaptive(
              value: value,
              onChanged: onChanged,
              activeTrackColor: colors.actionBackgroundPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
