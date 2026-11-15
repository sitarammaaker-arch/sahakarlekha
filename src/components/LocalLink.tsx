/**
 * LocalLink — react-router's <Link>, but an internal address follows the page's language (batch E): on an English
 * page a link to a page that has an English twin goes to /en/…; on a Hindi page a stray /en/… link goes to the
 * Hindi address. Addresses with no English twin (the logged-in app, /register…) are left as they are.
 * Drop-in: `import { Link } from '@/components/LocalLink'`.
 */
import React from 'react';
import { Link as RouterLink, type LinkProps } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizePath } from '@/lib/enRoutes';

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(({ to, ...rest }, ref) => {
  const { language } = useLanguage();
  const target = typeof to === 'string' ? localizePath(to, language) : to;
  return <RouterLink ref={ref} to={target} {...rest} />;
});
Link.displayName = 'LocalLink';

export default Link;
