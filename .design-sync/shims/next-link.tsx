/**
 * `next/link` stand-in for the design-system bundle.
 *
 * The DS ships to claude.ai/design, which is not a Next app: the real
 * `next/link` reads Next's App Router context (and `process.env`) at module
 * init, which throws in a plain browser page. In the browser `next/link`
 * renders a plain `<a href>` anyway, so this shim renders exactly that and
 * drops the Next-only routing props. Components keep their own markup.
 */
import * as React from 'react';

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | { pathname?: string };
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
  locale?: string | false;
};

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch, replace, scroll, shallow, passHref, legacyBehavior, locale, children, ...rest },
  ref,
) {
  const resolved = typeof href === 'string' ? href : (href?.pathname ?? '#');
  return (
    <a ref={ref} href={resolved} {...rest}>
      {children}
    </a>
  );
});

export default Link;
