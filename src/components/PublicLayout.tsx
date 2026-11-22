/**
 * PublicLayout — Shared navbar + footer for all public pages.
 * Extracted from LandingPage.tsx to avoid duplicating nav/footer across 7+ pages.
 */
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Link } from '@/components/LocalLink';
import { TRIAL_CTA } from '@/lib/cta';
import { trackEvent } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { ArrowRight, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { SOCIAL_CHANNELS, SocialIcon } from '@/lib/socials';
// import WhatsAppFab from '@/components/WhatsAppFab'; // temporarily hidden per user request (2026-08-20) — re-enable with the JSX below
import { SOCIETY_TYPES } from '@/content/societyTypes';
import { useSwitchLanguage } from '@/lib/useSwitchLanguage';

interface PublicLayoutProps {
  children: React.ReactNode;
}

// Primary public destinations, surfaced in the mobile drawer (desktop users reach
// these from the footer / in-page sections). Kept in one place so the list stays honest.
const MOBILE_NAV_LINKS: { to: string; hi: string; en: string }[] = [
  { to: '/pricing', hi: 'मूल्य', en: 'Pricing' },
  { to: '/guide', hi: 'गाइड', en: 'Guide' },
  { to: '/cookbook', hi: 'एंट्री कुकबुक', en: 'Entry Cookbook' },
  { to: '/help', hi: 'मदद केंद्र', en: 'Help' },
  { to: '/tools', hi: 'कैलकुलेटर', en: 'Calculators' },
  { to: '/downloads', hi: 'मुफ्त प्रारूप', en: 'Downloads' },
  { to: '/blog', hi: 'ब्लॉग', en: 'Blog' },
  { to: '/faq', hi: 'सामान्य प्रश्न', en: 'FAQ' },
  { to: '/ask', hi: 'पूछें', en: 'Ask' },
  { to: '/about', hi: 'हमारे बारे में', en: 'About' },
  { to: '/contact', hi: 'संपर्क', en: 'Contact' },
];

// Desktop top-nav — the public site had NO top menu on desktop; blog/guide/pricing
// were reachable only by scrolling to the footer. Kept short so the bar stays clean.
const DESKTOP_NAV_LINKS: { to: string; hi: string; en: string }[] = [
  { to: '/pricing', hi: 'मूल्य', en: 'Pricing' },
  { to: '/guide', hi: 'गाइड', en: 'Guide' },
  { to: '/blog', hi: 'ब्लॉग', en: 'Blog' },
  { to: '/help', hi: 'मदद', en: 'Help' },
];

// Footer "Quick Links" — one label per language (these were "English / हिंदी" pairs).
// The /ask link sits between the two lists because it is styled differently.
const FOOTER_LINKS: { to: string; hi: string; en: string }[] = [
  { to: '/about', hi: 'हमारे बारे में', en: 'About Us' },
  { to: '/pricing', hi: 'मूल्य', en: 'Pricing' },
  { to: '/guide', hi: 'उपयोग गाइड', en: 'How-To Guide' },
  { to: '/blog', hi: 'ब्लॉग', en: 'Blog' },
  { to: '/help', hi: 'मदद केंद्र', en: 'Help Center' },
  { to: '/cookbook', hi: 'एंट्री कुकबुक', en: 'Entry Cookbook' },
  { to: '/glossary', hi: 'शब्दकोश', en: 'Glossary' },
  { to: '/tools', hi: 'कैलकुलेटर', en: 'Calculators' },
  { to: '/search', hi: 'खोजें', en: 'Search' },
];
const FOOTER_LINKS_AFTER_ASK: { to: string; hi: string; en: string }[] = [
  { to: '/faq', hi: 'सामान्य प्रश्न', en: 'FAQ' },
  { to: '/contact', hi: 'संपर्क', en: 'Contact' },
  { to: '/partner', hi: 'पार्टनर बनें', en: 'Become a Partner' },   // SEO-06: the partner page had no inbound link
  { to: '/editorial-policy', hi: 'संपादकीय नीति', en: 'Editorial Policy' },
  { to: '/privacy', hi: 'गोपनीयता', en: 'Privacy Policy' },
  { to: '/terms', hi: 'नियम एवं शर्तें', en: 'Terms' },
];

// Two-option language switch "हिंदी | English". The choice lives in LanguageContext
// (localStorage) and is shared with the logged-in app. Hindi stays the default, so
// the prerendered HTML is still the Hindi page.
const LanguageSwitch: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language } = useLanguage();
  const setLanguage = useSwitchLanguage();   // batch E: also moves between /x and /en/x
  const options: { value: 'hi' | 'en'; label: string }[] = [
    { value: 'hi', label: 'हिंदी' },
    { value: 'en', label: 'English' },
  ];
  return (
    <div
      role="group"
      aria-label={language === 'hi' ? 'भाषा / Language' : 'Language'}
      className={`inline-flex items-center rounded-md border border-input bg-background p-0.5 text-xs font-medium ${className}`}
    >
      {options.map((o) => {
        const active = language === o.value;
        return (
          <button
            key={o.value}
            type="button"
            lang={o.value}
            aria-pressed={active}
            onClick={() => setLanguage(o.value)}
            className={`rounded px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {L('सीधे सामग्री पर जाएँ', 'Skip to content')}
      </a>
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">स</div>
            <div className="min-w-0">
              <span className="block font-bold text-base sm:text-lg text-foreground leading-tight">SahakarLekha</span>
              <p className="text-xs text-muted-foreground">सहकार लेखा</p>
            </div>
          </Link>

          {/* Desktop primary nav (md+). Mobile users get the same via the drawer below. */}
          <nav aria-label={L('मुख्य मेन्यू', 'Main menu')}className="hidden md:flex items-center gap-1">
            {DESKTOP_NAV_LINKS.map((l) => {
              const active = pathname === l.to || pathname.startsWith(l.to + '/');
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                  }`}
                >
                  {L(l.hi, l.en)}
                </Link>
              );
            })}
          </nav>

          {/* A logged-in user must never be shown "Login / Free Registration". /ask lives on
              this layout, so the founder watched it answer from his OWN ledger while the
              navbar invited him to register — and reasonably concluded his session was gone.
              It was not: same page, same session, the seam logged society_id + user-jwt +
              answered:true. But a page that tells a user they are logged out IS lying, and it
              cost hours of hunting an auth bug that never existed.
              Anonymous render stays byte-identical, so prerendered marketing HTML is unchanged
              — a crawler is never authenticated, and hydration swaps this for a real user. */}
          <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Language switch: in the bar from sm up. On a phone the 375px bar has no
                room, so it sits at the top of the menu drawer and in the footer. */}
            <LanguageSwitch className="hidden sm:inline-flex" />
            {isAuthenticated ? (
              <Button asChild size="sm" className="gap-1">
                <Link to="/dashboard">
                  <span className="hidden lg:inline">{L('डैशबोर्ड', 'Dashboard')}</span>
                  <span className="lg:hidden">{L('डैशबोर्ड', 'Dashboard')}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                {/* Below sm the Login button moves into the drawer — on a 375px phone the four header
                    controls overflowed and the clipped menu button sat half off-screen. */}
                {/* 2026-11-16 (audit J-9): logging in is the most frequent action of the people who already use
                    the product, and on a phone it was two taps away inside the drawer. From 360px up there is
                    room for a compact text button (the Register arrow is dropped below sm to make it); only the
                    narrowest phones (< 360px) still find Login in the drawer. */}
                <Button asChild variant="ghost" size="sm" className="hidden min-[360px]:inline-flex sm:hidden px-1.5 text-primary">
                  <Link to="/login" onClick={() => trackEvent('cta_click', { location: 'header', target: 'login' })}>{L('लॉगिन', 'Login')}</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                  <Link to="/login" onClick={() => trackEvent('cta_click', { location: 'header', target: 'login' })}>{L('लॉगिन', 'Login')}</Link>
                </Button>
                <Button asChild size="sm" className="gap-1 px-2.5 sm:px-3">
                  <Link to="/register" onClick={() => trackEvent('cta_click', { location: 'header', target: 'register' })}>
                    <span className="hidden lg:inline">{L(TRIAL_CTA.hi, TRIAL_CTA.en)}</span>
                    <span className="lg:hidden">{L('रजिस्टर', 'Register')}</span>
                    <ArrowRight className="hidden h-4 w-4 sm:block" />
                  </Link>
                </Button>
              </>
            )}

            {/* Mobile menu — the public site had no hamburger, so nav links were
                reachable only by scrolling to the footer of every page (MOBILE_AUDIT M-5). */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label={L('मेन्यू', 'Menu')}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72" closeLabel={L('मेन्यू बंद करें', 'Close menu')}>
                <SheetHeader>
                  <SheetTitle className="text-left">{L('सहकार लेखा', 'SahakarLekha')}</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <LanguageSwitch />
                </div>
                <nav aria-label={L('मेन्यू', 'Menu')} className="mt-4 flex flex-col">
                  {!isAuthenticated && (
                    <SheetClose asChild>
                      <Link to="/login" className="sm:hidden py-3 px-1 border-b font-medium text-primary hover:underline">
                        {L('लॉगिन', 'Login')}
                      </Link>
                    </SheetClose>
                  )}
                  {MOBILE_NAV_LINKS.map((l) => (
                    <SheetClose asChild key={l.to}>
                      <Link
                        to={l.to}
                        className="py-3 px-1 border-b text-foreground hover:text-primary transition-colors"
                      >
                        {L(l.hi, l.en)}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Page Content — skip-link target (a div: several pages render their own <main>) */}
      <div id="main" tabIndex={-1} className="outline-none">
        {children}
      </div>

      {/* Footer */}
      <footer className="py-10 bg-muted/50 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <Link to="/" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-primary flex items-center justify-center text-white font-bold">स</div>
                <span className="font-bold">SahakarLekha</span>
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">
                {L(
                  'भारत की सहकारी समितियों के लिए एकाउंटिंग सॉफ्टवेयर — ₹2,999/year + GST से। गाइड व कोर्स मुफ़्त।',
                  'Cooperative society accounting software for India — from ₹2,999/year + GST. Learning guides & course are free.',
                )}
              </p>
              <div className="mt-4">
                <p className="text-xs font-semibold text-foreground mb-2">{L('भाषा', 'Language')}</p>
                <LanguageSwitch />
              </div>
              <div className="mt-4">
                <p className="text-xs font-semibold text-foreground mb-2">{L('हमसे जुड़ें', 'Follow us')}</p>
                <div className="flex items-center gap-2">
                  {SOCIAL_CHANNELS.map(s => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      title={s.label}
                      className={`h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center transition-colors hover:text-white ${s.hoverBg}`}
                    >
                      <SocialIcon paths={s.paths} className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{L('सुविधाएँ', 'Features')}</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>{L('डबल-एंट्री वाउचर', 'Double-Entry Vouchers')}</li>
                <li>{L('ट्रायल बैलेंस व बैलेंस शीट', 'Trial Balance & Balance Sheet')}</li>
                <li>{L('TDS रजिस्टर व 26Q एक्सपोर्ट', 'TDS Register & 26Q Export')}</li>
                <li>{L('GST सारांश (GSTR-1/3B)', 'GST Summary (GSTR-1/3B)')}</li>
                <li>{L('सदस्य शेयर व ऋण रजिस्टर', 'Member Share & Loan Register')}</li>
                <li>{L('ऑडिट प्रमाणपत्र व अनुपालन', 'Audit Certificate & Compliance')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{L('समिति के प्रकार', 'Society Types')}</h4>
              <ul className="space-y-1 text-sm">
                {SOCIETY_TYPES.map(s => (
                  <li key={s.slug}>
                    <Link to={`/software/${s.slug}`} className="text-muted-foreground hover:text-primary transition-colors">{L(s.nameHi, s.nameEn)}</Link>
                  </li>
                ))}
                <li><Link to="/software" className="text-primary hover:underline">{L('सभी प्रकार →', 'All types →')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">{L('उपयोगी लिंक', 'Quick Links')}</h4>
              <ul className="space-y-1 text-sm">
                {FOOTER_LINKS.map((l) => (
                  <li key={l.to}><Link to={l.to} className="text-muted-foreground hover:text-primary transition-colors">{L(l.hi, l.en)}</Link></li>
                ))}
                <li><Link to="/ask" className="text-primary font-medium hover:underline">{L('सहकार लेखा से पूछें →', 'Ask SahakarLekha →')}</Link></li>
                {FOOTER_LINKS_AFTER_ASK.map((l) => (
                  <li key={l.to}><Link to={l.to} className="text-muted-foreground hover:text-primary transition-colors">{L(l.hi, l.en)}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
            <p>
              &copy; {new Date().getFullYear()}{' '}
              {L(
                'सहकार लेखा — भारत की सहकारी समितियों का लेखा प्लेटफ़ॉर्म',
                "SahakarLekha — the accounting platform for India's cooperative societies",
              )}
            </p>
            <p className="mt-1">{L('सहकारी समिति लेखा सॉफ्टवेयर | sahkari samiti software', 'Cooperative Society Accounting Software')}</p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp contact — TEMPORARILY HIDDEN per user request (2026-08-20).
          Re-enable: uncomment the import at the top of this file AND the line below. */}
      {/* <WhatsAppFab /> */}
    </div>
  );
};

export default PublicLayout;
