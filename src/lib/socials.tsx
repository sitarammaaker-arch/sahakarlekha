import React from 'react';

/**
 * Single source of truth for SahakarLekha's public community channels.
 * Used by the public footer (small icons), the Contact page (big buttons), and
 * the Landing page (secondary community strip) — so links/icons never diverge.
 * All three are verified-live as of setup.
 */
export interface SocialChannel {
  label: string;     // full label (big buttons / pills)
  sub: string;       // subtitle for big buttons
  href: string;
  solidBg: string;   // brand background for solid buttons/pills
  hoverBg: string;   // hover background for footer icon chips
  paths: string[];   // SVG path "d" values, viewBox 0 0 24 24
}

const YT = ['M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z'];
const WA = ['M17.6 14.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.8-2.6-1.4-3.7-3.2-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.2-.3-.2-.5-.3z', 'M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z'];
const X = ['M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.1-9.3L.9 2h7.2l5 6.6L18.9 2zm-1.2 18h1.9L6.4 4H4.4l13.3 16z'];

/** Direct WhatsApp chat number — country code + number, no '+'. Empty string hides the button. */
export const WHATSAPP_NUMBER = '919467918545';
/** WhatsApp glyph paths (viewBox 0 0 24 24) for reuse in the floating contact button. */
export const WHATSAPP_ICON_PATHS = WA;

export const SOCIAL_CHANNELS: SocialChannel[] = [
  { label: 'YouTube', sub: 'हिंदी वीडियो · Subscribe', href: 'https://youtube.com/@sahakarlekha', solidBg: 'bg-[#FF0000]', hoverBg: 'hover:bg-[#FF0000]', paths: YT },
  { label: 'WhatsApp चैनल', sub: 'अपडेट पाएँ · Join', href: 'https://whatsapp.com/channel/0029VbCrSqS3QxS5kAk8VJ1A', solidBg: 'bg-[#25D366]', hoverBg: 'hover:bg-[#25D366]', paths: WA },
  { label: 'X (Twitter)', sub: 'Follow करें', href: 'https://x.com/sahakarlekha', solidBg: 'bg-black', hoverBg: 'hover:bg-black', paths: X },
];

export const SocialIcon: React.FC<{ paths: string[]; className?: string }> = ({ paths, className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    {paths.map((d, i) => <path key={i} d={d} />)}
  </svg>
);
