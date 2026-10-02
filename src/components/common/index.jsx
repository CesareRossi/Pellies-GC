import React, { useId } from 'react';
import { Select } from './Select';

export { Select } from './Select';

/* ==========================================================================
   Shared primitives for the Pellies GC premium layer.
   Styling lives in src/styles/premium.css — these just give every screen the
   same markup, spacing and a11y wiring.
   ========================================================================== */

/** Page title block: eyebrow + display heading + optional lede and actions. */
export const PageHeader = ({ eyebrow, title, lede, icon, actions, align = 'left', className = '' }) => (
  <div
    className={`mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}
  >
    <div className={align === 'center' ? 'w-full text-center' : 'min-w-0'}>
      {eyebrow && <p className="pg-eyebrow pg-eyebrow-gold mb-2">{eyebrow}</p>}
      <h2
        className={`pg-display text-[26px] sm:text-[32px] pg-gold-text ${
          align === 'center' ? 'flex items-center justify-center gap-3' : 'flex items-center gap-3'
        }`}
      >
        {icon && <span className="text-[#D4AF37] shrink-0">{icon}</span>}
        <span className="min-w-0 truncate">{title}</span>
      </h2>
      {lede && (
        <p className="mt-1.5 text-sm text-[#A9C5B4] leading-relaxed">{lede}</p>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/** Small all-caps heading used inside panels. */
export const SectionLabel = ({ icon, children, trailing, className = '' }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    {icon && <span className="text-[#D4AF37] shrink-0">{icon}</span>}
    <span className="pg-eyebrow flex-1 min-w-0">{children}</span>
    {trailing}
  </div>
);

export const Card = ({ as: Tag = 'div', feature = false, interactive = false, className = '', children, ...rest }) => (
  <Tag
    className={`pg-card ${feature ? 'pg-card-feature' : ''} ${
      interactive ? 'pg-card-interactive' : ''
    } ${className}`}
    {...rest}
  >
    {children}
  </Tag>
);

export const Button = ({
  variant = 'secondary',
  size = 'md',
  block = false,
  icon,
  iconRight,
  className = '',
  children,
  ...rest
}) => (
  <button
    type="button"
    className={`pg-btn pg-btn-${variant} ${size === 'sm' ? 'pg-btn-sm' : ''} ${
      size === 'lg' ? 'pg-btn-lg' : ''
    } ${block ? 'pg-btn-block' : ''} ${className}`}
    {...rest}
  >
    {icon}
    {children}
    {iconRight}
  </button>
);

export const IconButton = ({ tone = 'default', active = false, label, className = '', children, ...rest }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    className={`pg-icon-btn ${tone === 'gold' ? 'pg-icon-btn-gold' : ''} ${
      tone === 'danger' ? 'pg-icon-btn-danger' : ''
    } ${active ? 'pg-icon-btn-active' : ''} ${className}`}
    {...rest}
  >
    {children}
  </button>
);

export const Chip = ({ tone = 'default', className = '', children, ...rest }) => (
  <span className={`pg-chip ${tone !== 'default' ? `pg-chip-${tone}` : ''} ${className}`} {...rest}>
    {children}
  </span>
);

export const LiveChip = ({ children = 'Live' }) => (
  <span className="pg-chip pg-chip-live">
    <span className="pg-live-dot" />
    {children}
  </span>
);

/** Labelled text/number input. */
export const Field = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  hint,
  error,
  inputMode,
  min,
  max,
  className = '',
  ...rest
}) => {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label className="pg-label" htmlFor={id}>
          {label}
          {required && <span className="text-[#D4AF37] ml-1">*</span>}
        </label>
      )}
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
        value={value ?? ''}
        onChange={(e) =>
          onChange(
            type === 'number'
              ? e.target.value === ''
                ? null
                : parseFloat(e.target.value)
              : e.target.value
          )
        }
        className={`pg-input ${error ? 'pg-input-invalid' : ''}`}
        placeholder={placeholder}
        required={required}
        aria-invalid={!!error}
        step={type === 'number' ? 'any' : undefined}
        {...rest}
      />
      {error ? <p className="pg-field-error">{error}</p> : hint ? <p className="pg-field-hint">{hint}</p> : null}
    </div>
  );
};

/**
 * Labelled select. Uses our own listbox rather than a native <select>: the
 * OS-drawn option list ignores the app's theme (on macOS it opens as a large,
 * light, detached panel) and can't be styled reliably across platforms.
 */
export const SelectField = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  error,
  disabled,
  className = '',
  ...rest
}) => {
  const id = useId();
  const labelId = `${id}-label`;
  return (
    <div className={className}>
      {label && (
        <label className="pg-label" id={labelId} htmlFor={id}>
          {label}
        </label>
      )}
      <Select
        id={id}
        aria-labelledby={label ? labelId : undefined}
        value={value ?? ''}
        onChange={onChange}
        options={options}
        placeholder={placeholder || 'Select…'}
        disabled={disabled}
        invalid={!!error}
        {...rest}
      />
      {error ? <p className="pg-field-error">{error}</p> : hint ? <p className="pg-field-hint">{hint}</p> : null}
    </div>
  );
};

/**
 * Segmented control. The active option is styled with CSS rather than an
 * animated pill — see the note in premium.css for why.
 */
export const Segmented = ({ value, onChange, options, size = 'md', className = '', ariaLabel }) => (
  <div className={`pg-segment ${className}`} role="tablist" aria-label={ariaLabel}>
    {options.map((o) => {
      const active = String(o.value) === String(value);
      return (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={active}
          data-active={active}
          onClick={() => onChange(o.value)}
          className="pg-segment-item"
          style={size === 'sm' ? { padding: '6px 11px', fontSize: 12 } : undefined}
          title={o.title}
        >
          {o.icon}
          <span>{o.label}</span>
          {o.count != null && (
            <span
              className={`ml-0.5 rounded-full px-1.5 py-px text-[10px] font-bold ${
                active ? 'bg-[#051A10]/20 text-[#051A10]' : 'bg-white/8 text-[#A9C5B4]'
              }`}
            >
              {o.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export const Spinner = ({ size = 40, className = '' }) => (
  <div
    className={`rounded-full border-2 border-[#D4AF37]/25 border-t-[#D4AF37] animate-spin ${className}`}
    style={{ width: size, height: size }}
    role="status"
    aria-label="Loading"
  />
);

export const LoadingState = ({ label = 'Loading…', className = '' }) => (
  <div className={`min-h-[40vh] flex items-center justify-center ${className}`}>
    <div className="text-center">
      <Spinner className="mx-auto mb-4" />
      <p className="text-[#A9C5B4] text-sm">{label}</p>
    </div>
  </div>
);

export const EmptyState = ({ icon, title, message, action, className = '' }) => (
  <div className={`flex min-h-[38vh] items-center justify-center px-4 ${className}`}>
    <div className="text-center max-w-sm">
      {icon && (
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/8 text-[#D4AF37]">
          {icon}
        </div>
      )}
      <h3 className="pg-display text-xl text-[#D4AF37] mb-2">{title}</h3>
      {message && <p className="text-sm text-[#A9C5B4] leading-relaxed">{message}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  </div>
);

/** Inline status banner — info / success / error / warning. */
export const Banner = ({ tone = 'info', children, className = '', ...rest }) => {
  const tones = {
    info: 'border-[#D4AF37]/25 bg-[#D4AF37]/8 text-[#E8D9A6]',
    success: 'border-emerald-500/30 bg-emerald-900/25 text-emerald-200',
    error: 'border-red-500/30 bg-red-900/25 text-red-200',
    warning: 'border-amber-500/30 bg-amber-900/25 text-amber-200',
  };
  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${tones[tone]} ${className}`}
      role={tone === 'error' ? 'alert' : 'status'}
      {...rest}
    >
      {children}
    </div>
  );
};

/** Search input with a leading magnifier and a clear button. */
export const SearchInput = ({ value, onChange, placeholder = 'Search…', className = '', ...rest }) => (
  <div className={`relative ${className}`}>
    <svg
      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A9C5B4]/60"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="pg-input pg-input-search"
      {...rest}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#A9C5B4]/70 hover:bg-white/8 hover:text-white"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    )}
  </div>
);
