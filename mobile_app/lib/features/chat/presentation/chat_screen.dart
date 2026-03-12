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
          ],
        ),
      ),
    );
  }

  Widget _buildCard(ChatCard card, CoinDCXColorScheme colors) {
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
          if (card.title != null)
            Padding(
              padding: const EdgeInsets.only(bottom: CoinDCXSpacing.xxs),
              child: Text(
                card.title!,
                style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundSecondary),
              ),
            ),
          ...card.data.entries.map((e) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 1),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  e.key,
                  style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary),
                ),
                Flexible(
                  child: Text(
                    '${e.value}',
                    style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary),
                    textAlign: TextAlign.end,
                  ),
                ),
              ],
            ),
          )),
        ],
      ),
    );
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
