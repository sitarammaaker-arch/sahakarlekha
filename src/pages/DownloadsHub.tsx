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

const SITE = 'https://sahakarlekha.com';

const ResourceCard: React.FC<{ r: DownloadResource }> = ({ r }) => {
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
      setErr(`डाउनलोड नहीं हो पाया — page reload करके फिर कोशिश करें। (${e instanceof Error ? e.message : String(e)})`);
    } finally { setBusy(false); }
  };
  return (
    <Card id={r.slug} className="h-full">
      <CardContent className="p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-lg text-foreground">{r.title}</h2>
          <p className="text-xs text-muted-foreground">{r.englishTitle}</p>
        </div>
        <dl className="text-sm space-y-1.5">
          <div className="flex gap-2"><FileText className="h-4 w-4 mt-0.5 text-primary shrink-0" /><dt className="sr-only">प्रारूप</dt><dd><b>प्रारूप:</b> {r.format}</dd></div>
          <div className="flex gap-2"><Info className="h-4 w-4 mt-0.5 text-primary shrink-0" /><dt className="sr-only">उपयोग</dt><dd><b>उपयोग:</b> {r.use}</dd></div>
          <div className="flex gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" /><dt className="sr-only">राज्य / वर्ष</dt><dd><b>राज्य:</b> {r.applicability} <b>वर्ष:</b> {r.year}</dd></div>
          <div className="flex gap-2"><CalendarCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" /><dt className="sr-only">समीक्षा</dt><dd><b>अंतिम समीक्षा:</b> {r.reviewed}</dd></div>
          <div className="flex gap-2 text-amber-700 dark:text-amber-500"><ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" /><dt className="sr-only">विशेषज्ञ समीक्षा</dt><dd>{r.expertReview}</dd></div>
        </dl>
        {r.kind === 'pdf' ? (
          <Button onClick={download} disabled={busy} className="gap-2"><Download className="h-4 w-4" /> {busy ? 'बन रहा है…' : 'PDF डाउनलोड करें'}</Button>
        ) : (
          <Link to={r.href!}><Button variant="outline" className="gap-2">खोलें व प्रिंट करें <ArrowRight className="h-4 w-4" /></Button></Link>
        )}
        {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
        {r.related.length > 0 && (
          <p className="text-sm text-muted-foreground">
            जुड़े पेज:{' '}
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
  useDocumentMeta({
    title: DOWNLOADS_META.title,
    description: DOWNLOADS_META.description,
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
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">मुफ्त खाली प्रारूप (Downloads)</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            सहकारी समिति के रोज़मर्रा के काम के लिए खाली कार्य-प्रारूप — बिना ईमेल, सीधा डाउनलोड।
          </p>
        </div>
      </section>
      <section className="py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 text-sm text-foreground flex gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
              <p>ये <b>सामान्य कार्य-प्रारूप</b> हैं, वैधानिक (statutory) प्रपत्र नहीं। आपके राज्य के सहकारी अधिनियम/नियम या समिति की उपविधि में कोई प्रारूप निर्धारित हो, तो वही मान्य है। विशेषज्ञ (CA / RCS) समीक्षा अभी लंबित है।</p>
            </CardContent>
          </Card>
          <div className="grid sm:grid-cols-2 gap-5">
            {DOWNLOADS.map((r) => <ResourceCard key={r.slug} r={r} />)}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            रोज़ का हिसाब हाथ से नहीं रखना चाहते? <Link to="/register" className="text-primary hover:underline">सहकार लेखा में यही रजिस्टर अपने-आप बनते हैं →</Link>
          </p>
        </div>
      </section>
    </PublicLayout>
  );
};

export default DownloadsHub;
