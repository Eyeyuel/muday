import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../cubit/settings_cubit.dart';
import '../cubit/settings_state.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
        children: [
          Text('settings'.tr(), style: AppTextStyles.title(context)),
          const SizedBox(height: 24),
          Text('appearance'.tr(), style: AppTextStyles.section(context)),
          const SizedBox(height: 10),
          BlocBuilder<SettingsCubit, SettingsState>(
            builder: (context, state) {
              return Card(
                child: SwitchListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 4,
                  ),
                  title: Text('darkMode'.tr()),
                  value: state.isDark,
                  activeThumbColor: AppColors.primary,
                  onChanged: (value) {
                    context.read<SettingsCubit>().setDarkMode(value);
                  },
                ),
              );
            },
          ),
          const SizedBox(height: 28),
          Text('language'.tr(), style: AppTextStyles.section(context)),
          const SizedBox(height: 10),
          Builder(
            builder: (context) {
              final currentLocale = context.locale;
              final options = [
                (const Locale('en'), 'english'.tr()),
                (const Locale('am'), 'amharic'.tr()),
              ];
              return Card(
                child: Column(
                  children: [
                    for (var i = 0; i < options.length; i++) ...[
                      if (i > 0) const Divider(height: 1),
                      ListTile(
                        title: Text(options[i].$2),
                        trailing: Icon(
                          options[i].$1.languageCode ==
                                  currentLocale.languageCode
                              ? Icons.check_circle_rounded
                              : Icons.circle_outlined,
                          color: options[i].$1.languageCode ==
                                  currentLocale.languageCode
                              ? AppColors.primary
                              : Theme.of(context).hintColor,
                        ),
                        onTap: () async {
                          await context.setLocale(options[i].$1);
                          if (context.mounted) {
                            context.read<SettingsCubit>().setLocale(options[i].$1);
                          }
                        },
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
