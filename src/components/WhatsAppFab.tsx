/**
 * WhatsAppFab — floating "ask on WhatsApp" button shown on all public pages.
 * Opens a direct chat to the support number with a friendly prefilled message.
 * Renders nothing if WHATSAPP_NUMBER is empty.
 */
import React from 'react';
import { WHATSAPP_NUMBER, WHATSAPP_ICON_PATHS, SocialIcon } from '@/lib/socials';

const PREFILL = 'नमस्ते! मुझे SahakarLekha (सहकारलेखा) के बारे में जानकारी चाहिए।';

const WhatsAppFab: React.FC = () => {
  if (!WHATSAPP_NUMBER) return null;
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(PREFILL)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp पर संपर्क करें"
      title="WhatsApp पर पूछें"
      className="no-print print:hidden fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 hover:bg-[#1ebe57] hover:shadow-xl transition-all px-4 py-3"
    >
      <SocialIcon paths={WHATSAPP_ICON_PATHS} className="h-6 w-6" />
      <span className="hidden sm:inline font-semibold text-sm pr-1">WhatsApp पर पूछें</span>
    </a>
  );
};

export default WhatsAppFab;
