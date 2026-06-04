/**
 * ReportsPage.tsx — Reports & Analytics landing page
 *
 * Shows a card grid. Each card navigates into the full report view.
 * Also includes the Accountant Package export widget.
 */

import { useState } from "react";
import {
  FileText, AlertCircle, TrendingUp, Phone, Package,
} from "lucide-react";
import InvoiceRegister    from "./InvoiceRegister";
import OutstandingInvoices from "./OutstandingInvoices";
import RevenueSummary     from "./RevenueSummary";
import CollectionsFollowUp from "./CollectionsFollowUp";
import AccountantPackage  from "./AccountantPackage";

// ── Report registry ───────────────────────────────────────────────────────────

type ReportId =
  | "invoice_register"
  | "outstanding"
  | "revenue_summary"
  | "collections";

interface ReportCard {
  id:          ReportId;
  icon:        React.ReactNode;
  title:       string;
  description: string;
  badge?:      string;
}

const REPORTS: ReportCard[] = [
  {
    id:          "invoice_register",
    icon:        <FileText size={20} />,
    title:       "Invoice Register",
    description: "Complete list of invoices for a period. Ideal for GST filing, audits, and accounting.",
    badge:       "GST",
  },
  {
    id:          "outstanding",
    icon:        <AlertCircle size={20} />,
    title:       "Outstanding Invoices",
    description: "Aged debtors report with 0–30 / 31–60 / 61–90 / 90+ day buckets.",
    badge:       "Collections",
  },
  {
    id:          "revenue_summary",
    icon:        <TrendingUp size={20} />,
    title:       "Revenue Summary",
    description: "Month-by-month invoiced vs collected. Track practice growth and collection rate.",
    badge:       "FY",
  },
  {
    id:          "collections",
    icon:        <Phone size={20} />,
    title:       "Collections Follow-Up",
    description: "Overdue invoices with client contact details. Export for follow-up calls.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [active, setActive] = useState<ReportId | null>(null);
  const [showPackage, setShowPackage] = useState(false);

  // Render active report
  if (active === "invoice_register")
    return <InvoiceRegister onBack={() => setActive(null)} />;
  if (active === "outstanding")
    return <OutstandingInvoices onBack={() => setActive(null)} />;
  if (active === "revenue_summary")
    return <RevenueSummary onBack={() => setActive(null)} />;
  if (active === "collections")
    return <CollectionsFollowUp onBack={() => setActive(null)} />;

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-neutral-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Financial reports for your practice — optimised for Indian advocates.
          </p>
        </div>

        {/* Report cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {REPORTS.map(r => (
            <button
              key={r.id}
              onClick={() => setActive(r.id)}
              className="group text-left border border-neutral-200 rounded-2xl p-5 hover:border-neutral-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white text-neutral-600 rounded-xl transition-colors">
                  {r.icon}
                </div>
                {r.badge && (
                  <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                    {r.badge}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-1">{r.title}</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">{r.description}</p>
              <div className="mt-3 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                Open report →
              </div>
            </button>
          ))}
        </div>

        {/* Accountant Package */}
        <div className="border border-neutral-200 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Package size={16} className="text-neutral-700" />
                <h3 className="text-sm font-semibold text-neutral-900">Accountant Package</h3>
                <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100">
                  All-in-one
                </span>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Export all reports as a single Excel workbook with 6 sheets — Invoice Register,
                Outstanding, Ageing Analysis, Revenue Summary, Payments, and Client Summary.
                Share with your accountant at quarter-end.
              </p>
            </div>
          </div>

          {showPackage ? (
            <AccountantPackage onClose={() => setShowPackage(false)} />
          ) : (
            <button
              onClick={() => setShowPackage(true)}
              className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-700 transition-colors"
            >
              <Package size={14} />
              Generate Accountant Package
            </button>
          )}
        </div>

        {/* Footer note */}
        <p className="text-xs text-neutral-400 text-center mt-8">
          All reports use Indian Financial Year (April 1 – March 31) · Data is read-only
        </p>
      </div>
    </div>
  );
}
