/**
 * SahakarLekha Contact Us Page — bilingual Hindi+English
 * Public page, no auth required
 */
import React, { useState } from 'react';
import PublicLayout from '@/components/PublicLayout';
import { useDocumentMeta } from '@/lib/useDocumentMeta';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';
import { SOCIAL_CHANNELS, SocialIcon } from '@/lib/socials';

const ContactUs: React.FC = () => {
  useDocumentMeta({
    title: 'संपर्क करें — SahakarLekha सहकारी लेखा सॉफ्टवेयर सहायता',
    description: 'SahakarLekha टीम से संपर्क करें — सहायता, डेमो व अपनी सहकारी समिति को ऑनबोर्ड करने के लिए. Contact us for support, a demo, or to onboard your cooperative society.',
    canonicalPath: '/contact',
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [societyName, setSocietyName] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('कृपया सभी आवश्यक फ़ील्ड भरें / Please fill all required fields');
      return;
    }
    toast.success('संदेश भेजा गया! / Message sent successfully!');
    setName('');
    setEmail('');
    setSocietyName('');
    setMessage('');
  };

  return (
    <PublicLayout>
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
            संपर्क करें — <span className="text-primary">Contact Us</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            हमसे जुड़ें — हम आपकी सहायता के लिए तत्पर हैं।
            <br />
            Reach out to us — we're here to help your cooperative society.
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
                    <h3 className="font-semibold text-foreground">Email</h3>
                    <p className="text-sm text-muted-foreground">ईमेल द्वारा संपर्क करें</p>
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
                    <h3 className="font-semibold text-foreground">Phone / फोन</h3>
                    <p className="text-sm text-muted-foreground">फोन द्वारा संपर्क</p>
                    <p className="mt-1 text-sm font-medium text-foreground">+91-XXXXX-XXXXX</p>
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
                    <h3 className="font-semibold text-foreground">Address / पता</h3>
                    <p className="text-sm text-muted-foreground">कार्यालय पता</p>
                    <p className="mt-1 text-sm font-medium text-foreground">India</p>
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
                    <h3 className="font-semibold text-foreground">Support Hours / सहायता समय</h3>
                    <p className="text-sm text-muted-foreground">सहायता समय</p>
                    <p className="mt-1 text-sm font-medium text-foreground">Monday - Saturday: 9:00 AM - 6:00 PM IST</p>
                    <p className="text-sm font-medium text-foreground">Sunday: Closed</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column — Contact Form */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-6">
                  संदेश भेजें / Send a Message
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">आपका नाम / Your Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">ईमेल / Email *</Label>
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
                    <Label htmlFor="societyName">समिति का नाम / Society Name (Optional)</Label>
                    <Input
                      id="societyName"
                      value={societyName}
                      onChange={(e) => setSocietyName(e.target.value)}
                      placeholder="Your cooperative society name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">संदेश / Message *</Label>
                    <Textarea
                      id="message"
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help you?"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full gap-2">
                    <Send className="h-4 w-4" />
                    संदेश भेजें / Send Message
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
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">हमसे जुड़ें / Connect with us</h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            हर अपडेट, टिप और वीडियो सबसे पहले पाएँ — अपने पसंदीदा चैनल पर जुड़ें।
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
            We typically respond within 24 hours on business days.
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            हम आमतौर पर कार्य दिवसों पर 24 घंटे के भीतर जवाब देते हैं।
          </p>
        </div>
      </section>
    </PublicLayout>
  );
};

export default ContactUs;
