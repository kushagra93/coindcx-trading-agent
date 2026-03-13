import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import '../../../core/api/models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/providers/api_providers.dart';

class TokenDetailScreen extends ConsumerStatefulWidget {
  final TokenMetrics token;
  const TokenDetailScreen({super.key, required this.token});

  @override
  ConsumerState<TokenDetailScreen> createState() => _TokenDetailScreenState();
}

class _TokenDetailScreenState extends ConsumerState<TokenDetailScreen> {
  bool _buying = false;
  String? _buyResult;

  TokenMetrics get token => widget.token;

  Future<void> _executeBuy(double amountUsd) async {
    setState(() { _buying = true; _buyResult = null; });
    try {
      final api = ref.read(apiClientProvider);
      final response = await http.Client().post(
        Uri.parse('${api.baseUrl}/api/v1/trade/execute'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'symbol': token.symbol,
          'side': 'buy',
          'amountUsd': amountUsd,
          'chain': token.chain,
        }),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final txUrl = body['txUrl'] as String?;
        final msg = txUrl != null
            ? 'Bought \$${amountUsd.toStringAsFixed(0)} of ${token.symbol.toUpperCase()} — $txUrl'
            : 'Bought \$${amountUsd.toStringAsFixed(0)} of ${token.symbol.toUpperCase()}';
        setState(() => _buyResult = msg);
        ref.invalidate(portfolioProvider);
      } else {
        try {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          setState(() => _buyResult = body['error'] as String? ?? 'Trade failed (${response.statusCode})');
        } catch (_) {
          setState(() => _buyResult = 'Trade failed (${response.statusCode})');
        }
      }
    } catch (e) {
      setState(() => _buyResult = 'Error: $e');
    } finally {
      setState(() => _buying = false);
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label copied'), duration: const Duration(seconds: 1), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = CoinDCXTheme.of(context);
    final screenKey = (token.address != null && token.address!.isNotEmpty) ? token.address! : token.symbol;
    final screeningAsync = ref.watch(tokenScreenProvider(screenKey));

    return Scaffold(
      backgroundColor: colors.generalBackgroundBgL1,
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (token.imageUrl != null && token.imageUrl!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    'http://coindcx-staging-2104180850.ap-south-1.elb.amazonaws.com/api/v1/proxy/image?url=${Uri.encodeComponent(token.imageUrl!)}',
                    width: 28, height: 28, fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
              ),
            Text(token.symbol.toUpperCase()),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(tokenScreenProvider(screenKey)),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(CoinDCXSpacing.md),
        children: [
          // Price header
          _buildPriceHeader(colors),
          const SizedBox(height: CoinDCXSpacing.sm),

          // Contract address
          if (token.address != null && token.address!.isNotEmpty)
            _buildAddressRow(token.address!, 'Contract', colors),
          const SizedBox(height: CoinDCXSpacing.md),

          // Buy buttons
          _buildBuySection(colors),
          const SizedBox(height: CoinDCXSpacing.md),

          // Screening / Audit
          screeningAsync.when(
            loading: () => _buildLoadingCard('Running safety analysis...', colors),
            error: (err, _) => _buildErrorCard(colors, ref),
            data: (result) {
              if (result == null) return const SizedBox.shrink();
              return Column(
                children: [
                  if (result.audit != null) ...[
                    _buildAuditGrid(result.audit!, colors),
                    const SizedBox(height: CoinDCXSpacing.md),
                    _buildBasicData(result, colors),
                    const SizedBox(height: CoinDCXSpacing.md),
                    _buildTokenAuditSection(result.audit!, colors),
                  ] else
                    _buildSimpleScreening(result, colors),
                  const SizedBox(height: CoinDCXSpacing.md),
                  _buildRisksList(result, colors),
                ],
              );
            },
          ),

          // Market stats
          const SizedBox(height: CoinDCXSpacing.md),
          _buildMarketStats(colors),
          const SizedBox(height: CoinDCXSpacing.xxl),
        ],
      ),
    );
  }

  Widget _buildPriceHeader(CoinDCXColorScheme colors) {
    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        children: [
          Text(token.name,
            style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary)),
          const SizedBox(height: 4),
          Text(_fmtPrice(token.priceUsd),
            style: CoinDCXTypography.numberLg.copyWith(color: colors.generalForegroundPrimary, fontSize: 28)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _changePill('5m', token.priceChange5m, colors),
              const SizedBox(width: 4),
              _changePill('1h', token.priceChange1h, colors),
              const SizedBox(width: 4),
              _changePill('6h', token.priceChange6h, colors),
              const SizedBox(width: 4),
              _changePill('24h', token.priceChange24h, colors),
            ],
          ),
        ],
      ),
    );
  }

  // GMGN-style top audit grid: Top 10, DEV, Holders, Snipers row
  Widget _buildAuditGrid(TokenAudit audit, CoinDCXColorScheme colors) {
    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        children: [
          // Row 1: Top 10, DEV, Holders
          Row(
            children: [
              _auditStat(
                'Top 10',
                '${audit.top10HolderPct.toStringAsFixed(1)}%',
                audit.top10HolderPct > 50 ? colors.negativeBackgroundPrimary : colors.positiveBackgroundPrimary,
                audit.top10HolderPct > 50 ? Icons.cancel_rounded : Icons.check_circle_rounded,
                colors,
              ),
              _auditStat(
                'Holders',
                _fmtCompact(audit.totalHolders.toDouble()),
                colors.generalForegroundPrimary,
                null,
                colors,
              ),
              _auditStat(
                'Insiders',
                '${audit.insidersDetected}',
                audit.insidersDetected > 0 ? colors.negativeBackgroundPrimary : colors.positiveBackgroundPrimary,
                null,
                colors,
              ),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          Divider(height: 1, color: colors.generalStrokeL1),
          const SizedBox(height: CoinDCXSpacing.sm),
          // Row 2: NoMint, NoFreeze, Burnt, LP Locked
          Row(
            children: [
              _auditCheck('NoMint', audit.noMint, colors),
              _auditCheck('No Freeze', audit.noFreeze, colors),
              _auditCheck('Burnt', audit.burnt > 90, colors, subtitle: '${audit.burnt}%'),
              _auditCheck('LP Lock', audit.lpLockedPct > 0, colors, subtitle: '${audit.lpLockedPct.toStringAsFixed(0)}%'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _auditStat(String label, String value, Color valueColor, IconData? icon, CoinDCXColorScheme colors) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 14, color: valueColor),
                const SizedBox(width: 2),
              ],
              Text(value, style: CoinDCXTypography.numberSm.copyWith(color: valueColor, fontSize: 13, fontWeight: FontWeight.w600)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _auditCheck(String label, bool passed, CoinDCXColorScheme colors, {String? subtitle}) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                passed ? Icons.check_circle_rounded : Icons.cancel_rounded,
                size: 16,
                color: passed ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
              ),
              if (subtitle != null) ...[
                const SizedBox(width: 2),
                Text(subtitle, style: CoinDCXTypography.caption.copyWith(
                  color: colors.generalForegroundSecondary, fontSize: 9)),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBasicData(ScreeningResult result, CoinDCXColorScheme colors) {
    final audit = result.audit!;
    final rows = <String, String>{
      'Market Cap': _fmtLargeNum(token.marketCap),
      'Holders': audit.totalHolders.toString(),
      'Liquidity': _fmtLargeNum(audit.totalLiquidity),
      'LP Providers': audit.lpProviders.toString(),
      if (audit.deployPlatform != null && audit.deployPlatform!.isNotEmpty)
        'Platform': audit.deployPlatform!,
      if (audit.tokenCreatedAt != null)
        'Token Created': _fmtDate(audit.tokenCreatedAt!),
    };

    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Basic Data', style: CoinDCXTypography.buttonMd.copyWith(color: colors.generalForegroundPrimary)),
          const SizedBox(height: CoinDCXSpacing.sm),
          ...rows.entries.map((e) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(e.key, style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary, fontSize: 12)),
                Text(e.value, style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
              ],
            ),
          )),
          // Pair address
          if (audit.pairAddress != null) ...[
            const SizedBox(height: 4),
            _buildAddressRow(audit.pairAddress!, 'Pair', colors),
          ],
          // Creator address
          if (audit.creator != null) ...[
            const SizedBox(height: 4),
            _buildAddressRow(audit.creator!, 'DEV', colors),
          ],
        ],
      ),
    );
  }

  Widget _buildTokenAuditSection(TokenAudit audit, CoinDCXColorScheme colors) {
    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Token Audit', style: CoinDCXTypography.buttonMd.copyWith(color: colors.generalForegroundPrimary)),
          const SizedBox(height: CoinDCXSpacing.sm),
          _auditRow('NoMint', audit.noMint, colors),
          _auditRow('No Blacklist/Freeze', audit.noFreeze, colors),
          _auditRow('LP Burnt', audit.burnt > 90, colors, trailing: '${audit.burnt}%'),
          _auditRow('Not Rugged', !audit.rugged, colors),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Top 10', style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundSecondary, fontSize: 12)),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${audit.top10HolderPct.toStringAsFixed(1)}%',
                      style: CoinDCXTypography.numberSm.copyWith(
                        color: audit.top10HolderPct > 50 ? colors.negativeBackgroundPrimary : colors.generalForegroundPrimary,
                        fontSize: 12)),
                    const SizedBox(width: 4),
                    Icon(
                      audit.top10HolderPct > 50 ? Icons.help_outline_rounded : Icons.check_circle_rounded,
                      size: 16,
                      color: audit.top10HolderPct > 50 ? colors.alertBackgroundPrimary : colors.positiveBackgroundPrimary,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(Icons.security_rounded, size: 12, color: colors.generalForegroundTertiary),
              const SizedBox(width: 4),
              Text('Powered by RugCheck + GoPlus',
                style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 9)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _auditRow(String label, bool passed, CoinDCXColorScheme colors, {String? trailing}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundSecondary, fontSize: 12)),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (trailing != null) ...[
                Text(trailing, style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
                const SizedBox(width: 4),
              ],
              Icon(
                passed ? Icons.check_circle_rounded : Icons.cancel_rounded,
                size: 16,
                color: passed ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRisksList(ScreeningResult result, CoinDCXColorScheme colors) {
    if (result.flags.isEmpty && (result.audit?.risks.isEmpty ?? true)) return const SizedBox.shrink();

    final risks = result.audit?.risks ?? [];
    final flags = result.flags;

    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, size: 16, color: colors.alertBackgroundPrimary),
              const SizedBox(width: 4),
              Text('Risks', style: CoinDCXTypography.buttonMd.copyWith(color: colors.generalForegroundPrimary)),
            ],
          ),
          const SizedBox(height: CoinDCXSpacing.sm),
          ...risks.map((r) {
            final level = r['level'] as String? ?? 'info';
            final color = level == 'error' ? colors.negativeBackgroundPrimary
                : level == 'warn' ? colors.alertBackgroundPrimary
                : colors.generalForegroundSecondary;
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.circle, size: 6, color: color),
                  const SizedBox(width: 6),
                  Expanded(child: Text(
                    '${r['name'] ?? ''} ${r['description'] != null ? '— ${r['description']}' : ''}',
                    style: CoinDCXTypography.bodySmall.copyWith(color: color, fontSize: 11),
                  )),
                ],
              ),
            );
          }),
          ...flags.map((f) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.circle, size: 6, color: colors.alertBackgroundPrimary),
                const SizedBox(width: 6),
                Expanded(child: Text(f,
                  style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundSecondary, fontSize: 11))),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildAddressRow(String address, String label, CoinDCXColorScheme colors) {
    final short = address.length > 12
        ? '${address.substring(0, 6)}...${address.substring(address.length - 4)}'
        : address;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          SizedBox(
            width: 50,
            child: Text(label, style: CoinDCXTypography.caption.copyWith(color: colors.generalForegroundTertiary, fontSize: 10)),
          ),
          Expanded(
            child: Text(short,
              style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundSecondary, fontSize: 11)),
          ),
          GestureDetector(
            onTap: () => _copyToClipboard(address, label),
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(color: colors.actionBackgroundSecondary, borderRadius: BorderRadius.circular(4)),
              child: Icon(Icons.copy_rounded, size: 12, color: colors.actionBackgroundPrimary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBuySection(CoinDCXColorScheme colors) {
    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Quick Buy', style: CoinDCXTypography.buttonMd.copyWith(color: colors.generalForegroundPrimary)),
          const SizedBox(height: CoinDCXSpacing.sm),
          Row(
            children: [
              _buyBtn('\$50', 50, colors),
              const SizedBox(width: CoinDCXSpacing.sm),
              _buyBtn('\$200', 200, colors),
              const SizedBox(width: CoinDCXSpacing.sm),
              _buyBtn('\$500', 500, colors),
            ],
          ),
          if (_buying)
            const Padding(padding: EdgeInsets.only(top: 8),
              child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)))),
          if (_buyResult != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Container(
                padding: const EdgeInsets.all(CoinDCXSpacing.sm),
                decoration: BoxDecoration(
                  color: _buyResult!.startsWith('Bought') ? colors.positiveBackgroundSecondary : colors.negativeBackgroundSecondary,
                  borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusSm),
                ),
                child: Text(_buyResult!, style: CoinDCXTypography.bodySmall.copyWith(
                  color: _buyResult!.startsWith('Bought') ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buyBtn(String label, double amount, CoinDCXColorScheme colors) {
    return Expanded(
      child: ElevatedButton(
        onPressed: _buying ? null : () => _executeBuy(amount),
        style: ElevatedButton.styleFrom(
          backgroundColor: colors.positiveBackgroundPrimary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: CoinDCXSpacing.sm),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd)),
        ),
        child: Text(label, style: CoinDCXTypography.buttonSm.copyWith(color: Colors.white)),
      ),
    );
  }

  Widget _buildMarketStats(CoinDCXColorScheme colors) {
    final stats = <String, String>{
      'Chain': token.chain.toUpperCase(),
      'Volume 24h': _fmtLargeNum(token.volume24h),
      'Liquidity': _fmtLargeNum(token.liquidity),
      'Market Cap': _fmtLargeNum(token.marketCap),
      'FDV': _fmtLargeNum(token.fdv),
      if (token.pairAgeHours != null)
        'Pair Age': _fmtAge(token.pairAgeHours!),
    };

    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Market Stats', style: CoinDCXTypography.buttonMd.copyWith(color: colors.generalForegroundPrimary)),
          const SizedBox(height: CoinDCXSpacing.sm),
          ...stats.entries.map((e) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(e.key, style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundTertiary, fontSize: 12)),
                Text(e.value, style: CoinDCXTypography.numberSm.copyWith(color: colors.generalForegroundPrimary, fontSize: 12)),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildSimpleScreening(ScreeningResult result, CoinDCXColorScheme colors) {
    final gradeColor = result.isSafe ? colors.positiveBackgroundPrimary
        : result.isDangerous ? colors.negativeBackgroundPrimary
        : colors.alertBackgroundPrimary;

    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: gradeColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
            child: Center(child: Text(result.verdict, style: CoinDCXTypography.heading3.copyWith(color: gradeColor))),
          ),
          const SizedBox(width: CoinDCXSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Safety Grade', style: CoinDCXTypography.buttonSm.copyWith(color: colors.generalForegroundPrimary)),
                Text('Score: ${result.score}/100',
                  style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingCard(String msg, CoinDCXColorScheme colors) {
    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.lg),
      decoration: BoxDecoration(
        color: colors.generalBackgroundBgL2,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        border: Border.all(color: colors.generalStrokeL1),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(width: CoinDCXSpacing.sm),
          Text(msg, style: CoinDCXTypography.bodySmall.copyWith(color: colors.generalForegroundSecondary)),
        ],
      ),
    );
  }

  Widget _buildErrorCard(CoinDCXColorScheme colors, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(CoinDCXSpacing.md),
      decoration: BoxDecoration(
        color: colors.negativeBackgroundSecondary,
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
      ),
      child: Row(
        children: [
          Text('Screening unavailable', style: CoinDCXTypography.bodySmall.copyWith(color: colors.negativeBackgroundPrimary)),
          const Spacer(),
          TextButton(onPressed: () {
            final key = (token.address != null && token.address!.isNotEmpty) ? token.address! : token.symbol;
            ref.invalidate(tokenScreenProvider(key));
          }, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _changePill(String label, double? change, CoinDCXColorScheme colors) {
    final v = change ?? 0;
    final pos = v >= 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: pos ? colors.positiveBackgroundPrimary.withValues(alpha: 0.12) : colors.negativeBackgroundPrimary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text('$label ${pos ? '+' : ''}${v.toStringAsFixed(1)}%',
        style: CoinDCXTypography.caption.copyWith(
          color: pos ? colors.positiveBackgroundPrimary : colors.negativeBackgroundPrimary, fontSize: 9)),
    );
  }

  String _fmtPrice(double p) {
    if (p >= 1.0) return '\$${p.toStringAsFixed(2)}';
    if (p >= 0.01) return '\$${p.toStringAsFixed(4)}';
    if (p >= 0.0001) return '\$${p.toStringAsFixed(6)}';
    return '\$${p.toStringAsFixed(8)}';
  }

  String _fmtLargeNum(double? v) {
    if (v == null || v == 0) return '-';
    if (v >= 1e9) return '\$${(v / 1e9).toStringAsFixed(2)}B';
    if (v >= 1e6) return '\$${(v / 1e6).toStringAsFixed(2)}M';
    if (v >= 1e3) return '\$${(v / 1e3).toStringAsFixed(1)}K';
    return '\$${v.toStringAsFixed(2)}';
  }

  String _fmtCompact(double v) {
    if (v >= 1e6) return '${(v / 1e6).toStringAsFixed(1)}M';
    if (v >= 1e3) return '${(v / 1e3).toStringAsFixed(1)}K';
    return v.toStringAsFixed(0);
  }

  String _fmtAge(int hours) {
    if (hours < 1) return '<1h';
    if (hours < 24) return '${hours}h';
    final days = hours ~/ 24;
    if (days < 30) return '${days}d';
    if (days < 365) return '${days ~/ 30}mo';
    return '${days ~/ 365}y';
  }

  String _fmtDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      return '${dt.month.toString().padLeft(2, '0')}/${dt.day.toString().padLeft(2, '0')}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso.length > 19 ? iso.substring(0, 19) : iso;
    }
  }
}
