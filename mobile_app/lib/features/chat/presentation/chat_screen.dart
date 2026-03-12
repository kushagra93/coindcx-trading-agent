import 'package:flutter/material.dart';
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

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _messages.add(ChatMessage(
      text: 'Hey! I can help you discover, screen, and trade tokens. '
          'Try "show trending", "screen SOL", "price of ETH", or "buy 10 BONK".',
      isUser: false,
      timestamp: DateTime.now(),
    ));
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _isLoading) return;

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
        isUser: false,
        timestamp: DateTime.now(),
      )));
    } catch (e) {
      setState(() => _messages.add(ChatMessage(
        text: 'Network error. Make sure the backend is running.',
        isUser: false,
        timestamp: DateTime.now(),
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
      appBar: AppBar(title: const Text('AI Assistant')),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(CoinDCXSpacing.md),
              itemCount: _messages.length + (_isLoading ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _messages.length) return _buildTypingIndicator(colors);
                return _buildMessageBubble(_messages[index], colors);
              },
            ),
          ),
          _buildInputBar(colors),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg, CoinDCXColorScheme colors) {
    return Align(
      alignment: msg.isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        margin: const EdgeInsets.only(bottom: CoinDCXSpacing.sm),
        padding: const EdgeInsets.all(CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          color: msg.isUser
              ? colors.actionBackgroundPrimary
              : colors.generalBackgroundBgL2,
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
            Text(
              msg.text,
              style: CoinDCXTypography.bodyMedium.copyWith(
                color: msg.isUser ? colors.actionForegroundPrimary : colors.generalForegroundPrimary,
              ),
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
                  onTap: () {
                    _controller.text = s;
                    _sendMessage();
                  },
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
      case 'trending':
        return _buildTrendingCard(card.data, colors);
      case 'screening':
        return _buildScreeningCard(card.data, colors);
      case 'token_price':
        return _buildTokenPriceCard(card.data, colors);
      case 'trade_preview':
        return _buildTradePreviewCard(card.data, colors);
      default:
        return const SizedBox.shrink();
    }
  }

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
        children: items.take(6).map<Widget>((item) {
          final t = item as Map<String, dynamic>;
          final symbol = t['symbol'] as String? ?? '';
          final price = (t['price'] as num?)?.toDouble() ?? 0;
          final change = (t['priceChange24h'] as num?)?.toDouble() ?? 0;
          final chain = t['chain'] as String? ?? '';
          final isPositive = change >= 0;

          return InkWell(
            onTap: () {
              _controller.text = 'screen $symbol';
              _sendMessage();
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xs),
              child: Row(
                children: [
                  Container(
                    width: 28, height: 28,
                    decoration: BoxDecoration(
                      color: colors.actionBackgroundSecondary,
                      borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                    ),
                    child: Center(
                      child: Text(symbol.isNotEmpty ? symbol[0] : '?',
                        style: CoinDCXTypography.caption.copyWith(color: colors.actionBackgroundPrimary, fontWeight: FontWeight.w700)),
                    ),
                  ),
                  const SizedBox(width: CoinDCXSpacing.xs),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(symbol, style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary)),
                        Text(chain, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(_formatPrice(price), style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary)),
                      Text(
                        '${isPositive ? '+' : ''}${change.toStringAsFixed(1)}%',
                        style: CoinDCXTypography.caption.copyWith(
                          color: isPositive ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                          fontSize: 10,
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

  Widget _buildScreeningCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final token = data['token'] as Map<String, dynamic>? ?? data;
    final grade = data['grade'] as String? ?? '?';
    final passed = data['passed'] as bool? ?? false;
    final reasons = (data['reasons'] as List<dynamic>?)?.cast<String>() ?? [];
    final rugScore = (token['rugScore'] as num?)?.toInt() ?? (data['rugScore'] as num?)?.toInt() ?? 0;

    final gradeColor = grade == 'A' || grade == 'B'
        ? colors.positiveBackgroundPrimary
        : grade == 'C'
            ? colors.alertBackgroundPrimary
            : colors.negativeBackgroundPrimary;

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
              Container(
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.sm, vertical: CoinDCXSpacing.xxxs),
                decoration: BoxDecoration(
                  color: gradeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Text('Grade $grade', style: CoinDCXTypography.buttonSm.copyWith(color: gradeColor)),
              ),
              const SizedBox(width: CoinDCXSpacing.xs),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: CoinDCXSpacing.xs, vertical: CoinDCXSpacing.xxxs),
                decoration: BoxDecoration(
                  color: passed ? colors.positiveBackgroundSecondary : colors.negativeBackgroundSecondary,
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusFull),
                ),
                child: Text(
                  passed ? 'PASSED' : 'FAILED',
                  style: CoinDCXTypography.caption.copyWith(
                    color: passed ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Spacer(),
              Text('$rugScore/100', style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundSecondary)),
            ],
          ),
          if (reasons.isNotEmpty) ...[
            const SizedBox(height: CoinDCXSpacing.xs),
            ...reasons.take(3).map((r) => Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded, size: 12, color: colors.alertBackgroundPrimary),
                  const SizedBox(width: CoinDCXSpacing.xxs),
                  Expanded(child: Text(r, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundSecondary))),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }

  Widget _buildTokenPriceCard(Map<String, dynamic> data, CoinDCXColorScheme colors) {
    final symbol = data['symbol'] as String? ?? '';
    final price = (data['price'] as num?)?.toDouble() ?? 0;
    final change = (data['priceChange24h'] as num?)?.toDouble() ?? 0;
    final volume = (data['volume24h'] as num?)?.toDouble() ?? 0;
    final mcap = (data['marketCap'] as num?)?.toDouble() ?? 0;
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(symbol, style: CoinDCXTypography.buttonMd.copyWith(color: colors.generalForegroundPrimary)),
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
        ],
      ),
    );
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
    if (value >= 1e3) return '\$${(value / 1e3).toStringAsFixed(0)}K';
    return '\$${value.toStringAsFixed(0)}';
  }

  Widget _buildTypingIndicator(CoinDCXColorScheme colors) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: CoinDCXSpacing.sm),
        padding: const EdgeInsets.all(CoinDCXSpacing.sm),
        decoration: BoxDecoration(
          color: colors.generalBackgroundBgL2,
          borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colors.actionBackgroundPrimary,
              ),
            ),
            const SizedBox(width: CoinDCXSpacing.xs),
            Text(
              'Thinking...',
              style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInputBar(CoinDCXColorScheme colors) {
    return Container(
      padding: EdgeInsets.only(
        left: CoinDCXSpacing.md,
        right: CoinDCXSpacing.md,
        top: CoinDCXSpacing.sm,
        bottom: CoinDCXSpacing.md + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL1,
        border: Border(top: BorderSide(color: colors.generalStrokeL1)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              onSubmitted: (_) => _sendMessage(),
              textInputAction: TextInputAction.send,
              style: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundPrimary),
              decoration: InputDecoration(
                hintText: 'Ask about any token...',
                hintStyle: CoinDCXTypography.bodyMedium.copyWith(color: colors.generalForegroundTertiary),
              ),
            ),
          ),
          const SizedBox(width: CoinDCXSpacing.xs),
          Container(
            decoration: BoxDecoration(
              color: colors.actionBackgroundPrimary,
              borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
            ),
            child: IconButton(
              icon: Icon(Icons.send_rounded, color: colors.actionForegroundPrimary),
              onPressed: _isLoading ? null : _sendMessage,
            ),
          ),
        ],
      ),
    );
  }
}
