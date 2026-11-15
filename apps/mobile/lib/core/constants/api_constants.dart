import 'dart:io';

class ApiConstants {
  ApiConstants._();

  /// Base URL for the backend API (local backend).
  static String get baseUrl {
    if (Platform.isAndroid) {
      return 'https://mudayai.learnica.net';
    }
    return 'https://mudayai.learnica.net';
  }

  static const String authCodeEndpoint = '/api/v1/auth/code';
  static const String refreshTokenEndpoint = '/api/v1/auth/token/refresh';
  static const String logoutEndpoint = '/api/v1/auth/logout';
  static const String meEndpoint = '/api/v1/me';
}
