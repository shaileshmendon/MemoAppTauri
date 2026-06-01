import { useState, useEffect } from "react";
import { fetchMatters, getDb, loadProfile } from "../db";
import type { Matter, Profile } from "../types";
import { fmtRef } from "../types";
import { format } from "date-fns";
import { User, Building2, Phone, Mail, Landmark, BadgeCheck, PenLine, Globe, CreditCard } from "lucide-react";


function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n);
}

// ── Profile card ─────────────────────────────────────────────────────────────

function ProfileCard({ onEdit }: { onEdit: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfile().then(p => { if (p) setProfile(p); });
  }, []);

  const isEmpty = !profile || (!profile.advocateName && !profile.firmName);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden mb-8">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
        <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
          <User size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-neutral-800">My Profile</p>
          <p className="text-xs text-neutral-400">
            {isEmpty ? "Add your details to personalise invoices" : "Used in generated invoices and documents"}
          </p>
        </div>
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-50">
          <PenLine size={12} />
          {isEmpty ? "Set up profile" : "Edit"}
        </button>
      </div>

      {/* View mode */}
      <div className="px-5 py-4">
        {isEmpty ? (
          <p className="text-sm text-neutral-400 text-center py-4">
            No profile set up yet. Click <strong>Set up profile</strong> to add your details.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-x-8 gap-y-4">
            {/* Identity */}
            <div className="col-span-3 pb-3 border-b border-neutral-100">
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                <ProfileField icon={<User size={13} />} label="Name"
                  value={[profile!.advocateName, profile!.designation].filter(Boolean).join(" · ")} />
                {profile!.firmName && (
                  <ProfileField icon={<Building2 size={13} />} label="Firm" value={profile!.firmName} />
                )}
                {profile!.barCouncilNumber && (
                  <ProfileField icon={<BadgeCheck size={13} />} label="Bar Enrolment" value={profile!.barCouncilNumber} />
                )}
                {profile!.gstin && (
                  <ProfileField icon={<BadgeCheck size={13} />} label="GSTIN" value={profile!.gstin} />
                )}
                {profile!.pan && (
                  <ProfileField icon={<CreditCard size={13} />} label="PAN" value={profile!.pan} />
                )}
              </div>
            </div>
            {/* Contact */}
            <div className="col-span-3 pb-3 border-b border-neutral-100">
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                {(profile!.addressLine1 || profile!.city) && (
                  <ProfileField icon={<Building2 size={13} />} label="Address"
                    value={[profile!.addressLine1, profile!.addressLine2, profile!.city, profile!.state, profile!.pincode].filter(Boolean).join(", ")} />
                )}
                {profile!.phone && <ProfileField icon={<Phone size={13} />} label="Phone" value={profile!.phone} />}
                {profile!.email && <ProfileField icon={<Mail size={13} />} label="Email" value={profile!.email} />}
                {profile!.website && <ProfileField icon={<Globe size={13} />} label="Website" value={profile!.website} />}
              </div>
            </div>
            {/* Bank */}
            {(profile!.bankName || profile!.accountNumber) && (
              <div className="col-span-3">
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  {profile!.accountHolder && <ProfileField icon={<Landmark size={13} />} label="Account Name" value={profile!.accountHolder} />}
                  {profile!.bankName && <ProfileField icon={<Landmark size={13} />} label="Bank" value={`${profile!.bankName}${profile!.bankBranch ? ` · ${profile!.bankBranch}` : ""}`} />}
                  {profile!.accountNumber && <ProfileField icon={<CreditCard size={13} />} label="Account No." value={profile!.accountNumber} />}
                  {profile!.ifscCode && <ProfileField icon={<CreditCard size={13} />} label="IFSC" value={profile!.ifscCode} />}
                  {profile!.upiId && <ProfileField icon={<CreditCard size={13} />} label="UPI" value={profile!.upiId} />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <span className="mt-0.5 text-neutral-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-neutral-400">{label}</p>
        <p className="text-sm text-neutral-700 truncate max-w-xs">{value}</p>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard({ onEditProfile }: { onEditProfile?: () => void }) {
  const [stats, setStats] = useState({
    totalMatters: 0, activeMatters: 0,
    totalInvoiced: 0, totalPaid: 0,
    totalAppearances: 0, totalTimeMins: 0,
  });
  const [recentMatters, setRecentMatters] = useState<Matter[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const matters = await fetchMatters();
      setRecentMatters(matters.slice(0, 5));

      const [invRow] = await db.select<{ total: number }[]>(
        "SELECT COALESCE(SUM(total_amount),0) as total FROM invoices"
      );
      const [paidRow] = await db.select<{ total: number }[]>(
        "SELECT COALESCE(SUM(amount_paid),0) as total FROM payments"
      );
      const [appRow] = await db.select<{ total: number }[]>(
        "SELECT COUNT(*) as total FROM appearances"
      );
      const [timeRow] = await db.select<{ total: number }[]>(
        "SELECT COALESCE(SUM(duration_minutes),0) as total FROM time_entries"
      );

      setStats({
        totalMatters: matters.length,
        activeMatters: matters.filter((m) => m.status === "active").length,
        totalInvoiced: invRow?.total ?? 0,
        totalPaid: paidRow?.total ?? 0,
        totalAppearances: appRow?.total ?? 0,
        totalTimeMins: timeRow?.total ?? 0,
      });
    })();
  }, []);

  const statItems = [
    { label: "Active Matters",  value: stats.activeMatters.toString(), sub: `${stats.totalMatters} total` },
    { label: "Total Invoiced",  value: inr(stats.totalInvoiced),       sub: `${inr(stats.totalPaid)} received` },
    { label: "Outstanding",     value: inr(stats.totalInvoiced - stats.totalPaid), sub: "balance due" },
    { label: "Time Logged",     value: `${Math.floor(stats.totalTimeMins / 60)}h ${stats.totalTimeMins % 60}m`, sub: "across all matters" },
    { label: "Appearances",     value: stats.totalAppearances.toString(), sub: "court appearances" },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-8 pt-6 pb-10 max-w-5xl mx-auto w-full">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Dashboard</h1>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {statItems.map(({ label, value, sub }) => (
            <div key={label} className="bg-white border border-neutral-200 rounded-xl p-4">
              <p className="text-xs text-neutral-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-neutral-900">{value}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Profile card */}
        <ProfileCard onEdit={() => onEditProfile?.()} />

        {/* Recent matters */}
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Recent Matters</h2>
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          {recentMatters.length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-8">No matters yet.</p>
          )}
          {recentMatters.map((m, i) => (
            <div key={m.id}
              className={`px-4 py-3 flex items-center gap-3 ${i < recentMatters.length - 1 ? "border-b border-neutral-100" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-neutral-800 truncate flex-1">{m.case_title}</p>
                  <span className="text-[10px] font-mono text-neutral-400 shrink-0">{fmtRef(m.ref_number)}</span>
                </div>
                <p className="text-xs text-neutral-500 truncate">{m.client_name}</p>
              </div>
              <span className="text-xs text-neutral-400">
                {format(new Date(m.created_at), "d MMM yyyy")}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                m.status === "active"  ? "bg-green-100 text-green-700"  :
                m.status === "closed"  ? "bg-neutral-100 text-neutral-500" :
                                         "bg-amber-100 text-amber-700"
              }`}>{m.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
