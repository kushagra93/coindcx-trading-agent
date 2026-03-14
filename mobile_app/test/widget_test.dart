import 'package:flutter_test/flutter_test.dart';
import 'package:trading_agent_app/main.dart';

void main() {
  testWidgets('App renders', (WidgetTester tester) async {
    await tester.pumpWidget(const TradingAgentApp());
    expect(find.text('Discover'), findsOneWidget);
  });
}
