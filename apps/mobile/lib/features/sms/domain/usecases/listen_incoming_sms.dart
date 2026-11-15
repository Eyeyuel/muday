import '../entities/sms_message.dart';
import '../repositories/sms_repository.dart';

class ListenIncomingSms {
  const ListenIncomingSms(this._repository);

  final SmsRepository _repository;

  Stream<SmsMessageEntity> call() => _repository.watchIncoming();
}
