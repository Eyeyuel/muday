export const TELEGRAM_COMMANDS = [
  { command: 'start', description: 'Open Muday home and onboarding' },
  { command: 'summary', description: 'Interactive financial summary and timeframes' },
  { command: 'today', description: "Show today's financial summary" },
  { command: 'week', description: "Show this week's financial summary" },
  { command: 'month', description: "Show this month's financial summary" },
  { command: 'banks', description: 'Show bank & account breakdown' },
  { command: 'pending', description: 'Review uncategorized bank transactions' },
  { command: 'settings', description: 'Manage reminders and notification times' },
  { command: 'deletemydata', description: 'Permanently delete your account and data' },
  { command: 'language', description: 'Change language' },
  { command: 'undo', description: 'Undo latest transaction group' },
  { command: 'help', description: 'Show Muday help' },
  { command: 'mycode', description: 'Get mobile app pairing code' },
] as const;

export const TELEGRAM_COMMANDS_AM = [
  { command: 'start', description: 'ሙዳይን ይክፈቱ እና ይጀምሩ' },
  { command: 'summary', description: 'የገንዘብ ማጠቃለያ በጊዜ ክፍለ ጊዜ' },
  { command: 'today', description: 'የዛሬን የገንዘብ ማጠቃለያ ይመልከቱ' },
  { command: 'week', description: 'የዚህን ሳምንት ማጠቃለያ ይመልከቱ' },
  { command: 'month', description: 'የዚህን ወር ማጠቃለያ ይመልከቱ' },
  { command: 'banks', description: 'የባንክና አካውንት እንቅስቃሴ ማጠቃለያ' },
  { command: 'pending', description: 'ያልተመደቡ የባንክ ግብይቶችን ይመድቡ' },
  { command: 'settings', description: 'ማስታወሻዎችንና ሰዓቶችን ያስተካክሉ' },
  { command: 'deletemydata', description: 'መለያዎንና ውሂብዎን ይሰርዙ' },
  { command: 'language', description: 'ቋንቋ ይቀይሩ' },
  { command: 'undo', description: 'የመጨረሻውን ግብይት ይመልሱ' },
  { command: 'help', description: 'የሙዳይ መመሪያን ይመልከቱ' },
  { command: 'mycode', description: 'የሞባይል አፕሊኬሽን ኮድ ያግኙ' },
] as const;

const BILINGUAL_DESCRIPTION = `💰 Welcome to Muday | እንኳን ወደ ሙዳይ በደህና መጡ

🇬🇧 Record your ETB income and expenses using text, voice notes, or receipt photos. View daily, weekly, and monthly summaries through your private dashboard.

🇪🇹 የብር ገቢና ወጪዎን በግጹፍ፣ በድምፅ ወይም በደረሰኝ ፎቶ ይመዝግቡ። የዕለት፣ የሳምንትና የወር ማጠቃለያዎን በግል ዳሽቦርድ ይመልከቱ።

🔐 Private • Simple • English & Amharic
👇 Press Start to begin | ለመጀመር Start ይጫኑ`;

const BILINGUAL_SHORT_DESCRIPTION =
  '🇬🇧 Track ETB by text, voice or receipt • 🇪🇹 ገቢና ወጪዎን በግጹፍ፣ በድምፅ ወይም በደረሰኝ ይመዝግቡ';

export const TELEGRAM_PROFILE = {
  am: {
    description: BILINGUAL_DESCRIPTION,
    shortDescription: BILINGUAL_SHORT_DESCRIPTION,
  },
  en: {
    description: BILINGUAL_DESCRIPTION,
    shortDescription: BILINGUAL_SHORT_DESCRIPTION,
  },
} as const;
