import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:hive/hive.dart';

import '../../../../../core/utils/platform_utils.dart';
import '../../../domain/usecases/request_sms_permission.dart';
import 'permission_state.dart';

class PermissionCubit extends Cubit<PermissionState> {
  PermissionCubit(this._requestSmsPermission, this._settingsBox)
    : super(const PermissionState());

  static const _grantedKey = 'smsPermissionGranted';

  final RequestSmsPermission _requestSmsPermission;
  final Box<dynamic> _settingsBox;

  Future<void> check() async {
    if (!PlatformUtils.isAndroid) {
      emit(const PermissionState(status: PermissionStatus.unsupported));
      return;
    }

    if (_settingsBox.get(_grantedKey) == true) {
      emit(const PermissionState(status: PermissionStatus.granted));
      return;
    }

    emit(const PermissionState(status: PermissionStatus.denied));
  }

  Future<void> request() async {
    if (!PlatformUtils.isAndroid) {
      emit(
        const PermissionState(
          status: PermissionStatus.unsupported,
          message: 'SMS reading works on Android only.',
        ),
      );
      return;
    }

    emit(const PermissionState(status: PermissionStatus.checking));
    try {
      final granted = await _requestSmsPermission();
      if (granted) {
        await _settingsBox.put(_grantedKey, true);
        emit(const PermissionState(status: PermissionStatus.granted));
        return;
      }
      emit(
        const PermissionState(
          status: PermissionStatus.denied,
          message: 'SMS permission is required to track bank payments.',
        ),
      );
    } catch (error) {
      emit(
        PermissionState(
          status: PermissionStatus.denied,
          message: error.toString(),
        ),
      );
    }
  }
}
