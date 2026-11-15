export const enCatalog = {
  welcome: 'Welcome to {appName}.',
  'onboarding.new':
    '👋 Welcome to Muday\n\nYour simple personal ETB money tracker inside Telegram.\n\n✍️ Log transactions using text\n🎙️ Record transactions using voice\n🧾 Scan one clear receipt photo\n📊 View daily, weekly and monthly summaries\n📈 Open your private financial dashboard\n\nBefore we begin, review how your information is processed.',
  'consent.introduction': 'Please review and accept the privacy notice before using Muday.',
  'consent.text':
    'Privacy and consent (version {consentVersion})\n\nMuday stores your Telegram account identifier, language, consent history, and the financial records you choose to submit. Telegram transports messages, voice notes, and receipt images to the bot. Text and receipt images may be sent to Google Gemini, an external AI provider, to extract the financial records you requested. Voice notes are downloaded temporarily and sent to Hasab AI for speech-to-text transcription; the returned transcript is then sent to Google Gemini for transaction extraction. Muday deletes temporary audio and image files after processing and does not intentionally retain transcripts or receipt images. Hasab AI and Google may process or retain submitted content under their own terms and policies. You may continue using text logging without sending voice notes or images. Muday uses stored data to provide personal finance tracking, summaries, and requested notifications. You can request deletion with /deletemydata.\n\nBy selecting “I Agree,” you consent to this processing. Development testing must use synthetic or explicitly consented data. This text is a product draft and requires provider-retention and privacy/legal review before real-user or public launch.',
  'consent.agree': 'I Agree',
  'consent.review': '🔐 Review privacy notice',
  'consent.not_now': 'Not now',
  'consent.accepted': 'Consent recorded. You can now use Muday.',
  'consent.already_accepted': 'Your consent for this version is already recorded.',
  'consent.expired': 'This consent button expired. Send /start to review it again.',
  'consent.outdated': 'This consent text has changed. Send /start to review the current version.',
  'consent.invalid': 'This consent button is invalid. Send /start to get a new one.',
  'consent.required': 'Consent is required before financial features can be used. Send /start.',
  tutorial:
    'Tutorial: send “I spent 250 birr on transport today,” record it as a short voice note, or send one clear receipt photo. Receipt results must be confirmed before saving.',
  'onboarding.ready':
    '✅ You’re ready to use Muday\n\nTry one of these:\n\n✍️ Text: “I paid 350 birr for groceries.”\n🎙️ Voice: Say “I paid 200 birr for taxi.”\n🧾 Receipt: Send one clear photo showing the final ETB total.\n\nOr choose an option below.',
  'onboarding.app_code':
    '📱 Your Muday app access code:\n\n<code>{code}</code>\n\nTap the code above to copy it, or tap the button below to open the app automatically.\n\nTo get a new code, type /mycode.',
  'onboarding.returning':
    '👋 Welcome back to Muday\n\nSend a transaction using text, voice or one clear receipt photo, or choose an option below.',
  'mycode.prompt':
    'Generating a new code will sign you out of all mobile app sessions. Do you want to continue?',
  'mycode.regenerated':
    '📱 Your new Muday app code:\n\n<code>{code}</code>\n\nTap the code to copy it, or tap the button below to open the app automatically.',
  'mycode.not_active':
    'Please complete your registration on the Muday bot first before using the mobile app.',
  'mycode.cancelled': 'Cancelled.',
  'language.prompt': 'Choose your language.',
  'language.prompt_initial':
    'Welcome to Muday! / ወደ ሙዳይ እንኳን ደህና መጡ!\n\nPlease choose your language / እባክዎን ቋንቋ ይምረጡ:',
  'language.updated': 'Your language has been updated.',
  'language.updated_pending':
    'Your language has been updated. Send /start to continue reviewing privacy and consent.',
  'navigation.dashboard': '📈 Open dashboard',
  'navigation.today': '📊 Today',
  'navigation.week': '📅 This week',
  'navigation.month': '🗓 This month',
  'navigation.settings': '⚙️ Settings',
  'navigation.undo': '↩️ Undo',
  'navigation.language': '🌐 Language',
  'navigation.help': '❓ Help',
  help: 'Muday helps you track income and expenses. Use /start, /language, or /help.',
  'help.pending':
    'Muday is a personal ETB income and expense tracker.\n\n/start - Review onboarding and consent\n/language - ቋንቋ / Language\n/help - Show help\n\nConsent is required before text or voice logging can be used. The MVP supports ETB and current-time transactions only.',
  'help.active':
    '❓ Muday Help\n\nRecord transactions\n✍️ Send text: “I paid 300 birr for electricity.”\n🎙️ Send a short voice note.\n🧾 Send one clear receipt photo and confirm its result.\n\nMuday can separate earned income, ordinary expenses, loans, repayments, refunds, and reimbursements. Transfers between your own accounts are not saved. Review any clarification or confirmation before accepting it.\n\nSummaries\n/today - Today\n/week - This week\n/month - This month\n\nAccount\n/settings - Reminders and times\n/language - Change language\n/undo - Undo the latest transaction group\n/deletemydata - Permanently delete your Muday data\n\nMuday supports ETB and current-time transactions only.',
  'callback.invalid': 'This button is invalid or unavailable. Please try the command again.',
  'error.generic': 'Something went wrong. Please try again.',
  'error.try_text': 'I could not process that voice note. Please try sending it as text.',
  'voice.queued': '🎙️ Voice note received. I am processing it now.',
  'voice.too_short': 'That voice note is too short. Please send a slightly longer recording.',
  'voice.too_long': 'That voice note is too long. Please send a shorter recording.',
  'voice.too_large': 'That voice file is too large. Please send a shorter recording.',
  'voice.rate_limited': 'Too many voice notes. Please wait one minute and try again.',
  'voice.unavailable':
    'Voice processing is temporarily unavailable. No transaction was saved. Please start the voice worker or send the transaction as text.',
  'voice.failed':
    'I could not process that voice note. No transaction was saved. Please try again or send it as text.',
  'receipt.queued': '🧾 Receipt received. I am reading it now.',
  'receipt.too_large': 'That receipt image is too large. Send an image smaller than 10 MB.',
  'receipt.rate_limited': 'Too many receipt images. Please wait one minute and try again.',
  'receipt.unavailable':
    'Receipt processing is temporarily unavailable. No transaction was saved. Please start the worker and try again.',
  'receipt.failed':
    'I could not process that receipt. No transaction was saved. Send one clear JPEG, PNG, or WebP image and try again.',
  'receipt.unclear':
    'I could not confidently read one ETB receipt total. Nothing was saved. Retake one clear receipt showing the final total.',
  'receipt.confirm':
    '🧾 I found this receipt transaction. Nothing is saved yet. Check the amount and category carefully:\n\n{transactions}\n\nSave this transaction?',
  'transaction.confirmed': 'Transaction saved.',
  'transaction.confirmation':
    '✅ {type} recorded\n\nAmount: {amount} ETB\nCategory: {category}\nNote: {note}\n\nUse /undo to reverse it.',
  'transaction.group_confirmation':
    '✅ Recorded successfully\n\n{transactions}\n\nUse /undo if this is incorrect.',
  'transaction.first_log':
    '🎉 Your first transaction is recorded!\n\nUse /today to see today’s totals, open your dashboard for a wider view, or use /settings to manage reminders.',
  'transaction.transfer_ignored':
    '🔄 An internal transfer was detected and was not saved. Muday uses one combined financial view, so moving your own money does not count as income or expense.',
  'transaction.classification_clarification':
    'I understand the amount, but I need one detail before categorizing it. Nothing was saved. Please resend the transaction and explain who paid whom and what the money was for.',
  'transaction.high_value_confirm':
    '⚠️ This includes an amount above 100,000 ETB. Nothing is saved yet.\n\n{transactions}\n\nDo you want to record it?',
  'transaction.financial_confirm':
    'Please review this classification. Nothing is saved yet.\n\n{transactions}\n\n{effects}\n\nDo you want to record it?',
  'transaction.type.income': 'Income',
  'transaction.type.expense': 'Expense',
  'transaction.type.loan_received': 'Loan received',
  'transaction.type.loan_repayment': 'Loan repayment',
  'transaction.type.refund': 'Refund',
  'transaction.type.reimbursement': 'Reimbursement',
  'platform.telebirr': 'Telebirr',
  'platform.cbe': 'CBE',
  'platform.cbe_birr': 'CBE Birr',
  'platform.boa': 'Bank of Abyssinia',
  'platform.awash': 'Awash Bank',
  'platform.dashen': 'Dashen Bank',
  'platform.cash': 'Cash',
  'platform.other_bank': 'Bank',
  'transaction.effect.loan_received':
    'ℹ️ This increases cash inflow, but it is borrowed money and does not count as earned income.',
  'transaction.effect.loan_repayment':
    'ℹ️ This decreases cash, but principal repayment is tracked separately from ordinary living expenses.',
  'transaction.effect.refund':
    'ℹ️ This reduces reported expenses and does not count as earned income.',
  'transaction.effect.reimbursement':
    'ℹ️ This recovers an earlier expense and does not count as earned income.',
  'transaction.no_note': 'None',
  'transaction.invalid':
    'I couldn’t understand that transaction clearly. Please try recording again or send it as text (e.g. “250 birr for lunch with Telebirr”).',
  'transaction.invalid_amount': 'Enter an amount greater than 0 and below 1,000,000 ETB.',
  'transaction.amount_missing':
    'I could not find the amount. Example: “250 birr for lunch with Telebirr.”',
  'transaction.currency_unsupported': 'Muday currently supports ETB only.',
  'transaction.category_unknown':
    'I could not determine the category. Include a word such as lunch, taxi, rent, or salary.',
  'transaction.high_value': 'Amounts above 100,000 ETB require confirmation. Nothing was saved.',
  'transaction.rate_limited': 'Too many attempts. Please wait one minute and try again.',
  'transaction.input_too_long': 'That message is too long. Send one short transaction.',
  'transaction.clarify_amount': 'What was the amount in ETB?',
  'transaction.clarify_type': 'Was this income or an expense?',
  'clarification.amount':
    'How much was the {category} transaction? Reply once with the ETB amount.',
  'clarification.type': 'Should this transaction be recorded as income or expense?',
  'clarification.failed':
    'I still could not understand the answer, so nothing was saved. Try a new message such as “250 birr for lunch with Telebirr.”',
  'clarification.financial_ownership':
    'What kind of money movement was this? Nothing will be saved until you choose.',
  'clarification.financial_purpose':
    'What was this money for? Nothing will be saved until you choose.',
  'clarification.principal_interest':
    'Please resend this loan payment with separate principal and interest amounts. Nothing was saved because Muday will not guess the split.',
  'interaction.expired_or_used':
    'This question has expired or was already handled. Send the transaction again if needed.',
  'interaction.cancelled': 'Cancelled. Nothing was changed.',
  'undo.preview': 'Undo this latest transaction group?\n\n{transactions}',
  'undo.none': 'There is no active transaction group to undo.',
  'undo.completed': 'The latest transaction group was undone.',
  'button.income': 'Income',
  'button.expense': 'Expense',
  'button.confirm': '✅ Confirm',
  'button.cancel': '❌ Cancel',
  'button.undo': '↩️ Undo',
  'button.keep': 'Keep it',
  'button.own_transfer': '🔄 Between my accounts',
  'button.paid_someone': '↗️ I paid someone',
  'button.paid_me': '↙️ Someone paid me',
  'button.work_payment': '💼 Work payment',
  'button.gift_received': '🎁 Gift',
  'button.loan_received': '🤝 Loan received',
  'button.loan_repayment': '💳 Loan repayment',
  'button.refund': '↩️ Refund',
  'button.reimbursement': '🧾 Reimbursement',
  'undo.prompt': 'Do you want to remove your most recent transaction?',
  'undo.nothing': 'No transaction found to undo.',
  'undo.success': 'Undone:\n{transactions}',
  'deletion.prompt_1':
    'Delete all your Muday data? This includes your transactions, consent history, preferences, interactions, and notification records. You can cancel without changing anything.',
  'deletion.prompt_2':
    'Final confirmation: this permanently removes your Muday account and financial data and cannot be undone. Continue only if you are certain.',
  'deletion.no_data': 'There is no Muday account data associated with this Telegram account.',
  'deletion.in_progress': 'Your data deletion is already in progress. Please wait.',
  'deletion.cancelled': 'Deletion cancelled. None of your data was changed.',
  'deletion.expired_or_used':
    'This deletion confirmation expired or was already used. Send /deletemydata again if needed.',
  'deletion.completed':
    'Your Muday account and data were permanently deleted. You may send /start to create a completely new account.',
  'deletion.already_completed': 'Your Muday data was already deleted.',
  'button.continue_deletion': 'Continue',
  'button.permanently_delete': 'Permanently delete',
  'message.unsupported':
    'Transaction logging is not available yet. Use /help to see the current features.',
  'privacy.private_only':
    'For your privacy, Muday only accepts financial information and commands in a private chat with the bot.',
  'settings.body':
    '⚙️ Settings\n\nMorning reminder: {morningStatus}\nMorning time: {morningTime} EAT\n\nNight status: {nightStatus}\nNight time: {nightTime} EAT\n\nChoose a toggle or one of the preset times below.',
  'settings.enabled': 'Enabled',
  'settings.disabled': 'Disabled',
  'settings.button.enable_morning': 'Enable morning reminder',
  'settings.button.disable_morning': 'Disable morning reminder',
  'settings.button.enable_night': 'Enable night status',
  'settings.button.disable_night': 'Disable night status',
  'notification.morning.0':
    '☀️ Good morning! Remember to record today’s income and expenses. Send text or a short voice note.',
  'notification.morning.1':
    '☀️ A quick Muday reminder: log money as it happens today so your summary stays useful.',
  'notification.morning.2':
    '☀️ New day, clear records. Send any income or expense to Muday when it happens.',
  'notification.night.empty':
    '🌙 Nothing was recorded today. If you spent or received money, send it now before you forget.',
  'notification.night.body':
    '🌙 Today’s status\n\nEarned income: {income} ETB\nOrdinary expenses after recoveries: {expenses} ETB\nEarned net: {net} ETB\n\nCash inflow: {cashInflow} ETB\nCash outflow: {cashOutflow} ETB\nCash-flow net: {cashNet} ETB\nTransactions: {count}\n\n{insight}',
  'notification.weekly.title': 'This week so far',
  'notification.monthly.title': 'Last month',
  'notification.monthly.largest': 'Largest expense: {category} - {amount} ETB',
  'notification.monthly.no_largest': 'No expenses were recorded last month.',
  'summary.title.today': 'Today',
  'summary.title.week': 'This Week',
  'summary.title.month': 'This Month',
  'summary.title.all': 'All Time',
  'banks.title': '🏦 Bank & Account Activity ({period})',
  'banks.empty': 'No bank transactions found in this period.',
  'banks.line': '{bank}: {count} transactions • {amount} ETB',
  'banks.total': 'Total Tracked: {count} transactions • {amount} ETB',
  'smart_match.prompt':
    '💡 Smart Match Detected!\nWe found a matching {bank} payment of {amount} ETB from {time}.\nWould you like to link them together to prevent duplicate records?',
  'smart_match.multi_prompt':
    '💡 Multiple Matching Payments Found!\nWe found {count} unreviewed bank payments of {amount} ETB. Which one would you like to link?',
  'smart_match.link_btn': '🔗 Link with {bank}',
  'smart_match.link_item_btn': '🔗 {bank} ({time})',
  'smart_match.dismiss_btn': '❌ Keep Separate',
  'smart_match.linked': '✅ Linked successfully with {bank} transaction!',
  'smart_match.dismissed': 'Kept as separate transaction.',
  'summary.body':
    '📊 {title}\n\nEarned income: {income} ETB\nOrdinary expenses after recoveries: {expenses} ETB\nEarned net: {net} ETB\n\nCash inflow: {cashInflow} ETB\nCash outflow: {cashOutflow} ETB\nCash-flow net: {cashNet} ETB\nTransactions: {count}\n\nOther cash movements:\n{movements}\n\nTop ordinary expense categories:\n{categories}\n\nCompared with the previous period:\n{comparison}\n\nInsight:\n{insight}',
  'summary.movement.line': '{kind} - {amount} ETB',
  'summary.movements.none': 'No special cash movements.',
  'summary.category.line': '{rank}. {category} - {amount} ETB ({percentage}%)',
  'summary.categories.none': 'No expenses recorded.',
  'summary.comparison.unchanged': 'Ordinary expenses after recoveries did not change.',
  'summary.comparison.no_prior':
    'You recorded {amount} ETB in ordinary expenses after recoveries; none were recorded in the previous period.',
  'summary.comparison.recovery_exceeded':
    'Refunds and reimbursements exceeded ordinary expenses by {amount} ETB in this period.',
  'summary.comparison.increased':
    'Ordinary expenses after recoveries increased by {amount} ETB ({percentage}%).',
  'summary.comparison.decreased':
    'Ordinary expenses after recoveries decreased by {amount} ETB ({percentage}%).',
  'summary.insight.no_activity': 'No transactions were recorded in this period.',
  'summary.insight.no_expenses': 'You recorded transactions without any expenses in this period.',
  'summary.insight.top_category': '{category} was your largest expense category.',
  'summary.insight.negative_net': 'Your expenses were higher than your income in this period.',
  'summary.insight.balanced': 'Your income and expenses were balanced in this period.',
  'category.salary': 'Salary',
  'category.business': 'Business',
  'category.remittance': 'Remittance',
  'category.other_income': 'Other income',
  'category.food': 'Food',
  'category.transport': 'Transport',
  'category.rent': 'Rent',
  'category.utilities': 'Utilities',
  'category.airtime_data': 'Airtime and data',
  'category.health': 'Health',
  'category.education': 'Education',
  'category.family_support': 'Family support',
  'category.entertainment': 'Entertainment',
  'category.clothing': 'Clothing',
  'category.church_charity': 'Church and charity',
  'category.other': 'Other',
  'category.freelance': 'Freelance',
  'category.gift_received': 'Gift received',
  'category.investment_return': 'Investment return',
  'category.rental_income': 'Rental income',
  'category.food_groceries': 'Food & groceries',
  'category.housing_rent': 'Housing & rent',
  'category.airtime_internet': 'Airtime & internet',
  'category.clothing_personal_care': 'Clothing & personal care',
  'category.shopping_household': 'Shopping & household',
  'category.fees_taxes': 'Fees & taxes',
  'category.church_charity_gifts': 'Church, charity & gifts',
  'category.travel': 'Travel',
  'category.other_expense': 'Other expense',
  'category.borrowed_money': 'Borrowed money',
  'category.debt_repayment': 'Debt repayment',
  'category.refund': 'Refund',
  'category.reimbursement': 'Reimbursement',
} as const;
