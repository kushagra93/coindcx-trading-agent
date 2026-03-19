import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/api/models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> with TickerProviderStateMixin {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = false;
  int _messageCount = 0;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.6, end: 1.0).animate(CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut));
    _addWelcomeMessage();
  }

  void _addWelcomeMessage() {
    _messages.add(ChatMessage(
      text: '',
      isUser: false,
      timestamp: DateTime.now(),
      isWelcome: true,
    ));
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _isLoading) return;

    _messageCount++;
    _controller.clear();
    setState(() {
      _messages.add(ChatMessage(text: text, isUser: true, timestamp: DateTime.now()));
      _isLoading = true;
    });
    _scrollToBottom();

    try {
      final api = ref.read(apiClientProvider);
      final response = await api.post('/api/v1/chat', body: {'message': text});
      final reply = ChatMessage.fromApiResponse(response);
      setState(() => _messages.add(reply));
    } on ApiException catch (e) {
      setState(() => _messages.add(ChatMessage(
        text: 'Something went wrong (${e.statusCode}). Try again.',
        isUser: false, timestamp: DateTime.now(),
      )));
    } catch (e) {
      setState(() => _messages.add(ChatMessage(
        text: 'Network error. Make sure the backend is running.',
        isUser: false, timestamp: DateTime.now(),
      )));
    } finally {
      setState(() => _isLoading = false);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 28, height: 28,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF6366f1), Color(0xFF8b5cf6)]),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.auto_awesome, size: 16, color: Colors.white),
            ),
            const SizedBox(width: 8),
            Text('CereBRO 🧠', style: CoinDCXTypography.heading3.copyWith(
              color: colors.generalForegroundPrimary, fontSize: 16)),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.help_outline_rounded, color: colors.generalForegroundSecondary, size: 20),
            onPressed: () { _controller.text = 'help'; _sendMessage(); },
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(CoinDCXSpacing.md),
              itemCount: _messages.length + (_isLoading ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _messages.length) return _buildTypingIndicator(colors);
                final msg = _messages[index];
                if (msg.isWelcome) return _buildWelcomeCard(colors);
                return _buildMessageBubble(msg, colors);
              },
            ),
          ),
          _buildPersistentSuggestions(colors),
          _buildInputBar(colors),
        ],
      ),
    );
  }

  // ── Inline Welcome Card ──────────────────────────────────────────

  Widget _buildWelcomeCard(CoinDCXColorScheme colors) {
    return Container(
      margin: const EdgeInsets.only(bottom: CoinDCXSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Agent greeting
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colors.generalBackgroundBgL2,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
                bottomLeft: Radius.circular(4),
                bottomRight: Radius.circular(16),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 32, height: 32,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFF6366f1), Color(0xFF8b5cf6)]),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.auto_awesome, size: 18, color: Colors.white),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('CereBRO 🧠🔥', style: CoinDCXTypography.heading3.copyWith(
                            color: colors.generalForegroundPrimary, fontSize: 15)),
                          Text('ur fav crypto bestie · solana-pilled 💜', style: CoinDCXTypography.caption.copyWith(
                            color: colors.generalForegroundTertiary, fontSize: 10)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'yo! 🧠🔥 i can trade, analyze & discover tokens for you — just type what you want, no cap! let\'s get this bread 💰',
                  style: CoinDCXTypography.bodyMedium.copyWith(
                    color: colors.generalForegroundPrimary, fontSize: 13, height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Quick-start action grid
          _buildWelcomeSection(
            colors,
            icon: Icons.rocket_launch_rounded,
            gradient: const [Color(0xFF10b981), Color(0xFF059669)],
            title: 'Quick Start',
            actions: [
              _WelcomeAction('Buy SOL \$100', 'buy SOL \$100', Icons.shopping_cart_rounded),
              _WelcomeAction('What\'s trending?', 'trending', Icons.trending_up_rounded),
              _WelcomeAction('Screen a token', 'screen SOL', Icons.verified_user_rounded),
              _WelcomeAction('My portfolio', 'portfolio', Icons.account_balance_wallet_rounded),
            ],
          ),
          const SizedBox(height: 8),
          _buildWelcomeSection(
            colors,
            icon: Icons.auto_awesome_rounded,
            gradient: const [Color(0xFF7c3aed), Color(0xFF6d28d9)],
            title: 'Advanced',
            actions: [
              _WelcomeAction('RSI analysis', 'RSI SOL', Icons.candlestick_chart_rounded),
              _WelcomeAction('Smart rules', 'buy SOL when it drops 10%', Icons.rule_rounded),
              _WelcomeAction('Copy top traders', 'leaderboard', Icons.emoji_events_rounded),
              _WelcomeAction('New tokens', 'new tokens today', Icons.fiber_new_rounded),
            ],
          ),
          const SizedBox(height: 8),

          // Hint
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: colors.actionBackgroundPrimary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.15)),
            ),
            child: Row(
              children: [
                Icon(Icons.lightbulb_outline_rounded, size: 14, color: colors.actionBackgroundPrimary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '💡 pro tip: paste any Solana contract address to instantly screen it fr fr',
                    style: CoinDCXTypography.caption.copyWith(
                      color: colors.actionBackgroundPrimary.withValues(alpha: 0.8), fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWelcomeSection(CoinDCXColorScheme colors, {
    required IconData icon,
    required List<Color> gradient,
    required String title,
    required List<_WelcomeAction> actions,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: gradient[0].withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: gradient[0].withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 22, height: 22,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: gradient),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Icon(icon, size: 13, color: Colors.white),
              ),
              const SizedBox(width: 8),
              Text(title, style: CoinDCXTypography.heading3.copyWith(
                color: colors.generalForegroundPrimary, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: actions.map((a) => GestureDetector(
              onTap: () { _controller.text = a.command; _sendMessage(); },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  color: colors.generalBackgroundBgL2,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: gradient[0].withValues(alpha: 0.25)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(a.icon, size: 13, color: gradient[0]),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(a.label, style: CoinDCXTypography.bodyMedium.copyWith(
                        color: colors.generalForegroundPrimary, fontSize: 12, fontWeight: FontWeight.w500)),
                    ),
                  ],
                ),
              ),
            )).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg, CoinDCXColorScheme colors) {
    return Align(
      alignment: msg.isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.85),
        margin: const EdgeInsets.only(bottom: CoinDCXSpacing.sm),
        padding: const EdgeInsets.all(CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          color: msg.isUser ? colors.actionBackgroundPrimary : colors.generalBackgroundBgL2,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(CoinDCXSpacing.radiusMd),
            topRight: const Radius.circular(CoinDCXSpacing.radiusMd),
            bottomLeft: Radius.circular(msg.isUser ? CoinDCXSpacing.radiusMd : CoinDCXSpacing.xxxs),
            bottomRight: Radius.circular(msg.isUser ? CoinDCXSpacing.xxxs : CoinDCXSpacing.radiusMd),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildMarkdownText(
              msg.text,
              msg.isUser ? colors.actionForegroundPrimary : colors.generalForegroundPrimary,
            ),
            if (msg.cards != null && msg.cards!.isNotEmpty) ...[
              const SizedBox(height: CoinDCXSpacing.xs),
              ...msg.cards!.map((card) => _buildCard(card, colors)),
            ],
            if (!msg.isUser && msg.suggestions != null && msg.suggestions!.isNotEmpty) ...[
              const SizedBox(height: CoinDCXSpacing.xs),
              Wrap(
                spacing: CoinDCXSpacing.xxs,
                runSpacing: CoinDCXSpacing.xxs,
                children: msg.suggestions!.map((s) => GestureDetector(
                  onTap: () { _controller.text = s; _sendMessage(); },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs),
                    decoration: BoxDecoration(
                      color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                      border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.3)),
                    ),
                    child: Text(s, style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary)),
                  ),
                )).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCard(ChatCard card, CoinDCXColorScheme colors) {
    switch (card.type) {
      case 'trending': return _buildTrendingCard(card.data, colors);
      case 'screening': return _buildScreeningCard(card.data, colors);
      case 'token_price': return _buildTokenPriceCard(card.data, colors);
      case 'trade_preview': return _buildTradePreviewCard(card.data, colors);
      case 'trade_executed': return _buildTradeExecutedCard(card.data, colors);
      case 'portfolio': return _buildPortfolioCard(card.data, colors);
      case 'leaderboard': return _buildLeaderboardCard(card.data, colors);
      case 'copy_trade_config': return _buildCopyTradeConfigCard(card.data, colors);
      case 'copy_trade_manager': return _buildCopyTradeManagerCard(card.data, colors);
      case 'limit_orders': return _buildLimitOrdersCard(card.data, colors);
      case 'dca_plan': return _buildDCAPlanCard(card.data, colors);
      case 'price_alert': return _buildPriceAlertCard(card.data, colors);
      case 'ta_indicators': return _buildTAIndicatorsCard(card.data, colors);
      case 'conditional_rule': return _buildConditionalRuleCard(card.data, colors);
      case 'smart_discovery': return _buildSmartDiscoveryCard(card.data, colors);
      default: return const SizedBox.shrink();
    }
  }

  // ── Trending card ──────────────────────────────────────────────────

  Widget _buildTrendingCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final items = data['items'] as List<dynamic>? ?? [];
    if (items.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL3,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        children: items.take(8).map<Widget>((item) {
          final t = item as Map<String, dynamic>;
          final symbol = t['symbol'] as String? ?? '';
          final price = (t['price'] as num?)?.toDouble() ?? (t['priceUsd'] as num?)?.toDouble() ?? 0;
          final change = (t['priceChange24h'] as num?)?.toDouble() ?? 0;
          final chain = t['chain'] as String? ?? '';
          final imageUrl = t['imageUrl'] as String?;
          final mcap = (t['marketCap'] as num?)?.toDouble() ?? 0;
          final isPositive = change >= 0;

          return InkWell(
            onTap: () { _controller.text = 'screen $symbol'; _sendMessage(); },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xs),
              child: Row(
                children: [
                  _buildMiniIcon(symbol, imageUrl, colors),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(symbol, style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                        Text('${chain.toUpperCase()} · MCap ${_formatLargeNum(mcap)}',
                          style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                        if (t['address'] != null && (t['address'] as String).isNotEmpty)
                          GestureDetector(
                            onTap: () {
                              Clipboard.setData(ClipboardData(text: t['address'] as String));
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('$symbol address copied'), duration: const Duration(seconds: 1), behavior: SnackBarBehavior.floating),
                              );
                            },
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(_truncAddr(t['address'] as String), style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontSize: 8)),
                                const SizedBox(width: 2),
                                Icon(Icons.copy_rounded, size: 8, color: colors.actionBackgroundPrimary),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(_formatPrice(price), style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: isPositive
                              ? colors.positiveBackgroundPrimary.withValues(alpha: 0.12)
                              : colors.negativeBackgroundPrimary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${isPositive ? '+' : ''}${change.toStringAsFixed(1)}%',
                          style: CoinDCXTypography.caption.copyWith(
                            color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                            fontSize: 9, fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Screening card ─────────────────────────────────────────────────

  Widget _buildScreeningCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final token = data['token'] as Map<String, dynamic>? ?? data;
    final grade = data['grade'] as String? ?? '?';
    final passed = data['passed'] as bool? ?? false;
    final score = (data['aiConfidence'] as num?)?.toInt() ?? (data['score'] as num?)?.toInt() ?? 0;
    final reasons = (data['reasons'] as List<dynamic>?)?.cast<String>() ?? [];
    final warnings = (data['warnings'] as List<dynamic>?)?.cast<String>() ?? [];
    final allFlags = [...reasons, ...warnings];
    final symbol = token['symbol'] as String? ?? '';
    final imageUrl = token['imageUrl'] as String?;

    // Audit fields
    final audit = data['audit'] as Map<String, dynamic>?;
    final top10Pct = (audit?['top10HolderPct'] as num?)?.toDouble()
        ?? (token['top10HolderPct'] as num?)?.toDouble();
    final insiders = (audit?['insidersDetected'] as num?)?.toInt()
        ?? (token['insidersDetected'] as num?)?.toInt();
    final noMint = audit?['noMint'] as bool? ?? token['noMint'] as bool?;
    final noFreeze = audit?['noFreeze'] as bool? ?? token['noFreeze'] as bool?;
    final burnt = (audit?['burnt'] as num?)?.toInt();
    final lpLockedPct = (audit?['lpLockedPct'] as num?)?.toDouble()
        ?? (token['lpLockPct'] as num?)?.toDouble();
    final rugProb = (data['rugProbability'] as num?)?.toDouble();
    final holders = (token['holders'] as num?)?.toInt() ?? (audit?['totalHolders'] as num?)?.toInt();
    final mcap = (token['marketCap'] as num?)?.toDouble();
    final liquidity = (token['liquidity'] as num?)?.toDouble();

    final gradeColor = grade == 'A' || grade == 'B'
        ? colors.positiveBackgroundPrimary
        : grade == 'C'
            ? colors.alertBackgroundPrimary
            : colors.negativeBackgroundPrimary;

    // Helper for GMGN-style stat cell
    Widget auditCell(String label, String value, {Color? valueColor, bool? isBool}) {
      final col = valueColor ?? colors.generalForegroundPrimary;
      return Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: CoinDCXTypography.caption.copyWith(
              color: colors.generalForegroundTertiary, fontSize: 8, letterSpacing: 0.3)),
            const SizedBox(height: 1),
            Text(value, style: CoinDCXTypography.numberSm.copyWith(
              color: col, fontSize: 11, fontWeight: FontWeight.w700)),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL3,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: gradeColor.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: icon + grade + passed/failed + score
          Row(
            children: [
              _buildMiniIcon(symbol, imageUrl, colors),
              const SizedBox(width: CoinDCXSpacing.xs),
              Text(symbol, style: CoinDCXTypography.buttonSm.copyWith(
                color: colors.generalForegroundPrimary, fontWeight: FontWeight.w700)),
              const SizedBox(width: CoinDCXSpacing.xs),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: gradeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Text('Grade $grade', style: CoinDCXTypography.buttonSm.copyWith(color: gradeColor, fontSize: 11)),
              ),
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: passed ? colors.positiveBackgroundSecondary : colors.negativeBackgroundSecondary,
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Text(passed ? 'SAFE' : 'RISKY',
                  style: CoinDCXTypography.caption.copyWith(
                    color: passed ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                    fontWeight: FontWeight.w700, fontSize: 10)),
              ),
              const Spacer(),
              Text('$score/100', style: CoinDCXTypography.numberSm.copyWith(
                color: colors.generalForegroundSecondary, fontSize: 11)),
            ],
          ),

          // CA copy row
          if (token['address'] != null && (token['address'] as String).isNotEmpty) ...[
            const SizedBox(height: 4),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: token['address'] as String));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('$symbol address copied'), duration: const Duration(seconds: 1), behavior: SnackBarBehavior.floating),
                );
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('CA: ${_truncAddr(token['address'] as String)}',
                    style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontSize: 10)),
                  const SizedBox(width: 4),
                  Icon(Icons.copy_rounded, size: 10, color: colors.actionBackgroundPrimary),
                ],
              ),
            ),
          ],

          // GMGN-style audit grid
          if (top10Pct != null || insiders != null || noMint != null || burnt != null || rugProb != null || holders != null) ...[
            const SizedBox(height: CoinDCXSpacing.xs),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: colors.generalBackgroundBgL1,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Column(
                children: [
                  // Row 1: Top 10, Holders, Insiders, Rug %
                  Row(
                    children: [
                      if (top10Pct != null)
                        auditCell('Top 10',
                          '${top10Pct.toStringAsFixed(1)}%',
                          valueColor: top10Pct > 30
                            ? colors.negativeBackgroundPrimary
                            : top10Pct > 20
                              ? colors.alertBackgroundPrimary
                              : colors.positiveBackgroundPrimary),
                      if (holders != null)
                        auditCell('Holders', _formatLargeNum(holders.toDouble()).replaceAll('\$', ''),
                          valueColor: colors.generalForegroundPrimary),
                      if (insiders != null)
                        auditCell('Insiders',
                          insiders == 0 ? '0%' : '$insiders',
                          valueColor: insiders == 0
                            ? colors.positiveBackgroundPrimary
                            : colors.negativeBackgroundPrimary),
                      if (rugProb != null)
                        auditCell('Rug %',
                          '${(rugProb * 100).toStringAsFixed(0)}%',
                          valueColor: rugProb < 0.3
                            ? colors.positiveBackgroundPrimary
                            : rugProb < 0.6
                              ? colors.alertBackgroundPrimary
                              : colors.negativeBackgroundPrimary),
                    ],
                  ),
                  if (noMint != null || noFreeze != null || burnt != null || lpLockedPct != null || mcap != null || liquidity != null) ...[
                    const SizedBox(height: 8),
                    // Row 2: NoMint, NoFreeze/Blacklist, Burnt, LP Locked
                    Row(
                      children: [
                        if (noMint != null)
                          auditCell('NoMint',
                            noMint! ? '✓ YES' : '✗ NO',
                            valueColor: noMint!
                              ? colors.positiveBackgroundPrimary
                              : colors.negativeBackgroundPrimary),
                        if (noFreeze != null)
                          auditCell('NoFreeze',
                            noFreeze! ? '✓ YES' : '✗ NO',
                            valueColor: noFreeze!
                              ? colors.positiveBackgroundPrimary
                              : colors.negativeBackgroundPrimary),
                        if (burnt != null)
                          auditCell('Burnt',
                            '🔥 $burnt%',
                            valueColor: burnt! >= 80
                              ? colors.positiveBackgroundPrimary
                              : colors.alertBackgroundPrimary),
                        if (lpLockedPct != null)
                          auditCell('LP Lock',
                            '${lpLockedPct.toStringAsFixed(0)}%',
                            valueColor: lpLockedPct >= 80
                              ? colors.positiveBackgroundPrimary
                              : lpLockedPct > 0
                                ? colors.alertBackgroundPrimary
                                : colors.negativeBackgroundPrimary),
                      ],
                    ),
                  ],
                  if (mcap != null || liquidity != null) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (mcap != null)
                          auditCell('Market Cap', _formatLargeNum(mcap),
                            valueColor: colors.generalForegroundPrimary),
                        if (liquidity != null)
                          auditCell('Liquidity', _formatLargeNum(liquidity),
                            valueColor: liquidity >= 50000
                              ? colors.positiveBackgroundPrimary
                              : liquidity >= 10000
                                ? colors.alertBackgroundPrimary
                                : colors.negativeBackgroundPrimary),
                        const Expanded(child: SizedBox()),
                        const Expanded(child: SizedBox()),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],

          // Flags / warnings
          if (allFlags.isNotEmpty) ...[
            const SizedBox(height: CoinDCXSpacing.xs),
            ...allFlags.take(5).map((r) {
              final isReason = reasons.contains(r);
              return Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(isReason ? Icons.warning_amber_rounded : Icons.info_outline_rounded,
                      size: 12, color: isReason ? colors.negativeBackgroundPrimary : colors.alertBackgroundPrimary),
                    const SizedBox(width: CoinDCXSpacing.xxs),
                    Expanded(child: Text(r,
                      style: CoinDCXTypography.caption.copyWith(
                        color: colors.generalForegroundSecondary, fontSize: 10))),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  // ── Token price card ───────────────────────────────────────────────

  Widget _buildTokenPriceCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final symbol = data['symbol'] as String? ?? '';
    final price = (data['price'] as num?)?.toDouble() ?? (data['priceUsd'] as num?)?.toDouble() ?? 0;
    final change = (data['priceChange24h'] as num?)?.toDouble() ?? 0;
    final volume = (data['volume24h'] as num?)?.toDouble() ?? 0;
    final mcap = (data['marketCap'] as num?)?.toDouble() ?? 0;
    final imageUrl = data['imageUrl'] as String?;
    final isPositive = change >= 0;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL3,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _buildMiniIcon(symbol, imageUrl, colors),
              const SizedBox(width: CoinDCXSpacing.xs),
              Text(symbol, style: CoinDCXTypography.buttonMd.copyWith(color: colors.generalForegroundPrimary)),
              const Spacer(),
              Text(_formatPrice(price), style: CoinDCXTypography.numberMd.copyWith(color: colors.generalForegroundPrimary)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xxs),
          Row(
            children: [
              _statChip('24h', '${isPositive ? '+' : ''}${change.toStringAsFixed(1)}%',
                  isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary, colors),
              const SizedBox(width: CoinDCXSpacing.xs),
              _statChip('Vol', _formatLargeNum(volume), colors.generalForegroundSecondary, colors),
              const SizedBox(width: CoinDCXSpacing.xs),
              _statChip('MCap', _formatLargeNum(mcap), colors.generalForegroundSecondary, colors),
            ],
          ),
        ],
      ),
    );
  }

  // ── Trade preview card ─────────────────────────────────────────────

  Widget _buildTradePreviewCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final symbol = data['symbol'] as String? ?? '';
    final amount = (data['amount'] as num?)?.toDouble() ?? 0;
    final price = (data['price'] as num?)?.toDouble() ?? 0;
    final chain = data['chain'] as String? ?? '';

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.actionBackgroundPrimary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Trade Preview', style: CoinDCXTypography.buttonSm.copyWith(color: colors.actionBackgroundPrimary)),
          const SizedBox(height: CoinDCXSpacing.xs),
          _kvRow('Token', symbol, colors),
          _kvRow('Amount', '\$${amount.toStringAsFixed(2)}', colors),
          _kvRow('Price', _formatPrice(price), colors),
          _kvRow('Chain', chain, colors),
          const SizedBox(height: CoinDCXSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () { _controller.text = 'confirm buy $symbol \$${amount.toStringAsFixed(2)}'; _sendMessage(); },
              style: ElevatedButton.styleFrom(backgroundColor: colors.positiveBackgroundPrimary, minimumSize: const Size(double.infinity, 40)),
              child: Text('Confirm Buy', style: CoinDCXTypography.buttonMd.copyWith(color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  // ── Trade executed card ────────────────────────────────────────────

  Widget _buildTradeExecutedCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final symbol = data['symbol'] as String? ?? '';
    final quantity = (data['quantity'] as num?)?.toDouble() ?? 0;
    final price = (data['price'] as num?)?.toDouble() ?? 0;
    final status = data['status'] as String? ?? '';
    final chain = data['chain'] as String? ?? '';
    final txUrl = data['txUrl'] as String?;
    final txHash = data['txHash'] as String?;
    final isOnChain = status == 'executed' && (txUrl != null || txHash != null);

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.positiveBackgroundSecondary,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: colors.positiveBackgroundPrimary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.check_circle_rounded, size: 16, color: colors.positiveBackgroundPrimary),
              const SizedBox(width: CoinDCXSpacing.xxs),
              Text(isOnChain ? 'On-Chain Trade' : 'Trade Executed',
                style: CoinDCXTypography.buttonSm.copyWith(color: colors.positiveBackgroundPrimary)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs, vertical: 2),
                decoration: BoxDecoration(
                  color: colors.positiveBackgroundPrimary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Text(status.toUpperCase(), style: CoinDCXTypography.caption.copyWith(color: colors.positiveBackgroundPrimary, fontSize: 9)),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xs),
          _kvRow('Token', symbol, colors),
          _kvRow('Quantity', quantity.toStringAsFixed(6), colors),
          _kvRow('Price', _formatPrice(price), colors),
          _kvRow('Chain', chain, colors),
          if (isOnChain) ...[
            const SizedBox(height: CoinDCXSpacing.xs),
            GestureDetector(
              onTap: () {
                final url = txUrl ?? 'https://solscan.io/tx/$txHash';
                Clipboard.setData(ClipboardData(text: url));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Solscan URL copied!'), duration: const Duration(seconds: 2)),
                );
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs),
                decoration: BoxDecoration(
                  color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                  border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.open_in_new_rounded, size: 12, color: colors.actionBackgroundPrimary),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'View on Solscan',
                        style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontWeight: FontWeight.w600),
                      ),
                    ),
                    Text(
                      txHash != null ? '${txHash!.substring(0, 8)}...' : '',
                      style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary.withValues(alpha: 0.6), fontSize: 9),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── Portfolio card ─────────────────────────────────────────────────

  Widget _buildPortfolioCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final positions = data['positions'] as List<dynamic>? ?? [];
    final history = data['history'] as List<dynamic>? ?? [];
    final totalInvested = (data['totalInvested'] as num?)?.toDouble() ?? 0;
    final totalSold = (data['totalSold'] as num?)?.toDouble() ?? 0;
    final holdings = positions.where((p) => (p as Map<String, dynamic>)['side'] == 'buy').toList();
    final netValue = totalInvested - totalSold;
    final wallet = data['wallet'] as Map<String, dynamic>?;
    final walletTokens = wallet?['tokens'] as List<dynamic>? ?? [];
    final totalWalletUsd = (wallet?['totalValueUsd'] as num?)?.toDouble() ?? 0;
    final solUsd = (wallet?['solUsd'] as num?)?.toDouble() ?? 0;
    final solBal = (wallet?['sol'] as num?)?.toDouble() ?? 0;
    final onChainHistory = data['onChainHistory'] as List<dynamic>? ?? [];

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL3,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(Icons.account_balance_wallet_rounded, size: 16, color: colors.actionBackgroundPrimary),
              const SizedBox(width: 4),
              Text('Portfolio', style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary)),
              const Spacer(),
              Text('${history.length} trades', style: CoinDCXTypography.caption.copyWith(
                color: colors.generalForegroundTertiary, fontSize: 9)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xs),

          // Summary stats — show wallet value if available, else session stats
          Container(
            padding: const EdgeInsets.all(CoinDCXSpacing.xs),
            decoration: BoxDecoration(
              color: colors.generalBackgroundBgL2,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
            ),
            child: wallet != null
              ? Row(
                  children: [
                    Expanded(child: _portfolioStat('Wallet', '\$${totalWalletUsd.toStringAsFixed(2)}', colors.actionBackgroundPrimary, colors)),
                    Container(width: 1, height: 24, color: colors.generalStrokeL1),
                    Expanded(child: _portfolioStat('SOL', '${solBal.toStringAsFixed(4)}', colors.generalForegroundPrimary, colors)),
                    Container(width: 1, height: 24, color: colors.generalStrokeL1),
                    Expanded(child: _portfolioStat('Tokens', '${walletTokens.length}', colors.generalForegroundSecondary, colors)),
                  ],
                )
              : Row(
                  children: [
                    Expanded(child: _portfolioStat('Invested', _formatLargeNum(totalInvested), colors.generalForegroundPrimary, colors)),
                    Container(width: 1, height: 24, color: colors.generalStrokeL1),
                    Expanded(child: _portfolioStat('Sold', _formatLargeNum(totalSold), colors.generalForegroundSecondary, colors)),
                    Container(width: 1, height: 24, color: colors.generalStrokeL1),
                    Expanded(child: _portfolioStat('Net', _formatLargeNum(netValue), colors.actionBackgroundPrimary, colors)),
                  ],
                ),
          ),

          // On-chain wallet tokens
          if (wallet != null) ...[
            const SizedBox(height: CoinDCXSpacing.sm),
            Row(
              children: [
                Text('WALLET HOLDINGS', style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1)),
                const Spacer(),
                Text('SOL \$${solUsd.toStringAsFixed(2)}', style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary, fontSize: 9)),
              ],
            ),
            const SizedBox(height: 4),
            ...walletTokens.take(10).map((t) {
              final tok = t as Map<String, dynamic>;
              final symbol = tok['symbol'] as String? ?? '';
              // Always use full mint for sell commands — symbol may be truncated/wrong
              final mint = tok['mint'] as String? ?? symbol;
              final uiAmount = (tok['uiAmount'] as num?)?.toDouble() ?? 0;
              final valueUsd = (tok['valueUsd'] as num?)?.toDouble() ?? 0;
              final priceUsd = (tok['priceUsd'] as num?)?.toDouble() ?? 0;
              return Container(
                margin: const EdgeInsets.only(bottom: 4),
                padding: const EdgeInsets.all(CoinDCXSpacing.xs),
                decoration: BoxDecoration(
                  color: colors.generalBackgroundBgL2,
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(symbol, style: CoinDCXTypography.buttonSm.copyWith(
                                color: colors.generalForegroundPrimary, fontSize: 13)),
                              Text(_formatLargeNum(uiAmount),
                                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                            ],
                          ),
                        ),
                        Text(valueUsd > 0 ? '\$${valueUsd.toStringAsFixed(2)}' : priceUsd > 0 ? '\$${priceUsd.toStringAsFixed(6)}' : '—',
                          style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [25, 50, 100].map((pct) => Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(right: pct < 100 ? 4 : 0),
                          child: GestureDetector(
                            onTap: () { _controller.text = 'sell $pct% $mint'; _sendMessage(); },
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 5),
                              decoration: BoxDecoration(
                                color: colors.negativeBackgroundPrimary.withValues(alpha: pct == 100 ? 0.25 : 0.12),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: colors.negativeBackgroundPrimary.withValues(alpha: 0.3)),
                              ),
                              alignment: Alignment.center,
                              child: Text('$pct%', style: CoinDCXTypography.caption.copyWith(
                                color: colors.negativeBackgroundPrimary, fontSize: 10, fontWeight: FontWeight.w700)),
                            ),
                          ),
                        ),
                      )).toList(),
                    ),
                  ],
                ),
              );
            }),
          ],

          // Session holdings (if any this session)
          if (holdings.isNotEmpty) ...[
            const SizedBox(height: CoinDCXSpacing.sm),
            Text('SESSION TRADES', style: CoinDCXTypography.caption.copyWith(
              color: colors.generalForegroundTertiary, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1)),
            const SizedBox(height: 4),
            ...holdings.take(5).map((p) {
              final pos = p as Map<String, dynamic>;
              final symbol = pos['symbol'] as String? ?? '';
              final amount = (pos['amount'] as num?)?.toDouble() ?? 0;
              final avgPrice = (pos['price'] as num?)?.toDouble() ?? 0;
              final costBasis = (pos['costBasis'] as num?)?.toDouble() ?? 0;
              return Container(
                margin: const EdgeInsets.only(bottom: 4),
                padding: const EdgeInsets.all(CoinDCXSpacing.xs),
                decoration: BoxDecoration(
                  color: colors.generalBackgroundBgL2,
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                ),
                child: Row(
                  children: [
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(symbol, style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 13)),
                        Text('${amount.toStringAsFixed(4)} @ ${_formatPrice(avgPrice)}',
                          style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                      ],
                    )),
                    Text('\$${costBasis.toStringAsFixed(2)}',
                      style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                  ],
                ),
              );
            }),
          ],

          if (wallet == null && holdings.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: CoinDCXSpacing.xs),
              child: Text('No active holdings', style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary)),
            ),

          // On-chain transaction history
          if (onChainHistory.isNotEmpty) ...[
            const SizedBox(height: CoinDCXSpacing.sm),
            Row(
              children: [
                Text('ON-CHAIN HISTORY', style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1)),
                const Spacer(),
                Text('latest ${onChainHistory.take(20).length}', style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary, fontSize: 9)),
              ],
            ),
            const SizedBox(height: 4),
            ...onChainHistory.take(20).map((tx) {
              final t = tx as Map<String, dynamic>;
              final side = t['side'] as String? ?? 'unknown';
              final symbol = t['tokenSymbol'] as String? ?? '?';
              final amtUsd = (t['amountUsd'] as num?)?.toDouble() ?? 0;
              final amtToken = (t['amountToken'] as num?)?.toDouble() ?? 0;
              final tsMs = (t['timestamp'] as num?)?.toInt() ?? 0;
              final txUrl = t['txUrl'] as String? ?? '';
              final isBuy = side == 'buy';
              final sideColor = isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary;
              final dt = tsMs > 0 ? DateTime.fromMillisecondsSinceEpoch(tsMs) : null;
              final dateStr = dt != null ? '${dt.day}/${dt.month} ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}' : '';
              return GestureDetector(
                        onTap: () {
                          // Use tokenMint if available so the backend can match exactly
                          final txMint = t['tokenMint'] as String?;
                          if (txUrl.isNotEmpty && txMint != null && txMint.isNotEmpty) {
                            _controller.text = 'sell 50% $txMint';
                          } else if (txUrl.isNotEmpty) {
                            _controller.text = 'sell 50% $symbol';
                          }
                          _sendMessage();
                        },
                child: Container(
                  margin: const EdgeInsets.only(bottom: 3),
                  padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs, vertical: 5),
                  decoration: BoxDecoration(
                    color: colors.generalBackgroundBgL2,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                    border: Border.all(color: sideColor.withValues(alpha: 0.15)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          color: sideColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(side.toUpperCase(), style: CoinDCXTypography.caption.copyWith(
                          color: sideColor, fontSize: 8, fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(symbol, style: CoinDCXTypography.buttonSm.copyWith(
                          color: colors.generalForegroundPrimary, fontSize: 12)),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(amtUsd > 0 ? '\$${amtUsd.toStringAsFixed(2)}' : _formatLargeNum(amtToken),
                            style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 11)),
                          if (dateStr.isNotEmpty)
                            Text(dateStr, style: CoinDCXTypography.caption.copyWith(
                              color: colors.generalForegroundTertiary, fontSize: 8)),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],

          // Transaction history
          if (history.isNotEmpty) ...[
            const SizedBox(height: CoinDCXSpacing.sm),
            Row(
              children: [
                Text('TRANSACTION HISTORY', style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1)),
                const Spacer(),
                Text('latest ${history.length > 10 ? 10 : history.length} of ${history.length}', style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary, fontSize: 8)),
              ],
            ),
            const SizedBox(height: 4),
            ...history.take(10).map((t) {
              final tx = t as Map<String, dynamic>;
              final symbol = tx['symbol'] as String? ?? '';
              final side = tx['side'] as String? ?? '';
              final amountUsd = (tx['amountUsd'] as num?)?.toDouble() ?? 0;
              final price = (tx['price'] as num?)?.toDouble() ?? 0;
              final quantity = (tx['quantity'] as num?)?.toDouble() ?? 0;
              final timestamp = (tx['timestamp'] as num?)?.toInt() ?? 0;
              final isBuy = side == 'buy';
              final time = DateTime.fromMillisecondsSinceEpoch(timestamp);
              final timeStr = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
              final dateStr = '${time.day}/${time.month}';

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    Container(
                      width: 18, height: 18,
                      decoration: BoxDecoration(
                        color: isBuy
                          ? colors.positiveBackgroundPrimary.withValues(alpha: 0.12)
                          : colors.negativeBackgroundPrimary.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Icon(
                        isBuy ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
                        size: 11,
                        color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${side.toUpperCase()} $symbol',
                            style: CoinDCXTypography.caption.copyWith(
                              color: isBuy ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                              fontSize: 10, fontWeight: FontWeight.w600)),
                          Text('${quantity.toStringAsFixed(4)} @ ${_formatPrice(price)}',
                            style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 8)),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('\$${amountUsd.toStringAsFixed(2)}',
                          style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 10)),
                        Text('$dateStr $timeStr',
                          style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 8)),
                      ],
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _portfolioStat(String label, String value, Color valueColor, CoinDCXColorScheme colors) {
    return Column(
      children: [
        Text(label, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
        const SizedBox(height: 2),
        Text(value, style: CoinDCXTypography.numberSm.copyWith(color: valueColor, fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }

  // ── Leaderboard card ───────────────────────────────────────────────

  Widget _buildLeaderboardCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final traders = (data['traders'] as List<dynamic>?) ?? [];
    final title = data['title'] as String? ?? 'Top Solana Traders (7d)';
    final isKol = title.toLowerCase().contains('kol');

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL3,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: (isKol ? Colors.purple : colors.actionBackgroundPrimary).withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(isKol ? Icons.star_rounded : Icons.emoji_events_rounded, size: 16, color: isKol ? Colors.purple : Colors.amber),
              const SizedBox(width: 4),
              Expanded(child: Text(title, style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary))),
              Text('via GMGN', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          // Column headers
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                SizedBox(width: 22, child: Text('#', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9))),
                Expanded(child: Text('Wallet', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9))),
                SizedBox(width: 70, child: Text('PnL 7d', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9), textAlign: TextAlign.right)),
                SizedBox(width: 40, child: Text('Win%', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9), textAlign: TextAlign.right)),
                const SizedBox(width: 50),
              ],
            ),
          ),
          ...traders.take(10).map((t) {
            final trader = t as Map<String, dynamic>;
            final rank = trader['rank'] as int? ?? 0;
            final addr = trader['walletAddress'] as String? ?? '';
            final name = trader['name'] as String? ?? '';
            final twitter = trader['twitterUsername'] as String? ?? '';
            final pnl = (trader['pnl7d'] as num?)?.toDouble() ?? 0;
            final wr = (trader['winRate7d'] as num?)?.toDouble() ?? 0;
            final tags = (trader['tags'] as List<dynamic>?)?.cast<String>() ?? [];
            final shortAddr = addr.length > 10 ? '${addr.substring(0, 4)}...${addr.substring(addr.length - 4)}' : addr;
            final displayName = name.isNotEmpty ? name : shortAddr;
            final hasTwitter = twitter.isNotEmpty;
            final isTop3 = rank <= 3;

            return InkWell(
              onTap: () { _controller.text = 'copy trade $shortAddr'; _sendMessage(); },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    SizedBox(
                      width: 22,
                      child: Text(
                        isTop3 ? ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'][rank] : '$rank',
                        style: CoinDCXTypography.buttonSm.copyWith(
                          color: isTop3 ? Colors.amber : colors.generalForegroundSecondary,
                          fontSize: isTop3 ? 14 : 11,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(displayName, style: CoinDCXTypography.buttonSm.copyWith(
                            color: colors.generalForegroundPrimary, fontSize: 11), overflow: TextOverflow.ellipsis),
                          Row(
                            children: [
                              if (hasTwitter) ...[
                                Text('@$twitter', style: CoinDCXTypography.caption.copyWith(
                                  color: const Color(0xFF1DA1F2), fontSize: 8)),
                                const SizedBox(width: 4),
                              ],
                              if (tags.isNotEmpty)
                                Text(tags.where((t) => t == 'kol' || t == 'smart_degen' || t == 'top_followed').join(' · '),
                                  style: CoinDCXTypography.caption.copyWith(
                                    color: colors.actionBackgroundPrimary, fontSize: 8)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: 70,
                      child: Text(
                        '\$${_formatLargeNum(pnl)}',
                        style: CoinDCXTypography.numberSm.copyWith(
                          color: pnl >= 0 ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                          fontSize: 11, fontWeight: FontWeight.w600),
                        textAlign: TextAlign.right,
                      ),
                    ),
                    SizedBox(
                      width: 40,
                      child: Text(
                        '${(wr * 100).toStringAsFixed(0)}%',
                        style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundSecondary, fontSize: 11),
                        textAlign: TextAlign.right,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: (isKol ? Colors.purple : colors.actionBackgroundPrimary).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(isKol ? 'FOLLOW' : 'COPY', style: CoinDCXTypography.caption.copyWith(
                        color: isKol ? Colors.purple : colors.actionBackgroundPrimary, fontSize: 8, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  // ── Copy Trade Config card (triggers modal) ───────────────────────

  Widget _buildCopyTradeConfigCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final walletAddress = data['walletAddress'] as String? ?? '';
    final walletName = data['walletName'] as String? ?? '';
    final defaults = data['defaults'] as Map<String, dynamic>? ?? {};

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [colors.actionBackgroundPrimary.withValues(alpha: 0.08), colors.generalBackgroundBgL3],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.content_copy_rounded, size: 16, color: colors.actionBackgroundPrimary),
              const SizedBox(width: 4),
              Text('Copy Trade Setup', style: CoinDCXTypography.buttonSm.copyWith(color: colors.actionBackgroundPrimary)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xs),
          Row(
            children: [
              _buildMiniIconFallback(walletName, colors, 32),
              const SizedBox(width: CoinDCXSpacing.xs),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(walletName, style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary)),
                    Text(walletAddress.length > 12
                      ? '${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}'
                      : walletAddress,
                      style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _showCopyTradeModal(walletAddress, walletName, defaults),
              icon: const Icon(Icons.tune_rounded, size: 16),
              label: Text('Configure Copy Trade', style: CoinDCXTypography.buttonSm.copyWith(color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: colors.actionBackgroundPrimary,
                minimumSize: const Size(double.infinity, 42),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showCopyTradeModal(String walletAddress, String walletName, Map<String, dynamic> defaults) {
    String buyMode = defaults['buyMode'] as String? ?? 'fixed_buy';
    double buyAmount = (defaults['buyAmount'] as num?)?.toDouble() ?? 50;
    String sellMethod = defaults['sellMethod'] as String? ?? 'mirror_sell';
    final amountController = TextEditingController(text: buyAmount.toStringAsFixed(2));
    final colors = CoinDCXTheme.of(context);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          padding: EdgeInsets.only(
            left: CoinDCXSpacing.md, right: CoinDCXSpacing.md,
            top: CoinDCXSpacing.md, bottom: MediaQuery.of(ctx).viewInsets.bottom + CoinDCXSpacing.lg,
          ),
          decoration: BoxDecoration(
            color: colors.generalBackgroundBgL2,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(width: 40, height: 4,
                  decoration: BoxDecoration(color: colors.generalStrokeL1, borderRadius: BorderRadius.circular(2))),
              ),
              const SizedBox(height: CoinDCXSpacing.md),
              Row(
                children: [
                  Icon(Icons.content_copy_rounded, size: 20, color: colors.actionBackgroundPrimary),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  Expanded(
                    child: Text('Copy Trade: $walletName',
                      style: CoinDCXTypography.heading3.copyWith(color: colors.generalForegroundPrimary, fontSize: 16)),
                  ),
                ],
              ),
              const SizedBox(height: CoinDCXSpacing.md),

              // Buy Mode
              Text('Buy Mode', style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundSecondary)),
              const SizedBox(height: CoinDCXSpacing.xs),
              Row(
                children: [
                  _modeChip('Fixed Buy', 'fixed_buy', buyMode, colors, (v) => setModalState(() => buyMode = v)),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  _modeChip('Max Buy', 'max_buy', buyMode, colors, (v) => setModalState(() => buyMode = v)),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  _modeChip('Ratio', 'fixed_ratio', buyMode, colors, (v) => setModalState(() => buyMode = v)),
                ],
              ),
              const SizedBox(height: CoinDCXSpacing.sm),

              // Buy Amount
              Text(
                buyMode == 'fixed_ratio' ? 'Copy Ratio (0.0 - 1.0)' : 'Amount (USD)',
                style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundSecondary),
              ),
              const SizedBox(height: CoinDCXSpacing.xs),
              TextField(
                controller: amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: CoinDCXTypography.numberMd.copyWith(color: colors.generalForegroundPrimary),
                decoration: InputDecoration(
                  prefixText: buyMode == 'fixed_ratio' ? '' : '\$ ',
                  prefixStyle: CoinDCXTypography.numberMd.copyWith(color: colors.generalForegroundTertiary),
                  filled: true,
                  fillColor: colors.generalBackgroundBgL3,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                    borderSide: BorderSide(color: colors.generalStrokeL1),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.sm),
                ),
                onChanged: (v) => buyAmount = double.tryParse(v) ?? buyAmount,
              ),
              const SizedBox(height: CoinDCXSpacing.sm),

              // Sell Method
              Text('Sell Method', style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundSecondary)),
              const SizedBox(height: CoinDCXSpacing.xs),
              Row(
                children: [
                  _modeChip('Mirror Sells', 'mirror_sell', sellMethod, colors, (v) => setModalState(() => sellMethod = v)),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  _modeChip('Manual Only', 'manual', sellMethod, colors, (v) => setModalState(() => sellMethod = v)),
                ],
              ),
              const SizedBox(height: CoinDCXSpacing.sm),

              // Info box
              Container(
                padding: const EdgeInsets.all(CoinDCXSpacing.sm),
                decoration: BoxDecoration(
                  color: colors.negativeBackgroundPrimary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                  border: Border.all(color: colors.negativeBackgroundPrimary.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, size: 14, color: colors.negativeBackgroundPrimary),
                    const SizedBox(width: CoinDCXSpacing.xs),
                    Expanded(child: Text('Live mode: copy trades execute real on-chain swaps using your wallet. Max \$500 per trade.',
                      style: CoinDCXTypography.caption.copyWith(color: colors.negativeBackgroundPrimary, fontSize: 10))),
                  ],
                ),
              ),
              const SizedBox(height: CoinDCXSpacing.md),

              // Confirm button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.of(ctx).pop();
                    await _confirmCopyTrade(walletAddress, walletName, buyMode, double.tryParse(amountController.text) ?? buyAmount, sellMethod);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.positiveBackgroundPrimary,
                    minimumSize: const Size(double.infinity, 48),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm)),
                  ),
                  child: Text('Start Copy Trading', style: CoinDCXTypography.buttonMd.copyWith(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _modeChip(String label, String value, String selected, CoinDCXColorScheme colors, ValueChanged<String> onTap) {
    final isSelected = value == selected;
    return Expanded(
      child: GestureDetector(
        onTap: () => onTap(value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: CoinDCXSpacing.xs),
          decoration: BoxDecoration(
            color: isSelected ? colors.actionBackgroundPrimary : colors.generalBackgroundBgL3,
            borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
            border: Border.all(color: isSelected ? colors.actionBackgroundPrimary : colors.generalStrokeL1),
          ),
          child: Center(child: Text(label, style: CoinDCXTypography.buttonSm.copyWith(
            color: isSelected ? Colors.white : colors.generalForegroundSecondary, fontSize: 11))),
        ),
      ),
    );
  }

  Future<void> _confirmCopyTrade(String walletAddress, String walletName, String buyMode, double buyAmount, String sellMethod) async {
    setState(() => _isLoading = true);
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.post('/api/v1/chat/copy-confirm', body: {
        'walletAddress': walletAddress,
        'walletName': walletName,
        'buyMode': buyMode,
        'buyAmount': buyAmount,
        'sellMethod': sellMethod,
      });
      final reply = ChatMessage.fromApiResponse(response);
      setState(() => _messages.add(reply));
    } catch (e) {
      setState(() => _messages.add(ChatMessage(
        text: 'Failed to start copy trading. Try again.',
        isUser: false, timestamp: DateTime.now(),
      )));
    } finally {
      setState(() => _isLoading = false);
      _scrollToBottom();
    }
  }

  // ── Copy Trade Manager card ──────────────────────────────────────

  Widget _buildCopyTradeManagerCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final configs = (data['configs'] as List<dynamic>?) ?? [];
    final activities = (data['recentActivity'] as List<dynamic>?) ?? [];

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL3,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.content_copy_rounded, size: 16, color: colors.actionBackgroundPrimary),
              const SizedBox(width: 4),
              Text('My Copy Trades', style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary)),
              const Spacer(),
              Text('${configs.length} active', style: CoinDCXTypography.caption.copyWith(
                color: colors.actionBackgroundPrimary, fontSize: 10)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),

          // Active configs
          ...configs.map((c) {
            final config = c as Map<String, dynamic>;
            final addr = config['walletAddress'] as String? ?? '';
            final name = config['walletName'] as String? ?? '';
            final enabled = config['enabled'] as bool? ?? true;
            final buyMode = config['buyMode'] as String? ?? '';
            final buyAmt = (config['buyAmount'] as num?)?.toDouble() ?? 0;
            final sellMeth = config['sellMethod'] as String? ?? '';
            final copied = (config['totalCopied'] as num?)?.toDouble() ?? 0;
            final shortAddr = addr.length > 10 ? '${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}' : addr;

            return Container(
              margin: const EdgeInsets.only(bottom: CoinDCXSpacing.xs),
              padding: const EdgeInsets.all(CoinDCXSpacing.xs),
              decoration: BoxDecoration(
                color: colors.generalBackgroundBgL2,
                borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                border: Border.all(color: enabled
                  ? colors.positiveBackgroundPrimary.withValues(alpha: 0.2)
                  : colors.generalStrokeL1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 8, height: 8,
                        decoration: BoxDecoration(
                          color: enabled ? colors.positiveBackgroundPrimary : colors.generalForegroundTertiary,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(name.isNotEmpty ? name : shortAddr,
                          style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                      ),
                      // Pause/Resume toggle
                      GestureDetector(
                        onTap: () {
                          final cmd = enabled ? 'pause' : 'resume';
                          _controller.text = '$cmd copy $addr';
                          _sendMessage();
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: (enabled ? colors.alertBackgroundPrimary : colors.positiveBackgroundPrimary).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(enabled ? 'PAUSE' : 'RESUME',
                            style: CoinDCXTypography.caption.copyWith(
                              color: enabled ? colors.alertBackgroundPrimary : colors.positiveBackgroundPrimary,
                              fontSize: 9, fontWeight: FontWeight.w600)),
                        ),
                      ),
                      const SizedBox(width: 4),
                      // Stop button
                      GestureDetector(
                        onTap: () { _controller.text = 'stop copy $addr'; _sendMessage(); },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: colors.negativeBackgroundPrimary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text('STOP', style: CoinDCXTypography.caption.copyWith(
                            color: colors.negativeBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text('$buyMode · \$${buyAmt.toStringAsFixed(2)} · $sellMeth',
                        style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                      const Spacer(),
                      Text('Copied: \$${copied.toStringAsFixed(2)}',
                        style: CoinDCXTypography.caption.copyWith(
                          color: colors.positiveBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
              ),
            );
          }),

          // Recent activity feed
          if (activities.isNotEmpty) ...[
            const SizedBox(height: CoinDCXSpacing.xs),
            Text('Recent Activity', style: CoinDCXTypography.caption.copyWith(
              color: colors.generalForegroundTertiary, fontSize: 10, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            ...activities.take(5).map((a) {
              final act = a as Map<String, dynamic>;
              final token = act['tokenSymbol'] as String? ?? '';
              final side = act['side'] as String? ?? '';
              final amount = (act['copyAmountUsd'] as num?)?.toDouble() ?? 0;
              final status = act['status'] as String? ?? '';
              final skipReason = act['skipReason'] as String? ?? '';
              final txUrl = act['txUrl'] as String?;
              final isSkipped = status == 'skipped';
              final isExecuted = status == 'executed';

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isSkipped ? Icons.block_rounded
                            : isExecuted ? Icons.check_circle_rounded
                            : (side == 'buy' ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded),
                          size: 10,
                          color: isSkipped
                            ? colors.generalForegroundTertiary
                            : isExecuted
                              ? colors.positiveBackgroundPrimary
                              : (side == 'buy' ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary),
                        ),
                        const SizedBox(width: 4),
                        Text('${side.toUpperCase()} $token',
                          style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundPrimary, fontSize: 9)),
                        if (isExecuted)
                          Text(' ON-CHAIN', style: CoinDCXTypography.caption.copyWith(
                            color: colors.positiveBackgroundPrimary, fontSize: 8, fontWeight: FontWeight.w600)),
                        const Spacer(),
                        if (isSkipped)
                          Text(skipReason, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 8))
                        else
                          Text('\$${amount.toStringAsFixed(2)}',
                            style: CoinDCXTypography.caption.copyWith(color: colors.positiveBackgroundPrimary, fontSize: 9)),
                      ],
                    ),
                    if (isExecuted && txUrl != null)
                      GestureDetector(
                        onTap: () {
                          Clipboard.setData(ClipboardData(text: txUrl));
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: const Text('Solscan URL copied!'), duration: const Duration(seconds: 2), behavior: SnackBarBehavior.floating),
                          );
                        },
                        child: Padding(
                          padding: const EdgeInsets.only(left: 14, top: 2),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.open_in_new_rounded, size: 9, color: colors.actionBackgroundPrimary),
                              const SizedBox(width: 3),
                              Text('View on Solscan', style: CoinDCXTypography.caption.copyWith(
                                color: colors.actionBackgroundPrimary, fontSize: 8, fontWeight: FontWeight.w600,
                                decoration: TextDecoration.underline)),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  // ── Limit Orders card ─────────────────────────────────────────────

  Widget _buildLimitOrdersCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final orders = (data['orders'] as List<dynamic>?) ?? [];
    if (orders.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL3,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: colors.alertBackgroundPrimary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.schedule_rounded, size: 16, color: colors.alertBackgroundPrimary),
              const SizedBox(width: 4),
              Text('Limit Orders', style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary)),
              const Spacer(),
              Text('${orders.length} active', style: CoinDCXTypography.caption.copyWith(color: colors.alertBackgroundPrimary, fontSize: 10)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xs),
          ...orders.map((o) {
            final order = o as Map<String, dynamic>;
            final token = order['token'] as String? ?? '';
            final type = order['orderType'] as String? ?? '';
            final trigger = (order['triggerPrice'] as num?)?.toDouble() ?? 0;
            final created = (order['currentPriceAtCreation'] as num?)?.toDouble() ?? 0;
            final amount = (order['amountUsd'] as num?)?.toDouble() ?? 0;
            final status = order['status'] as String? ?? 'active';

            final typeLabel = type == 'take_profit' ? 'TP' : type == 'stop_loss' ? 'SL' : type == 'limit_buy' ? 'LB' : 'LS';
            final typeColor = (type == 'take_profit' || type == 'limit_sell')
                ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary;
            final pctChange = created > 0 ? ((trigger - created) / created * 100) : 0.0;

            return Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.all(CoinDCXSpacing.xs),
              decoration: BoxDecoration(
                color: colors.generalBackgroundBgL2,
                borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: typeColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(4)),
                    child: Text(typeLabel, style: CoinDCXTypography.caption.copyWith(color: typeColor, fontSize: 9, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(width: 6),
                  Text(token, style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                  const Spacer(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(_formatPrice(trigger), style: CoinDCXTypography.numberSm.copyWith(color: typeColor, fontSize: 11)),
                      Text('${pctChange >= 0 ? '+' : ''}${pctChange.toStringAsFixed(1)}% · \$${amount.toStringAsFixed(2)}',
                        style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                    ],
                  ),
                  if (status == 'active') ...[
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: () { _controller.text = 'cancel order ${order['id']}'; _sendMessage(); },
                      child: Icon(Icons.close_rounded, size: 14, color: colors.generalForegroundTertiary),
                    ),
                  ],
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  // ── DCA Plan card ───────────────────────────────────────────────────

  Widget _buildDCAPlanCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final token = data['token'] as String? ?? '';
    final amountPerBuy = (data['amountPerBuy'] as num?)?.toDouble() ?? 0;
    final intervalMs = (data['intervalMs'] as num?)?.toInt() ?? 0;
    final totalBuys = (data['totalBuys'] as num?)?.toInt() ?? 0;
    final completedBuys = (data['completedBuys'] as num?)?.toInt() ?? 0;
    final totalSpent = (data['totalSpent'] as num?)?.toDouble() ?? 0;
    final status = data['status'] as String? ?? 'active';
    final planId = data['id'] as String? ?? '';

    final intervalHours = intervalMs > 0 ? (intervalMs / 3600000).round() : 24;
    final intervalLabel = intervalHours >= 24 ? '${(intervalHours / 24).round()}d' : '${intervalHours}h';
    final totalCost = amountPerBuy * totalBuys;
    final progress = totalBuys > 0 ? completedBuys / totalBuys : 0.0;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL3,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.repeat_rounded, size: 16, color: colors.actionBackgroundPrimary),
              const SizedBox(width: 4),
              Text('DCA Plan — $token', style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: status == 'active' ? colors.positiveBackgroundPrimary.withValues(alpha: 0.15) : colors.generalForegroundTertiary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(status.toUpperCase(), style: CoinDCXTypography.caption.copyWith(
                  color: status == 'active' ? colors.positiveBackgroundPrimary : colors.generalForegroundTertiary,
                  fontSize: 9, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xs),
          Row(
            children: [
              _statChip('Amount', '\$${amountPerBuy.toStringAsFixed(2)}', colors.generalForegroundPrimary, colors),
              const SizedBox(width: CoinDCXSpacing.md),
              _statChip('Every', intervalLabel, colors.generalForegroundPrimary, colors),
              const SizedBox(width: CoinDCXSpacing.md),
              _statChip('Total', '\$${totalCost.toStringAsFixed(2)}', colors.generalForegroundSecondary, colors),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xs),
          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: colors.generalStrokeL1,
              color: colors.actionBackgroundPrimary,
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('$completedBuys/$totalBuys buys · \$${totalSpent.toStringAsFixed(2)} spent',
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
              if (status == 'active')
                GestureDetector(
                  onTap: () { _controller.text = 'pause DCA $planId'; _sendMessage(); },
                  child: Text('PAUSE', style: CoinDCXTypography.caption.copyWith(
                    color: colors.alertBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w600)),
                ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Price Alert card ────────────────────────────────────────────────

  Widget _buildPriceAlertCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final token = data['token'] as String? ?? '';
    final targetPrice = (data['targetPrice'] as num?)?.toDouble() ?? 0;
    final direction = data['direction'] as String? ?? 'above';
    final priceAtCreation = (data['priceAtCreation'] as num?)?.toDouble() ?? 0;
    final status = data['status'] as String? ?? 'active';
    final alertId = data['id'] as String? ?? '';

    final isAbove = direction == 'above';
    final pctAway = priceAtCreation > 0 ? ((targetPrice - priceAtCreation) / priceAtCreation * 100) : 0.0;
    final dirColor = isAbove ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL3,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: dirColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.notifications_active_rounded, size: 20, color: dirColor),
          const SizedBox(width: CoinDCXSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$token — ${isAbove ? "Above" : "Below"} ${_formatPrice(targetPrice)}',
                  style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary)),
                Text('Current: ${_formatPrice(priceAtCreation)} · ${pctAway >= 0 ? '+' : ''}${pctAway.toStringAsFixed(1)}% away',
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
              ],
            ),
          ),
          if (status == 'active')
            GestureDetector(
              onTap: () { _controller.text = 'cancel alert $alertId'; _sendMessage(); },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: colors.negativeBackgroundPrimary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text('CANCEL', style: CoinDCXTypography.caption.copyWith(
                  color: colors.negativeBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w600)),
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: colors.positiveBackgroundPrimary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text('TRIGGERED', style: CoinDCXTypography.caption.copyWith(
                color: colors.positiveBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w600)),
            ),
        ],
      ),
    );
  }

  // ── TA Indicators card ─────────────────────────────────────────────

  Widget _buildTAIndicatorsCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final token = data['token'] as String? ?? '';
    final rsi = (data['rsi14'] as num?)?.toDouble() ?? 0;
    final macdData = data['macd'] as Map<String, dynamic>? ?? {};
    final macd = (macdData['macd'] as num?)?.toDouble() ?? 0;
    final signal = (macdData['signal'] as num?)?.toDouble() ?? 0;
    final histogram = (macdData['histogram'] as num?)?.toDouble() ?? 0;
    final bbData = data['bollinger'] as Map<String, dynamic>? ?? {};
    final bbUpper = (bbData['upper'] as num?)?.toDouble() ?? 0;
    final bbLower = (bbData['lower'] as num?)?.toDouble() ?? 0;
    final bbBandwidth = (bbData['bandwidth'] as num?)?.toDouble() ?? 0;
    final price = (data['price'] as num?)?.toDouble() ?? 0;
    final sma20 = (data['sma20'] as num?)?.toDouble() ?? 0;
    final sma50 = (data['sma50'] as num?)?.toDouble() ?? 0;
    final volumeSpike = data['volumeSpike'] as bool? ?? false;
    final goldenCross = data['goldenCross'] as bool? ?? false;
    final deathCross = data['deathCross'] as bool? ?? false;

    final rsiColor = rsi < 30 ? colors.positiveBackgroundPrimary : rsi > 70 ? colors.negativeBackgroundPrimary : colors.alertBackgroundPrimary;
    final rsiLabel = rsi < 30 ? 'OVERSOLD' : rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL';
    final macdColor = histogram > 0 ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary;
    final trendColor = sma20 > sma50 ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary;
    final trendLabel = sma20 > sma50 ? 'BULLISH' : 'BEARISH';

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFF1a1a2e), const Color(0xFF16213e)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: const Color(0xFF0f3460).withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.candlestick_chart_rounded, size: 16, color: Color(0xFF00d2ff)),
              const SizedBox(width: 4),
              Text('Technical Analysis — $token', style: CoinDCXTypography.buttonSm.copyWith(color: const Color(0xFF00d2ff))),
              const Spacer(),
              Text(_formatPrice(price), style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),

          // RSI gauge
          Row(
            children: [
              Text('RSI (14)', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: rsiColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(4)),
                child: Text(rsiLabel, style: CoinDCXTypography.caption.copyWith(color: rsiColor, fontSize: 8, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 6),
              Text(rsi.toStringAsFixed(1), style: CoinDCXTypography.numberSm.copyWith(color: rsiColor, fontSize: 14, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: SizedBox(
              height: 6,
              child: Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [
                        colors.positiveBackgroundPrimary,
                        colors.alertBackgroundPrimary,
                        colors.negativeBackgroundPrimary,
                      ]),
                    ),
                  ),
                  Positioned(
                    left: (rsi.clamp(0, 100) / 100) * (MediaQuery.of(context).size.width * 0.7),
                    child: Container(
                      width: 3, height: 6,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.sm),

          // MACD & Trend
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(CoinDCXSpacing.xs),
                  decoration: BoxDecoration(
                    color: macdColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('MACD', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                      Text(histogram > 0 ? 'BULLISH' : 'BEARISH', style: CoinDCXTypography.buttonSm.copyWith(color: macdColor, fontSize: 11)),
                      Text('H: ${histogram > 0 ? "+" : ""}${histogram.toStringAsFixed(6)}',
                        style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundSecondary, fontSize: 8)),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.xs),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(CoinDCXSpacing.xs),
                  decoration: BoxDecoration(
                    color: trendColor.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Trend', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                      Text(trendLabel, style: CoinDCXTypography.buttonSm.copyWith(color: trendColor, fontSize: 11)),
                      Text('SMA20 vs SMA50',
                        style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundSecondary, fontSize: 8)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xs),

          // Bollinger Bands
          Container(
            padding: const EdgeInsets.all(CoinDCXSpacing.xs),
            decoration: BoxDecoration(
              color: colors.generalBackgroundBgL2.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Bollinger Bands', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
                    Text('BW: ${bbBandwidth.toStringAsFixed(2)}%', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundSecondary, fontSize: 8)),
                  ],
                ),
                Text('↑${_formatPrice(bbUpper)}', style: CoinDCXTypography.numberSm.copyWith(color: colors.negativeBackgroundPrimary, fontSize: 10)),
                Text('↓${_formatPrice(bbLower)}', style: CoinDCXTypography.numberSm.copyWith(color: colors.positiveBackgroundPrimary, fontSize: 10)),
              ],
            ),
          ),

          // Signals
          if (goldenCross || deathCross || volumeSpike) ...[
            const SizedBox(height: CoinDCXSpacing.xs),
            Wrap(
              spacing: CoinDCXSpacing.xxs,
              children: [
                if (goldenCross) _signalChip('🟢 Golden Cross', colors.positiveBackgroundPrimary),
                if (deathCross) _signalChip('🔴 Death Cross', colors.negativeBackgroundPrimary),
                if (volumeSpike) _signalChip('📈 Volume Spike', colors.alertBackgroundPrimary),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _signalChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(label, style: CoinDCXTypography.caption.copyWith(color: color, fontSize: 9, fontWeight: FontWeight.w600)),
    );
  }

  // ── Conditional Rule card ─────────────────────────────────────────

  Widget _buildConditionalRuleCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final ruleId = data['id'] as String? ?? '';
    final token = data['token'] as String? ?? '';
    final condition = data['condition'] as String? ?? '';
    final description = data['description'] as String? ?? '';
    final status = data['status'] as String? ?? 'active';
    final action = data['action'] as String? ?? 'buy';

    final conditionLabel = condition.replaceAll('_', ' ').toUpperCase();
    final statusColor = status == 'active' ? colors.positiveBackgroundPrimary
        : status == 'triggered' ? colors.alertBackgroundPrimary
        : colors.generalForegroundTertiary;
    final actionColor = action == 'buy' ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      padding: const EdgeInsets.all(CoinDCXSpacing.sm),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFF1e1e3f), const Color(0xFF2d1b69).withValues(alpha: 0.5)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: const Color(0xFF7c3aed).withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded, size: 16, color: Color(0xFF7c3aed)),
              const SizedBox(width: 4),
              Text('Conditional Rule', style: CoinDCXTypography.buttonSm.copyWith(color: const Color(0xFFa78bfa))),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(4)),
                child: Text(status.toUpperCase(), style: CoinDCXTypography.caption.copyWith(
                  color: statusColor, fontSize: 9, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.xs),
          Text(description, style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
          const SizedBox(height: CoinDCXSpacing.xs),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: actionColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(4)),
                child: Text(action.toUpperCase(), style: CoinDCXTypography.caption.copyWith(
                  color: actionColor, fontSize: 9, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF7c3aed).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(conditionLabel, style: CoinDCXTypography.caption.copyWith(
                  color: const Color(0xFFa78bfa), fontSize: 8, fontWeight: FontWeight.w600)),
              ),
              const Spacer(),
              if (status == 'active')
                GestureDetector(
                  onTap: () { _controller.text = 'cancel rule $ruleId'; _sendMessage(); },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: colors.negativeBackgroundPrimary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text('CANCEL', style: CoinDCXTypography.caption.copyWith(
                      color: colors.negativeBackgroundPrimary, fontSize: 9, fontWeight: FontWeight.w600)),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Smart Discovery card ──────────────────────────────────────────

  Widget _buildSmartDiscoveryCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final title = data['title'] as String? ?? 'Discovery';
    final tokens = data['tokens'] as List<dynamic>? ?? [];
    if (tokens.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: CoinDCXSpacing.xs),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFF0d1b2a), const Color(0xFF1b2838)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
        border: Border.all(color: const Color(0xFF415a77).withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(CoinDCXSpacing.sm, CoinDCXSpacing.sm, CoinDCXSpacing.sm, CoinDCXSpacing.xxs),
            child: Row(
              children: [
                const Icon(Icons.explore_rounded, size: 16, color: Color(0xFF4cc9f0)),
                const SizedBox(width: 4),
                Expanded(child: Text(title, style: CoinDCXTypography.buttonSm.copyWith(color: const Color(0xFF4cc9f0)))),
                Text('${tokens.length} found', style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundTertiary, fontSize: 9)),
              ],
            ),
          ),
          ...tokens.take(8).map<Widget>((item) {
            final t = item as Map<String, dynamic>;
            final symbol = t['symbol'] as String? ?? '';
            final price = (t['price'] as num?)?.toDouble() ?? 0;
            final change = (t['priceChange24h'] as num?)?.toDouble() ?? 0;
            final volume = (t['volume24h'] as num?)?.toDouble() ?? 0;
            final mcap = (t['marketCap'] as num?)?.toDouble() ?? 0;
            final imageUrl = t['imageUrl'] as String?;
            final buys = (t['txnsBuys24h'] as num?)?.toInt() ?? 0;
            final sells = (t['txnsSells24h'] as num?)?.toInt() ?? 0;
            final buyPct = (buys + sells) > 0 ? ((buys / (buys + sells)) * 100).toStringAsFixed(0) : '?';
            final ageMin = (t['ageMinutes'] as num?)?.toInt() ?? 0;
            final ageLabel = ageMin < 60 ? '${ageMin}m' : ageMin < 1440 ? '${(ageMin / 60).toStringAsFixed(0)}h' : '${(ageMin / 1440).toStringAsFixed(0)}d';
            final isPositive = change >= 0;

            return InkWell(
              onTap: () { _controller.text = 'screen $symbol'; _sendMessage(); },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs + 1),
                child: Row(
                  children: [
                    _buildMiniIcon(symbol, imageUrl, colors, size: 24),
                    const SizedBox(width: CoinDCXSpacing.xs),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(symbol, style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 11)),
                          Text('${ageLabel} old · Buy $buyPct% · MCap ${_formatLargeNum(mcap)}',
                            style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 8)),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(_formatPrice(price), style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 11)),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: isPositive
                                    ? colors.positiveBackgroundPrimary.withValues(alpha: 0.12)
                                    : colors.negativeBackgroundPrimary.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(3),
                              ),
                              child: Text(
                                '${isPositive ? '+' : ''}${change.toStringAsFixed(0)}%',
                                style: CoinDCXTypography.caption.copyWith(
                                  color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                                  fontSize: 8, fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text('V:${_formatLargeNum(volume)}', style: CoinDCXTypography.caption.copyWith(
                              color: colors.generalForegroundTertiary, fontSize: 8)),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: CoinDCXSpacing.xs),
        ],
      ),
    );
  }

  // ── Shared helpers ─────────────────────────────────────────────────

  String _proxyUrl(String url) =>
    'http://localhost:3000/api/v1/proxy/image?url=${Uri.encodeComponent(url)}';

  Widget _buildMiniIcon(String symbol, String? imageUrl, CoinDCXColorScheme colors, {double size = 28}) {
    if (imageUrl != null && imageUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size),
        child: Image.network(_proxyUrl(imageUrl), width: size, height: size, fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildMiniIconFallback(symbol, colors, size)),
      );
    }
    return _buildMiniIconFallback(symbol, colors, size);
  }

  Widget _buildMiniIconFallback(String symbol, CoinDCXColorScheme colors, double size) {
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(color: colors.actionBackgroundSecondary, borderRadius: BorderRadius.circular(size)),
      child: Center(child: Text(
        symbol.isNotEmpty ? symbol[0] : '?',
        style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontWeight: FontWeight.w700, fontSize: size * 0.4),
      )),
    );
  }

  Widget _buildMarkdownText(String text, Color baseColor) {
    final spans = <InlineSpan>[];
    final boldRegex = RegExp(r'\*\*(.+?)\*\*');
    int lastEnd = 0;
    for (final match in boldRegex.allMatches(text)) {
      if (match.start > lastEnd) {
        spans.add(TextSpan(text: text.substring(lastEnd, match.start),
          style: CoinDCXTypography.bodyMedium.copyWith(color: baseColor)));
      }
      spans.add(TextSpan(text: match.group(1),
        style: CoinDCXTypography.bodyMedium.copyWith(color: baseColor, fontWeight: FontWeight.w700)));
      lastEnd = match.end;
    }
    if (lastEnd < text.length) {
      spans.add(TextSpan(text: text.substring(lastEnd),
        style: CoinDCXTypography.bodyMedium.copyWith(color: baseColor)));
    }
    return RichText(text: TextSpan(children: spans));
  }

  Widget _statChip(String label, String value, Color valueColor, CoinDCXColorScheme colors) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$label ', style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
        Text(value, style: CoinDCXTypography.numberSm.copyWith(color: valueColor, fontSize: 11)),
      ],
    );
  }

  Widget _kvRow(String key, String value, CoinDCXColorScheme colors) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(key, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary)),
          Text(value, style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary)),
        ],
      ),
    );
  }

  String _formatPrice(double price) {
    if (price >= 1.0) return '\$${price.toStringAsFixed(2)}';
    if (price >= 0.01) return '\$${price.toStringAsFixed(4)}';
    return '\$${price.toStringAsFixed(8)}';
  }

  String _formatLargeNum(double value) {
    if (value >= 1e9) return '\$${(value / 1e9).toStringAsFixed(1)}B';
    if (value >= 1e6) return '\$${(value / 1e6).toStringAsFixed(1)}M';
    if (value >= 1e3) return '\$${(value / 1e3).toStringAsFixed(1)}K';
    return '\$${value.toStringAsFixed(2)}';
  }

  String _truncAddr(String addr) {
    if (addr.length > 12) return '${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}';
    return addr;
  }

  Widget _buildTypingIndicator(CoinDCXColorScheme colors) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: CoinDCXSpacing.sm),
        padding: const EdgeInsets.all(CoinDCXSpacing.sm),
        decoration: BoxDecoration(color: colors.generalBackgroundBgL2, borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(width: 16, height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: colors.actionBackgroundPrimary)),
            const SizedBox(width: CoinDCXSpacing.xs),
            Text('Thinking...', style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary)),
          ],
        ),
      ),
    );
  }

  List<String> _getLatestSuggestions() {
    for (int i = _messages.length - 1; i >= 0; i--) {
      final msg = _messages[i];
      if (!msg.isUser && msg.suggestions != null && msg.suggestions!.isNotEmpty) {
        return msg.suggestions!;
      }
    }
    return [];
  }

  Widget _buildPersistentSuggestions(CoinDCXColorScheme colors) {
    final suggestions = _getLatestSuggestions();
    if (suggestions.isEmpty || _isLoading) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.xs),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL1,
        border: Border(top: BorderSide(color: colors.generalStrokeL1.withValues(alpha: 0.5))),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        child: Row(
          children: suggestions.map((s) => Padding(
            padding: const EdgeInsets.only(right: CoinDCXSpacing.xs),
            child: GestureDetector(
              onTap: () { _controller.text = s; _sendMessage(); },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxs),
                decoration: BoxDecoration(
                  color: colors.actionBackgroundPrimary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                  border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.3)),
                ),
                child: Text(s, style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary)),
              ),
            ),
          )).toList(),
        ),
      ),
    );
  }

  Widget _buildInputBar(CoinDCXColorScheme colors) {
    return Container(
      padding: EdgeInsets.only(
        left: CoinDCXSpacing.sm, right: CoinDCXSpacing.sm,
        top: CoinDCXSpacing.xxs, bottom: CoinDCXSpacing.sm + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL1,
        border: Border(top: BorderSide(color: colors.generalStrokeL1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_messageCount < 3) _buildCoachMark(colors),
          // Quick action chips
          SizedBox(
            height: 30,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _quickAction('📈 Trending', 'trending', colors, pulse: _messageCount < 2),
                _quickAction('🔍 Screen', 'screen SOL', colors),
                _quickAction('📊 TA', 'RSI SOL', colors),
                _quickAction('💰 Portfolio', 'portfolio', colors),
                _quickAction('🔄 Copy Trade', 'my copy trades', colors),
                _quickAction('🏆 PnL Leaders', 'leaderboard', colors, highlight: true),
                _quickAction('⭐ KOL Rankings', 'kol wallets', colors, highlight: true),
                _quickAction('🆕 New tokens', 'new tokens today', colors),
                _quickAction('❓ Help', 'help', colors),
              ],
            ),
          ),
          const SizedBox(height: CoinDCXSpacing.xxs),
          Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.generalBackgroundBgL2,
                    borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    border: Border.all(color: colors.generalStrokeL1),
                  ),
                  child: TextField(
                    controller: _controller,
                    onSubmitted: (_) => _sendMessage(),
                    textInputAction: TextInputAction.send,
                    style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary),
                    decoration: InputDecoration(
                      hintText: 'Buy SOL, set stop loss, RSI check...',
                      hintStyle: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundTertiary, fontSize: 13),
                      contentPadding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.md, vertical: CoinDCXSpacing.sm),
                      border: InputBorder.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: CoinDCXSpacing.xs),
              Container(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF6366f1), Color(0xFF8b5cf6)],
                  ),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: IconButton(
                  icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                  onPressed: _isLoading ? null : _sendMessage,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCoachMark(CoinDCXColorScheme colors) {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (ctx, child) => Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: colors.actionBackgroundPrimary.withValues(alpha: 0.08 + 0.04 * _pulseAnimation.value),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: colors.actionBackgroundPrimary.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Icon(Icons.touch_app_rounded, size: 16, color: colors.actionBackgroundPrimary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Tap a shortcut below or type anything — I understand natural language!',
                style: CoinDCXTypography.caption.copyWith(
                  color: colors.actionBackgroundPrimary, fontSize: 11, fontWeight: FontWeight.w500),
              ),
            ),
            GestureDetector(
              onTap: () => setState(() => _messageCount = 3),
              child: Icon(Icons.close_rounded, size: 14, color: colors.actionBackgroundPrimary.withValues(alpha: 0.5)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickAction(String label, String command, CoinDCXColorScheme colors, {bool pulse = false, bool highlight = false}) {
    final isActive = pulse || highlight;
    final chip = Padding(
      padding: const EdgeInsets.only(right: 6),
      child: GestureDetector(
        onTap: () { _controller.text = command; _sendMessage(); },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: isActive
              ? colors.actionBackgroundPrimary.withValues(alpha: 0.12)
              : colors.generalBackgroundBgL2,
            borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
            border: Border.all(
              color: isActive
                ? colors.actionBackgroundPrimary.withValues(alpha: highlight ? 0.7 : 0.5)
                : colors.generalStrokeL2,
              width: highlight ? 1.5 : 1.0,
            ),
          ),
          child: Text(label, style: CoinDCXTypography.caption.copyWith(
            color: isActive ? colors.actionBackgroundPrimary : colors.generalForegroundSecondary,
            fontSize: 11,
            fontWeight: highlight ? FontWeight.w600 : FontWeight.normal,
          )),
        ),
      ),
    );

    if (!pulse) return chip;
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (ctx, child) => Transform.scale(scale: 0.96 + 0.04 * _pulseAnimation.value, child: child),
      child: chip,
    );
  }
}

class _WelcomeAction {
  final String label;
  final String command;
  final IconData icon;
  const _WelcomeAction(this.label, this.command, this.icon);
}
