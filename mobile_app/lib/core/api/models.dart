class TokenMetrics {
  final String symbol;
  final String name;
  final String chain;
  final double priceUsd;
  final double? priceChange5m;
  final double? priceChange1h;
  final double? priceChange6h;
  final double? priceChange24h;
  final double? volume24h;
  final double? liquidity;
  final double? marketCap;
  final double? fdv;
  final int? pairAgeHours;
  final String? address;
  final String? imageUrl;
  final int? boosts;
  final int? txnsBuys24h;
  final int? txnsSells24h;

  const TokenMetrics({
    required this.symbol,
    required this.name,
    required this.chain,
    required this.priceUsd,
    this.priceChange5m,
    this.priceChange1h,
    this.priceChange6h,
    this.priceChange24h,
    this.volume24h,
    this.liquidity,
    this.marketCap,
    this.fdv,
    this.pairAgeHours,
    this.address,
    this.imageUrl,
    this.boosts,
    this.txnsBuys24h,
    this.txnsSells24h,
  });

  factory TokenMetrics.fromJson(Map<String, dynamic> json) {
    return TokenMetrics(
      symbol: json['symbol'] as String? ?? '',
      name: json['name'] as String? ?? '',
      chain: json['chain'] as String? ?? '',
      priceUsd: (json['priceUsd'] as num?)?.toDouble()
          ?? (json['price'] as num?)?.toDouble()
          ?? 0.0,
      priceChange5m: (json['priceChange5m'] as num?)?.toDouble(),
      priceChange1h: (json['priceChange1h'] as num?)?.toDouble(),
      priceChange6h: (json['priceChange6h'] as num?)?.toDouble(),
      priceChange24h: (json['priceChange24h'] as num?)?.toDouble(),
      volume24h: (json['volume24h'] as num?)?.toDouble(),
      liquidity: (json['liquidity'] as num?)?.toDouble(),
      marketCap: (json['marketCap'] as num?)?.toDouble(),
      fdv: (json['fdv'] as num?)?.toDouble(),
      pairAgeHours: (json['pairAgeHours'] as num?)?.toInt()
          ?? (json['ageMinutes'] != null ? ((json['ageMinutes'] as num).toDouble() / 60).round() : null),
      address: json['address'] as String?,
      imageUrl: json['imageUrl'] as String?,
      boosts: (json['boosts'] as num?)?.toInt(),
      txnsBuys24h: (json['txnsBuys24h'] as num?)?.toInt(),
      txnsSells24h: (json['txnsSells24h'] as num?)?.toInt(),
    );
  }
}

class TokenAudit {
  final bool noMint;
  final bool noFreeze;
  final int burnt;
  final double top10HolderPct;
  final int insidersDetected;
  final int totalHolders;
  final double totalLiquidity;
  final double lpLockedPct;
  final int lpProviders;
  final String? creator;
  final double? creatorBalance;
  final String? deployPlatform;
  final bool rugged;
  final String? tokenCreatedAt;
  final String? pairAddress;
  final List<Map<String, dynamic>> risks;

  const TokenAudit({
    required this.noMint,
    required this.noFreeze,
    required this.burnt,
    required this.top10HolderPct,
    required this.insidersDetected,
    required this.totalHolders,
    required this.totalLiquidity,
    required this.lpLockedPct,
    required this.lpProviders,
    this.creator,
    this.creatorBalance,
    this.deployPlatform,
    required this.rugged,
    this.tokenCreatedAt,
    this.pairAddress,
    required this.risks,
  });

  factory TokenAudit.fromJson(Map<String, dynamic> json) {
    return TokenAudit(
      noMint: json['noMint'] as bool? ?? false,
      noFreeze: json['noFreeze'] as bool? ?? false,
      burnt: (json['burnt'] as num?)?.toInt() ?? 0,
      top10HolderPct: (json['top10HolderPct'] as num?)?.toDouble() ?? 0,
      insidersDetected: (json['insidersDetected'] as num?)?.toInt() ?? 0,
      totalHolders: (json['totalHolders'] as num?)?.toInt() ?? 0,
      totalLiquidity: (json['totalLiquidity'] as num?)?.toDouble() ?? 0,
      lpLockedPct: (json['lpLockedPct'] as num?)?.toDouble() ?? 0,
      lpProviders: (json['lpProviders'] as num?)?.toInt() ?? 0,
      creator: json['creator'] as String?,
      creatorBalance: (json['creatorBalance'] as num?)?.toDouble(),
      deployPlatform: json['deployPlatform'] as String?,
      rugged: json['rugged'] as bool? ?? false,
      tokenCreatedAt: json['tokenCreatedAt'] as String?,
      pairAddress: json['pairAddress'] as String?,
      risks: (json['risks'] as List<dynamic>?)
          ?.map((r) => r as Map<String, dynamic>)
          .toList() ?? [],
    );
  }
}

class ScreeningResult {
  final TokenMetrics metrics;
  final String verdict;
  final int score;
  final List<String> flags;
  final Map<String, dynamic>? security;
  final TokenAudit? audit;

  const ScreeningResult({
    required this.metrics,
    required this.verdict,
    required this.score,
    required this.flags,
    this.security,
    this.audit,
  });

  factory ScreeningResult.fromJson(Map<String, dynamic> json) {
    final tokenData = json['metrics'] as Map<String, dynamic>?
        ?? json['token'] as Map<String, dynamic>?
        ?? {};
    final grade = json['verdict'] as String?
        ?? json['grade'] as String?
        ?? '';
    final confidence = (json['aiConfidence'] as num?)?.toInt()
        ?? (json['score'] as num?)?.toInt()
        ?? (tokenData['rugScore'] as num?)?.toInt()
        ?? 0;
    final reasons = (json['flags'] as List<dynamic>?)?.cast<String>()
        ?? (json['reasons'] as List<dynamic>?)?.cast<String>()
        ?? [];

    return ScreeningResult(
      metrics: TokenMetrics.fromJson(tokenData),
      verdict: grade,
      score: confidence,
      flags: reasons,
      security: json['security'] as Map<String, dynamic>?,
      audit: json['audit'] != null
          ? TokenAudit.fromJson(json['audit'] as Map<String, dynamic>)
          : null,
    );
  }

  bool get isSafe => verdict == 'A' || verdict == 'B' || verdict == 'SAFE' || verdict == 'MODERATE';
  bool get isDangerous => verdict == 'F' || verdict == 'DANGEROUS';
}

class ChatMessage {
  final String text;
  final bool isUser;
  final List<ChatCard>? cards;
  final List<String>? suggestions;
  final DateTime timestamp;

  const ChatMessage({
    required this.text,
    required this.isUser,
    this.cards,
    this.suggestions,
    required this.timestamp,
  });

  factory ChatMessage.fromApiResponse(Map<String, dynamic> json) {
    final rawCards = json['cards'] as List<dynamic>?;
    final cards = rawCards?.map((c) {
      final cardMap = c as Map<String, dynamic>;
      final type = cardMap['type'] as String? ?? '';
      final data = cardMap['data'];
      // Backend sends data as the direct payload (list for trending, map for others)
      Map<String, dynamic> flatData;
      if (data is Map<String, dynamic>) {
        flatData = data;
      } else if (data is List) {
        flatData = {'items': data};
      } else {
        flatData = {};
      }
      return ChatCard(type: type, title: cardMap['title'] as String?, data: flatData);
    }).toList();

    final suggestions = (json['suggestions'] as List<dynamic>?)?.cast<String>();

    return ChatMessage(
      text: json['text'] as String? ?? json['message'] as String? ?? '',
      isUser: false,
      cards: cards,
      suggestions: suggestions,
      timestamp: DateTime.now(),
    );
  }
}

class ChatCard {
  final String type;
  final String? title;
  final Map<String, dynamic> data;

  const ChatCard({required this.type, this.title, required this.data});

  factory ChatCard.fromJson(Map<String, dynamic> json) {
    return ChatCard(
      type: json['type'] as String? ?? '',
      title: json['title'] as String?,
      data: json['data'] as Map<String, dynamic>? ?? {},
    );
  }
}

class TradeQuote {
  final String symbol;
  final double price;
  final ScreeningResult? screening;

  const TradeQuote({required this.symbol, required this.price, this.screening});

  factory TradeQuote.fromJson(Map<String, dynamic> json) {
    return TradeQuote(
      symbol: json['symbol'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      screening: json['screening'] != null
          ? ScreeningResult.fromJson(json['screening'] as Map<String, dynamic>)
          : null,
    );
  }
}

class TradeRecord {
  final String id;
  final String symbol;
  final String side;
  final double amount;
  final double price;
  final String status;
  final String chain;
  final int timestamp;
  final String? txHash;

  const TradeRecord({
    required this.id,
    required this.symbol,
    required this.side,
    required this.amount,
    required this.price,
    required this.status,
    required this.chain,
    required this.timestamp,
    this.txHash,
  });

  factory TradeRecord.fromJson(Map<String, dynamic> json) {
    return TradeRecord(
      id: json['id'] as String? ?? '',
      symbol: json['symbol'] as String? ?? '',
      side: json['side'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble()
          ?? (json['amountUsd'] as num?)?.toDouble()
          ?? (json['quantity'] as num?)?.toDouble()
          ?? 0.0,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? '',
      chain: json['chain'] as String? ?? '',
      timestamp: (json['timestamp'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
      txHash: json['txHash'] as String?,
    );
  }
}

// ─── Leaderboard ────────────────────────────────────────────

class LeaderboardTrader {
  final int rank;
  final String walletAddress;
  final String name;
  final String? twitterUsername;
  final double pnl7d;
  final double pnl30d;
  final double winRate7d;
  final double winRate30d;
  final double? sharpe;
  final int copiers;
  final String chain;
  final List<String> tags;

  const LeaderboardTrader({
    required this.rank,
    required this.walletAddress,
    required this.name,
    this.twitterUsername,
    required this.pnl7d,
    required this.pnl30d,
    required this.winRate7d,
    required this.winRate30d,
    this.sharpe,
    required this.copiers,
    required this.chain,
    required this.tags,
  });

  factory LeaderboardTrader.fromJson(Map<String, dynamic> json, int index) {
    return LeaderboardTrader(
      rank: (json['rank'] as num?)?.toInt() ?? index + 1,
      walletAddress: json['walletAddress'] as String? ?? json['wallet'] as String? ?? '',
      name: json['walletName'] as String? ?? json['name'] as String? ?? 'Trader',
      twitterUsername: json['twitterUsername'] as String?,
      pnl7d: (json['pnl7d'] as num?)?.toDouble() ?? 0,
      pnl30d: (json['pnl30d'] as num?)?.toDouble() ?? 0,
      winRate7d: (json['winRate7d'] as num?)?.toDouble() ?? 0,
      winRate30d: (json['winRate30d'] as num?)?.toDouble() ?? 0,
      sharpe: (json['sharpe'] as num?)?.toDouble(),
      copiers: (json['copiers'] as num?)?.toInt() ?? 0,
      chain: json['chain'] as String? ?? 'solana',
      tags: (json['tags'] as List<dynamic>?)?.cast<String>() ?? [],
    );
  }
}

// ─── Copy Trading ───────────────────────────────────────────

class CopyTradeConfig {
  final String walletAddress;
  final String walletName;
  final String buyMode;
  final double buyAmount;
  final String sellMethod;
  final bool enabled;
  final double totalCopied;
  final double totalPnl;

  const CopyTradeConfig({
    required this.walletAddress,
    required this.walletName,
    required this.buyMode,
    required this.buyAmount,
    required this.sellMethod,
    required this.enabled,
    required this.totalCopied,
    required this.totalPnl,
  });

  factory CopyTradeConfig.fromJson(Map<String, dynamic> json) {
    return CopyTradeConfig(
      walletAddress: json['walletAddress'] as String? ?? '',
      walletName: json['walletName'] as String? ?? 'Trader',
      buyMode: json['buyMode'] as String? ?? 'fixed_buy',
      buyAmount: (json['buyAmount'] as num?)?.toDouble() ?? 0,
      sellMethod: json['sellMethod'] as String? ?? 'mirror_sell',
      enabled: json['enabled'] as bool? ?? true,
      totalCopied: (json['totalCopied'] as num?)?.toDouble() ?? 0,
      totalPnl: (json['totalPnl'] as num?)?.toDouble() ?? 0,
    );
  }
}

class CopyActivity {
  final String tokenSymbol;
  final String side;
  final double copyAmountUsd;
  final String status;
  final String? skipReason;
  final String walletAddress;
  final int timestamp;

  const CopyActivity({
    required this.tokenSymbol,
    required this.side,
    required this.copyAmountUsd,
    required this.status,
    this.skipReason,
    required this.walletAddress,
    required this.timestamp,
  });

  factory CopyActivity.fromJson(Map<String, dynamic> json) {
    return CopyActivity(
      tokenSymbol: json['tokenSymbol'] as String? ?? '',
      side: json['side'] as String? ?? 'buy',
      copyAmountUsd: (json['copyAmountUsd'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? '',
      skipReason: json['skipReason'] as String?,
      walletAddress: json['walletAddress'] as String? ?? '',
      timestamp: (json['timestamp'] as num?)?.toInt() ?? 0,
    );
  }
}

// ─── Strategies ─────────────────────────────────────────────

class StrategyTemplate {
  final String type;
  final String name;
  final String description;
  final String riskLevel;
  final int simulated90dReturn;
  final List<String> controls;

  const StrategyTemplate({
    required this.type,
    required this.name,
    required this.description,
    required this.riskLevel,
    required this.simulated90dReturn,
    required this.controls,
  });

  factory StrategyTemplate.fromJson(Map<String, dynamic> json) {
    return StrategyTemplate(
      type: json['type'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      riskLevel: json['riskLevel'] as String? ?? 'moderate',
      simulated90dReturn: (json['simulated90dReturn'] as num?)?.toInt() ?? 0,
      controls: (json['controls'] as List<dynamic>?)?.cast<String>() ?? [],
    );
  }

  String get icon {
    switch (type) {
      case 'dca': return '📊';
      case 'momentum': return '🚀';
      case 'grid': return '📈';
      case 'mean-reversion': return '🔄';
      default: return '⚡';
    }
  }
}

class Strategy {
  final String id;
  final String type;
  final String name;
  final String chain;
  final List<String> tokens;
  final double budgetUsd;
  final String riskLevel;
  final double maxPerTradePct;
  final bool enabled;

  const Strategy({
    required this.id,
    required this.type,
    required this.name,
    required this.chain,
    required this.tokens,
    required this.budgetUsd,
    required this.riskLevel,
    required this.maxPerTradePct,
    required this.enabled,
  });

  factory Strategy.fromJson(Map<String, dynamic> json) {
    return Strategy(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      name: json['name'] as String? ?? '',
      chain: json['chain'] as String? ?? 'solana',
      tokens: (json['tokens'] as List<dynamic>?)?.cast<String>() ?? [],
      budgetUsd: (json['budgetUsd'] as num?)?.toDouble() ?? 0,
      riskLevel: json['riskLevel'] as String? ?? 'moderate',
      maxPerTradePct: (json['maxPerTradePct'] as num?)?.toDouble() ?? 5,
      enabled: json['enabled'] as bool? ?? true,
    );
  }
}

// ─── Agent & Risk ───────────────────────────────────────────

class AgentStatus {
  final bool running;
  final String? startedAt;
  final String? stoppedAt;
  final bool globalHalt;

  const AgentStatus({
    required this.running,
    this.startedAt,
    this.stoppedAt,
    required this.globalHalt,
  });

  factory AgentStatus.fromJson(Map<String, dynamic> json) {
    return AgentStatus(
      running: json['running'] as bool? ?? false,
      startedAt: json['startedAt'] as String?,
      stoppedAt: json['stoppedAt'] as String?,
      globalHalt: json['globalHalt'] as bool? ?? false,
    );
  }
}

class RiskSettings {
  final String riskLevel;
  final double dailyLossLimitUsd;
  final double maxPerTradePct;

  const RiskSettings({
    required this.riskLevel,
    required this.dailyLossLimitUsd,
    required this.maxPerTradePct,
  });

  factory RiskSettings.fromJson(Map<String, dynamic> json) {
    return RiskSettings(
      riskLevel: json['riskLevel'] as String? ?? 'moderate',
      dailyLossLimitUsd: (json['dailyLossLimitUsd'] as num?)?.toDouble() ?? 1000,
      maxPerTradePct: (json['maxPerTradePct'] as num?)?.toDouble() ?? 5,
    );
  }
}

// ─── Chains ─────────────────────────────────────────────────

class ChainInfo {
  final String id;
  final String name;
  final String family;
  final int? chainId;
  final String nativeToken;
  final String? dexVenue;
  final String? blockExplorer;

  const ChainInfo({
    required this.id,
    required this.name,
    required this.family,
    this.chainId,
    required this.nativeToken,
    this.dexVenue,
    this.blockExplorer,
  });

  factory ChainInfo.fromJson(Map<String, dynamic> json) {
    return ChainInfo(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      family: json['family'] as String? ?? 'evm',
      chainId: (json['chainId'] as num?)?.toInt(),
      nativeToken: json['nativeToken'] as String? ?? '',
      dexVenue: json['dexVenue'] as String?,
      blockExplorer: json['blockExplorer'] as String?,
    );
  }
}
