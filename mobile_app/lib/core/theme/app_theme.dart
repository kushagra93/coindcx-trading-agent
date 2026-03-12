import 'package:flutter/material.dart';
import 'colors.dart';
import 'spacing.dart';
import 'typography.dart';

export 'colors.dart';
export 'spacing.dart';
export 'typography.dart';

class CoinDCXTheme extends InheritedWidget {
  final CoinDCXColorScheme colors;

  const CoinDCXTheme({
    super.key,
    required this.colors,
    required super.child,
  });

  static CoinDCXColorScheme of(BuildContext context) {
    final theme = context.dependOnInheritedWidgetOfExactType<CoinDCXTheme>();
    return theme?.colors ?? CoinDCXColors.dark;
  }

  @override
  bool updateShouldNotify(CoinDCXTheme oldWidget) => colors != oldWidget.colors;
}

ThemeData buildMaterialTheme(CoinDCXColorScheme scheme) {
  return ThemeData(
    brightness: scheme == CoinDCXColors.dark ? Brightness.dark : Brightness.light,
    scaffoldBackgroundColor: scheme.generalBackgroundBgL1,
    colorScheme: ColorScheme(
      brightness: scheme == CoinDCXColors.dark ? Brightness.dark : Brightness.light,
      primary: scheme.actionBackgroundPrimary,
      onPrimary: scheme.actionForegroundPrimary,
      secondary: scheme.actionBackgroundSecondary,
      onSecondary: scheme.generalForegroundPrimary,
      error: scheme.negativeBackgroundPrimary,
      onError: Colors.white,
      surface: scheme.generalBackgroundBgL2,
      onSurface: scheme.generalForegroundPrimary,
    ),
    cardTheme: CardThemeData(
      color: scheme.generalBackgroundBgL2,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        side: BorderSide(color: scheme.generalStrokeL1),
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.generalBackgroundBgL1,
      foregroundColor: scheme.generalForegroundPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: CoinDCXTypography.heading3.copyWith(color: scheme.generalForegroundPrimary),
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: scheme.generalBackgroundBgL1,
      selectedItemColor: scheme.actionBackgroundPrimary,
      unselectedItemColor: scheme.generalForegroundTertiary,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.generalBackgroundBgL2,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: CoinDCXSpacing.md,
        vertical: CoinDCXSpacing.sm,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        borderSide: BorderSide(color: scheme.generalStrokeL2),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        borderSide: BorderSide(color: scheme.generalStrokeL1),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd),
        borderSide: BorderSide(color: scheme.actionBackgroundPrimary, width: 1.5),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: scheme.actionBackgroundPrimary,
        foregroundColor: scheme.actionForegroundPrimary,
        elevation: 0,
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CoinDCXSpacing.radiusMd)),
        textStyle: CoinDCXTypography.buttonMd,
      ),
    ),
  );
}
