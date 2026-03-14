import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/models.dart';

class DiscoveryScreen extends ConsumerStatefulWidget {
  const DiscoveryScreen({super.key});

  @override
  ConsumerState<DiscoveryScreen> createState() => _DiscoveryScreenState();
}

class _DiscoveryScreenState extends ConsumerState<DiscoveryScreen>
    with SingleTickerProviderStateMixin {
  final _searchController = TextEditingController();
  final _searchFocusNode = FocusNode();
  Timer? _debounce;
  String _searchQuery = '';
  String _activeFilter = '1D';
  bool _showMcap = true;
  String _activeCategory = 'Gainers'; // 'Gainers' or 'New Pairs'
  bool _searchFocused = false;

  late AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _searchFocusNode.addListener(() {
      setState(() => _searchFocused = _searchFocusNode.hasFocus);
    });
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    _debounce?.cancel();
    _shimmerController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      setState(() => _searchQuery = value.trim());
    });
  }

  double _getChangeForFilter(TokenMetrics t) {
    switch (_activeFilter) {
      case '15M': return t.priceChange5m ?? 0;
      case '1H': return t.priceChange1h ?? 0;
      case '4H': return t.priceChange6h ?? 0;
      case '1D': default: return t.priceChange24h ?? 0;
    }
  }

  String _filterLabel() {
    switch (_activeFilter) {
      case '15M': return '5m';
      case '1H': return '1h';
      case '4H': return '6h';
      case '1D': default: return '24h';
    }
  }

  List<TokenMetrics> _sortedTokens(List<TokenMetrics> tokens) {
    final sorted = List<TokenMetrics>.from(tokens);
    if (_activeCategory == 'New Pairs') {
      sorted.sort((a, b) => (a.pairAgeHours ?? 999999).compareTo(b.pairAgeHours ?? 999999));
    } else {
      sorted.sort((a, b) => _getChangeForFilter(b).compareTo(_getChangeForFilter(a)));
    }
    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);
    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      body: SafeArea(
        child: _searchQuery.isNotEmpty ? _buildSearchMode(colors) : _buildMainView(colors),
      ),
    );
  }

  Widget _buildMainView(CoinDCXColorScheme colors) {
    final dataAsync = _activeCategory == 'New Pairs'
        ? ref.watch(newPairsProvider)
        : ref.watch(trendingTokensProvider);

    return dataAsync.when(
      loading: () => _buildLoadingState(colors),
      error: (err, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: colors.negativeBackgroundSecondary,
                borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusLg),
              ),
              child: Icon(Icons.cloud_off_rounded, size: 32, color: colors.negativeBackgroundPrimary),
            ),
            const SizedBox(height: CoinDCXSpacing.lg),
            Text('Could not load tokens', style: CoinDCXTypography.bodyLarge.copyWith(color: colors.generalForegroundPrimary)),
            const SizedBox(height: CoinDCXSpacing.xs),
            Text('Check your connection and try again',
              style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary)),
            const SizedBox(height: CoinDCXSpacing.lg),
            TextButton.icon(
              onPressed: () {
                ref.invalidate(trendingTokensProvider);
                ref.invalidate(newPairsProvider);
              },
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (tokens) => _buildLoadedView(tokens, colors),
    );
  }

  // --- Shimmer loading state ---
  Widget _buildLoadingState(CoinDCXColorScheme colors) {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, _) {
        final shimmerValue = _shimmerController.value;
        return CustomScrollView(
          physics: const NeverScrollableScrollPhysics(),
          slivers: [
            // Search bar placeholder
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(CoinDCXSpacing.md, CoinDCXSpacing.md, CoinDCXSpacing.md, 0),
                child: _shimmerBox(colors, height: 40, borderRadius: CoinDCXSpacing.radiusFull, shimmerValue: shimmerValue),
              ),
            ),
            // Section header placeholder
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(CoinDCXSpacing.md, CoinDCXSpacing.xl, CoinDCXSpacing.md, CoinDCXSpacing.sm),
                child: _shimmerBox(colors, height: 16, width: 140, borderRadius: CoinDCXSpacing.radiusSm, shimmerValue: shimmerValue),
              ),
            ),
            // Hot cards placeholder
            SliverToBoxAdapter(
              child: SizedBox(
                height: 145,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
                  scrollDirection: Axis.horizontal,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: 4,
                  separatorBuilder: (_, __) => const SizedBox(width: CoinDCXSpacing.sm),
                  itemBuilder: (_, __) => _shimmerBox(colors, width: 160, height: 145, borderRadius: CoinDCXSpacing.radiusMd, shimmerValue: shimmerValue),
                ),
              ),
            ),
            // Tab placeholder
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(CoinDCXSpacing.md, CoinDCXSpacing.xl, CoinDCXSpacing.md, CoinDCXSpacing.md),
                child: Row(children: [
                  _shimmerBox(colors, width: 80, height: 28, borderRadius: CoinDCXSpacing.radiusFull, shimmerValue: shimmerValue),
                  const SizedBox(width: CoinDCXSpacing.sm),
                  _shimmerBox(colors, width: 80, height: 28, borderRadius: CoinDCXSpacing.radiusFull, shimmerValue: shimmerValue),
                ]),
              ),
            ),
            // List rows placeholder
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, __) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
                  child: Row(children: [
                    _shimmerBox(colors, width: 40, height: 40, borderRadius: 20, shimmerValue: shimmerValue),
                    const SizedBox(width: CoinDCXSpacing.sm),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _shimmerBox(colors, height: 12, width: 80, borderRadius: 4, shimmerValue: shimmerValue),
                        const SizedBox(height: 6),
                        _shimmerBox(colors, height: 10, width: 120, borderRadius: 4, shimmerValue: shimmerValue),
                      ],
                    )),
                    _shimmerBox(colors, height: 12, width: 50, borderRadius: 4, shimmerValue: shimmerValue),
                    const SizedBox(width: CoinDCXSpacing.sm),
                    _shimmerBox(colors, height: 24, width: 58, borderRadius: 4, shimmerValue: shimmerValue),
                  ]),
                ),
                childCount: 8,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _shimmerBox(CoinDCXColorScheme colors, {
    double? width,
    double height = 16,
    double borderRadius = 4,
    required double shimmerValue,
  }) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        gradient: LinearGradient(
          begin: Alignment(-1.0 + 2.0 * shimmerValue, 0),
          end: Alignment(-0.5 + 2.0 * shimmerValue, 0),
          colors: [
            colors.generalBackgroundBgL2,
            colors.generalBackgroundBgL3,
            colors.generalBackgroundBgL2,
          ],
        ),
      ),
    );
  }

  Widget _buildLoadedView(List<TokenMetrics> tokens, CoinDCXColorScheme colors) {
    final sorted = _sortedTokens(tokens);
    final hotTokens = sorted.where((t) => _getChangeForFilter(t) > 0).take(12).toList();

    return CustomScrollView(
      slivers: [
        // Search bar
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(CoinDCXSpacing.md, CoinDCXSpacing.md, CoinDCXSpacing.md, 0),
            child: Row(
              children: [
                Expanded(
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    height: 40,
                    decoration: BoxDecoration(
                      color: colors.generalBackgroundBgL2,
                      borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                      border: Border.all(
                        color: _searchFocused
                            ? colors.actionBackgroundPrimary.withValues(alpha: 0.5)
                            : Colors.transparent,
                      ),
                      boxShadow: _searchFocused
                          ? [
                              BoxShadow(
                                color: colors.actionBackgroundPrimary.withValues(alpha: 0.12),
                                blurRadius: 8,
                                spreadRadius: 1,
                              ),
                            ]
                          : null,
                    ),
                    child: TextField(
                      controller: _searchController,
                      focusNode: _searchFocusNode,
                      onChanged: _onSearchChanged,
                      style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Search tokens...',
                        hintStyle: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundTertiary, fontSize: 13),
                        prefixIcon: Icon(Icons.search_rounded, color: colors.generalForegroundTertiary, size: 18),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: CoinDCXSpacing.sm),
                _buildIconButton(
                  icon: Icons.leaderboard_rounded,
                  colors: colors,
                  onTap: () => Navigator.pushNamed(context, '/leaderboard'),
                ),
                const SizedBox(width: CoinDCXSpacing.xxs),
                _buildIconButton(
                  icon: Icons.auto_graph_rounded,
                  colors: colors,
                  onTap: () => Navigator.pushNamed(context, '/strategies'),
                ),
                const SizedBox(width: CoinDCXSpacing.xxs),
                _buildIconButton(
                  icon: Icons.refresh_rounded,
                  colors: colors,
                  onTap: () {
                    ref.invalidate(trendingTokensProvider);
                    ref.invalidate(newPairsProvider);
                  },
                ),
              ],
            ),
          ),
        ),

        // "Hot Right Now" -- only show on Gainers tab
        if (hotTokens.isNotEmpty && _activeCategory == 'Gainers') ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(CoinDCXSpacing.md, CoinDCXSpacing.xl, CoinDCXSpacing.md, CoinDCXSpacing.sm),
              child: Row(
                children: [
                  Icon(Icons.local_fire_department_rounded, color: colors.alertBackgroundPrimary, size: 20),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  Text('Hot Right Now', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 15)),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  Expanded(child: Text('Top gainers, DYOR', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary))),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 145,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: hotTokens.length,
                separatorBuilder: (_, __) => const SizedBox(width: CoinDCXSpacing.sm),
                itemBuilder: (context, i) => _buildHotCard(hotTokens[i], i, colors),
              ),
            ),
          ),
        ],

        // Category tabs + filters
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(CoinDCXSpacing.md, CoinDCXSpacing.xl, CoinDCXSpacing.md, CoinDCXSpacing.sm),
            child: Row(
              children: [
                _buildCategoryTab('Gainers', Icons.star_rounded, colors),
                const SizedBox(width: CoinDCXSpacing.sm),
                _buildCategoryTab('New Pairs', Icons.fiber_new_rounded, colors),
                const Spacer(),
                if (_activeCategory == 'Gainers') _buildTimeFilter(colors),
              ],
            ),
          ),
        ),

        // Column header
        SliverToBoxAdapter(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
            margin: const EdgeInsets.only(bottom: CoinDCXSpacing.xxs),
            child: Row(
              children: [
                // Extra space for the left indicator bar
                const SizedBox(width: 3),
                const SizedBox(width: CoinDCXSpacing.xs),
                SizedBox(width: 156, child: Text(
                  'Name / Age',
                  style: _hdr(colors),
                )),
                const Spacer(),
                GestureDetector(
                  onTap: () => setState(() => _showMcap = !_showMcap),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _showMcap ? 'M.Cap' : 'Price',
                        style: _hdr(colors).copyWith(
                          color: colors.actionBackgroundPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Icon(Icons.swap_vert_rounded, size: 12, color: colors.actionBackgroundPrimary),
                    ],
                  ),
                ),
                const SizedBox(width: CoinDCXSpacing.md),
                SizedBox(width: 62, child: Text(
                  _activeCategory == 'New Pairs' ? 'Liq' : _filterLabel(),
                  style: _hdr(colors), textAlign: TextAlign.center,
                )),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(child: Divider(height: 1, color: colors.generalStrokeL1)),

        // Token list
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) => _activeCategory == 'New Pairs'
                ? _buildNewPairRow(sorted[index], colors)
                : _buildTokenRow(sorted[index], colors),
            childCount: sorted.length,
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 80)),
      ],
    );
  }

  // --- Icon button with circular splash ---
  Widget _buildIconButton({
    required IconData icon,
    required CoinDCXColorScheme colors,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
        splashColor: colors.actionBackgroundPrimary.withValues(alpha: 0.12),
        highlightColor: colors.actionBackgroundSecondary.withValues(alpha: 0.2),
        child: Padding(
          padding: const EdgeInsets.all(CoinDCXSpacing.xs),
          child: Icon(icon, color: colors.generalForegroundSecondary, size: 22),
        ),
      ),
    );
  }

  Widget _buildHotCard(TokenMetrics token, int rankIndex, CoinDCXColorScheme colors) {
    final change = _getChangeForFilter(token);
    final isPositive = change >= 0;
    final buys = token.txnsBuys24h ?? 0;
    final mcap = token.marketCap;
    final volume = token.volume24h;

    // Compute a volume bar ratio (0..1) for the mini indicator
    final volumeRatio = (volume != null && mcap != null && mcap > 0)
        ? (volume / mcap).clamp(0.0, 1.0)
        : 0.0;

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/token-detail', arguments: token),
      child: Container(
        width: 160,
        padding: const EdgeInsets.all(CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          color: colors.generalBackgroundBgL2,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
          border: _gradientBorder(
            isPositive
                ? colors.positiveBackgroundPrimary
                : colors.negativeBackgroundPrimary,
            colors,
          ),
        ),
        child: Stack(
          children: [
            // Rank badge
            Positioned(
              top: 0,
              left: 0,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: isPositive
                      ? colors.positiveBackgroundPrimary.withValues(alpha: 0.15)
                      : colors.generalBackgroundBgL3,
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                ),
                child: Center(
                  child: Text(
                    '#${rankIndex + 1}',
                    style: CoinDCXTypography.caption.copyWith(
                      color: isPositive
                          ? colors.positiveBackgroundPrimary
                          : colors.generalForegroundTertiary,
                      fontSize: 8,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (buys > 100)
                  Padding(
                    padding: const EdgeInsets.only(left: 24),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: colors.positiveBackgroundPrimary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text('$buys+ buys in 24h',
                        style: CoinDCXTypography.caption.copyWith(color: colors.positiveBackgroundPrimary, fontSize: 8)),
                    ),
                  )
                else
                  const SizedBox(height: 4),
                Row(
                  children: [
                    const SizedBox(width: 4),
                    _buildTokenIcon(token, colors, size: 30),
                    const SizedBox(width: CoinDCXSpacing.xs),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(token.symbol.toUpperCase(),
                            style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12),
                            overflow: TextOverflow.ellipsis),
                          Text(token.name.length > 14 ? '${token.name.substring(0, 14)}...' : token.name,
                            style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9),
                            overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Text('${isPositive ? '+' : ''}${change.toStringAsFixed(2)}%',
                    style: CoinDCXTypography.numberMd.copyWith(
                      color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                      fontSize: 16, fontWeight: FontWeight.w700)),
                ),
                const Spacer(),
                // Volume bar indicator + MCap
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('MCap ${_formatCompact(mcap)}',
                              style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                            const SizedBox(height: 3),
                            // Mini volume bar
                            ClipRRect(
                              borderRadius: BorderRadius.circular(1),
                              child: SizedBox(
                                height: 2,
                                child: LinearProgressIndicator(
                                  value: volumeRatio,
                                  backgroundColor: colors.generalStrokeL1,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    isPositive
                                        ? colors.positiveBackgroundPrimary.withValues(alpha: 0.6)
                                        : colors.negativeBackgroundPrimary.withValues(alpha: 0.6),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // Creates a border that simulates a gradient (green/red fading to transparent)
  Border _gradientBorder(Color accentColor, CoinDCXColorScheme colors) {
    return Border(
      top: BorderSide(color: accentColor.withValues(alpha: 0.35), width: 1),
      left: BorderSide(color: accentColor.withValues(alpha: 0.25), width: 1),
      right: BorderSide(color: accentColor.withValues(alpha: 0.1), width: 1),
      bottom: BorderSide(color: colors.generalStrokeL1, width: 1),
    );
  }

  Widget _buildTokenRow(TokenMetrics token, CoinDCXColorScheme colors) {
    final change = _getChangeForFilter(token);
    final isPositive = change >= 0;
    final age = _formatAge(token.pairAgeHours);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/token-detail', arguments: token),
        splashColor: colors.actionBackgroundPrimary.withValues(alpha: 0.06),
        highlightColor: colors.generalBackgroundBgL2.withValues(alpha: 0.5),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 0, vertical: CoinDCXSpacing.sm),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: colors.generalStrokeL1.withValues(alpha: 0.3))),
          ),
          child: Row(
            children: [
              // Thin vertical indicator bar on the left edge
              Container(
                width: 3,
                height: 40,
                decoration: BoxDecoration(
                  color: isPositive
                      ? colors.positiveBackgroundPrimary.withValues(alpha: 0.6)
                      : colors.negativeBackgroundPrimary.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
              _buildTokenIcon(token, colors, size: 40),
              const SizedBox(width: CoinDCXSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(child: Text(token.symbol.toUpperCase(),
                          style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 13),
                          overflow: TextOverflow.ellipsis)),
                        if (age != null) ...[
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(color: colors.generalBackgroundBgL3, borderRadius: BorderRadius.circular(4)),
                            child: Text(age, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 8)),
                          ),
                        ],
                        if (token.boosts != null && token.boosts! > 0) ...[
                          const SizedBox(width: 4),
                          Icon(Icons.bolt_rounded, size: 12, color: colors.alertBackgroundPrimary),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    _buildAddressLabel(token, colors),
                  ],
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
              SizedBox(
                width: 70,
                child: Text(
                  _showMcap ? _formatCompact(token.marketCap) : _formatPrice(token.priceUsd),
                  style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 11),
                  textAlign: TextAlign.right,
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
              Container(
                width: 62,
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                decoration: BoxDecoration(
                  color: isPositive
                      ? colors.positiveBackgroundPrimary.withValues(alpha: 0.12)
                      : colors.negativeBackgroundPrimary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                ),
                child: Text(
                  '${isPositive ? '+' : ''}${change.toStringAsFixed(1)}%',
                  style: CoinDCXTypography.numberSm.copyWith(
                    color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAddressLabel(TokenMetrics token, CoinDCXColorScheme colors) {
    if (token.address != null && token.address!.isNotEmpty) {
      final addr = token.address!;
      final short = '${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}';
      return GestureDetector(
        onTap: () {
          Clipboard.setData(ClipboardData(text: addr));
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${token.symbol.toUpperCase()} address copied'),
              duration: const Duration(seconds: 1), behavior: SnackBarBehavior.floating),
          );
        },
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(short, style: CoinDCXTypography.caption.copyWith(
              color: colors.actionBackgroundPrimary, fontSize: 9)),
            const SizedBox(width: 2),
            Icon(Icons.copy_rounded, size: 9, color: colors.actionBackgroundPrimary),
          ],
        ),
      );
    }
    return Text(
      token.name.length > 18 ? '${token.name.substring(0, 18)}...' : token.name,
      style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10),
      overflow: TextOverflow.ellipsis,
    );
  }

  String _proxyUrl(String url) {
    final baseUrl = ApiClient.staticBaseUrl;
    return '$baseUrl/api/v1/proxy/image?url=${Uri.encodeComponent(url)}';
  }

  Widget _buildTokenIcon(TokenMetrics token, CoinDCXColorScheme colors, {double size = 40}) {
    if (token.imageUrl != null && token.imageUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size),
        child: Image.network(_proxyUrl(token.imageUrl!), width: size, height: size, fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildFallbackIcon(token, colors, size)),
      );
    }
    return _buildFallbackIcon(token, colors, size);
  }

  Widget _buildFallbackIcon(TokenMetrics token, CoinDCXColorScheme colors, double size) {
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(color: colors.actionBackgroundSecondary, borderRadius: BorderRadius.circular(size)),
      child: Center(child: Text(
        token.symbol.isNotEmpty ? token.symbol[0].toUpperCase() : '?',
        style: CoinDCXTypography.buttonSm.copyWith(color: colors.actionBackgroundPrimary, fontSize: size * 0.38, fontWeight: FontWeight.w700),
      )),
    );
  }

  Widget _buildCategoryTab(String label, IconData icon, CoinDCXColorScheme colors) {
    final active = _activeCategory == label;
    return GestureDetector(
      onTap: () => setState(() => _activeCategory = label),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: active ? colors.actionBackgroundPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
          border: active ? null : Border.all(color: colors.generalStrokeL2),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: active ? Colors.white : colors.generalForegroundTertiary),
            const SizedBox(width: 4),
            Text(label, style: CoinDCXTypography.buttonSm.copyWith(
              color: active ? Colors.white : colors.generalForegroundTertiary,
              fontSize: 11,
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildNewPairRow(TokenMetrics token, CoinDCXColorScheme colors) {
    final age = _formatAge(token.pairAgeHours);
    final liq = token.liquidity ?? 0;
    final change = token.priceChange24h ?? 0;
    final isPositive = change >= 0;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, '/token-detail', arguments: token),
        splashColor: colors.actionBackgroundPrimary.withValues(alpha: 0.06),
        highlightColor: colors.generalBackgroundBgL2.withValues(alpha: 0.5),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 0, vertical: CoinDCXSpacing.sm),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: colors.generalStrokeL1.withValues(alpha: 0.3))),
          ),
          child: Row(
            children: [
              // Thin vertical indicator bar
              Container(
                width: 3,
                height: 40,
                decoration: BoxDecoration(
                  color: isPositive
                      ? colors.positiveBackgroundPrimary.withValues(alpha: 0.6)
                      : colors.negativeBackgroundPrimary.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
              _buildTokenIcon(token, colors, size: 40),
              const SizedBox(width: CoinDCXSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(child: Text(token.symbol.toUpperCase(),
                          style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 13),
                          overflow: TextOverflow.ellipsis)),
                        if (age != null) ...[
                          const SizedBox(width: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: colors.actionBackgroundPrimary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(age, style: CoinDCXTypography.caption.copyWith(
                              color: colors.actionBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w600)),
                          ),
                        ],
                        if (token.boosts != null && token.boosts! > 0) ...[
                          const SizedBox(width: 4),
                          Icon(Icons.bolt_rounded, size: 12, color: colors.alertBackgroundPrimary),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    _buildAddressLabel(token, colors),
                  ],
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
              SizedBox(
                width: 70,
                child: Text(
                  _showMcap ? _formatCompact(token.marketCap) : _formatPrice(token.priceUsd),
                  style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 11),
                  textAlign: TextAlign.right,
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
              SizedBox(
                width: 62,
                child: Text(
                  _formatCompact(liq),
                  style: CoinDCXTypography.numberSm.copyWith(
                    color: isPositive ? colors.positiveBackgroundPrimary : colors.generalForegroundSecondary,
                    fontSize: 11),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTimeFilter(CoinDCXColorScheme colors) {
    final filters = ['15M', '1H', '4H', '1D'];
    return Row(
      children: filters.map((f) {
        final active = f == _activeFilter;
        return GestureDetector(
          onTap: () => setState(() => _activeFilter = f),
          child: Container(
            margin: const EdgeInsets.only(left: 4),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: active ? colors.actionBackgroundPrimary : Colors.transparent,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
            ),
            child: Text(f, style: CoinDCXTypography.caption.copyWith(
              color: active ? Colors.white : colors.generalForegroundTertiary,
              fontSize: 10, fontWeight: active ? FontWeight.w600 : FontWeight.w400)),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildSearchMode(CoinDCXColorScheme colors) {
    final searchAsync = ref.watch(tokenSearchProvider(_searchQuery));
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(CoinDCXSpacing.md),
          child: Row(
            children: [
              _buildIconButton(
                icon: Icons.arrow_back_rounded,
                colors: colors,
                onTap: () { _searchController.clear(); setState(() => _searchQuery = ''); },
              ),
              const SizedBox(width: CoinDCXSpacing.xs),
              Expanded(
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: colors.generalBackgroundBgL2,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    border: Border.all(
                      color: colors.actionBackgroundPrimary.withValues(alpha: 0.5),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: colors.actionBackgroundPrimary.withValues(alpha: 0.12),
                        blurRadius: 8,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                  child: TextField(
                    controller: _searchController, onChanged: _onSearchChanged, autofocus: true,
                    style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Search by name, symbol, or address...',
                      hintStyle: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundTertiary, fontSize: 13),
                      prefixIcon: Icon(Icons.search_rounded, color: colors.generalForegroundTertiary, size: 18),
                      border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(vertical: 10)),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(child: searchAsync.when(
          loading: () => _buildSearchLoadingState(colors),
          error: (err, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline_rounded, size: 36, color: colors.negativeBackgroundPrimary),
                const SizedBox(height: CoinDCXSpacing.sm),
                Text('Search failed', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.negativeBackgroundPrimary)),
              ],
            ),
          ),
          data: (tokens) {
            if (tokens.isEmpty) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.search_off_rounded, size: 40, color: colors.generalForegroundTertiary),
                    const SizedBox(height: CoinDCXSpacing.sm),
                    Text('No results for "$_searchQuery"',
                      style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
                  ],
                ),
              );
            }
            return ListView.builder(itemCount: tokens.length, itemBuilder: (_, i) => _buildTokenRow(tokens[i], colors));
          },
        )),
      ],
    );
  }

  Widget _buildSearchLoadingState(CoinDCXColorScheme colors) {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, _) {
        final shimmerValue = _shimmerController.value;
        return ListView.builder(
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 5,
          itemBuilder: (_, __) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
            child: Row(children: [
              _shimmerBox(colors, width: 40, height: 40, borderRadius: 20, shimmerValue: shimmerValue),
              const SizedBox(width: CoinDCXSpacing.sm),
              Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _shimmerBox(colors, height: 12, width: 80, borderRadius: 4, shimmerValue: shimmerValue),
                  const SizedBox(height: 6),
                  _shimmerBox(colors, height: 10, width: 120, borderRadius: 4, shimmerValue: shimmerValue),
                ],
              )),
              _shimmerBox(colors, height: 12, width: 50, borderRadius: 4, shimmerValue: shimmerValue),
              const SizedBox(width: CoinDCXSpacing.sm),
              _shimmerBox(colors, height: 24, width: 58, borderRadius: 4, shimmerValue: shimmerValue),
            ]),
          ),
        );
      },
    );
  }

  TextStyle _hdr(CoinDCXColorScheme c) =>
    CoinDCXTypography.caption.copyWith(color: c.generalForegroundTertiary, fontSize: 10, letterSpacing: 0.3);

  String _formatPrice(double price) {
    if (price >= 1000) return '\$${price.toStringAsFixed(2)}';
    if (price >= 1.0) return '\$${price.toStringAsFixed(2)}';
    if (price >= 0.01) return '\$${price.toStringAsFixed(4)}';
    if (price >= 0.0001) return '\$${price.toStringAsFixed(6)}';
    final str = price.toStringAsFixed(10);
    final match = RegExp(r'0\.0+').firstMatch(str);
    if (match != null) {
      final zeroCount = match.group(0)!.length - 2;
      final significant = str.substring(match.end, (match.end + 4).clamp(0, str.length));
      return '\$0.0${_toSubscript(zeroCount)}$significant';
    }
    return '\$${price.toStringAsFixed(8)}';
  }

  String _toSubscript(int n) {
    const subs = ['\u2080', '\u2081', '\u2082', '\u2083', '\u2084', '\u2085', '\u2086', '\u2087', '\u2088', '\u2089'];
    return n.toString().split('').map((d) => subs[int.parse(d)]).join();
  }

  String _formatCompact(double? value) {
    if (value == null || value == 0) return '-';
    if (value >= 1e9) return '\$${(value / 1e9).toStringAsFixed(1)}B';
    if (value >= 1e6) return '\$${(value / 1e6).toStringAsFixed(1)}M';
    if (value >= 1e3) return '\$${(value / 1e3).toStringAsFixed(0)}K';
    return '\$${value.toStringAsFixed(0)}';
  }

  String? _formatAge(int? ageHours) {
    if (ageHours == null) return null;
    if (ageHours < 1) return '<1h';
    if (ageHours < 24) return '${ageHours}h';
    final days = ageHours ~/ 24;
    if (days < 30) return '${days}d';
    final months = days ~/ 30;
    if (months < 12) return '${months}mo';
    return '${days ~/ 365}y';
  }
}
