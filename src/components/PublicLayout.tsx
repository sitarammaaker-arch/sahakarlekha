/**
 * PublicLayout — Shared navbar + footer for all public pages.
 * Extracted from LandingPage.tsx to avoid duplicating nav/footer across 7+ pages.
 */
import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface PublicLayoutProps {
  children: React.ReactNode;
}

// Community / social channels (verified live). Brand glyphs as inline SVG so we
// don't depend on lucide brand icons. Brand colour shows on hover.
const SOCIALS: { label: string; href: string; hover: string; icon: React.ReactNode }[] = [
  {
    label: 'YouTube', href: 'https://youtube.com/@sahakarlekha', hover: 'hover:bg-[#FF0000]',
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" /></svg>),
  },
  {
    label: 'X (Twitter)', href: 'https://x.com/sahakarlekha', hover: 'hover:bg-black',
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.1-9.3L.9 2h7.2l5 6.6L18.9 2zm-1.2 18h1.9L6.4 4H4.4l13.3 16z" /></svg>),
  },
  {
    label: 'WhatsApp', href: 'https://whatsapp.com/channel/0029VbCrSqS3QxS5kAk8VJ1A', hover: 'hover:bg-[#25D366]',
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M17.6 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.8-2.6-1.4-3.7-3.2-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.2-.3-.2-.5-.3z" /><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" /></svg>),
  },
];

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  const { pathname } = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b shadow-sm overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-lg">स</div>
            <div>
              <h1 className="font-bold text-lg text-foreground leading-tight">SahakarLekha</h1>
              <p className="text-xs text-muted-foreground">सहकारलेखा</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
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
                  {SOCIALS.map(s => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      title={s.label}
                      className={`h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center transition-colors hover:text-white ${s.hover}`}
                    >
                      {s.icon}
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
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Marketing & Processing (CMS)</li>
                <li>Primary Agricultural Credit (PACS)</li>
                <li>Dairy Cooperative</li>
                <li>Consumer Cooperative</li>
                <li>Housing Cooperative</li>
                <li>Sugar Factory Cooperative</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Quick Links</h4>
              <ul className="space-y-1 text-sm">
                <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">About Us / हमारे बारे में</Link></li>
                <li><Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing / मूल्य</Link></li>
                <li><Link to="/guide" className="text-muted-foreground hover:text-primary transition-colors">How-To Guide / उपयोग गाइड</Link></li>
                <li><Link to="/faq" className="text-muted-foreground hover:text-primary transition-colors">FAQ / सामान्य प्रश्न</Link></li>
                <li><Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact / संपर्क</Link></li>
                <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy / गोपनीयता</Link></li>
                <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms / नियम एवं शर्तें</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} SahakarLekha (सहकारलेखा) — Bharat ki Cooperative Societies ka Accounting Platform</p>
            <p className="mt-1">सहकारी समिति लेखा सॉफ्टवेयर | Cooperative Society Accounting Software | sahkari samiti software</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
