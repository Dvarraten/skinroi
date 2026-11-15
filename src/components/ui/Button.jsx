// The one place buttons are styled. Pick a variant by what the button does,
// not by how it should look:
//
//   primary    the main action of a view (at most one per view / row)
//   secondary  any other action                         (default)
//   ghost      low-key actions: cancel, reset, hide, links in a toolbar
//   success    confirm a sale
//   danger     delete / destructive, quiet until hovered
//   dangerSolid  the confirm step of a destructive action
//
// Sizes: xs (28px, table rows), sm (32px, toolbars), md (36px, forms),
// lg (44px, page-level call to action). `pressed` turns a secondary or ghost
// button into a toggle. `as="a"` renders a link that looks like a button.
import React from 'react';
import { useTheme } from '../../themes/ThemeContext';

const BASE =
  'inline-flex items-center justify-center shrink-0 rounded-lg font-medium whitespace-nowrap select-none ' +
  'transition-colors disabled:opacity-40 disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:pointer-events-none';

const SIZES = {
  xs: 'h-7 px-2.5 gap-1 text-xs',
  sm: 'h-8 px-3 gap-1.5 text-xs',
  md: 'h-9 px-4 gap-2 text-[13px]',
  lg: 'h-11 px-5 gap-2 text-sm',
};

const ICON_SIZES = {
  xs: 'h-7 w-7',
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
};

function variantClasses(variant, theme, pressed) {
  switch (variant) {
    case 'primary':
      // Fill and text colour come from the theme accent as inline styles.
      return 'font-semibold hover:brightness-110 active:brightness-95';
    case 'success':
      return 'font-semibold bg-emerald-600 hover:bg-emerald-500 text-white';
    case 'dangerSolid':
      return 'font-semibold bg-red-600 hover:bg-red-500 text-white';
    case 'danger':
      return 'text-red-400 hover:text-red-300 hover:bg-red-500/10';
    case 'ghost':
      return pressed
        ? `${theme.activeBg} ${theme.text}`
        : `${theme.subtext} ${theme.textHover} ${theme.itemHoverBg}`;
    case 'secondary':
    default:
      return pressed
        ? `border ${theme.cardBorder} ${theme.activeBg} ${theme.text}`
        : `border ${theme.cardBorder} ${theme.card} ${theme.textSecondary} ${theme.textHover} ${theme.cardHover} ${theme.itemHoverBg}`;
  }
}

export const Button = React.forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon = null,
    iconRight = null,
    block = false,
    pressed,
    as: Tag = 'button',
    className = '',
    style,
    children,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const accentStyle = variant === 'primary'
    ? { backgroundColor: theme.accentColor, color: theme.onAccent }
    : null;
  return (
    <Tag
      ref={ref}
      type={Tag === 'button' ? 'button' : undefined}
      aria-pressed={pressed === undefined ? undefined : !!pressed}
      className={`${BASE} ${SIZES[size] || SIZES.md} ${variantClasses(variant, theme, pressed)} ${block ? 'w-full' : ''} ${className}`}
      style={accentStyle ? { ...accentStyle, ...style } : style}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </Tag>
  );
});

// Square button that only shows an icon. `label` is required: it is the
// tooltip and what screen readers announce.
export const IconButton = React.forwardRef(function IconButton(
  { label, variant = 'ghost', size = 'sm', pressed, className = '', style, children, ...rest },
  ref,
) {
  const theme = useTheme();
  const accentStyle = variant === 'primary'
    ? { backgroundColor: theme.accentColor, color: theme.onAccent }
    : null;
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : !!pressed}
      className={`${BASE} ${ICON_SIZES[size] || ICON_SIZES.sm} ${variantClasses(variant, theme, pressed)} ${className}`}
      style={accentStyle ? { ...accentStyle, ...style } : style}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;
