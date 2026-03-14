String formatPrice(double price) {
  if (price >= 1.0) return '\$${price.toStringAsFixed(2)}';
  if (price >= 0.01) return '\$${price.toStringAsFixed(4)}';
  if (price >= 0.0001) return '\$${price.toStringAsFixed(6)}';
  final str = price.toStringAsFixed(10);
  final match = RegExp(r'0\.0+').firstMatch(str);
  if (match != null) {
    final zeroCount = match.group(0)!.length - 2;
    final significant = str.substring(match.end, (match.end + 4).clamp(0, str.length));
    return '\$0.0${_toSubscript(zeroCount)}$significant';
  }
  return '\$${price.toStringAsFixed(8)}';
}

String _toSubscript(int n) {
  const subs = ['\u2080', '\u2081', '\u2082', '\u2083', '\u2084', '\u2085', '\u2086', '\u2087', '\u2088', '\u2089'];
  return n.toString().split('').map((d) => subs[int.parse(d)]).join();
}

String formatCompact(double? value) {
  if (value == null || value == 0) return '-';
  if (value >= 1e9) return '\$${(value / 1e9).toStringAsFixed(1)}B';
  if (value >= 1e6) return '\$${(value / 1e6).toStringAsFixed(1)}M';
  if (value >= 1e3) return '\$${(value / 1e3).toStringAsFixed(0)}K';
  return '\$${value.toStringAsFixed(0)}';
}

String formatPnl(double value) {
  final prefix = value >= 0 ? '+' : '';
  if (value.abs() >= 1e6) return '$prefix\$${(value / 1e6).toStringAsFixed(1)}M';
  if (value.abs() >= 1e3) return '$prefix\$${(value / 1e3).toStringAsFixed(1)}K';
  return '$prefix\$${value.toStringAsFixed(2)}';
}

String formatPercent(double value) {
  final prefix = value >= 0 ? '+' : '';
  return '$prefix${value.toStringAsFixed(1)}%';
}

String shortenAddress(String address) {
  if (address.length <= 10) return address;
  return '${address.substring(0, 6)}...${address.substring(address.length - 4)}';
}

String timeAgo(int timestampMs) {
  final diff = DateTime.now().millisecondsSinceEpoch - timestampMs;
  final seconds = diff ~/ 1000;
  if (seconds < 60) return 'just now';
  final minutes = seconds ~/ 60;
  if (minutes < 60) return '${minutes}m ago';
  final hours = minutes ~/ 60;
  if (hours < 24) return '${hours}h ago';
  final days = hours ~/ 24;
  if (days < 30) return '${days}d ago';
  return '${days ~/ 30}mo ago';
}
