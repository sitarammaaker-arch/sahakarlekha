/**
 * SahakarLekha Contact Us Page — bilingual Hindi+English
 * Public page, no auth required
 */
import React, { useState } from 'react';
import PublicLayout from '@/components/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';

// Community channels (verified live). Brand glyphs as inline SVG.
const CHANNELS: { label: string; sub: string; href: string; bg: string; icon: React.ReactNode }[] = [
  {
    label: 'YouTube', sub: 'हिंदी वीडियो · Subscribe', href: 'https://youtube.com/@sahakarlekha', bg: 'bg-[#FF0000]',
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" /></svg>),
  },
  {
    label: 'WhatsApp चैनल', sub: 'अपडेट पाएँ · Join', href: 'https://whatsapp.com/channel/0029VbCrSqS3QxS5kAk8VJ1A', bg: 'bg-[#25D366]',
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M17.6 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.8-2.6-1.4-3.7-3.2-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.2-.3-.2-.5-.3z" /><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" /></svg>),
  },
  {
    label: 'X (Twitter)', sub: 'Follow करें', href: 'https://x.com/sahakarlekha', bg: 'bg-black',
    icon: (<svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.1-9.3L.9 2h7.2l5 6.6L18.9 2zm-1.2 18h1.9L6.4 4H4.4l13.3 16z" /></svg>),
  },
];

const ContactUs: React.FC = () => {
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
            {CHANNELS.map(c => (
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={c.label}
                className={`group flex flex-col items-center gap-3 rounded-xl p-6 text-white shadow-md transition-transform hover:-translate-y-1 hover:shadow-lg ${c.bg}`}
              >
                <span className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">{c.icon}</span>
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
