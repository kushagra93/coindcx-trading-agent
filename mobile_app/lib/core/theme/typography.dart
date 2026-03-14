import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class CoinDCXTypography {
  static TextStyle get _base => GoogleFonts.inter();

  // Headings
  static TextStyle heading1 = _base.copyWith(fontSize: 28, fontWeight: FontWeight.w700, height: 1.29);
  static TextStyle heading2 = _base.copyWith(fontSize: 24, fontWeight: FontWeight.w700, height: 1.33);
  static TextStyle heading3 = _base.copyWith(fontSize: 20, fontWeight: FontWeight.w600, height: 1.4);

  // Body
  static TextStyle bodyLarge = _base.copyWith(fontSize: 16, fontWeight: FontWeight.w500, height: 1.5);
  static TextStyle bodyMedium = _base.copyWith(fontSize: 14, fontWeight: FontWeight.w400, height: 1.43);
  static TextStyle bodySmall = _base.copyWith(fontSize: 12, fontWeight: FontWeight.w400, height: 1.33);

  // Buttons / labels
  static TextStyle buttonMd = _base.copyWith(fontSize: 14, fontWeight: FontWeight.w600, height: 1.43);
  static TextStyle buttonSm = _base.copyWith(fontSize: 12, fontWeight: FontWeight.w600, height: 1.33);
  static TextStyle caption = _base.copyWith(fontSize: 11, fontWeight: FontWeight.w500, height: 1.45);

  // Numbers (monospace for financial data)
  static TextStyle numberLg = GoogleFonts.jetBrainsMono(fontSize: 20, fontWeight: FontWeight.w600, height: 1.4);
  static TextStyle numberMd = GoogleFonts.jetBrainsMono(fontSize: 14, fontWeight: FontWeight.w500, height: 1.43);
  static TextStyle numberSm = GoogleFonts.jetBrainsMono(fontSize: 12, fontWeight: FontWeight.w500, height: 1.33);
}
