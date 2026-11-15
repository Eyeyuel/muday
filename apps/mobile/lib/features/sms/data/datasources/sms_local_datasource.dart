import '../../../../core/error/exceptions.dart';
import '../../../../core/utils/platform_utils.dart';
import '../models/sms_message_model.dart';
import '../platform/app_sms_reader.dart';

abstract class SmsLocalDataSource {
  Future<bool> requestPermission();

  Future<List<SmsMessageModel>> fetchInbox({
    int start = 0,
    int count = 100,
    int? sinceDateMs,
  });

  Stream<SmsMessageModel> observeIncoming();
}

class SmsLocalDataSourceImpl implements SmsLocalDataSource {
  SmsLocalDataSourceImpl({AppSmsReader? reader})
    : _reader = reader ?? AppSmsReader();

  final AppSmsReader _reader;

  @override
  Future<bool> requestPermission() async {
    if (!PlatformUtils.isAndroid) return false;
    try {
      return await _reader.requestPermissions();
    } catch (error) {
      throw SmsException('Could not request SMS permission: $error');
    }
  }

  @override
  Future<List<SmsMessageModel>> fetchInbox({
    int start = 0,
    int count = 100,
    int? sinceDateMs,
  }) async {
    if (!PlatformUtils.isAndroid) {
      throw const SmsException('SMS reading is only available on Android.');
    }
    try {
      final messages = await _reader.fetchInbox(
        start: start,
        count: count,
        sinceDateMs: sinceDateMs,
      );
      return messages.map(SmsMessageModel.fromPlatform).toList();
    } catch (error) {
      throw SmsException('Could not read SMS inbox: $error');
    }
  }

  @override
  Stream<SmsMessageModel> observeIncoming() {
    if (!PlatformUtils.isAndroid) {
      return const Stream.empty();
    }
    return _reader.observeIncoming().map(SmsMessageModel.fromPlatform);
  }
}
