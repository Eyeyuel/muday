import 'dart:convert';
import 'dart:io';
import 'package:hive/hive.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../../../../core/constants/api_constants.dart';
import '../models/auth_session_model.dart';

abstract class AuthDataSource {
  Future<AuthSessionModel> exchangePairingCode(String code);
  Future<AuthSessionModel> refreshToken();
  Future<bool> isSessionValid();
  Future<Map<String, dynamic>> postTextTransaction(String text);
  Future<Map<String, dynamic>> saveBankSmsTransaction({
    required double amount,
    required String type,
    required String category,
    String? bankSource,
    DateTime? occurredAt,
    String? note,
    String? smsId,
    String? rawText,
  });
  Future<Map<String, dynamic>> postBankSmsBulk(List<Map<String, dynamic>> messages);
  Future<Map<String, dynamic>> updateTransaction(
    String id, {
    String? category,
    String? type,
    String? note,
  });
  Future<Map<String, dynamic>> uploadVoiceTransaction(List<int> bytes, String filename, {int durationSeconds = 10});
  Future<Map<String, dynamic>> uploadReceiptTransaction(List<int> bytes, String filename);
  Future<Map<String, dynamic>> undoLatestTransaction();
  Future<List<Map<String, dynamic>>> getTransactionHistory({int limit = 50, int offset = 0, DateTime? since});
  Future<List<Map<String, dynamic>>> getBankSmsTransactions({int limit = 50, int offset = 0, DateTime? since});
  Future<List<Map<String, dynamic>>> getMatchCandidates(double amount, {String type = 'expense'});
  Future<Map<String, dynamic>> linkCandidateTransaction({
    required String targetId,
    required String targetType,
    required String category,
    String? note,
    String type = 'expense',
  });
  Future<List<Map<String, dynamic>>> getIdentities();
  Future<Map<String, dynamic>> getMeProfile();
  Future<Map<String, dynamic>> getNotificationSettings();
  Future<Map<String, dynamic>> updateNotificationSettings(Map<String, dynamic> settings);
  Future<void> saveSession(AuthSessionModel session);
  Future<void> clearSession();
  String? getAccessToken();
  String? getRefreshToken();
  String? getUserId();
  DateTime? getUserCreatedAt();
  bool isAuthenticated();
}

class AuthDataSourceImpl implements AuthDataSource {
  AuthDataSourceImpl(this._settingsBox);

  final Box<dynamic> _settingsBox;

  static const _keyAccessToken = 'auth_access_token';
  static const _keyRefreshToken = 'auth_refresh_token';
  static const _keySessionId = 'auth_session_id';
  static const _keyUserId = 'auth_user_id';
  static const _keyUserLanguage = 'auth_user_language';
  static const _keyUserCreatedAt = 'auth_user_created_at';
  static const _keyTokenExpiresAt = 'auth_token_expires_at';

  List<String> get _candidateBaseUrls => [
        ApiConstants.baseUrl.replaceAll(RegExp(r'/+$'), ''), // Primary baseUrl (local default)
        'http://10.0.2.2:3001',      // Android emulator -> host machine
        'http://192.168.1.8:3001',   // Wi-Fi IP
        'http://192.168.1.3:3001',   // Wi-Fi IP
        'http://127.0.0.1:3001',     // Physical device with USB adb reverse
        'http://localhost:3001',     // Localhost
        'https://mudayai.learnica.net', // Production remote fallback
      ];

  static bool _isNetworkError(Object e) {
    final s = e.toString();
    return s.contains('SocketException') ||
        s.contains('ClientException') ||
        s.contains('TimeoutException') ||
        s.contains('Connection refused') ||
        s.contains('errno = 111') ||
        s.contains('no such host') ||
        s.contains('Network is unreachable');
  }


  @override
  Future<AuthSessionModel> exchangePairingCode(String code) async {
    final clientType = Platform.isAndroid
        ? 'FLUTTER_ANDROID'
        : Platform.isIOS
            ? 'FLUTTER_IOS'
            : 'WEB';

    final body = jsonEncode({
      'code': code.trim(),
      'clientType': clientType,
      'deviceName': Platform.operatingSystem,
    });

    Object? lastError;
    http.Response? response;

    // Try candidates (10.0.2.2 for emulator, localhost/127.0.0.1 for physical device with adb reverse)
    for (final base in _candidateBaseUrls) {
      try {
        final uri = Uri.parse('$base${ApiConstants.authCodeEndpoint}');
        response = await http
            .post(
              uri,
              headers: {'Content-Type': 'application/json'},
              body: body,
            )
            .timeout(const Duration(seconds: 8));
        if (response.statusCode != 0) {
          break;
        }
      } catch (e) {
        lastError = e;
      }
    }

    if (response == null) {
      throw Exception('Network error: Could not reach backend server. ($lastError)');
    }

    if (response.statusCode == 200 || response.statusCode == 201) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final session = AuthSessionModel.fromJson(json);
      await saveSession(session);
      return session;
    } else {
      String errorMessage = 'Invalid pairing code';
      try {
        final json = jsonDecode(response.body) as Map<String, dynamic>;
        if (json['message'] is String) {
          errorMessage = json['message'] as String;
        } else if (json['message'] is List) {
          errorMessage = (json['message'] as List).join(', ');
        }
      } catch (_) {}

      if (response.statusCode == 401) {
        throw Exception('Invalid or expired code. Please generate a new one from the bot.');
      } else if (response.statusCode == 429) {
        throw Exception('Too many attempts. Please wait a minute and try again.');
      } else {
        throw Exception(errorMessage);
      }
    }
  }

  @override
  Future<AuthSessionModel> refreshToken() async {
    final token = getRefreshToken();
    if (token == null || token.isEmpty) {
      throw Exception('No refresh token available');
    }

    final body = jsonEncode({'refreshToken': token});

    for (final base in _candidateBaseUrls) {
      try {
        final uri = Uri.parse('$base${ApiConstants.refreshTokenEndpoint}');
        final response = await http
            .post(
              uri,
              headers: {'Content-Type': 'application/json'},
              body: body,
            )
            .timeout(const Duration(seconds: 8));

        if (response.statusCode == 200) {
          final json = jsonDecode(response.body) as Map<String, dynamic>;
          final session = AuthSessionModel(
            sessionId: _settingsBox.get(_keySessionId) as String? ?? '',
            accessToken: json['accessToken'] as String? ?? '',
            refreshToken: json['refreshToken'] as String? ?? token,
            expiresInSeconds: json['expiresInSeconds'] as int? ?? 900,
          );
          await saveSession(session);
          return session;
        }
      } catch (_) {}
    }

    await clearSession();
    throw Exception('Session expired. Please log in again.');
  }

  // ─── _getValidToken: returns a fresh token or throws ──────────────────────
  Future<String> _getValidToken() async {
    final token = getAccessToken();
    final expiresAtMs = _settingsBox.get(_keyTokenExpiresAt) as int?;

    // Token is valid locally (with 60s buffer)
    if (token != null &&
        token.isNotEmpty &&
        expiresAtMs != null &&
        DateTime.now().millisecondsSinceEpoch < (expiresAtMs - 60000)) {
      return token;
    }

    // Expired or missing — try silent refresh
    final rt = getRefreshToken();
    if (rt == null || rt.isEmpty) {
      await clearSession();
      throw Exception('Session expired. Please reconnect with your Telegram pairing code.');
    }
    try {
      final refreshed = await refreshToken();
      return refreshed.accessToken;
    } catch (_) {
      await clearSession();
      throw Exception('Session expired. Please reconnect with your Telegram pairing code.');
    }
  }

  // ─── _authenticatedGet: GET with auto 401 retry ────────────────────────────
  Future<http.Response> _authenticatedGet(String path, {Duration timeout = const Duration(seconds: 10)}) async {
    final token = await _getValidToken();
    Object? lastError;
    for (final base in _candidateBaseUrls) {
      try {
        final uri = Uri.parse('$base$path');
        var response = await http.get(uri, headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        }).timeout(timeout);

        if (response.statusCode == 401) {
          try {
            final refreshed = await refreshToken();
            response = await http.get(uri, headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${refreshed.accessToken}',
            }).timeout(timeout);
          } catch (_) {
            await clearSession();
            throw Exception('Session expired. Please reconnect with your Telegram pairing code.');
          }
        }
        return response;
      } catch (e) {
        lastError = e;
        if (!_isNetworkError(e)) rethrow;
      }
    }
    throw Exception('Could not reach backend server. ($lastError)');
  }

  // ─── _authenticatedPost: POST with auto 401 retry ─────────────────────────
  Future<http.Response> _authenticatedPost(String path, {String? body, Duration timeout = const Duration(seconds: 10)}) async {
    final token = await _getValidToken();
    Object? lastError;
    for (final base in _candidateBaseUrls) {
      try {
        final uri = Uri.parse('$base$path');
        var response = await http.post(uri, headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        }, body: body).timeout(timeout);

        if (response.statusCode == 401) {
          try {
            final refreshed = await refreshToken();
            response = await http.post(uri, headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${refreshed.accessToken}',
            }, body: body).timeout(timeout);
          } catch (_) {
            await clearSession();
            throw Exception('Session expired. Please reconnect with your Telegram pairing code.');
          }
        }
        return response;
      } catch (e) {
        lastError = e;
        if (!_isNetworkError(e)) rethrow;
      }
    }
    throw Exception('Could not reach backend server. ($lastError)');
  }

  // ─── _authenticatedPatch: PATCH with auto 401 retry ────────────────────────
  Future<http.Response> _authenticatedPatch(String path, {String? body, Duration timeout = const Duration(seconds: 10)}) async {
    final token = await _getValidToken();
    Object? lastError;
    for (final base in _candidateBaseUrls) {
      try {
        final uri = Uri.parse('$base$path');
        var response = await http.patch(uri, headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        }, body: body).timeout(timeout);

        if (response.statusCode == 401) {
          try {
            final refreshed = await refreshToken();
            response = await http.patch(uri, headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${refreshed.accessToken}',
            }, body: body).timeout(timeout);
          } catch (_) {
            await clearSession();
            throw Exception('Session expired. Please reconnect with your Telegram pairing code.');
          }
        }
        return response;
      } catch (e) {
        lastError = e;
        if (!_isNetworkError(e)) rethrow;
      }
    }
    throw Exception('Could not reach backend server. ($lastError)');
  }

  // ─── _sendMultipart: multipart helper ─────────────────────────────────────
  Future<http.Response> _sendMultipart(Uri uri, String token, void Function(http.MultipartRequest) build, {required Duration timeout}) async {
    final req = http.MultipartRequest('POST', uri);
    req.headers['Authorization'] = 'Bearer $token';
    build(req);
    final streamed = await req.send().timeout(timeout);
    return http.Response.fromStream(streamed);
  }

  // ─── isSessionValid: async backend ping on startup ────────────────────────
  @override
  Future<bool> isSessionValid() async {
    final token = getAccessToken();
    if (token == null || token.isEmpty) return false;

    final expiresAtMs = _settingsBox.get(_keyTokenExpiresAt) as int?;
    final isLocallyExpired = expiresAtMs != null &&
        DateTime.now().millisecondsSinceEpoch >= (expiresAtMs - 60000);

    if (isLocallyExpired) {
      final rt = getRefreshToken();
      if (rt == null || rt.isEmpty) {
        await clearSession();
        return false;
      }
      try {
        await refreshToken();
        return true;
      } catch (_) {
        await clearSession();
        return false;
      }
    }

    // Token looks valid locally — ping backend to confirm
    for (final base in _candidateBaseUrls) {
      try {
        final uri = Uri.parse('$base/api/v1/me');
        final response = await http.get(uri, headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        }).timeout(const Duration(seconds: 6));

        if (response.statusCode == 200) return true;

        if (response.statusCode == 401) {
          final rt = getRefreshToken();
          if (rt != null && rt.isNotEmpty) {
            try {
              await refreshToken();
              return true;
            } catch (_) {}
          }
          await clearSession();
          return false;
        }

        // Other server error (e.g. 500) — don't log out, server is reachable
        return true;
      } catch (e) {
        if (!_isNetworkError(e)) return true; // Non-network error, keep session
        continue; // Network error — try next candidate
      }
    }

    // All candidates unreachable — keep existing local auth state
    return isAuthenticated();
  }

  @override
  Future<Map<String, dynamic>> postTextTransaction(String text) async {
    final response = await _authenticatedPost(
      '/api/v1/transactions/text',
      body: jsonEncode({'text': text.trim()}),
      timeout: const Duration(seconds: 12),
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<Map<String, dynamic>> saveBankSmsTransaction({
    required double amount,
    required String type,
    required String category,
    String? bankSource,
    DateTime? occurredAt,
    String? note,
    String? smsId,
    String? rawText,
  }) async {
    final payload = <String, dynamic>{
      'amount': amount,
      'type': type,
      'category': category,
      'bankSource': ?bankSource,
      'occurredAt': ?occurredAt?.toIso8601String(),
      'note': ?note,
      'smsId': ?smsId,
      'rawText': ?rawText,
    };

    return postBankSmsBulk([payload]);
  }

  @override
  Future<Map<String, dynamic>> postBankSmsBulk(List<Map<String, dynamic>> messages) async {
    if (messages.isEmpty) {
      return {'success': true, 'processed': 0, 'saved': 0, 'duplicates': 0};
    }

    final response = await _authenticatedPost(
      '/api/v1/transactions/bank-sms',
      body: jsonEncode({'messages': messages}),
      timeout: const Duration(seconds: 15),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      return {'success': true};
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<Map<String, dynamic>> updateTransaction(
    String id, {
    String? category,
    String? type,
    String? note,
  }) async {
    final payload = <String, dynamic>{
      'category': ?category,
      'type': ?type,
      'note': ?note,
    };

    final response = await _authenticatedPatch(
      '/api/v1/transactions/$id',
      body: jsonEncode(payload),
      timeout: const Duration(seconds: 12),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      return {'success': true};
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<List<Map<String, dynamic>>> getTransactionHistory({int limit = 50, int offset = 0, DateTime? since}) async {
    final sinceQuery = since != null ? '&since=${Uri.encodeComponent(since.toUtc().toIso8601String())}' : '';
    final response = await _authenticatedGet(
      '/api/v1/transactions/history?limit=$limit&offset=$offset$sinceQuery',
      timeout: const Duration(seconds: 10),
    );
    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is List) {
        return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<List<Map<String, dynamic>>> getBankSmsTransactions({int limit = 50, int offset = 0, DateTime? since}) async {
    final sinceQuery = since != null ? '&since=${Uri.encodeComponent(since.toUtc().toIso8601String())}' : '';
    final response = await _authenticatedGet(
      '/api/v1/transactions/bank-sms?limit=$limit&offset=$offset$sinceQuery',
      timeout: const Duration(seconds: 10),
    );
    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is List) {
        return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<List<Map<String, dynamic>>> getMatchCandidates(double amount, {String type = 'expense'}) async {
    final amtStr = amount.toStringAsFixed(2);
    final response = await _authenticatedGet(
      '/api/v1/transactions/match-candidates?amountEtb=$amtStr&type=$type',
      timeout: const Duration(seconds: 8),
    );
    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is List) {
        return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      }
      return [];
    }
    return [];
  }

  @override
  Future<Map<String, dynamic>> linkCandidateTransaction({
    required String targetId,
    required String targetType,
    required String category,
    String? note,
    String type = 'expense',
  }) async {
    final payload = {
      'targetId': targetId,
      'targetType': targetType,
      'category': category,
      if (note != null && note.isNotEmpty) 'note': note,
      'type': type,
    };

    final response = await _authenticatedPost(
      '/api/v1/transactions/link-candidate',
      body: jsonEncode(payload),
      timeout: const Duration(seconds: 12),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      return {'success': true};
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  String _extractHttpErrorMessage(String responseBody, int statusCode) {
    try {
      final decoded = jsonDecode(responseBody);
      if (decoded is Map) {
        if (decoded['message'] is String) return decoded['message'] as String;
        if (decoded['message'] is List) return (decoded['message'] as List).join(', ');
        if (decoded['error'] is Map && decoded['error']['message'] is String) {
          return decoded['error']['message'] as String;
        }
        if (decoded['error'] is String) return decoded['error'] as String;
      }
    } catch (_) {}
    return 'Server error ($statusCode)';
  }

  @override
  Future<Map<String, dynamic>> uploadVoiceTransaction(
    List<int> bytes,
    String filename, {
    int durationSeconds = 10,
  }) async {
    final lowerName = filename.toLowerCase();
    final MediaType mediaType;
    if (lowerName.endsWith('.m4a') || lowerName.endsWith('.mp4')) {
      mediaType = MediaType('audio', 'mp4');
    } else if (lowerName.endsWith('.mp3')) {
      mediaType = MediaType('audio', 'mpeg');
    } else if (lowerName.endsWith('.ogg')) {
      mediaType = MediaType('audio', 'ogg');
    } else {
      mediaType = MediaType('audio', 'wav');
    }

    final token = await _getValidToken();
    Object? lastError;
    for (final base in _candidateBaseUrls) {
      try {
        final uri = Uri.parse('$base/api/v1/transactions/voice');
        var response = await _sendMultipart(uri, token, (req) {
          req.fields['durationSeconds'] = durationSeconds.toString();
          req.files.add(http.MultipartFile.fromBytes('file', bytes,
              filename: filename, contentType: mediaType));
        }, timeout: const Duration(seconds: 30));

        if (response.statusCode == 401) {
          final refreshed = await refreshToken();
          response = await _sendMultipart(uri, refreshed.accessToken, (req) {
            req.fields['durationSeconds'] = durationSeconds.toString();
            req.files.add(http.MultipartFile.fromBytes('file', bytes,
                filename: filename, contentType: mediaType));
          }, timeout: const Duration(seconds: 30));
        }

        if (response.statusCode == 200) return jsonDecode(response.body) as Map<String, dynamic>;
        throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
      } catch (e) {
        lastError = e;
        if (!_isNetworkError(e)) rethrow;
      }
    }
    throw Exception('Failed to upload voice note ($lastError)');
  }

  @override
  Future<Map<String, dynamic>> uploadReceiptTransaction(List<int> bytes, String filename) async {
    final token = await _getValidToken();
    final lowerName = filename.toLowerCase();
    final MediaType mediaType;
    if (lowerName.endsWith('.png') || (bytes.length >= 4 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)) {
      mediaType = MediaType('image', 'png');
    } else if (lowerName.endsWith('.webp')) {
      mediaType = MediaType('image', 'webp');
    } else {
      mediaType = MediaType('image', 'jpeg');
    }

    Object? lastError;
    for (final base in _candidateBaseUrls) {
      try {
        final uri = Uri.parse('$base/api/v1/transactions/receipt');
        var response = await _sendMultipart(uri, token, (req) {
          req.files.add(http.MultipartFile.fromBytes('file', bytes,
              filename: filename, contentType: mediaType));
        }, timeout: const Duration(seconds: 30));

        if (response.statusCode == 401) {
          final refreshed = await refreshToken();
          response = await _sendMultipart(uri, refreshed.accessToken, (req) {
            req.files.add(http.MultipartFile.fromBytes('file', bytes,
                filename: filename, contentType: mediaType));
          }, timeout: const Duration(seconds: 30));
        }

        if (response.statusCode == 200) return jsonDecode(response.body) as Map<String, dynamic>;
        throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
      } catch (e) {
        lastError = e;
        if (!_isNetworkError(e)) rethrow;
      }
    }
    throw Exception('Failed to upload receipt ($lastError)');
  }

  @override
  Future<Map<String, dynamic>> undoLatestTransaction() async {
    final response = await _authenticatedPost(
      '/api/v1/transactions/undo',
      timeout: const Duration(seconds: 10),
    );
    if (response.statusCode == 200) return jsonDecode(response.body) as Map<String, dynamic>;
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<List<Map<String, dynamic>>> getIdentities() async {
    final response = await _authenticatedGet('/api/v1/me/identities');
    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      if (decoded is List) {
        return decoded.map((e) => e as Map<String, dynamic>).toList();
      }
      return [];
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<Map<String, dynamic>> getMeProfile() async {
    final response = await _authenticatedGet('/api/v1/me');
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (data['createdAt'] is String) {
        final parsed = DateTime.tryParse(data['createdAt'] as String);
        if (parsed != null) {
          await _settingsBox.put(_keyUserCreatedAt, parsed.millisecondsSinceEpoch);
        }
      }
      if (data['id'] is String) {
        await _settingsBox.put(_keyUserId, data['id'] as String);
      }
      return data;
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<Map<String, dynamic>> getNotificationSettings() async {
    final response = await _authenticatedGet('/api/v1/me/settings/notifications');
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<Map<String, dynamic>> updateNotificationSettings(Map<String, dynamic> settings) async {
    final response = await _authenticatedPatch(
      '/api/v1/me/settings/notifications',
      body: jsonEncode(settings),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw Exception(_extractHttpErrorMessage(response.body, response.statusCode));
  }

  @override
  Future<void> saveSession(AuthSessionModel session) async {
    await _settingsBox.put(_keyAccessToken, session.accessToken);
    await _settingsBox.put(_keyRefreshToken, session.refreshToken);
    await _settingsBox.put(_keySessionId, session.sessionId);
    // Persist token expiry so isAuthenticated() is accurate across restarts
    final ttl = session.expiresInSeconds > 0 ? session.expiresInSeconds : 900;
    final expiresAt = DateTime.now().add(Duration(seconds: ttl)).millisecondsSinceEpoch;
    await _settingsBox.put(_keyTokenExpiresAt, expiresAt);
    if (session.user != null) {
      await _settingsBox.put(_keyUserId, session.user!.id);
      await _settingsBox.put(_keyUserLanguage, session.user!.language);
      if (session.user!.createdAt != null) {
        await _settingsBox.put(_keyUserCreatedAt, session.user!.createdAt!.millisecondsSinceEpoch);
      }
    }
  }

  @override
  Future<void> clearSession() async {
    await _settingsBox.delete(_keyAccessToken);
    await _settingsBox.delete(_keyRefreshToken);
    await _settingsBox.delete(_keySessionId);
    await _settingsBox.delete(_keyTokenExpiresAt);
    await _settingsBox.delete(_keyUserId);
    await _settingsBox.delete(_keyUserLanguage);
    // Note: Do not clear _keyUserCreatedAt or user anchor date so re-login uses the same registration date
  }

  @override
  String? getAccessToken() => _settingsBox.get(_keyAccessToken) as String?;

  @override
  String? getRefreshToken() => _settingsBox.get(_keyRefreshToken) as String?;

  @override
  String? getUserId() => _settingsBox.get(_keyUserId) as String?;

  @override
  DateTime? getUserCreatedAt() {
    final ms = _settingsBox.get(_keyUserCreatedAt) as int?;
    if (ms == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(ms);
  }

  @override
  bool isAuthenticated() {
    final token = getAccessToken();
    if (token == null || token.isEmpty) return false;
    // If token is expired but refresh token still exists, report as authenticated
    // (isSessionValid() will handle the actual refresh when needed)
    final expiresAtMs = _settingsBox.get(_keyTokenExpiresAt) as int?;
    if (expiresAtMs != null) {
      final isExpired = DateTime.now().millisecondsSinceEpoch >= (expiresAtMs - 60000);
      if (isExpired) {
        return getRefreshToken() != null && getRefreshToken()!.isNotEmpty;
      }
    }
    return true;
  }
}
