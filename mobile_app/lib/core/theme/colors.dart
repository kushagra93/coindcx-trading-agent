import 'package:flutter/material.dart';

class CoinDCXColors {
  // Light theme
  static const light = CoinDCXColorScheme(
    generalForegroundPrimary: Color(0xE5000000),
    generalForegroundSecondary: Color(0x8A000000),
    generalForegroundTertiary: Color(0x54000000),
    generalBackgroundBgL0Web: Color(0xFFF5F5F5),
    generalBackgroundBgL1: Color(0xFFFFFFFF),
    generalBackgroundBgL2: Color(0xFFF5F5F5),
    generalBackgroundBgL3: Color(0xFFF2F2F2),
    generalStrokeL1: Color(0x0A000000),
    generalStrokeL2: Color(0x14000000),
    generalStrokeL3: Color(0x38000000),
    actionForegroundPrimary: Color(0xFFFFFFFF),
    actionBackgroundPrimary: Color(0xFF4965D2),
    actionBackgroundSecondary: Color(0xFFEDF0FB),
    positiveBackgroundPrimary: Color(0xFF37B271),
    positiveBackgroundSecondary: Color(0xFFEBF7F1),
    negativeBackgroundPrimary: Color(0xFFE13B4D),
    negativeBackgroundSecondary: Color(0xFFFCEBED),
    alertBackgroundPrimary: Color(0xFFF7931A),
    alertBackgroundSecondary: Color(0xFFFEF4E8),
  );

  // Dark theme
  static const dark = CoinDCXColorScheme(
    generalForegroundPrimary: Color(0xE5FFFFFF),
    generalForegroundSecondary: Color(0x8AFFFFFF),
    generalForegroundTertiary: Color(0x54FFFFFF),
    generalBackgroundBgL0Web: Color(0xFF0A0A0A),
    generalBackgroundBgL1: Color(0xFF000000),
    generalBackgroundBgL2: Color(0xFF141414),
    generalBackgroundBgL3: Color(0xFF1F1F1F),
    generalStrokeL1: Color(0x14FFFFFF),
    generalStrokeL2: Color(0x1FFFFFFF),
    generalStrokeL3: Color(0x33FFFFFF),
    actionForegroundPrimary: Color(0xFFFFFFFF),
    actionBackgroundPrimary: Color(0xFF425BBD),
    actionBackgroundSecondary: Color(0xFF292929),
    positiveBackgroundPrimary: Color(0xFF37B271),
    positiveBackgroundSecondary: Color(0xFF1C5939),
    negativeBackgroundPrimary: Color(0xFFB42F3E),
    negativeBackgroundSecondary: Color(0xFF441217),
    alertBackgroundPrimary: Color(0xFFF7931A),
    alertBackgroundSecondary: Color(0xFF4A2C08),
  );
}

class CoinDCXColorScheme {
  final Color generalForegroundPrimary;
  final Color generalForegroundSecondary;
  final Color generalForegroundTertiary;
  final Color generalBackgroundBgL0Web;
  final Color generalBackgroundBgL1;
  final Color generalBackgroundBgL2;
  final Color generalBackgroundBgL3;
  final Color generalStrokeL1;
  final Color generalStrokeL2;
  final Color generalStrokeL3;
  final Color actionForegroundPrimary;
  final Color actionBackgroundPrimary;
  final Color actionBackgroundSecondary;
  final Color positiveBackgroundPrimary;
  final Color positiveBackgroundSecondary;
  final Color negativeBackgroundPrimary;
  final Color negativeBackgroundSecondary;
  final Color alertBackgroundPrimary;
  final Color alertBackgroundSecondary;

  const CoinDCXColorScheme({
    required this.generalForegroundPrimary,
    required this.generalForegroundSecondary,
    required this.generalForegroundTertiary,
    required this.generalBackgroundBgL0Web,
    required this.generalBackgroundBgL1,
    required this.generalBackgroundBgL2,
    required this.generalBackgroundBgL3,
    required this.generalStrokeL1,
    required this.generalStrokeL2,
    required this.generalStrokeL3,
    required this.actionForegroundPrimary,
    required this.actionBackgroundPrimary,
    required this.actionBackgroundSecondary,
    required this.positiveBackgroundPrimary,
    required this.positiveBackgroundSecondary,
    required this.negativeBackgroundPrimary,
    required this.negativeBackgroundSecondary,
    required this.alertBackgroundPrimary,
    required this.alertBackgroundSecondary,
  });
}
