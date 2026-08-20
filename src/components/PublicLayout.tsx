/**
 * PublicLayout — Shared navbar + footer for all public pages.
 * Extracted from LandingPage.tsx to avoid duplicating nav/footer across 7+ pages.
 */
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { ArrowRight, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SOCIAL_CHANNELS, SocialIcon } from '@/lib/socials';
// import WhatsAppFab from '@/components/WhatsAppFab'; // temporarily hidden per user request (2026-08-20) — re-enable with the JSX below
import { SOCIETY_TYPES } from '@/content/societyTypes';

interface PublicLayoutProps {
  children: React.ReactNode;
}

// Primary public destinations, surfaced in the mobile drawer (desktop users reach
// these from the footer / in-page sections). Kept in one place so the list stays honest.
const MOBILE_NAV_LINKS: { to: string; label: string }[] = [
  { to: '/pricing', label: 'मूल्य / Pricing' },
  { to: '/guide', label: 'गाइड / Guide' },
  { to: '/cookbook', label: 'एंट्री कुकबुक' },
  { to: '/help', label: 'मदद केंद्र / Help' },
  { to: '/tools', label: 'कैलकुलेटर / Calculators' },
  { to: '/blog', label: 'ब्लॉग / Blog' },
  { to: '/faq', label: 'सामान्य प्रश्न / FAQ' },
  { to: '/ask', label: 'पूछें / Ask' },
  { to: '/about', label: 'हमारे बारे में / About' },
  { to: '/contact', label: 'संपर्क / Contact' },
];

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">स</div>
            <div>
              <span className="block font-bold text-lg text-foreground leading-tight">SahakarLekha</span>
              <p className="text-xs text-muted-foreground">सहकार लेखा</p>
            </div>
          </Link>
          {/* A logged-in user must never be shown "Login / Free Registration". /ask lives on
              this layout, so the founder watched it answer from his OWN ledger while the
              navbar invited him to register — and reasonably concluded his session was gone.
              It was not: same page, same session, the seam logged society_id + user-jwt +
              answered:true. But a page that tells a user they are logged out IS lying, and it
              cost hours of hunting an auth bug that never existed.
              Anonymous render stays byte-identical, so prerendered marketing HTML is unchanged
              — a crawler is never authenticated, and hydration swaps this for a real user. */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link to="/dashboard">
                <Button size="sm" className="gap-1">
                  <span className="hidden lg:inline">डैशबोर्ड / Dashboard</span>
                  <span className="lg:hidden">डैशबोर्ड</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" size="sm">Login</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="gap-1">
                    <span className="hidden lg:inline">Free Registration</span>
                    <span className="lg:hidden">Register</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile menu — the public site had no hamburger, so nav links were
                reachable only by scrolling to the footer of every page (MOBILE_AUDIT M-5). */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="मेन्यू / Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="text-left">सहकार लेखा</SheetTitle>
                </SheetHeader>
                <nav className="mt-4 flex flex-col">
                  {MOBILE_NAV_LINKS.map((l) => (
                    <SheetClose asChild key={l.to}>
                      <Link
                        to={l.to}
                        className="py-3 px-1 border-b text-foreground hover:text-primary transition-colors"
                      >
                        {l.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {children}

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
                भारत की सहकारी समितियों के लिए मुफ्त एकाउंटिंग सॉफ्टवेयर।
                Free cooperative society accounting software for India.
              </p>
              <div className="mt-4">
                <p className="text-xs font-semibold text-foreground mb-2">हमसे जुड़ें / Follow us</p>
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
              <h4 className="font-semibold text-sm mb-3">Features</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Double-Entry Vouchers</li>
                <li>Trial Balance & Balance Sheet</li>
                <li>TDS Register & 26Q Export</li>
                <li>GST Summary (GSTR-1/3B)</li>
                <li>Member Share & Loan Register</li>
                <li>Audit Certificate & Compliance</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Society Types</h4>
              <ul className="space-y-1 text-sm">
                {SOCIETY_TYPES.map(s => (
                  <li key={s.slug}>
                    <Link to={`/software/${s.slug}`} className="text-muted-foreground hover:text-primary transition-colors">{s.nameEn}</Link>
                  </li>
                ))}
                <li><Link to="/software" className="text-primary hover:underline">All types / सभी प्रकार →</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Quick Links</h4>
              <ul className="space-y-1 text-sm">
                <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">About Us / हमारे बारे में</Link></li>
                <li><Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing / मूल्य</Link></li>
                <li><Link to="/guide" className="text-muted-foreground hover:text-primary transition-colors">How-To Guide / उपयोग गाइड</Link></li>
                <li><Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors">Blog / ब्लॉग</Link></li>
                <li><Link to="/help" className="text-muted-foreground hover:text-primary transition-colors">Help Center / मदद केंद्र</Link></li>
                <li><Link to="/cookbook" className="text-muted-foreground hover:text-primary transition-colors">Entry Cookbook / एंट्री कुकबुक</Link></li>
                <li><Link to="/glossary" className="text-muted-foreground hover:text-primary transition-colors">Glossary / शब्दकोश</Link></li>
                <li><Link to="/tools" className="text-muted-foreground hover:text-primary transition-colors">Calculators / कैलकुलेटर</Link></li>
                <li><Link to="/search" className="text-muted-foreground hover:text-primary transition-colors">Search / खोजें</Link></li>
                <li><Link to="/ask" className="text-primary font-medium hover:underline">Ask SahakarLekha / पूछें →</Link></li>
                <li><Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">FAQ / सामान्य प्रश्न</Link></li>
                <li><Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact / संपर्क</Link></li>
                <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy / गोपनीयता</Link></li>
                <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms / नियम एवं शर्तें</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} SahakarLekha (सहकार लेखा) — Bharat ki Cooperative Societies ka Accounting Platform</p>
            <p className="mt-1">सहकारी समिति लेखा सॉफ्टवेयर | Cooperative Society Accounting Software | sahkari samiti software</p>
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
