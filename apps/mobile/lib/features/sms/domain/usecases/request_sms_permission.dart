import '../repositories/sms_repository.dart';

class RequestSmsPermission {
  const RequestSmsPermission(this._repository);

  final SmsRepository _repository;

  Future<bool> call() => _repository.requestPermission();
}
