/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Ban,
  Bell,
  BookOpen,
  CalendarDays,
  FileBarChart2,
  Home,
  LogOut,
  PlusCircle,
  Shield,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  ActiveTab,
  APP_CREATOR_CREDIT,
  AppSettings,
  BOOTSTRAPPED_ADMIN_EMAIL,
  CaseContact,
  CasePresetFilter,
  CustomReminder,
  DEFAULT_COURTS,
  LEGAL_EMBLEM_URL,
  RevenueCase,
  UserCourt,
  UserProfile,
} from './types';
import { generateAutoNotifications } from './utils/dateAndExport';
import { AdminPanelView } from './components/AdminPanelView';
import { AppDownloadView } from './components/AppDownloadView';
import { AuthScreen } from './components/AuthScreen';
import { CalendarRemindersView } from './components/CalendarRemindersView';
import { CaseDetailView } from './components/CaseDetailView';
import { CaseFormView } from './components/CaseFormView';
import { CaseListView } from './components/CaseListView';
import { ConfirmModal } from './components/ConfirmModal';
import { ContactsView } from './components/ContactsView';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProfileView } from './components/ProfileView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ReportsView } from './components/ReportsView';

function MainApp() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  const [cases, setCases] = useState<RevenueCase[]>([]);
  const [customCourts, setCustomCourts] = useState<UserCourt[]>([]);
  const [reminders, setReminders] = useState<CustomReminder[]>([]);
  const [contacts, setContacts] = useState<CaseContact[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Navigation & Selection State
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [caseDiarySubView, setCaseDiarySubView] = useState<'register' | 'contacts'>('register');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [editingCase, setEditingCase] = useState<RevenueCase | null>(null);
  const [presetFilter, setPresetFilter] = useState<CasePresetFilter>('all');
  const [courtFilter, setCourtFilter] = useState('');
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [showDownloadPage, setShowDownloadPage] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.hash === '#download' ||
      new URLSearchParams(window.location.search).get('download') !== null
    );
  });

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === '#download') {
        setShowDownloadPage(true);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Case Delete Confirmation State
  const [caseToDelete, setCaseToDelete] = useState<RevenueCase | null>(null);
  const [deletingCase, setDeletingCase] = useState(false);

  // 1. Auth State Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setNeedsProfileSetup(false);
        setCases([]);
        setCustomCourts([]);
        setReminders([]);
        setContacts([]);
        setSelectedCaseId(null);
        setEditingCase(null);
      }
    });
    return () => unsub();
  }, []);

  // 2. Load & Subscribe to User Profile
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    setProfileLoading(true);
    const ref = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile({
            uid: snap.id,
            ...(snap.data() as Omit<UserProfile, 'uid'>),
          });
          setNeedsProfileSetup(false);
        } else {
          setProfile(null);
          setNeedsProfileSetup(true);
        }
        setProfileLoading(false);
      },
      (err) => {
        setProfileLoading(false);
        handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
      }
    );
    return () => unsub();
  }, [authReady, firebaseUser]);

  // 3. Subscribe to Private User Collections & Global Settings once Profile is active
  useEffect(() => {
    if (!authReady || !firebaseUser || !profile || profile.isBlocked) return;
    const uid = firebaseUser.uid;

    const unsubCases = onSnapshot(
      query(collection(db, 'cases'), where('ownerId', '==', uid)),
      (snap) => {
        setCases(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<RevenueCase, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'cases')
    );

    const unsubCourts = onSnapshot(
      query(collection(db, 'courts'), where('ownerId', '==', uid)),
      (snap) => {
        setCustomCourts(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<UserCourt, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'courts')
    );

    const unsubReminders = onSnapshot(
      query(collection(db, 'reminders'), where('ownerId', '==', uid)),
      (snap) => {
        setReminders(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CustomReminder, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reminders')
    );

    const unsubContacts = onSnapshot(
      query(collection(db, 'contacts'), where('ownerId', '==', uid)),
      (snap) => {
        setContacts(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<CaseContact, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'contacts')
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'app'),
      (snap) => {
        if (snap.exists()) {
          setAppSettings(snap.data() as AppSettings);
        } else {
          setAppSettings(null);
        }
      },
      () => {
        // Non-critical if settings doc hasn't been initialized by admin yet
      }
    );

    return () => {
      unsubCases();
      unsubCourts();
      unsubReminders();
      unsubContacts();
      unsubSettings();
    };
  }, [authReady, firebaseUser, profile?.uid, profile?.isBlocked]);

  const isAdmin = Boolean(
    profile &&
      (profile.role === 'admin' ||
        (firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL &&
          firebaseUser?.emailVerified))
  );

  const allCourtNames = useMemo(() => {
    const set = new Set<string>(DEFAULT_COURTS);
    customCourts.forEach((c) => set.add(c.name));
    cases.forEach((c) => {
      if (c.courtName) set.add(c.courtName);
    });
    return Array.from(set);
  }, [customCourts, cases]);

  const notifications = useMemo(
    () =>
      generateAutoNotifications(
        cases,
        reminders,
        appSettings?.defaultReminderDays ?? 3
      ),
    [cases, reminders, appSettings?.defaultReminderDays]
  );

  const selectedCase = useMemo(
    () => (selectedCaseId ? cases.find((c) => c.id === selectedCaseId) || null : null),
    [cases, selectedCaseId]
  );

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleConfirmDeleteCase = async () => {
    if (!caseToDelete || !firebaseUser) return;
    setDeletingCase(true);
    try {
      // Delete subcollections first (dailyEntries & documents)
      const [entriesSnap, docsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'cases', caseToDelete.id, 'dailyEntries'),
            where('ownerId', '==', firebaseUser.uid),
            where('caseId', '==', caseToDelete.id)
          )
        ),
        getDocs(
          query(
            collection(db, 'cases', caseToDelete.id, 'documents'),
            where('ownerId', '==', firebaseUser.uid),
            where('caseId', '==', caseToDelete.id)
          )
        ),
      ]);

      const batch = writeBatch(db);
      entriesSnap.docs.forEach((d) => batch.delete(d.ref));
      docsSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, 'cases', caseToDelete.id));
      await batch.commit();

      // Keep user's caseCount synchronized
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          caseCount: Math.max(0, cases.length - 1),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // non-blocking
      }

      if (selectedCaseId === caseToDelete.id) {
        setSelectedCaseId(null);
      }
      setCaseToDelete(null);
    } catch (err) {
      // Fallback single doc delete if subcollection batch fails
      try {
        await deleteDoc(doc(db, 'cases', caseToDelete.id));
        if (selectedCaseId === caseToDelete.id) setSelectedCaseId(null);
        setCaseToDelete(null);
      } catch (innerErr) {
        handleFirestoreError(innerErr, OperationType.DELETE, `cases/${caseToDelete.id}`);
      }
      console.error(err);
    } finally {
      setDeletingCase(false);
    }
  };

  const openDownloadPage = () => {
    setShowDownloadPage(true);
    try {
      window.history.replaceState({}, '', `${window.location.pathname}#download`);
    } catch {
      // ignore in sandboxed iframe
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeDownloadPage = () => {
    setShowDownloadPage(false);
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      // ignore in sandboxed iframe
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dedicated Direct App Download Page (?download=app) — accessible even before login
  if (showDownloadPage) {
    return (
      <AppDownloadView
        appSettings={appSettings}
        isAdmin={isAdmin}
        currentUserUid={firebaseUser?.uid}
        isLoggedIn={Boolean(firebaseUser && profile && !needsProfileSetup)}
        onBack={closeDownloadPage}
      />
    );
  }

  // Loading Splash
  if (!authReady || (firebaseUser && profileLoading && !profile && !needsProfileSetup)) {
    return (
      <div className="min-h-screen bg-[#0B1D3A] flex flex-col items-center justify-center p-6 text-white">
        <img
          src={LEGAL_EMBLEM_URL}
          alt="राजस्व न्यायालय केस डायरी"
          referrerPolicy="no-referrer"
          className="w-16 h-16 rounded-2xl border border-[#C9A227]/50 mb-4 object-cover"
        />
        <h1 className="text-xl font-bold text-white">राजस्व न्यायालय केस डायरी</h1>
        <p className="text-xs font-semibold tracking-wider text-[#E5C665] mt-1.5">
          निर्माता: {APP_CREATOR_CREDIT}
        </p>
        <p className="text-xs text-slate-300 mt-2">सुरक्षित डेटाबेस से जुड़ रहे हैं...</p>
      </div>
    );
  }

  // Unauthenticated or New User Profile Setup
  if (!firebaseUser || needsProfileSetup || !profile) {
    return (
      <AuthScreen
        firebaseUser={firebaseUser}
        needsProfileSetup={needsProfileSetup}
        onOpenDownloadPage={openDownloadPage}
        onProfileCreated={(created) => {
          setProfile(created);
          setNeedsProfileSetup(false);
        }}
      />
    );
  }

  // Blocked User Lockout Screen
  if (profile.isBlocked) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-7 text-center shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 flex items-center justify-center mx-auto mb-4">
            <Ban className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#0B1D3A] mb-2">
            आपका खाता अस्थायी रूप से ब्लॉक है
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            सुरक्षा या व्यवस्थापकीय कारणों से इस खाते की पहुँच रोक दी गई है। कृपया व्यवस्थापक से संपर्क करें।
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[44px] px-5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            लॉगआउट करें
          </button>
        </div>
      </div>
    );
  }

  // Maintenance Mode Gate (non-admins)
  if (appSettings?.maintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#0B1D3A] flex items-center justify-center p-6 text-white">
        <div className="max-w-md w-full bg-white/5 border border-white/15 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-[#E5C665] mb-2">रखरखाव कार्य जारी है</h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            राजस्व न्यायालय केस डायरी में तकनीकी अद्यतन किया जा रहा है। कृपया कुछ समय बाद पुनः प्रयास करें।
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-[44px] px-5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold cursor-pointer"
          >
            लॉगआउट करें
          </button>
        </div>
      </div>
    );
  }

  const navigateTab = (tab: ActiveTab) => {
    setSelectedCaseId(null);
    if (tab !== 'new-case') setEditingCase(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCaseDetail = (c: RevenueCase) => {
    setSelectedCaseId(c.id);
    setEditingCase(null);
    setActiveTab('cases');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCaseEdit = (c: RevenueCase) => {
    setEditingCase(c);
    setSelectedCaseId(null);
    setActiveTab('new-case');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openNewCaseForm = () => {
    setEditingCase(null);
    setSelectedCaseId(null);
    setActiveTab('new-case');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const displayAppName = appSettings?.appName || 'राजस्व न्यायालय केस डायरी';

  const desktopNavItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'होम डैशबोर्ड', icon: <Home className="w-4 h-4" /> },
    { id: 'cases', label: 'केस डायरी', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'new-case', label: 'नया मुकदमा', icon: <PlusCircle className="w-4 h-4" /> },
    { id: 'calendar', label: 'तारीख एवं रिमाइंडर', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'reports', label: 'रिपोर्ट एवं निर्यात', icon: <FileBarChart2 className="w-4 h-4" /> },
    { id: 'profile', label: 'प्रोफाइल व न्यायालय', icon: <UserIcon className="w-4 h-4" /> },
  ];

  if (isAdmin) {
    desktopNavItems.push({
      id: 'admin',
      label: 'व्यवस्थापक पैनल',
      icon: <Shield className="w-4 h-4" />,
    });
  }

  // Exact 5 requested Mobile Bottom Navigation Tabs
  const mobileBottomTabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'होम', icon: <Home className="w-5 h-5" /> },
    { id: 'cases', label: 'केस डायरी', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'new-case', label: 'नया मुकदमा', icon: <PlusCircle className="w-5 h-5" /> },
    { id: 'calendar', label: 'तारीख', icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'profile', label: 'प्रोफाइल', icon: <UserIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex">
      {/* Desktop Left Sidebar (260px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0B1D3A] text-white border-r border-white/10 z-30 no-print">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <img
            src={LEGAL_EMBLEM_URL}
            alt="प्रतीक"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl border border-[#C9A227]/50 object-cover shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white leading-tight truncate">
              {displayAppName}
            </h1>
            <p className="text-[11px] text-[#E5C665] truncate">उत्तर प्रदेश</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {desktopNavItems.map((item) => {
            const active =
              activeTab === item.id && !(item.id === 'new-case' && editingCase);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  item.id === 'new-case' ? openNewCaseForm() : navigateTab(item.id)
                }
                className={`w-full min-h-[44px] px-3.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#C9A227] text-[#071326] font-bold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <button
            type="button"
            onClick={() => navigateTab('profile')}
            className="w-full flex items-center gap-2.5 text-left hover:bg-white/5 p-2 rounded-xl transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-[#E5C665]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{profile.name}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {profile.district || 'उत्तर प्रदेश'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full min-h-[40px] px-3 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-100 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            लॉगआउट
          </button>

          <div className="pt-2 border-t border-white/10 text-center">
            <p className="text-[10px] text-slate-400">निर्माता एवं प्रस्तुति</p>
            <p className="text-[11px] font-bold tracking-wider text-[#E5C665] truncate mt-0.5">
              {APP_CREATOR_CREDIT}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top App Bar (Compact 56px on Mobile, Clean Workspace Bar on Desktop) */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={LEGAL_EMBLEM_URL}
              alt="प्रतीक"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-[#C9A227]/40 lg:hidden shrink-0"
            />
            <div className="min-w-0">
              <span className="block text-sm sm:text-base font-bold text-[#0B1D3A] truncate font-legal-serif leading-tight">
                {displayAppName}
              </span>
              <span className="block text-[10px] sm:text-[11px] font-semibold tracking-wide text-[#9A7410] truncate leading-tight">
                {APP_CREATOR_CREDIT}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton
              variant="header"
              appSettings={appSettings}
              isAdmin={isAdmin}
              onOpenAdmin={() => navigateTab('admin')}
              onOpenDownloadPage={openDownloadPage}
            />
            <button
              type="button"
              onClick={() => navigateTab('reports')}
              className="hidden sm:inline-flex min-h-[38px] px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileBarChart2 className="w-3.5 h-3.5 text-[#A17C14]" />
              रिपोर्ट्स
            </button>

            <button
              type="button"
              onClick={() => setShowNotifDrawer(true)}
              className="relative min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-[#0B1D3A] cursor-pointer"
              aria-label="सूचनाएँ देखें"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono-num font-bold flex items-center justify-center">
                  {notifications.length > 9 ? '9+' : notifications.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 lg:pb-10">
          {selectedCase ? (
            <CaseDetailView
              ownerId={firebaseUser.uid}
              profile={profile}
              caseItem={selectedCase}
              contacts={contacts}
              onBack={() => setSelectedCaseId(null)}
              onEditCase={openCaseEdit}
              onDeleteCase={(c) => setCaseToDelete(c)}
            />
          ) : activeTab === 'home' ? (
            <DashboardView
              profile={profile}
              cases={cases}
              notifications={notifications}
              appSettings={appSettings}
              onOpenPreset={(preset) => {
                setPresetFilter(preset);
                setCourtFilter('');
                setCaseDiarySubView('register');
                navigateTab('cases');
              }}
              onOpenCourtFilter={(courtName) => {
                setPresetFilter('all');
                setCourtFilter(courtName);
                setCaseDiarySubView('register');
                navigateTab('cases');
              }}
              onSelectCase={openCaseDetail}
              onAddNewCase={openNewCaseForm}
              onOpenReports={() => navigateTab('reports')}
              onOpenCalendar={() => navigateTab('calendar')}
            />
          ) : activeTab === 'cases' ? (
            <div className="space-y-5">
              {/* Case Diary Area Sub-Navigation: Case Register vs Contacts Directory */}
              <div
                role="tablist"
                aria-label="केस डायरी अनुभाग"
                className="inline-flex w-full sm:w-auto items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={caseDiarySubView === 'register'}
                  onClick={() => setCaseDiarySubView('register')}
                  className={`flex-1 sm:flex-initial min-h-[42px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    caseDiarySubView === 'register'
                      ? 'bg-[#0B1D3A] text-white'
                      : 'text-slate-600 hover:text-[#0B1D3A]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>मुकदमा रजिस्टर</span>
                  <span className="font-mono-num text-[11px] opacity-80">
                    ({cases.length})
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={caseDiarySubView === 'contacts'}
                  onClick={() => setCaseDiarySubView('contacts')}
                  className={`flex-1 sm:flex-initial min-h-[42px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    caseDiarySubView === 'contacts'
                      ? 'bg-[#0B1D3A] text-white'
                      : 'text-slate-600 hover:text-[#0B1D3A]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>संपर्क निर्देशिका</span>
                  <span className="font-mono-num text-[11px] opacity-80">
                    ({contacts.length})
                  </span>
                </button>
              </div>

              {caseDiarySubView === 'register' ? (
                <CaseListView
                  cases={cases}
                  allCourtNames={allCourtNames}
                  presetFilter={presetFilter}
                  initialCourtFilter={courtFilter}
                  onChangePreset={setPresetFilter}
                  onClearCourtFilter={() => setCourtFilter('')}
                  onSelectCase={openCaseDetail}
                  onEditCase={openCaseEdit}
                  onDeleteCase={(c) => setCaseToDelete(c)}
                  onAddNewCase={openNewCaseForm}
                />
              ) : (
                <ContactsView
                  ownerId={firebaseUser.uid}
                  contacts={contacts}
                  cases={cases}
                  onSelectCase={openCaseDetail}
                />
              )}
            </div>
          ) : activeTab === 'new-case' ? (
            <CaseFormView
              ownerId={firebaseUser.uid}
              profile={profile}
              allCourtNames={allCourtNames}
              editingCase={editingCase}
              totalExistingCases={cases.length}
              onSaved={(savedId) => {
                setEditingCase(null);
                if (savedId) {
                  setSelectedCaseId(savedId);
                  setActiveTab('cases');
                } else {
                  navigateTab('cases');
                }
              }}
              onCancel={() => {
                setEditingCase(null);
                navigateTab('cases');
              }}
            />
          ) : activeTab === 'calendar' ? (
            <CalendarRemindersView
              ownerId={firebaseUser.uid}
              cases={cases}
              reminders={reminders}
              notifications={notifications}
              onSelectCase={openCaseDetail}
            />
          ) : activeTab === 'reports' ? (
            <ReportsView
              cases={cases}
              allCourtNames={allCourtNames}
              profile={profile}
              onSelectCase={openCaseDetail}
            />
          ) : activeTab === 'admin' && isAdmin ? (
            <AdminPanelView currentUser={profile} appSettings={appSettings} />
          ) : (
            <ProfileView
              profile={profile}
              isAdmin={isAdmin}
              appSettings={appSettings}
              customCourts={customCourts}
              onSignOut={handleSignOut}
              onOpenReports={() => navigateTab('reports')}
              onOpenAdmin={() => navigateTab('admin')}
              onOpenDownloadPage={openDownloadPage}
            />
          )}

          <footer className="mt-10 pt-4 border-t border-slate-200/80 text-center no-print">
            <p className="text-xs text-slate-500">
              राजस्व न्यायालय केस डायरी (उत्तर प्रदेश) · निर्माता:{' '}
              <span className="font-bold text-[#0B1D3A] tracking-wide">
                {APP_CREATOR_CREDIT}
              </span>
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (5 Hindi Menus) */}
      <nav
        aria-label="मुख्य नेविगेशन"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print"
      >
        <div className="grid grid-cols-5 h-16">
          {mobileBottomTabs.map((tab) => {
            const isActive =
              activeTab === tab.id ||
              (tab.id === 'profile' && (activeTab === 'reports' || activeTab === 'admin'));
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  tab.id === 'new-case' ? openNewCaseForm() : navigateTab(tab.id)
                }
                className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isActive ? 'text-[#0B1D3A]' : 'text-slate-500'
                }`}
              >
                <span
                  className={`p-1 rounded-lg ${
                    isActive ? 'bg-[#0B1D3A] text-[#E5C665]' : ''
                  }`}
                >
                  {tab.icon}
                </span>
                <span className={`text-[10px] leading-none whitespace-nowrap ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* In-App Notifications Drawer */}
      {showNotifDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-xs"
          onClick={() => setShowNotifDrawer(false)}
        >
          <div
            className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-[#0B1D3A] text-white">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#E5C665]" />
                <h3 className="text-base font-bold">पेशी रिमाइंडर एवं सूचनाएँ</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNotifDrawer(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
                aria-label="बंद करें"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  अभी कोई नई पेशी सूचना या रिमाइंडर नहीं है।
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setShowNotifDrawer(false);
                      const found = n.caseId
                        ? cases.find((c) => c.id === n.caseId)
                        : undefined;
                      if (found) openCaseDetail(found);
                      else navigateTab('calendar');
                    }}
                    className="w-full py-3.5 text-left hover:bg-slate-50 px-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <p
                      className={`text-sm font-bold ${
                        n.urgency === 'high'
                          ? 'text-red-700'
                          : n.urgency === 'medium'
                            ? 'text-amber-800'
                            : 'text-[#0B1D3A]'
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{n.subtitle}</p>
                  </button>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setShowNotifDrawer(false);
                  navigateTab('calendar');
                }}
                className="w-full min-h-[44px] rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] cursor-pointer"
              >
                कैलेंडर और कस्टम रिमाइंडर खोलें
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Delete Case Confirmation Modal */}
      <ConfirmModal
        open={Boolean(caseToDelete)}
        title="मुकदमा स्थायी रूप से हटाएं?"
        message={`क्या आप वाकई वाद संख्या "${caseToDelete?.caseNumber || ''}" (${caseToDelete?.plaintiffName || ''}) को उसकी सभी दैनिक प्रविष्टियों और संलग्न दस्तावेज़ रिकॉर्ड के साथ स्थायी रूप से हटाना चाहते हैं?`}
        loading={deletingCase}
        onConfirm={handleConfirmDeleteCase}
        onCancel={() => setCaseToDelete(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
      <OfflineIndicator />
    </ErrorBoundary>
  );
}
