import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_text_styles.dart';
import '../../bloc/permission/permission_cubit.dart';
import '../../bloc/permission/permission_state.dart';

class PermissionPage extends StatelessWidget {
  const PermissionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          child: BlocBuilder<PermissionCubit, PermissionState>(
            builder: (context, state) {
              final unsupported =
                  state.status == PermissionStatus.unsupported;
              final checking = state.status == PermissionStatus.checking;

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(),
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: const Icon(
                      Icons.sms_outlined,
                      color: AppColors.primary,
                      size: 34,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    unsupported ? 'androidOnly'.tr() : 'trackSpending'.tr(),
                    style: AppTextStyles.title(context),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    unsupported
                        ? 'permissionUnsupported'.tr()
                        : 'permissionBody'.tr(),
                    style: AppTextStyles.body(context),
                  ),
                  if (state.message != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      state.message!,
                      style: AppTextStyles.body(context).copyWith(
                        color: AppColors.danger,
                      ),
                    ),
                  ],
                  const Spacer(),
                  if (!unsupported)
                    FilledButton(
                      onPressed: checking
                          ? null
                          : () => context.read<PermissionCubit>().request(),
                      child: checking
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text('allowSms'.tr()),
                    ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
