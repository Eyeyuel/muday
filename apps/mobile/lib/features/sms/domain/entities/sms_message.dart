import 'package:equatable/equatable.dart';

class SmsMessageEntity extends Equatable {
  const SmsMessageEntity({
    required this.smsId,
    required this.sender,
    required this.body,
    required this.date,
  });

  final String smsId;
  final String sender;
  final String body;
  final DateTime date;

  @override
  List<Object?> get props => [smsId, sender, body, date];
}
