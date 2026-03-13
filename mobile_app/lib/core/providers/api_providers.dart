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
  final positions = (response['positions'] as List<dynamic>?)
      ?.map((p) => TradeRecord.fromJson(p as Map<String, dynamic>))
      .toList();
  return positions ?? [];
});
