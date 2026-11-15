import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:hive/hive.dart';

import 'settings_state.dart';

class SettingsCubit extends Cubit<SettingsState> {
  SettingsCubit(this._box) : super(SettingsState(
          themeMode: _box.get(_themeKey) == 'dark'
              ? ThemeMode.dark
              : ThemeMode.light,
          locale: Locale(_box.get(_localeKey, defaultValue: 'en') as String),
        ));

  static const _themeKey = 'themeMode';
  static const _localeKey = 'localeCode';
  static const supportedLocales = [
    Locale('en'),
    Locale('am'),
  ];

  final Box<dynamic> _box;

  Future<void> setDarkMode(bool enabled) async {
    final mode = enabled ? ThemeMode.dark : ThemeMode.light;
    await _box.put(_themeKey, enabled ? 'dark' : 'light');
    emit(state.copyWith(themeMode: mode));
  }

  Future<void> setLocale(Locale locale) async {
    await _box.put(_localeKey, locale.languageCode);
    emit(state.copyWith(locale: locale));
  }
}
