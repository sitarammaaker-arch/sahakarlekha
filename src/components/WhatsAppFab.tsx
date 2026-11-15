/**
 * WhatsAppFab — floating "ask on WhatsApp" button shown on all public pages.
 * Opens a direct chat to the support number with a friendly prefilled message.
 * Renders nothing if WHATSAPP_NUMBER is empty.
 */
import React from 'react';
import { WHATSAPP_NUMBER, WHATSAPP_ICON_PATHS, SocialIcon } from '@/lib/socials';
import { trackEvent } from '@/lib/analytics';
import { useLanguage } from '@/contexts/LanguageContext';

const PREFILL = 'नमस्ते! मुझे SahakarLekha (सहकार लेखा) के बारे में जानकारी चाहिए।';
const PREFILL_EN = 'Hello! I would like to know more about SahakarLekha.';

const WhatsAppFab: React.FC = () => {
  const { language } = useLanguage();
  const L = (hi: string, en: string) => (language === 'hi' ? hi : en);
  if (!WHATSAPP_NUMBER) return null;
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(L(PREFILL, PREFILL_EN))}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent('whatsapp_click', { location: 'fab', page: window.location.pathname })}
      aria-label={L('WhatsApp पर संपर्क करें', 'Contact us on WhatsApp')}
      title={L('WhatsApp पर पूछें', 'Ask on WhatsApp')}
      className="no-print print:hidden fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 hover:bg-[#1ebe57] hover:shadow-xl transition-all px-4 py-3"
    >
      <SocialIcon paths={WHATSAPP_ICON_PATHS} className="h-6 w-6" />
      <span className="hidden sm:inline font-semibold text-sm pr-1">{L('WhatsApp पर पूछें', 'Ask on WhatsApp')}</span>
    </a>
  );
};

export default WhatsAppFab;
