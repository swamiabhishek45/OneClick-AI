import { Resume, UserProfile } from './types';

export interface ProfileExportBundle {
  version: 1;
  exportedAt: string;
  profiles: UserProfile[];
  resumes: Resume[];
}

export function buildExportBundle(profiles: UserProfile[], resumes: Resume[]): ProfileExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles,
    resumes,
  };
}

export function parseExportBundle(json: string): ProfileExportBundle {
  const data = JSON.parse(json) as ProfileExportBundle;
  if (!data || data.version !== 1 || !Array.isArray(data.profiles)) {
    throw new Error('Invalid export file format');
  }
  return {
    version: 1,
    exportedAt: data.exportedAt || new Date().toISOString(),
    profiles: data.profiles,
    resumes: Array.isArray(data.resumes) ? data.resumes : [],
  };
}
