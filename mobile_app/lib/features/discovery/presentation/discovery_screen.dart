import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../core/api/models.dart';

class DiscoveryScreen extends ConsumerStatefulWidget {
  const DiscoveryScreen({super.key});

  @override
  ConsumerState<DiscoveryScreen> createState() => _DiscoveryScreenState();
}

class _DiscoveryScreenState extends ConsumerState<DiscoveryScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _searchQuery = '';
  String _activeFilter = '1D';
  bool _showMcap = true;
  String _activeCategory = 'Gainers'; // 'Gainers' or 'New Pairs'

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
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
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded, size: 48, color: colors.generalForegroundTertiary),
            const SizedBox(height: CoinDCXSpacing.md),
            Text('Could not load tokens', style: CoinDCXTypography.bodyLarge.copyWith(color: colors.generalForegroundSecondary)),
            const SizedBox(height: CoinDCXSpacing.sm),
            TextButton(onPressed: () {
              ref.invalidate(trendingTokensProvider);
              ref.invalidate(newPairsProvider);
            }, child: const Text('Retry')),
          ],
        ),
      ),
      data: (tokens) => _buildLoadedView(tokens, colors),
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
                  child: Container(
                    height: 40,
                    decoration: BoxDecoration(
                      color: colors.generalBackgroundBgL2,
                      borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    ),
                    child: TextField(
                      controller: _searchController,
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
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/leaderboard'),
                  child: Icon(Icons.leaderboard_rounded, color: colors.generalForegroundSecondary, size: 22),
                ),
                const SizedBox(width: CoinDCXSpacing.sm),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/strategies'),
                  child: Icon(Icons.auto_graph_rounded, color: colors.generalForegroundSecondary, size: 22),
                ),
                const SizedBox(width: CoinDCXSpacing.sm),
                GestureDetector(
                  onTap: () {
                    ref.invalidate(trendingTokensProvider);
                    ref.invalidate(newPairsProvider);
                  },
                  child: Icon(Icons.refresh_rounded, color: colors.generalForegroundSecondary, size: 22),
                ),
              ],
            ),
          ),
        ),

        // "Hot Right Now" — only show on Gainers tab
        if (hotTokens.isNotEmpty && _activeCategory == 'Gainers') ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(CoinDCXSpacing.md, CoinDCXSpacing.lg, CoinDCXSpacing.md, CoinDCXSpacing.sm),
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
              height: 130,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                itemCount: hotTokens.length,
                separatorBuilder: (_, __) => const SizedBox(width: CoinDCXSpacing.sm),
                itemBuilder: (context, i) => _buildHotCard(hotTokens[i], colors),
              ),
            ),
          ),
        ],

        // Category tabs + filters
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(CoinDCXSpacing.md, CoinDCXSpacing.lg, CoinDCXSpacing.md, CoinDCXSpacing.xs),
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
            padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.xs),
            child: Row(
              children: [
                SizedBox(width: 160, child: Text(
                  _activeCategory == 'New Pairs' ? 'Name / Age' : 'Name / Age',
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
                SizedBox(width: 50, child: Text(
                  _activeCategory == 'New Pairs' ? 'Liq' : _filterLabel(),
                  style: _hdr(colors), textAlign: TextAlign.right,
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

  Widget _buildHotCard(TokenMetrics token, CoinDCXColorScheme colors) {
    final change = _getChangeForFilter(token);
    final isPositive = change >= 0;
    final buys = token.txnsBuys24h ?? 0;
    final mcap = token.marketCap;

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/token-detail', arguments: token),
      child: Container(
        width: 150,
        padding: const EdgeInsets.all(CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          color: colors.generalBackgroundBgL2,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
          border: Border.all(
            color: isPositive
                ? colors.positiveBackgroundPrimary.withValues(alpha: 0.25)
                : colors.generalStrokeL2,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (buys > 100)
              Container(
                margin: const EdgeInsets.only(bottom: 4),
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: colors.positiveBackgroundPrimary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text('$buys+ buys in 24h',
                  style: CoinDCXTypography.caption.copyWith(color: colors.positiveBackgroundPrimary, fontSize: 8)),
              ),
            Row(
              children: [
                _buildTokenIcon(token, colors, size: 28),
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
            Text('${isPositive ? '+' : ''}${change.toStringAsFixed(2)}%',
              style: CoinDCXTypography.numberMd.copyWith(
                color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                fontSize: 16, fontWeight: FontWeight.w700)),
            const Spacer(),
            Text('MCap ${_formatCompact(mcap)}',
              style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
          ],
        ),
      ),
    );
  }

  Widget _buildTokenRow(TokenMetrics token, CoinDCXColorScheme colors) {
    final change = _getChangeForFilter(token);
    final isPositive = change >= 0;
    final age = _formatAge(token.pairAgeHours);

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/token-detail', arguments: token),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: colors.generalStrokeL1.withValues(alpha: 0.3))),
        ),
        child: Row(
          children: [
            _buildTokenIcon(token, colors, size: 36),
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
              width: 58,
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
              decoration: BoxDecoration(
                color: isPositive
                    ? colors.positiveBackgroundPrimary.withValues(alpha: 0.12)
                    : colors.negativeBackgroundPrimary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '${isPositive ? '+' : ''}${change.toStringAsFixed(1)}%',
                style: CoinDCXTypography.numberSm.copyWith(
                  color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                  fontSize: 11),
                textAlign: TextAlign.center,
              ),
            ),
          ],
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

  String _proxyUrl(String url) =>
    'http://coindcx-staging-815408101.us-east-1.elb.amazonaws.com/api/v1/proxy/image?url=${Uri.encodeComponent(url)}';

  Widget _buildTokenIcon(TokenMetrics token, CoinDCXColorScheme colors, {double size = 36}) {
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

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/token-detail', arguments: token),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: colors.generalStrokeL1.withValues(alpha: 0.3))),
        ),
        child: Row(
          children: [
            _buildTokenIcon(token, colors, size: 36),
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
              width: 58,
              child: Text(
                _formatCompact(liq),
                style: CoinDCXTypography.numberSm.copyWith(
                  color: isPositive ? colors.positiveBackgroundPrimary : colors.generalForegroundSecondary,
                  fontSize: 11),
                textAlign: TextAlign.center,
              ),
            ),
          ],
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
              GestureDetector(
                onTap: () { _searchController.clear(); setState(() => _searchQuery = ''); },
                child: Icon(Icons.arrow_back_rounded, color: colors.generalForegroundPrimary),
              ),
              const SizedBox(width: CoinDCXSpacing.sm),
              Expanded(
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(color: colors.generalBackgroundBgL2, borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull)),
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
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(child: Text('Search failed', style: CoinDCXTypography.bodyMedium.copyWith(color: colors.negativeBackgroundPrimary))),
          data: (tokens) {
            if (tokens.isEmpty) return Center(child: Text('No results for "$_searchQuery"',
              style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)));
            return ListView.builder(itemCount: tokens.length, itemBuilder: (_, i) => _buildTokenRow(tokens[i], colors));
          },
        )),
      ],
    );
  }

  TextStyle _hdr(CoinDCXColorScheme c) =>
    CoinDCXTypography.caption.copyWith(color: c.generalForegroundTertiary, fontSize: 10);

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
