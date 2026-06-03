import { LayoutGrid, Briefcase, FileText } from "lucide-react";
import type { MatterTab } from "../types";

interface Props {
  active: MatterTab;
  onChange: (t: MatterTab) => void;
  matterTitle: string;
}

const tabs: { id: MatterTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",  label: "Overview",   icon: <LayoutGrid size={14} /> },
  { id: "work_done", label: "Work Done",  icon: <Briefcase size={14} /> },
  { id: "invoices",  label: "Invoices",   icon: <FileText size={14} /> },
];

export default function MatterTabs({ active, onChange, matterTitle }: Props) {
  return (
    <div className="border-b border-neutral-200 bg-white shrink-0">
      {/* Matter title breadcrumb */}
      <div className="px-6 pt-3 pb-0">
        <p className="text-xs text-neutral-400 truncate mb-2">{matterTitle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-4">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-default -mb-px ${
              active === id
                ? "border-neutral-900 text-neutral-800"
                : "border-transparent text-neutral-500 hover:text-neutral-800 hover:border-neutral-300"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
