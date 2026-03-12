class TokenMetrics {
  final String symbol;
  final String name;
  final String chain;
  final double priceUsd;
  final double? priceChange24h;
  final double? volume24h;
  final double? liquidity;
  final double? marketCap;
  final double? fdv;
  final int? pairAgeHours;
  final String? address;
  final String? imageUrl;

  const TokenMetrics({
    required this.symbol,
    required this.name,
    required this.chain,
    required this.priceUsd,
    this.priceChange24h,
    this.volume24h,
    this.liquidity,
    this.marketCap,
    this.fdv,
    this.pairAgeHours,
    this.address,
    this.imageUrl,
  });

  factory TokenMetrics.fromJson(Map<String, dynamic> json) {
    return TokenMetrics(
      symbol: json['symbol'] as String? ?? '',
      name: json['name'] as String? ?? '',
      chain: json['chain'] as String? ?? '',
      priceUsd: (json['priceUsd'] as num?)?.toDouble() ?? 0.0,
      priceChange24h: (json['priceChange24h'] as num?)?.toDouble(),
      volume24h: (json['volume24h'] as num?)?.toDouble(),
      liquidity: (json['liquidity'] as num?)?.toDouble(),
      marketCap: (json['marketCap'] as num?)?.toDouble(),
      fdv: (json['fdv'] as num?)?.toDouble(),
      pairAgeHours: json['pairAgeHours'] as int?,
      address: json['address'] as String?,
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

class ScreeningResult {
  final TokenMetrics metrics;
  final String verdict;
  final int score;
  final List<String> flags;
  final Map<String, dynamic>? security;

  const ScreeningResult({
    required this.metrics,
    required this.verdict,
    required this.score,
    required this.flags,
    this.security,
  });

  factory ScreeningResult.fromJson(Map<String, dynamic> json) {
    return ScreeningResult(
      metrics: TokenMetrics.fromJson(json['metrics'] as Map<String, dynamic>? ?? {}),
      verdict: json['verdict'] as String? ?? '',
      score: json['score'] as int? ?? 0,
      flags: (json['flags'] as List<dynamic>?)?.cast<String>() ?? [],
      security: json['security'] as Map<String, dynamic>?,
    );
  }

  bool get isSafe => verdict == 'SAFE' || verdict == 'MODERATE';
  bool get isDangerous => verdict == 'DANGEROUS';
}

class ChatMessage {
  final String text;
  final bool isUser;
  final List<ChatCard>? cards;
  final DateTime timestamp;

  const ChatMessage({
    required this.text,
    required this.isUser,
    this.cards,
    required this.timestamp,
  });

  factory ChatMessage.fromApiResponse(Map<String, dynamic> json) {
    final cards = (json['cards'] as List<dynamic>?)
        ?.map((c) => ChatCard.fromJson(c as Map<String, dynamic>))
        .toList();
    return ChatMessage(
      text: json['message'] as String? ?? '',
      isUser: false,
      cards: cards,
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
