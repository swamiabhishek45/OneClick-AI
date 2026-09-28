import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CustomField, CustomFieldSection } from '../shared/types';
import { profileInputClass, profileLabelClass } from './ProfileFormUi';

type Props = {
  section: CustomFieldSection;
  fields: CustomField[];
  onAdd: (section: CustomFieldSection) => void;
  onChange: (index: number, key: 'name' | 'value', val: string) => void;
  onRemove: (index: number) => void;
  getGlobalIndex: (fieldId: string) => number;
};

export function SectionCustomFields({
  section,
  fields,
  onAdd,
  onChange,
  onRemove,
  getGlobalIndex,
}: Props) {
  const sectionFields = fields.filter((f) => (f.section || 'personal') === section);

  return (
    <div className="sm:col-span-2 mt-2 pt-5 border-t border-slate-800/70">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Extra fields
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Optional answers matched by label during autofill
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(section)}
          className="bg-brand-600/15 border border-brand-500/30 hover:bg-brand-600/25 text-brand-200 py-2 px-3.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add field
        </button>
      </div>

      {sectionFields.length === 0 ? (
        <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-800 py-4 px-3 text-center">
          No extra fields yet — e.g. Gender, visa status, ethnicity
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_40px] gap-3 px-1">
            <span className={profileLabelClass}>Label</span>
            <span className={profileLabelClass}>Autofill value</span>
            <span />
          </div>
          {sectionFields.map((field) => {
            const globalIndex = getGlobalIndex(field.id);
            return (
              <div
                key={field.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_40px] gap-3 items-start sm:items-center rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 sm:p-0 sm:border-0 sm:bg-transparent"
              >
                <div>
                  <span className={`${profileLabelClass} sm:hidden`}>Label</span>
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => onChange(globalIndex, 'name', e.target.value)}
                    placeholder="e.g. Gender"
                    className={profileInputClass}
                  />
                </div>
                <div>
                  <span className={`${profileLabelClass} sm:hidden`}>Value</span>
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => onChange(globalIndex, 'value', e.target.value)}
                    placeholder="e.g. Female"
                    className={profileInputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(globalIndex)}
                  title="Remove field"
                  className="h-[42px] w-full sm:w-10 flex items-center justify-center bg-slate-900 border border-slate-800 hover:border-rose-500/40 hover:text-rose-400 text-slate-400 transition rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
