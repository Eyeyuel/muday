import '../../../../core/utils/date_utils.dart';
import '../../domain/entities/sms_message.dart';
import '../platform/app_sms_reader.dart';

class SmsMessageModel extends SmsMessageEntity {
  const SmsMessageModel({
    required super.smsId,
    required super.sender,
    required super.body,
    required super.date,
  });

  factory SmsMessageModel.fromPlatform(AppSmsMessage message) {
    return SmsMessageModel(
      smsId: _stableId(message),
      sender: message.address,
      body: message.body,
      date: AppDateUtils.fromSmsMillis(message.date),
    );
  }

  static String _stableId(AppSmsMessage message) {
    if (message.id > 0) return message.id.toString();
    return '${message.address}|${message.date}|${message.body.hashCode}';
  }
}
