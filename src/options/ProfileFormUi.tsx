import React from 'react';
import { LucideIcon } from 'lucide-react';

export const profileLabelClass = 'block text-[11px] font-semibold ui-label uppercase tracking-wide mb-1.5';
export const profileInputClass =
  'w-full ui-input rounded-lg px-3 py-2.5 text-sm';
export const profileTextareaClass = `${profileInputClass} resize-y min-h-[88px]`;

export const profileSectionGridClass =
  'grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4';
export const profileSectionCardClass =
  'ui-panel p-5 sm:p-6 rounded-2xl shadow-sm dark:shadow-none';

type ProfileFieldProps = {
  label: string;
  span?: 'full' | 'half';
  children: React.ReactNode;
};

export function ProfileField({ label, span = 'half', children }: ProfileFieldProps) {
  return (
    <div className={span === 'full' ? 'sm:col-span-2' : undefined}>
      <label className={profileLabelClass}>{label}</label>
      {children}
    </div>
  );
}

type ProfileSectionProps = {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
};

export function ProfileSection({ icon: Icon, title, children }: ProfileSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/10 border border-brand-600/20 dark:bg-brand-500/15 dark:border-brand-400/25">
          <Icon className="w-4 h-4 text-brand-700 dark:text-brand-300" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider ui-heading">{title}</h3>
      </div>
      <div className={profileSectionCardClass}>{children}</div>
    </section>
  );
}

type EducationSubBlockProps = {
  title: string;
  children: React.ReactNode;
};

export function EducationSubBlock({ title, children }: EducationSubBlockProps) {
  return (
    <div className="rounded-xl border border-brand-800/15 bg-cream-50/80 p-4 sm:p-5 dark:bg-brand-950/50 dark:border-brand-600/25">
      <h4 className="text-xs font-semibold text-brand-700 dark:text-brand-300 mb-4 pb-2 border-b border-brand-800/15 dark:border-brand-600/25">
        {title}
      </h4>
      <div className={profileSectionGridClass}>{children}</div>
    </div>
  );
}
