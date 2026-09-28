import { getExtensionURL } from './extensionRuntime';

type ExtensionLogoProps = {
  className?: string;
  alt?: string;
  /** Square chrome toolbar / FAB icons use full mark; UI headers use tighter crop. */
  variant?: 'mark' | 'full';
};

export function ExtensionLogo({
  className = 'h-5 w-5',
  alt = 'OneClick Autofill AI',
  variant = 'mark',
}: ExtensionLogoProps) {
  const file = variant === 'full' ? 'icon.png' : 'logo-mark.png';
  const src = getExtensionURL(file) ?? file;

  const fitClass =
    variant === 'mark'
      ? 'object-contain bg-cream'
      : 'object-cover object-center';

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} ${fitClass} shrink-0`}
      draggable={false}
    />
  );
}
