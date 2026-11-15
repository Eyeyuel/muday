import '../entities/sms_message.dart';

abstract class SmsRepository {
  Future<bool> requestPermission();

  Future<List<SmsMessageEntity>> getInbox({
    int start = 0,
    int count = 100,
    DateTime? sinceDate,
  });

  Stream<SmsMessageEntity> watchIncoming();
}
