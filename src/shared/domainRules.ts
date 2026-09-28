import type { DomainRule } from './types';

/** Per-site opt-in for automatic fill (page load / SPA updates). */
export function isSiteAutoFillEnabled(rule: DomainRule): boolean {
  return rule.autoFillOnLoad === true;
}

export function withSiteAutoFill(rule: DomainRule, enabled: boolean): DomainRule {
  return {
    ...rule,
    enabled: true,
    autoFillOnLoad: enabled,
    requireConfirmation: false,
  };
}
