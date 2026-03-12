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
    final rugScore = (json['score'] as num?)?.toInt()
        ?? (tokenData['rugScore'] as num?)?.toInt()
        ?? 0;
    final reasons = (json['flags'] as List<dynamic>?)?.cast<String>()
        ?? (json['reasons'] as List<dynamic>?)?.cast<String>()
        ?? [];

    return ScreeningResult(
      metrics: TokenMetrics.fromJson(tokenData),
      verdict: grade,
      score: rugScore,
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

  const TradeRecord({
    required this.id,
    required this.symbol,
    required this.side,
    required this.amount,
    required this.price,
    required this.status,
    required this.chain,
  });

  factory TradeRecord.fromJson(Map<String, dynamic> json) {
    return TradeRecord(
      id: json['id'] as String? ?? '',
      symbol: json['symbol'] as String? ?? '',
      side: json['side'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? '',
      chain: json['chain'] as String? ?? '',
    );
  }
}
