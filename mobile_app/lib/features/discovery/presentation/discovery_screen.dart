import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';
import '../../../shared/widgets/token_card.dart';

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
              Text(
                'Could not load trending tokens',
                style: CoinDCXTypography.bodyLarge.copyWith(color: colors.generalForegroundSecondary),
              ),
              const SizedBox(height: CoinDCXSpacing.xs),
              Text(
                err.toString(),
                style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary),
                textAlign: TextAlign.center,
              ),
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
            child: Text(
              'No trending tokens found',
              style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary),
            ),
          );
        }
        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: CoinDCXSpacing.sm),
              child: Text(
                'Trending',
                style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary),
              ),
            ),
            ...tokens.map((t) => Padding(
              padding: const EdgeInsets.only(bottom: CoinDCXSpacing.xs),
              child: TokenCard(
                token: t,
                onTap: () => Navigator.pushNamed(context, '/token-detail', arguments: t),
              ),
            )),
            const SizedBox(height: CoinDCXSpacing.xl),
          ],
        );
      },
    );
  }

  Widget _buildSearchResults() {
    final searchAsync = ref.watch(tokenSearchProvider(_searchQuery));
    final colors = CoinDCXTheme.of(context);

    return searchAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(
        child: Text(
          'Search failed: $err',
          style: CoinDCXTypography.bodyMedium.copyWith(color: colors.negativeBackgroundPrimary),
        ),
      ),
      data: (tokens) {
        if (tokens.isEmpty) {
          return Center(
            child: Text(
              'No results for "$_searchQuery"',
              style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundSecondary),
            ),
          );
        }
        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md),
          children: tokens.map((t) => Padding(
            padding: const EdgeInsets.only(bottom: CoinDCXSpacing.xs),
            child: TokenCard(
              token: t,
              onTap: () => Navigator.pushNamed(context, '/token-detail', arguments: t),
            ),
          )).toList(),
        );
      },
    );
  }
}
