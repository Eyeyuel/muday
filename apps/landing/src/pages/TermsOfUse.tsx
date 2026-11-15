import { Link } from 'react-router-dom';

export const TermsOfUse = ({ lang, theme }: { lang: 'en' | 'am'; theme: 'dark' | 'light' }) => {
  const isDark = theme === 'dark';

  const enContent = (
    <>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
        <p className="mb-4">
          By accessing or using the Muday AI Telegram bot and related services, you agree to be
          bound by these Terms of Use. If you do not agree to these terms, please do not use our
          services.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
        <p className="mb-4">
          Muday AI provides a personal finance tracking tool via Telegram. It uses artificial
          intelligence to parse forwarded SMS messages, voice notes, and receipt images to help you
          categorize and track your expenses.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">3. Not a Financial Advisor</h2>
        <p className="mb-4">
          <strong>Muday AI is not a bank, financial institution, or financial advisor.</strong> Any
          insights, categories, or tips provided by the bot are for informational purposes only and
          should not be considered professional financial advice. You are solely responsible for
          your financial decisions.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">4. User Responsibilities</h2>
        <p className="mb-4">
          You agree to use Muday AI only for lawful purposes. You are responsible for the accuracy
          of the data you forward to the bot. Do not forward sensitive information (like passwords
          or full credit card numbers) that are not necessary for expense tracking.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">5. Service Limitations</h2>
        <p className="mb-4">
          While we strive for high availability and accuracy, Muday AI is provided on an "as is" and
          "as available" basis. We do not guarantee that the AI parsing will be 100% accurate at all
          times, nor do we guarantee uninterrupted service.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">6. Changes to Terms</h2>
        <p className="mb-4">
          We reserve the right to modify these Terms of Use at any time. We will notify users of
          significant changes through the Telegram bot. Continued use of the service after such
          changes constitutes your acceptance of the new terms.
        </p>
      </section>
    </>
  );

  const amContent = (
    <>
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">1. ስምምነት</h2>
        <p className="mb-4">
          የ Muday AI ቴሌግራም ቦትን እና ተያያዥ አገልግሎቶችን ሲጠቀሙ በእነዚህ የአጠቃቀም ውሎች ለመገዛት ተስማምተዋል ማለት ነው። በእነዚህ
          ውሎች የማይስማሙ ከሆነ እባክዎ አገልግሎቶቻችንን አይጠቀሙ።
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">2. ስለ አገልግሎቱ</h2>
        <p className="mb-4">
          Muday AI በቴሌግራም በኩል የግል የፋይናንስ መቆጣጠሪያ መሳሪያን ያቀርባል። ወጪዎችዎን ለመመደብ እና ለመከታተል እንዲረዳዎ የላኩትን
          የባንክ መልዕክቶች (SMS)፣ የድምፅ መልዕክቶች፣ እና የደረሰኝ ምስሎች ለማንበብ የሰው ሰራሽ አስተውሎትን (AI) ይጠቀማል።
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">3. የፋይናንስ አማካሪ አይደለም</h2>
        <p className="mb-4">
          <strong>Muday AI ባንክ፣ የፋይናንስ ተቋም ወይም የፋይናንስ አማካሪ አይደለም።</strong> በቦቱ የሚቀርቡ ማናቸውም ግንዛቤዎች፣
          ምድቦች፣ ወይም ምክሮች ለመረጃነት ብቻ የቀረቡ ናቸው እንጂ እንደ ሙያዊ የፋይናንስ ምክር ሊቆጠሩ አይገባም። ለፋይናንስ ውሳኔዎችዎ እርስዎ ብቻ
          ሀላፊነቱን ይወስዳሉ።
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">4. የተጠቃሚ ሀላፊነቶች</h2>
        <p className="mb-4">
          Muday AIን ህጋዊ ለሆኑ ዓላማዎች ብቻ ለመጠቀም ተስማምተዋል። ወደ ቦቱ ለሚልኩት መረጃ ትክክለኛነት ሀላፊነቱ የእርስዎ ነው። ለወጪ
          መቆጣጠሪያ አስፈላጊ ያልሆኑ ሚስጥራዊ መረጃዎችን (እንደ የይለፍ ቃል ወይም የባንክ ካርድ ቁጥሮች ያሉ) ወደ ቦቱ አይላኩ።
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">5. የአገልግሎት ገደቦች</h2>
        <p className="mb-4">
          ምንም እንኳን ከፍተኛ ጥራት ያለው አገልግሎት ለመስጠት ብንጥርም፣ Muday AI የሚቀርበው "ባለበት ሁኔታ" እና "በሚገኝበት ጊዜ" ነው። የ
          AI ትንታኔ ሁልጊዜ 100% ትክክል እንደሚሆን ዋስትና አንሰጥም፣ እንዲሁም አገልግሎቱ መቼም እንደማይቋረጥ ዋስትና አንሰጥም።
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">6. በውሎች ላይ የሚደረጉ ለውጦች</h2>
        <p className="mb-4">
          እነዚህን የአጠቃቀም ውሎች በማንኛውም ጊዜ የመቀየር መብታችን የተጠበቀ ነው። ጉልህ ለውጦች ሲኖሩ በተጠቃሚዎች የቴሌግራም ቦት በኩል
          እናሳውቃለን። ለውጦቹ ከተደረጉ በኋላ አገልግሎቱን መጠቀሙን መቀጠልዎ አዲሶቹን ውሎች እንደተቀበሉ ይቆጠራል።
        </p>
      </section>
    </>
  );

  return (
    <div
      className={`min-h-screen pt-32 pb-24 px-6 md:px-12 transition-colors duration-300 font-general-sans ${isDark ? 'bg-[#050811] text-white' : 'bg-[#f4f4f6] text-slate-900'}`}
    >
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-10 font-medium text-emerald-500 hover:text-emerald-600 transition-colors"
        >
          <span>←</span> <span>{lang === 'en' ? 'Back to Home' : 'ወደ ዋናው ገፅ ይመለሱ'}</span>
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          {lang === 'en' ? 'Terms of Use' : 'የአጠቃቀም ውሎች'}
        </h1>
        <p className="mb-12 text-sm font-medium opacity-50">
          {lang === 'en' ? 'Last Updated: August 2026' : 'ለመጨረሻ ጊዜ የተሻሻለው፡ ነሀሴ 2026'}
        </p>

        <div className="leading-relaxed text-[15px] md:text-[17px]">
          {lang === 'en' ? enContent : amContent}
        </div>
      </div>
    </div>
  );
};
