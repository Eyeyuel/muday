import '../../../../core/constants/sms_limits.dart';
import '../entities/sms_message.dart';
import '../repositories/sms_repository.dart';

class GetSmsHistory {
  const GetSmsHistory(this._repository);

  final SmsRepository _repository;

  Stream<List<SmsMessageEntity>> streamPages({
    int maxMessages = SmsLimits.historyMax,
    int pageSize = SmsLimits.historyPageSize,
    DateTime? sinceDate,
  }) async* {
    var start = 0;
    while (start < maxMessages) {
      final page = await _repository.getInbox(
        start: start,
        count: pageSize,
        sinceDate: sinceDate,
      );
      if (page.isEmpty) break;
      yield page;
      if (sinceDate != null && page.isNotEmpty && page.last.date.isBefore(sinceDate)) {
        // Since SMS inbox is sorted newest first, we can stop scanning older batches
        break;
      }
      if (page.length < pageSize) break;
      start += pageSize;
      await Future<void>.delayed(const Duration(milliseconds: 15));
    }
  }

  Future<List<SmsMessageEntity>> call({
    int maxMessages = SmsLimits.historyMax,
  }) async {
    final messages = <SmsMessageEntity>[];
    await for (final page in streamPages(maxMessages: maxMessages)) {
      messages.addAll(page);
    }
    return messages;
  }
}
