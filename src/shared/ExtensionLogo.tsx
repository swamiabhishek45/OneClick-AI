type ExtensionLogoProps = {
  className?: string;
  alt?: string;
};

export function ExtensionLogo({
  className = 'h-5 w-5',
  alt = 'OneClick Autofill AI',
}: ExtensionLogoProps) {
  const src =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('icon.png')
      : 'icon.png';

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-contain shrink-0`}
      draggable={false}
    />
  );
}
