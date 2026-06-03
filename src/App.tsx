import { useState, useEffect, useCallback } from "react";
import "./index.css";
import Sidebar from "./components/Sidebar";
import MatterList from "./components/MatterList";
import MatterForm from "./components/MatterForm";
import MatterDetail from "./components/MatterDetail";
import MatterTabs from "./components/MatterTabs";
import WorkDone from "./components/WorkDone";
import Invoices from "./components/Invoices";
import type { MatterTab } from "./types";
import Dashboard from "./components/Dashboard";
import OutstandingDues from "./components/OutstandingDues";
import RecordPayment from "./components/RecordPayment";
import ContactList from "./components/ContactList";
import Onboarding from "./components/Onboarding";
import SettingsPage from "./components/SettingsPage";
import AboutModal from "./components/AboutModal";
import ScreenshotHelper from "./components/ScreenshotHelper";
import LockScreen from "./components/LockScreen";
import QuickCapture from "./components/QuickCapture";
import Inbox from "./components/Inbox";
import { isProfileSetup, loadProfile, getLock, fetchInboxCount } from "./db";
import type { AppLock } from "./db";
import type { Matter, NavSection, Profile } from "./types";

// Sidebar width in px — must match w-52 (13rem = 208px)
const SIDEBAR_W = 208;

export default function App() {
  const [nav, setNav] = useState<NavSection>("matters");
  const [selectedMatter, setSelectedMatter] = useState<Matter | null>(null);
  const [matterTab, setMatterTab] = useState<MatterTab>("overview");
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [refreshList, setRefreshList] = useState(0);
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [lock, setLock] = useState<AppLock | null | "loading">("loading");
  const [unlocked, setUnlocked] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  /** Invoice ID to auto-expand when the Invoices tab opens after Bill Unbilled Work. */
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([isProfileSetup(), loadProfile(), getLock()]).then(([ready, prof, lk]) => {
      setProfileReady(ready);
      if (prof) setProfile(prof);
      setLock(lk);
      // If no lock, consider immediately unlocked
      if (!lk) setUnlocked(true);
    });
    fetchInboxCount().then(setInboxCount);
  }, []);

  // ⌘K global shortcut — open Quick Capture
  const refreshInboxCount = useCallback(() => {
    fetchInboxCount().then(setInboxCount);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setShowCapture(c => !c);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Called from SettingsPage when user sets/removes lock
  const handleLockChanged = () => {
    getLock().then(lk => { setLock(lk); if (!lk) setUnlocked(true); });
  };

  const handleOnboardingComplete = (p: Profile) => {
    setProfile(p);
    setProfileReady(true);
  };

  const handleProfileSaved = (p: Profile) => {
    setProfile(p);
  };

  const selectMatter = (m: Matter) => {
    setSelectedMatter(m);
    setEditing(false);
    setIsNew(false);
    setNav("matters");
  };

  const openNew = () => {
    setSelectedMatter(null);
    setEditing(false);
    setIsNew(true);
    setNav("matters");
  };

  const handleSaveMatter = (m: Matter) => {
    setSelectedMatter(m);
    setEditing(false);
    setIsNew(false);
    setMatterTab("overview");
    setRefreshList(r => r + 1);
  };

  const handleDeleteMatter = () => {
    setSelectedMatter(null);
    setEditing(false);
    setIsNew(false);
    setRefreshList(r => r + 1);
  };

  const handleNavChange = (n: NavSection) => {
    setNav(n);
    if (n === "matters") setMatterTab("overview");
    setEditing(false);
    setIsNew(false);
  };

  const handleTabChange = (t: MatterTab) => {
    setMatterTab(t);
    setEditing(false);
    setIsNew(false);
  };

  // ── Render the main content panel ───────────────────────────────────────

  const renderContent = () => {
    // Full-page sections (no matter context needed)
    if (nav === "dashboard")      return <Dashboard onEditProfile={() => setNav("settings")} />;
    if (nav === "outstanding")    return <OutstandingDues />;
    if (nav === "record_payment") return <RecordPayment />;
    if (nav === "inbox")          return <Inbox onAssigned={refreshInboxCount} />;
    if (nav === "clients")     return <ContactList type="client" />;
    if (nav === "firms")       return <ContactList type="firm" />;
    if (nav === "settings")    return <SettingsPage profile={profile} onSaved={handleProfileSaved} onLockChanged={handleLockChanged} />;

    // New matter form
    if (isNew) {
      return (
        <MatterForm
          onSave={handleSaveMatter}
          onCancel={() => setIsNew(false)}
        />
      );
    }

    // No matter selected yet
    if (!selectedMatter) {
      return <EmptyState text="Select a matter or click + to create one" />;
    }

    // Edit form
    if (editing) {
      return (
        <MatterForm
          initial={selectedMatter}
          onSave={handleSaveMatter}
          onCancel={() => setEditing(false)}
        />
      );
    }

    // Tabbed matter view
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <MatterTabs
          active={matterTab}
          onChange={handleTabChange}
          matterTitle={selectedMatter.case_title}
        />
        <div className="flex-1 overflow-hidden">
          {matterTab === "overview"     && (
            <MatterDetail
              matter={selectedMatter}
              onEdit={() => setEditing(true)}
              onDelete={handleDeleteMatter}
              onTabChange={handleTabChange}
              onInvoiceCreated={(invoiceId) => {
                setPendingInvoiceId(invoiceId);
                handleTabChange("invoices");
              }}
            />
          )}
          {matterTab === "work_done"    && (
            <WorkDone
              matter={selectedMatter}
              onInvoiceCreated={(invoiceId) => {
                setPendingInvoiceId(invoiceId);
                handleTabChange("invoices");
              }}
            />
          )}
          {matterTab === "invoices"     && (
            <Invoices
              matter={selectedMatter}
              autoExpandId={pendingInvoiceId}
              onAutoExpandConsumed={() => setPendingInvoiceId(null)}
            />
          )}
        </div>
      </div>
    );
  };

  const showMatterList = !["dashboard", "outstanding", "record_payment", "inbox", "clients", "firms", "settings"].includes(nav);

  // Show splash while checking
  if (profileReady === null || lock === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white text-sm">
        Loading…
      </div>
    );
  }

  // Show lock screen if lock is set and not yet unlocked
  if (lock && !unlocked) {
    return <LockScreen lock={lock} onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Drag bar — uses data-tauri-drag-region so macOS handles window dragging
           without the WebView losing keyboard focus (startDragging() API was
           causing the WKWebView to cede OS-level keyboard focus on every click) */}
      <div
        className="h-9 w-full shrink-0 select-none cursor-default"
        style={{
          background: `linear-gradient(to right, #171717 ${SIDEBAR_W}px, #f9fafb ${SIDEBAR_W}px)`,
        }}
        data-tauri-drag-region
      />

      {/* Onboarding overlay */}
      {!profileReady && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}

      {/* About modal */}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {/* Quick Capture palette — ⌘K */}
      {showCapture && (
        <QuickCapture
          onClose={() => setShowCapture(false)}
          onSaved={() => { setShowCapture(false); refreshInboxCount(); }}
        />
      )}

      {/* Dev-only screenshot helper — ⌘⇧D to toggle */}
      <ScreenshotHelper />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={nav}
          onChange={handleNavChange}
          onAbout={() => setShowAbout(true)}
          onLock={lock ? () => setUnlocked(false) : undefined}
          inboxCount={inboxCount}
          onQuickCapture={() => setShowCapture(true)}
        />

        {showMatterList && (
          <MatterList
            selectedId={selectedMatter?.id ?? null}
            onSelect={selectMatter}
            onNew={openNew}
            refresh={refreshList}
          />
        )}

        <main className="flex-1 overflow-hidden bg-white">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full text-neutral-400 text-sm select-none">
      {text}
    </div>
  );
}
