import 'package:equatable/equatable.dart';

import '../../../../../core/constants/sms_time_filter.dart';
import '../../../domain/entities/sms_message.dart';

abstract class SmsEvent extends Equatable {
  const SmsEvent();

  @override
  List<Object?> get props => [];
}

class SmsStarted extends SmsEvent {
  const SmsStarted({this.timeFilter = SmsTimeFilter.monthly});

  final SmsTimeFilter timeFilter;

  @override
  List<Object?> get props => [timeFilter];
}

class SmsIncomingReceived extends SmsEvent {
  const SmsIncomingReceived(this.message);

  final SmsMessageEntity message;

  @override
  List<Object?> get props => [message];
}

class SmsTransactionHandled extends SmsEvent {
  const SmsTransactionHandled(this.smsId);

  final String smsId;

  @override
  List<Object?> get props => [smsId];
}
