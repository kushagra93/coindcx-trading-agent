import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/models.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

final trendingTokensProvider = FutureProvider<List<TokenMetrics>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/tokens/trending');
  final tokens = (response['tokens'] as List<dynamic>?)
      ?.map((t) => TokenMetrics.fromJson(t as Map<String, dynamic>))
      .toList();
  return tokens ?? [];
});

final newPairsProvider = FutureProvider<List<TokenMetrics>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/tokens/new-pairs');
  final tokens = (response['tokens'] as List<dynamic>?)
      ?.map((t) => TokenMetrics.fromJson(t as Map<String, dynamic>))
      .toList();
  return tokens ?? [];
});

final tokenSearchProvider = FutureProvider.family<List<TokenMetrics>, String>((ref, query) async {
  if (query.isEmpty) return [];
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/tokens/search', queryParams: {'q': query});
  if (response['metrics'] != null) {
    return [TokenMetrics.fromJson(response['metrics'] as Map<String, dynamic>)];
  }
  return [];
});

final tokenScreenProvider = FutureProvider.family<ScreeningResult?, String>((ref, symbolOrAddress) async {
  final api = ref.read(apiClientProvider);
  // If it looks like a contract address, use the address endpoint
  final isAddress = symbolOrAddress.length > 20;
  if (isAddress) {
    final response = await api.post('/api/v1/tokens/screen-address', body: {'address': symbolOrAddress});
    return ScreeningResult.fromJson(response);
  }
  final response = await api.get('/api/v1/tokens/screen/$symbolOrAddress');
  return ScreeningResult.fromJson(response);
});

final portfolioProvider = FutureProvider<List<TradeRecord>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/trade/portfolio');
  final trades = (response['trades'] as List<dynamic>?)
      ?.map((p) => TradeRecord.fromJson(p as Map<String, dynamic>))
      .toList();
  return trades ?? [];
});

// ─── Portfolio raw response (for trades list) ───────────────

final portfolioRawProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.read(apiClientProvider);
  return api.get('/api/v1/trade/portfolio');
});

// ─── Leaderboard ────────────────────────────────────────────

typedef LeaderboardParams = ({String sort, String period});

final leaderboardProvider = FutureProvider.family<List<LeaderboardTrader>, LeaderboardParams>((ref, params) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/leaderboard', queryParams: {
    'sort': params.sort,
    'period': params.period,
    'limit': '30',
  });
  final traders = (response['traders'] as List<dynamic>?)
      ?.asMap().entries.map((e) => LeaderboardTrader.fromJson(e.value as Map<String, dynamic>, e.key))
      .toList();
  return traders ?? [];
});

final kolLeaderboardProvider = FutureProvider<List<LeaderboardTrader>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/leaderboard/kols');
  final traders = (response['traders'] as List<dynamic>?)
      ?.asMap().entries.map((e) => LeaderboardTrader.fromJson(e.value as Map<String, dynamic>, e.key))
      .toList();
  return traders ?? [];
});

// ─── Copy Trading ───────────────────────────────────────────

final copyConfigsProvider = FutureProvider<List<CopyTradeConfig>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/copy');
  final configs = (response['following'] as List<dynamic>?)
      ?.map((c) => CopyTradeConfig.fromJson(c as Map<String, dynamic>))
      .toList();
  return configs ?? [];
});

final copyActivityProvider = FutureProvider<List<CopyActivity>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/copy/activity', queryParams: {'limit': '30'});
  final activities = (response['activities'] as List<dynamic>?)
      ?.map((a) => CopyActivity.fromJson(a as Map<String, dynamic>))
      .toList();
  return activities ?? [];
});

// ─── Strategies ─────────────────────────────────────────────

final templatesProvider = FutureProvider<List<StrategyTemplate>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/templates');
  final templates = (response['templates'] as List<dynamic>?)
      ?.map((t) => StrategyTemplate.fromJson(t as Map<String, dynamic>))
      .toList();
  return templates ?? [];
});

final strategiesProvider = FutureProvider<List<Strategy>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/strategies');
  final strategies = (response['strategies'] as List<dynamic>?)
      ?.map((s) => Strategy.fromJson(s as Map<String, dynamic>))
      .toList();
  return strategies ?? [];
});

// ─── Agent & Risk ───────────────────────────────────────────

final agentStatusProvider = FutureProvider<AgentStatus>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/agent/status');
  return AgentStatus.fromJson(response);
});

final riskSettingsProvider = FutureProvider<RiskSettings>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/risk');
  final settings = response['settings'] as Map<String, dynamic>? ?? response;
  return RiskSettings.fromJson(settings);
});

// ─── Chains ─────────────────────────────────────────────────

final chainsProvider = FutureProvider<List<ChainInfo>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/chains');
  final chains = (response['chains'] as List<dynamic>?)
      ?.map((c) => ChainInfo.fromJson(c as Map<String, dynamic>))
      .toList();
  return chains ?? [];
});

// ─── Gainers ────────────────────────────────────────────────

final gainersProvider = FutureProvider<List<TokenMetrics>>((ref) async {
  final api = ref.read(apiClientProvider);
  final response = await api.get('/api/v1/tokens/gainers');
  final tokens = (response['tokens'] as List<dynamic>?)
      ?.map((t) => TokenMetrics.fromJson(t as Map<String, dynamic>))
      .toList();
  return tokens ?? [];
});
