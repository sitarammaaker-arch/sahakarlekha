/**
 * DownloadsHub — /downloads: free blank working formats (registry: src/content/downloads.ts).
 *
 * Each card states the format, its use, state/year applicability, the last review date and — honestly — that an
 * expert (CA / RCS) review is still pending, so no format is presented as statutory. PDFs come from the existing
 * engine (src/lib/pdf.ts generateBlankFormatPDF), imported only on click so the page itself stays light.
 * No email or sign-up is asked for.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { trackEvent } from '@/lib/analytics';
import { DOWNLOADS, DOWNLOADS_META, type DownloadResource } from '@/content/downloads';
import { Download, FileText, ArrowRight, Info, CalendarCheck, MapPin, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import HindiOnlyNotice from '@/components/HindiOnlyNotice';

const SITE = 'https://sahakarlekha.com';

const ResourceCard: React.FC<{ r: DownloadResource }> = ({ r }) => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const download = async () => {
    if (!r.pdf) return;
    setBusy(true); setErr(null);
    try {
      const { generateBlankFormatPDF } = await import('@/lib/pdf');
      generateBlankFormatPDF(r.pdf);
      trackEvent('download_format', { slug: r.slug });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(L(`डाउनलोड नहीं हो पाया — page reload करके फिर कोशिश करें। (${msg})`, `Download failed — reload the page and try again. (${msg})`));
    } finally { setBusy(false); }
  };
  return (
    <Card id={r.slug} className="h-full">
      <CardContent className="p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-lg text-foreground">{L(r.title, r.englishTitle)}</h2>
          <p className="text-xs text-muted-foreground">{L(r.englishTitle, r.title)}</p>
        </div>
        <dl className="text-sm space-y-1.5">
          <div className="flex gap-2"><FileText className="h-4 w-4 mt-0.5 text-primary shrink-0" /><dt className="sr-only">{L('प्रारूप', 'Format')}</dt><dd><b>{L('प्रारूप', 'Format')}:</b> {r.format}</dd></div>
          <div className="flex gap-2"><Info className="h-4 w-4 mt-0.5 text-primary shrink-0" /><dt className="sr-only">{L('उपयोग', 'Use')}</dt><dd><b>{L('उपयोग', 'Use')}:</b> {r.use}</dd></div>
          <div className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" /><dt className="sr-only">{L('राज्य / वर्ष', 'State / Year')}</dt><dd><b>{L('राज्य', 'State')}:</b> {r.applicability} <b>{L('वर्ष', 'Year')}:</b> {r.year}</dd></div>
          <div className="flex gap-2"><CalendarCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" /><dt className="sr-only">{L('समीक्षा', 'Review')}</dt><dd><b>{L('अंतिम समीक्षा', 'Last reviewed')}:</b> {r.reviewed}</dd></div>
          <div className="flex gap-2 text-amber-700 dark:text-amber-500"><ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" /><dt className="sr-only">{L('विशेषज्ञ समीक्षा', 'Expert review')}</dt><dd>{r.expertReview}</dd></div>
        </dl>
        {r.kind === 'pdf' ? (
          <Button onClick={download} disabled={busy} className="gap-2"><Download className="h-4 w-4" /> {busy ? L('बन रहा है…', 'Preparing…') : L('PDF डाउनलोड करें', 'Download PDF')}</Button>
        ) : (
          <Link to={r.href!}><Button variant="outline" className="gap-2">{L('खोलें व प्रिंट करें', 'Open and print')} <ArrowRight className="h-4 w-4" /></Button></Link>
        )}
        {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
        {r.related.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {L('जुड़े पेज', 'Related pages')}:{' '}
            {r.related.map((l, i) => (
              <React.Fragment key={l.href}>{i > 0 && ' · '}<Link to={l.href} className="text-primary hover:underline">{l.label}</Link></React.Fragment>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const DownloadsHub: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({
    title: L(DOWNLOADS_META.title, 'Free Blank Formats (Downloads) — Cash Book, Vouchers, Share Register | SahakarLekha'),
    description: L(DOWNLOADS_META.description, 'Free blank working formats for cooperative societies: cash book, receipt/payment vouchers, member share register, asset and depreciation register and a year-end checklist — no sign-up, direct download.'),
    canonicalPath: '/downloads',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'डाउनलोड', item: `${SITE}/downloads` }] },
      { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: DOWNLOADS.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.title, url: `${SITE}/downloads#${r.slug}` })) },
    ],
  });
  return (
    <PublicLayout>
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/10 py-14 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Download className="h-11 w-11 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">{L('मुफ्त खाली प्रारूप (Downloads)', 'Free Blank Formats (Downloads)')}</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {L('सहकारी समिति के रोज़मर्रा के काम के लिए खाली कार्य-प्रारूप — बिना ईमेल, सीधा डाउनलोड।', 'Blank working formats for a cooperative society\u2019s everyday work — no sign-up, direct download.')}
          </p>
        </div>
      </section>
      <section className="py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 text-sm text-foreground flex gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
              {language === 'hi' ? (
                <p>ये <b>सामान्य कार्य-प्रारूप</b> हैं, वैधानिक (statutory) प्रपत्र नहीं। आपके राज्य के सहकारी अधिनियम/नियम या समिति की उपविधि में कोई प्रारूप निर्धारित हो, तो वही मान्य है। विशेषज्ञ (CA / RCS) समीक्षा अभी लंबित है।</p>
              ) : (
                <p>These are <b>general working formats</b>, not statutory forms. If your state&apos;s Cooperative Act/Rules or your society&apos;s bye-laws prescribe a format, that one applies. Expert (CA / RCS) review is still pending.</p>
              )}
            </CardContent>
          </Card>
          <HindiOnlyNotice what="The details on each format card" />
          <div className="grid sm:grid-cols-2 gap-5">
            {DOWNLOADS.map((r) => <ResourceCard key={r.slug} r={r} />)}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {L('रोज़ का हिसाब हाथ से नहीं रखना चाहते?', 'Don\u2019t want to keep daily accounts by hand?')} <Link to="/register" className="text-primary hover:underline">{L('सहकार लेखा में यही रजिस्टर अपने-आप बनते हैं →', 'SahakarLekha builds these same registers automatically →')}</Link>
          </p>
        </div>
      </section>
    </PublicLayout>
  );
};

export default DownloadsHub;
