import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';

class LeaderboardScreen extends ConsumerStatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  ConsumerState<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends ConsumerState<LeaderboardScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      appBar: AppBar(
      backgroundColor: colors.generalBackgroundBgL1,
      elevation: 0,
      title: Row(
          children: [
            const Text('🏆', style: TextStyle(fontSize: 20)),
            const SizedBox(width: 8),
            Text('Smart Money', style: CoinDCXTypography.heading3.copyWith(
              color: colors.generalForegroundPrimary, fontSize: 17)),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: colors.actionBackgroundPrimary,
          unselectedLabelColor: colors.generalForegroundTertiary,
          indicatorColor: colors.actionBackgroundPrimary,
          indicatorWeight: 2,
          labelStyle: CoinDCXTypography.buttonSm.copyWith(fontSize: 13),
          tabs: const [
            Tab(text: '📊 PnL Leaders'),
            Tab(text: '⭐ KOL Rankings'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _LeaderboardTab(type: 'pnl', colors: colors),
          _LeaderboardTab(type: 'kol', colors: colors),
        ],
      ),
    );
  }
}

class _LeaderboardTab extends ConsumerWidget {
  final String type;
  final CoinDCXColorScheme colors;
  const _LeaderboardTab({required this.type, required this.colors});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = type == 'pnl' ? pnlLeaderboardProvider : kolLeaderboardProvider;
    final async = ref.watch(provider);

    return async.when(
      loading: () => Center(child: CircularProgressIndicator(color: colors.actionBackgroundPrimary)),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded, size: 40, color: colors.generalForegroundTertiary),
            const SizedBox(height: 12),
            Text('Could not load data', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
            const SizedBox(height: 8),
            TextButton(onPressed: () => ref.invalidate(provider), child: const Text('Retry')),
          ],
        ),
      ),
      data: (traders) => _buildList(context, traders),
    );
  }

  Widget _buildList(BuildContext context, List<Map<String, dynamic>> traders) {
    if (traders.isEmpty) {
      return Center(child: Text('No data available', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundTertiary)));
    }

    return RefreshIndicator(
      onRefresh: () async {},
      color: colors.actionBackgroundPrimary,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: traders.length,
        itemBuilder: (ctx, i) => _buildTraderRow(context, traders[i], i + 1),
      ),
    );
  }

  Widget _buildTraderRow(BuildContext context, Map<String, dynamic> t, int rank) {
    final addr = t['walletAddress'] as String? ?? '';
    final name = t['name'] as String? ?? '';
    final twitter = t['twitterUsername'] as String? ?? '';
    final pnl = (t['pnl7d'] as num?)?.toDouble() ?? 0;
    final winRate = (t['winRate7d'] as num?)?.toDouble() ?? 0;
    final tags = (t['tags'] as List<dynamic>?)?.cast<String>() ?? [];
    final totalTrades = (t['totalTrades'] as num?)?.toInt() ?? 0;
    final shortAddr = addr.length > 10 ? '${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}' : addr;
    final displayName = name.isNotEmpty ? name : (twitter.isNotEmpty ? '@$twitter' : shortAddr);
    final isTop3 = rank <= 3;
    final rankEmoji = isTop3 ? ['', '🥇', '🥈', '🥉'][rank] : '$rank';
    final pnlColor = pnl >= 0 ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isTop3
          ? colors.actionBackgroundPrimary.withValues(alpha: 0.05)
          : colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isTop3
            ? colors.actionBackgroundPrimary.withValues(alpha: 0.2)
            : colors.generalStrokeL1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _showCopyDialog(context, addr, displayName, rank),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                // Rank
                SizedBox(
                  width: 32,
                  child: Text(rankEmoji,
                    style: TextStyle(fontSize: isTop3 ? 20 : 14,
                      color: isTop3 ? Colors.amber : colors.generalForegroundTertiary,
                      fontWeight: FontWeight.w700),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(width: 10),
                // Identity
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(displayName,
                        style: CoinDCXTypography.buttonSm.copyWith(
                          color: colors.generalForegroundPrimary, fontSize: 13),
                        overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(shortAddr,
                            style: CoinDCXTypography.caption.copyWith(
                              color: colors.generalForegroundTertiary, fontSize: 9)),
                          if (tags.isNotEmpty) ...[
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(3),
                              ),
                              child: Text(tags.first,
                                style: CoinDCXTypography.caption.copyWith(
                                  color: colors.actionBackgroundPrimary, fontSize: 8)),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                // Stats
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(pnl >= 0 ? '+\$${_fmt(pnl)}' : '-\$${_fmt(pnl.abs())}',
                      style: CoinDCXTypography.numberSm.copyWith(
                        color: pnlColor, fontSize: 13, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Text('Win ${winRate.toStringAsFixed(0)}%',
                          style: CoinDCXTypography.caption.copyWith(
                            color: colors.generalForegroundTertiary, fontSize: 9)),
                        if (totalTrades > 0) ...[
                          Text(' · ', style: CoinDCXTypography.caption.copyWith(
                            color: colors.generalForegroundTertiary, fontSize: 9)),
                          Text('$totalTrades trades',
                            style: CoinDCXTypography.caption.copyWith(
                              color: colors.generalForegroundTertiary, fontSize: 9)),
                        ],
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showCopyDialog(BuildContext context, String addr, String name, int rank) {
    final colors = CoinDCXTheme.of(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: colors.generalBackgroundBgL2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Rank #$rank · $name',
              style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary)),
            const SizedBox(height: 4),
            Text(addr, style: CoinDCXTypography.caption.copyWith(
              color: colors.generalForegroundTertiary, fontSize: 10)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _actionBtn(
                    context, '🪞 Copy Trade', colors.actionBackgroundPrimary,
                    () { Navigator.pop(context); _goToChat(context, 'copy trade $addr'); },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _actionBtn(
                    context, '📋 Copy Address', colors.generalBackgroundBgL3,
                    () {
                      Clipboard.setData(ClipboardData(text: addr));
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Address copied!'), duration: Duration(seconds: 1)));
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _actionBtn(BuildContext context, String label, Color bg, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
        child: Text(label, textAlign: TextAlign.center,
          style: CoinDCXTypography.buttonSm.copyWith(color: Colors.white, fontSize: 13)),
      ),
    );
  }

  void _goToChat(BuildContext context, String cmd) {
    // Navigate to chat tab (index 1)
    // This is handled by the bottom nav — we just pop and the user can type
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Tap Agent tab and type: $cmd'),
        duration: const Duration(seconds: 3),
        action: SnackBarAction(label: 'OK', onPressed: () {}),
      ),
    );
  }

  String _fmt(double v) {
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}K';
    return v.toStringAsFixed(0);
  }
}
