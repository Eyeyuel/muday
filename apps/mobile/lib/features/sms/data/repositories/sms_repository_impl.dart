import '../../domain/entities/sms_message.dart';
import '../../domain/repositories/sms_repository.dart';
import '../datasources/sms_local_datasource.dart';

class SmsRepositoryImpl implements SmsRepository {
  const SmsRepositoryImpl(this._dataSource);

  final SmsLocalDataSource _dataSource;

  @override
  Future<bool> requestPermission() => _dataSource.requestPermission();

  @override
  Future<List<SmsMessageEntity>> getInbox({
    int start = 0,
    int count = 100,
    DateTime? sinceDate,
  }) {
    return _dataSource.fetchInbox(
      start: start,
      count: count,
      sinceDateMs: sinceDate?.millisecondsSinceEpoch,
    );
  }

  @override
  Stream<SmsMessageEntity> watchIncoming() => _dataSource.observeIncoming();
}
