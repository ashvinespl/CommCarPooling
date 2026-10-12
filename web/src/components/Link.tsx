// Router links that also work inside hosts which follow <a href> clicks
// themselves (e.g. a sandboxed single-file preview). In the normal build these
// are react-router's own components. In the in-memory preview build, links get
// a harmless "#" href and navigate in-app on click, so the host never leaves the page.
import { forwardRef, type MouseEvent } from 'react';
import {
  Link as RouterLink, NavLink as RouterNavLink, useMatch, useNavigate, useResolvedPath,
  type LinkProps, type NavLinkProps,
} from 'react-router-dom';

const IN_APP_ONLY = import.meta.env.VITE_ROUTER === 'memory';

function useInAppClick(to: LinkProps['to'], onClick?: (e: MouseEvent<HTMLAnchorElement>) => void) {
  const navigate = useNavigate();
  return (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    navigate(to);
  };
}

const InAppLink = forwardRef<HTMLAnchorElement, LinkProps>(({ to, onClick, replace: _r, state: _s, reloadDocument: _d, relative: _rel, preventScrollReset: _p, viewTransition: _v, target: _t, ...rest }, ref) => {
  const handle = useInAppClick(to, onClick);
  return <a {...rest} ref={ref} href="#" onClick={handle} />;
});

const InAppNavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(({ to, onClick, className, style, children, end, caseSensitive: _c, replace: _r, state: _s, reloadDocument: _d, relative: _rel, preventScrollReset: _p, viewTransition: _v, target: _t, ...rest }, ref) => {
  const handle = useInAppClick(to, onClick);
  const path = useResolvedPath(to);
  const isActive = !!useMatch({ path: path.pathname, end: end ?? false });
  const state = { isActive, isPending: false, isTransitioning: false };
  return (
    <a {...rest} ref={ref} href="#" onClick={handle} aria-current={isActive ? 'page' : undefined}
      className={typeof className === 'function' ? className(state) : className}
      style={typeof style === 'function' ? style(state) : style}>
      {typeof children === 'function' ? children(state) : children}
    </a>
  );
});

export const Link = IN_APP_ONLY ? InAppLink : RouterLink;
export const NavLink = IN_APP_ONLY ? InAppNavLink : RouterNavLink;
