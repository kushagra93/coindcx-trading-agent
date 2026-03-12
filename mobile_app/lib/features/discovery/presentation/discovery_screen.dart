import 'dart:async';
import 'package:flutter/material.dart';
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

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(trendingTokensProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(CoinDCXSpacing.md),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary),
              decoration: InputDecoration(
                hintText: 'Search tokens by name or symbol...',
                hintStyle: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundTertiary),
                prefixIcon: Icon(Icons.search_rounded, color: colors.generalForegroundTertiary),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: Icon(Icons.clear_rounded, color: colors.generalForegroundTertiary),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchQuery = '');
                        },
                      )
                    : null,
              ),
            ),
          ),
          Expanded(
            child: _searchQuery.isNotEmpty ? _buildSearchResults() : _buildTrending(),
          ),
        ],
      ),
    );
  }

  Widget _buildTrending() {
    final trendingAsync = ref.watch(trendingTokensProvider);
    final colors = CoinDCXTheme.of(context);

    return trendingAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(CoinDCXSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off_rounded, size: 48, color: colors.generalForegroundTertiary),
              const SizedBox(height: CoinDCXSpacing.md),
              Text('Could not load trending tokens',
                style: CoinDCXTypography.bodyLarge.copyWith(color: colors.generalForegroundSecondary)),
              const SizedBox(height: CoinDCXSpacing.md),
              TextButton(
                onPressed: () => ref.invalidate(trendingTokensProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (tokens) {
        if (tokens.isEmpty) {
          return Center(
            child: Text('No trending tokens found',
              style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
          );
        }
        return _buildTokenTable(tokens, colors);
      },
    );
  }

  Widget _buildTokenTable(List<TokenMetrics> tokens, CoinDCXColorScheme colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
          child: Row(
            children: [
              Text('Trending', style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxxs),
                decoration: BoxDecoration(
                  color: colors.positiveBackgroundSecondary,
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Text('LIVE', style: CoinDCXTypography.caption.copyWith(
                  color: colors.positiveBackgroundPrimary, fontWeight: FontWeight.w700, fontSize: 10)),
              ),
            ],
          ),
        ),
        const SizedBox(height: CoinDCXSpacing.sm),
        // Column headers
        Container(
          padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.xs),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: colors.generalStrokeL1)),
          ),
          child: Row(
            children: [
              SizedBox(width: 28, child: Text('#', style: _headerStyle(colors))),
              Expanded(flex: 3, child: Text('TOKEN', style: _headerStyle(colors))),
              Expanded(flex: 2, child: Text('PRICE', style: _headerStyle(colors), textAlign: TextAlign.right)),
              Expanded(flex: 2, child: Text('24H', style: _headerStyle(colors), textAlign: TextAlign.right)),
              Expanded(flex: 2, child: Text('VOL', style: _headerStyle(colors), textAlign: TextAlign.right)),
              Expanded(flex: 2, child: Text('MCAP', style: _headerStyle(colors), textAlign: TextAlign.right)),
            ],
          ),
        ),
        // Token rows
        Expanded(
          child: ListView.builder(
            padding: EdgeInsets.zero,
            itemCount: tokens.length,
            itemBuilder: (context, index) => _buildTokenRow(index, tokens[index], colors),
          ),
        ),
      ],
    );
  }

  Widget _buildTokenRow(int index, TokenMetrics token, CoinDCXColorScheme colors) {
    final is24hPositive = (token.priceChange24h ?? 0) >= 0;

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/token-detail', arguments: token),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: colors.generalStrokeL1.withValues(alpha: 0.5))),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 28,
              child: Text(
                '#${index + 1}',
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
              ),
            ),
            // Token info
            Expanded(
              flex: 3,
              child: Row(
                children: [
                  Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      color: colors.actionBackgroundSecondary,
                      borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    ),
                    child: Center(
                      child: Text(
                        token.symbol.isNotEmpty ? token.symbol[0].toUpperCase() : '?',
                        style: CoinDCXTypography.caption.copyWith(
                          color: colors.actionBackgroundPrimary, fontWeight: FontWeight.w700, fontSize: 11),
                      ),
                    ),
                  ),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          token.symbol.toUpperCase(),
                          style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary),
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          token.name.length > 14 ? '${token.name.substring(0, 14)}...' : token.name,
                          style: CoinDCXTypography.caption.copyWith(
                            color: colors.generalForegroundTertiary, fontSize: 9),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Price
            Expanded(
              flex: 2,
              child: Text(
                _formatPrice(token.priceUsd),
                style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 11),
                textAlign: TextAlign.right,
              ),
            ),
            // 24h change
            Expanded(
              flex: 2,
              child: Container(
                alignment: Alignment.centerRight,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xxs, vertical: 1),
                  decoration: BoxDecoration(
                    color: is24hPositive
                        ? colors.positiveBackgroundPrimary.withValues(alpha: 0.15)
                        : colors.negativeBackgroundPrimary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${is24hPositive ? '+' : ''}${(token.priceChange24h ?? 0).toStringAsFixed(0)}%',
                    style: CoinDCXTypography.numberSm.copyWith(
                      color: is24hPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                      fontSize: 10,
                    ),
                    textAlign: TextAlign.right,
                  ),
                ),
              ),
            ),
            // Volume
            Expanded(
              flex: 2,
              child: Text(
                _formatCompact(token.volume24h),
                style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundSecondary, fontSize: 10),
                textAlign: TextAlign.right,
              ),
            ),
            // Market cap
            Expanded(
              flex: 2,
              child: Text(
                _formatCompact(token.marketCap),
                style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundSecondary, fontSize: 10),
                textAlign: TextAlign.right,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchResults() {
    final searchAsync = ref.watch(tokenSearchProvider(_searchQuery));
    final colors = CoinDCXTheme.of(context);

    return searchAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Text('Search failed: $err',
          style: CoinDCXTypography.bodyMedium.copyWith(color: colors.negativeBackgroundPrimary)),
      ),
      data: (tokens) {
        if (tokens.isEmpty) {
          return Center(
            child: Text('No results for "$_searchQuery"',
              style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary)),
          );
        }
        return _buildTokenTable(tokens, colors);
      },
    );
  }

  TextStyle _headerStyle(CoinDCXColorScheme colors) =>
    CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9, fontWeight: FontWeight.w600);

  String _formatPrice(double price) {
    if (price >= 1.0) return '\$${price.toStringAsFixed(2)}';
    if (price >= 0.01) return '\$${price.toStringAsFixed(4)}';
    if (price >= 0.0001) return '\$${price.toStringAsFixed(6)}';
    return '\$${price.toStringAsFixed(8)}';
  }

  String _formatCompact(double? value) {
    if (value == null || value == 0) return '—';
    if (value >= 1e9) return '\$${(value / 1e9).toStringAsFixed(1)}B';
    if (value >= 1e6) return '\$${(value / 1e6).toStringAsFixed(1)}M';
    if (value >= 1e3) return '\$${(value / 1e3).toStringAsFixed(0)}K';
    return '\$${value.toStringAsFixed(0)}';
  }
}
