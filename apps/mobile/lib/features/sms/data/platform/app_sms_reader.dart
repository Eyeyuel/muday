import 'package:flutter/services.dart';

class AppSmsMessage {
  const AppSmsMessage({
    required this.id,
    required this.address,
    required this.body,
    required this.date,
  });

  factory AppSmsMessage.fromMap(Map<String, dynamic> map) {
    return AppSmsMessage(
      id: (map['id'] as num?)?.toInt() ?? 0,
      address: (map['address'] as String?) ?? '',
      body: (map['body'] as String?) ?? '',
      date: (map['date'] as num?)?.toInt() ?? 0,
    );
  }

  final int id;
  final String address;
  final String body;
  final int date;
}

class AppSmsReader {
  static const _channel = MethodChannel('app_sms_reader');
  static const _events = EventChannel('app_sms_observer');

  Future<bool> requestPermissions() async {
    final granted = await _channel.invokeMethod<bool>('requestPermissions');
    return granted ?? false;
  }

  Future<List<AppSmsMessage>> fetchInbox({
    int start = 0,
    int count = 100,
    int? sinceDateMs,
  }) async {
    final args = <String, dynamic>{
      'type': 'inbox',
      'start': start,
      'count': count,
    };
    if (sinceDateMs != null && sinceDateMs > 0) {
      args['sinceDate'] = sinceDateMs;
    }

    final result = await _channel.invokeMethod<List<dynamic>>(
      'fetchMessages',
      args,
    );
    return (result ?? const [])
        .map((item) => AppSmsMessage.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Stream<AppSmsMessage> observeIncoming() {
    return _events.receiveBroadcastStream().map((event) {
      return AppSmsMessage.fromMap(Map<String, dynamic>.from(event as Map));
    });
  }
}
