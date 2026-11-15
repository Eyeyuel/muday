import 'package:equatable/equatable.dart';

enum PermissionStatus { checking, unsupported, denied, granted }

class PermissionState extends Equatable {
  const PermissionState({
    this.status = PermissionStatus.checking,
    this.message,
  });

  final PermissionStatus status;
  final String? message;

  PermissionState copyWith({
    PermissionStatus? status,
    String? message,
  }) {
    return PermissionState(
      status: status ?? this.status,
      message: message,
    );
  }

  @override
  List<Object?> get props => [status, message];
}
