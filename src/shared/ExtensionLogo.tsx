import { getExtensionURL } from './extensionRuntime';

type ExtensionLogoProps = {
  className?: string;
  alt?: string;
  /** Square chrome toolbar / FAB icons use full mark; UI headers use tighter crop. */
  variant?: 'mark' | 'full';
};

export function ExtensionLogo({
  className = 'h-5 w-5',
  alt = 'OneClick AI',
  variant = 'mark',
}: ExtensionLogoProps) {
  const file = variant === 'full' ? 'icon.png' : 'logo-mark.png';
  const src = getExtensionURL(file) ?? file;

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-contain object-center shrink-0 max-h-full max-w-full`}
      draggable={false}
    />
  );
}
