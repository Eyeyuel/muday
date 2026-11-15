import 'package:get_it/get_it.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../../features/auth/data/datasources/auth_datasource.dart';
import '../../features/expense/data/repositories/expense_repository_impl.dart';
import '../../features/expense/data/services/offline_sync_service.dart';
import '../../features/expense/domain/repositories/expense_repository.dart';
import '../../features/expense/domain/usecases/get_expenses.dart';
import '../../features/expense/domain/usecases/is_sms_already_saved.dart';
import '../../features/expense/domain/usecases/save_expense.dart';
import '../../features/expense/presentation/bloc/expense/expense_bloc.dart';
import '../../features/sms/data/datasources/sms_local_datasource.dart';
import '../../features/sms/data/parsers/bank_sms_parser.dart';
import '../../features/sms/data/repositories/sms_repository_impl.dart';
import '../../features/sms/data/services/sms_anchor_date_service.dart';
import '../../features/sms/data/services/sms_bulk_sync_service.dart';
import '../../features/sms/domain/parsers/bank_transaction_parser.dart';
import '../../features/sms/domain/repositories/sms_repository.dart';
import '../../features/sms/domain/usecases/get_sms_history.dart';
import '../../features/sms/domain/usecases/listen_incoming_sms.dart';
import '../../features/sms/domain/usecases/parse_bank_sms.dart';
import '../../features/sms/domain/usecases/request_sms_permission.dart';
import '../../features/settings/presentation/cubit/settings_cubit.dart';
import '../../features/sms/presentation/bloc/permission/permission_cubit.dart';
import '../../features/sms/presentation/bloc/sms/sms_bloc.dart';

final sl = GetIt.instance;

const settingsBoxName = 'settings';

Future<void> configureDependencies() async {
  await Hive.initFlutter();
  final settingsBox = await Hive.openBox<dynamic>(settingsBoxName);

  sl
    ..registerLazySingleton<Box<dynamic>>(
      () => settingsBox,
      instanceName: settingsBoxName,
    )
    ..registerLazySingleton<AuthDataSource>(
      () => AuthDataSourceImpl(sl(instanceName: settingsBoxName)),
    )
    ..registerLazySingleton<OfflineSyncService>(
      () => OfflineSyncService(
        sl(instanceName: settingsBoxName),
        sl<AuthDataSource>(),
      ),
    )
    ..registerLazySingleton<SmsLocalDataSource>(SmsLocalDataSourceImpl.new)
    ..registerLazySingleton<SmsRepository>(
      () => SmsRepositoryImpl(sl()),
    )
    ..registerLazySingleton<BankTransactionParser>(BankSmsParser.new)
    ..registerLazySingleton(() => RequestSmsPermission(sl()))
    ..registerLazySingleton(() => GetSmsHistory(sl()))
    ..registerLazySingleton(() => ListenIncomingSms(sl()))
    ..registerLazySingleton(() => ParseBankSms(sl()))
    ..registerLazySingleton<ExpenseRepository>(
      () => ExpenseRepositoryImpl(sl<AuthDataSource>(), sl<OfflineSyncService>()),
    )
    ..registerLazySingleton(() => SaveExpense(sl()))
    ..registerLazySingleton(() => GetExpenses(sl()))
    ..registerLazySingleton(() => IsSmsAlreadySaved(sl()))
    ..registerFactory(
      () => PermissionCubit(
        sl(),
        sl(instanceName: settingsBoxName),
      ),
    )
    ..registerLazySingleton<SmsBulkSyncService>(
      () => SmsBulkSyncService(
        sl<AuthDataSource>(),
        sl<OfflineSyncService>(),
      ),
    )
    ..registerLazySingleton<SmsAnchorDateService>(
      () => SmsAnchorDateService(sl(instanceName: settingsBoxName)),
    )
    ..registerFactory(
      () => SmsBloc(
        getSmsHistory: sl(),
        listenIncomingSms: sl(),
        parseBankSms: sl(),
        isSmsAlreadySaved: sl(),
        smsBulkSyncService: sl(),
        anchorDateService: sl(),
        authDataSource: sl(),
      ),
    )
    ..registerFactory(() => ExpenseBloc(sl(), sl()))
    ..registerLazySingleton(
      () => SettingsCubit(sl(instanceName: settingsBoxName)),
    );
}
