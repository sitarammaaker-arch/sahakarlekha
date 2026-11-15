/**
 * SahakarLekha Contact Us Page — bilingual Hindi+English
 * Public page, no auth required
 */
import React, { useState } from 'react';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { PAGE_META_EN } from '@/content/pageMetaEn';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';
import { SOCIAL_CHANNELS, SocialIcon, WHATSAPP_NUMBER } from '@/lib/socials';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { useLanguage } from '@/contexts/LanguageContext';

const ContactUs: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  useDocumentMeta({
    title: L(
      'संपर्क करें — SahakarLekha सहकारी लेखा सॉफ्टवेयर सहायता',
      PAGE_META_EN.contact.title,
    ),
    description: L(
      'SahakarLekha टीम से संपर्क करें — सहायता, डेमो व अपनी सहकारी समिति को ऑनबोर्ड करने के लिए. Contact us for support, a demo, or to onboard your cooperative society.',
      PAGE_META_EN.contact.description,
    ),
    canonicalPath: '/contact',
  });
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [message, setMessage] = useState('');
  const [company, setCompany] = useState(''); // honeypot — humans never see/fill this
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (company) return; // bot filled the hidden field — silently drop
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({
        title: L('अधूरी जानकारी', 'Incomplete details'),
        description: L('कृपया नाम, ईमेल व संदेश भरें', 'Please fill name, email & message'),
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert([{
        type: 'message',
        name: name.trim(),
        email: email.trim(),
        society_name: societyName.trim() || null,
        message: message.trim(),
        page_url: typeof window !== 'undefined' ? window.location.href : null,
      }]);
      if (error) throw error;
      trackEvent('contact_submit', {});
      toast({
        title: L('संदेश भेज दिया गया ✓', 'Message sent ✓'),
        description: L('हम 24 घंटे में जवाब देंगे।', 'We reply within 24 hours.'),
      });
      setName('');
      setEmail('');
      setSocietyName('');
      setMessage('');
    } catch (err) {
      // RULE 1: never show a fake success. Tell the user it did not save and
      // give a reliable fallback channel.
      toast({
        title: L('संदेश सेव नहीं हो सका', 'Message could not be saved'),
        description: L(
          'कृपया WhatsApp +91 94679 18545 या support@sahakarlekha.com पर भेजें।',
          'Could not send — please use WhatsApp +91 94679 18545 or email support@sahakarlekha.com.',
        ),
        variant: 'destructive',
        duration: 11000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            <span className="text-primary">{L('संपर्क करें', 'Contact Us')}</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            {L(
              'हमसे जुड़ें — हम आपकी सहायता के लिए तत्पर हैं।',
              'Reach out to us — we\'re here to help your cooperative society.',
            )}
          </p>
        </div>
      </section>

      {/* Contact Info + Form */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column — Info Cards */}
            <div className="space-y-4">
              {/* Email */}
              <Card>
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{L('ईमेल', 'Email')}</h3>
                    <p className="text-sm text-muted-foreground">{L('ईमेल द्वारा संपर्क करें', 'Write to us by email')}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">support@sahakarlekha.com</p>
                  </div>
                </CardContent>
              </Card>

              {/* Phone */}
              <Card>
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{L('WhatsApp / फोन', 'WhatsApp / Phone')}</h3>
                    <p className="text-sm text-muted-foreground">{L('WhatsApp पर तुरंत संपर्क', 'Quick contact on WhatsApp')}</p>
                    <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-medium text-primary hover:underline">+91 94679 18545</a>
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              <Card>
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="rounded-full bg-primary/10 p-3">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{L('पता', 'Address')}</h3>
                    <p className="text-sm text-muted-foreground">{L('कार्यालय पता', 'Office address')}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{L('भारत', 'India')}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Support Hours */}
              <Card>
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{L('सहायता समय', 'Support Hours')}</h3>
                    <p className="text-sm text-muted-foreground">{L('हम कब उपलब्ध हैं', 'When we are available')}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{L('सोमवार - शनिवार: सुबह 9:00 - शाम 6:00 (IST)', 'Monday - Saturday: 9:00 AM - 6:00 PM IST')}</p>
                    <p className="text-sm font-medium text-foreground">{L('रविवार: बंद', 'Sunday: Closed')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column — Contact Form */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-6">
                  {L('संदेश भेजें', 'Send a Message')}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{L('आपका नाम *', 'Your Name *')}</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={L('अपना नाम लिखें', 'Enter your name')}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{L('ईमेल *', 'Email *')}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="societyName">{L('समिति का नाम (वैकल्पिक)', 'Society Name (Optional)')}</Label>
                    <Input
                      id="societyName"
                      value={societyName}
                      onChange={(e) => setSocietyName(e.target.value)}
                      placeholder={L('आपकी सहकारी समिति का नाम', 'Your cooperative society name')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">{L('संदेश *', 'Message *')}</Label>
                    <Textarea
                      id="message"
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={L('हम आपकी क्या मदद कर सकते हैं?', 'How can we help you?')}
                      required
                    />
                  </div>

                  {/* Honeypot: hidden from humans, bots tend to fill it */}
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                  />

                  <Button type="submit" className="w-full gap-2" disabled={submitting}>
                    <Send className="h-4 w-4" />
                    {submitting ? L('भेज रहे हैं…', 'Sending…') : L('संदेश भेजें', 'Send Message')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Connect with us — community channels (big buttons) */}
      <section className="py-16 bg-white border-t">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">{L('हमसे जुड़ें', 'Connect with us')}</h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            {L(
              'हर अपडेट, टिप और वीडियो सबसे पहले पाएँ — अपने पसंदीदा चैनल पर जुड़ें।',
              'Get every update, tip and video first — follow us on your favourite channel.',
            )}
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SOCIAL_CHANNELS.map(c => (
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={c.label}
                className={`group flex flex-col items-center gap-3 rounded-xl p-6 text-white shadow-md transition-transform hover:-translate-y-1 hover:shadow-lg ${c.solidBg}`}
              >
                <span className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center"><SocialIcon paths={c.paths} className="h-6 w-6" /></span>
                <span className="text-lg font-bold">{c.label}</span>
                <span className="text-sm text-white/90">{c.sub}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Response Time Notice */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground text-sm sm:text-base">
            {L(
              'हम आमतौर पर कार्य दिवसों पर 24 घंटे के भीतर जवाब देते हैं।',
              'We typically respond within 24 hours on business days.',
            )}
          </p>
        </div>
      </section>
    </PublicLayout>
  );
};

export default ContactUs;
