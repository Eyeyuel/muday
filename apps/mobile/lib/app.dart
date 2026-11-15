import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:toastification/toastification.dart';

import 'core/di/injection.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/data/datasources/auth_datasource.dart';
import 'features/expense/presentation/bloc/expense/expense_bloc.dart';
import 'features/expense/presentation/pages/shell/app_shell.dart';
import 'features/settings/presentation/cubit/settings_cubit.dart';
import 'features/settings/presentation/cubit/settings_state.dart';
import 'features/sms/presentation/bloc/permission/permission_cubit.dart';
import 'features/sms/presentation/bloc/permission/permission_state.dart';
import 'features/sms/presentation/bloc/sms/sms_bloc.dart';
import 'features/sms/presentation/pages/permission/permission_page.dart';
import 'features/telegram/presentation/pages/telegram_connect_page.dart';

class ExpenseApp extends StatelessWidget {
  const ExpenseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(value: sl<SettingsCubit>()),
        BlocProvider(create: (_) => sl<PermissionCubit>()..check()),
        BlocProvider(create: (_) => sl<SmsBloc>()),
        BlocProvider(create: (_) => sl<ExpenseBloc>()),
      ],
      child: BlocBuilder<SettingsCubit, SettingsState>(
        builder: (context, settings) {
          return ToastificationWrapper(
            child: MaterialApp(
              title: 'appTitle'.tr(),
              debugShowCheckedModeBanner: false,
              theme: AppTheme.light(),
              darkTheme: AppTheme.dark(),
              themeMode: settings.themeMode,
              locale: context.locale,
              supportedLocales: context.supportedLocales,
              localizationsDelegates: context.localizationDelegates,
              home: const _RootPage(),
            ),
          );
        },
      ),
    );
  }
}

class _RootPage extends StatefulWidget {
  const _RootPage();

  @override
  State<_RootPage> createState() => _RootPageState();
}

class _RootPageState extends State<_RootPage> {
  late Future<bool> _sessionCheckFuture;

  @override
  void initState() {
    super.initState();
    _sessionCheckFuture = sl<AuthDataSource>().isSessionValid();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PermissionCubit, PermissionState>(
      builder: (context, state) {
        // While permissions are still being checked, show spinner
        if (state.status == PermissionStatus.checking) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        return FutureBuilder<bool>(
          future: _sessionCheckFuture,
          builder: (context, snapshot) {
            // Validating session — show a brief splash
            if (snapshot.connectionState != ConnectionState.done) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }

            final isValid = snapshot.data ?? false;

            if (!isValid) {
              return const TelegramConnectPage(isFirstPage: true);
            }

            if (state.status == PermissionStatus.granted) {
              return const AppShell();
            }

            return const PermissionPage();
          },
        );
      },
    );
  }
}
