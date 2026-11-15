import 'package:flutter/material.dart';

abstract final class AppTextStyles {
  static TextStyle title(BuildContext context) => TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.6,
    height: 1.15,
    color: Theme.of(context).colorScheme.onSurface,
  );

  static TextStyle section(BuildContext context) => TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: Theme.of(context).colorScheme.onSurface,
  );

  static TextStyle body(BuildContext context) => TextStyle(
    fontSize: 15,
    height: 1.45,
    color: Theme.of(context).hintColor,
  );

  static TextStyle total(BuildContext context) => TextStyle(
    fontSize: 36,
    fontWeight: FontWeight.w700,
    letterSpacing: -1,
    color: Theme.of(context).colorScheme.onSurface,
  );

  static TextStyle label(BuildContext context) => TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: Theme.of(context).hintColor,
  );
}
