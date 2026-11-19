import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import {
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Lock,
  Save,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  Upload,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { APP_CREATOR_CREDIT, type AppSettings, type UserProfile } from '../types';
import { normalizeDirectApkUrl, sanitizeStr } from '../utils/dateAndExport';

interface AdminPanelViewProps {
  currentUser: UserProfile;
  appSettings: AppSettings | null;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  currentUser,
  appSettings,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Settings Form State
  const [appName, setAppName] = useState(
    appSettings?.appName || 'राजस्व न्यायालय केस डायरी'
  );
  const [announcement, setAnnouncement] = useState(appSettings?.announcement || '');
  const [maintenanceMode, setMaintenanceMode] = useState(
    appSettings?.maintenanceMode || false
  );
  const [allowNewRegistrations, setAllowNewRegistrations] = useState(
    appSettings?.allowNewRegistrations ?? true
  );
  const [defaultReminderDays, setDefaultReminderDays] = useState(
    appSettings?.defaultReminderDays ?? 3
  );
  const [apkDownloadUrl, setApkDownloadUrl] = useState(
    appSettings?.apkDownloadUrl || ''
  );
  const [apkVersion, setApkVersion] = useState(
    appSettings?.apkVersion || 'v1.0.0'
  );
  const [apkUploadProgress, setApkUploadProgress] = useState<number | null>(null);
  const [apkError, setApkError] = useState('');
  const [copiedApkLink, setCopiedApkLink] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (appSettings) {
      setAppName(appSettings.appName);
      setAnnouncement(appSettings.announcement);
      setMaintenanceMode(appSettings.maintenanceMode);
      setAllowNewRegistrations(appSettings.allowNewRegistrations);
      setDefaultReminderDays(appSettings.defaultReminderDays);
      setApkDownloadUrl(appSettings.apkDownloadUrl || '');
      setApkVersion(appSettings.apkVersion || 'v1.0.0');
    }
  }, [appSettings]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserProfile[] = snap.docs.map((d) => ({
          uid: d.id,
          ...(d.data() as Omit<UserProfile, 'uid'>),
        }));
        setUsers(list);
        setLoadingUsers(false);
      },
      (err) => {
        setLoadingUsers(false);
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    );
    return () => unsub();
  }, []);

  const totalUsers = users.length;
  const blockedUsers = users.filter((u) => u.isBlocked).length;
  const activeUsers = totalUsers - blockedUsers;
  const totalDeclaredCases = users.reduce((sum, u) => sum + (u.caseCount || 0), 0);

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [u.name, u.mobileNumber, u.email, u.district, u.tehsil, u.designation]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const handleToggleBlock = async (u: UserProfile) => {
    if (u.uid === currentUser.uid) return;
    setActionMsg('');
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        isBlocked: !u.isBlocked,
        updatedAt: serverTimestamp(),
      });
      setActionMsg(
        !u.isBlocked
          ? `खाता "${u.name}" को सफलतापूर्वक ब्लॉक कर दिया गया है।`
          : `खाता "${u.name}" को पुनः सक्रिय कर दिया गया है।`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    }
  };

  const handleToggleAdminRole = async (u: UserProfile) => {
    if (u.uid === currentUser.uid) return;
    setActionMsg('');
    const nextRole = u.role === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
      if (nextRole === 'admin') {
        await setDoc(doc(db, 'admins', u.uid), {
          uid: u.uid,
          email: sanitizeStr(u.email || u.mobileNumber || 'admin@local', 160),
          addedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, 'admins', u.uid));
      }
      setActionMsg(
        nextRole === 'admin'
          ? `"${u.name}" को व्यवस्थापक अधिकार प्रदान किए गए।`
          : `"${u.name}" से व्यवस्थापक अधिकार हटा दिए गए।`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${u.uid}`);
    }
  };

  const handleApkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setApkError('');
    setActionMsg('');

    if (!file.name.toLowerCase().endsWith('.apk')) {
      setApkError('कृपया केवल वैध Android .APK फ़ाइल चुनें।');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setApkError('APK फ़ाइल का आकार 100 MB से कम होना चाहिए।');
      return;
    }

    const safeFileName = `Rajaswa_Case_Diary_${Date.now()}.apk`;
    const fileRef = storageRef(storage, `public/releases/${safeFileName}`);
    setApkUploadProgress(5);

    const task = uploadBytesResumable(fileRef, file, {
      contentType: 'application/vnd.android.package-archive',
      contentDisposition: 'attachment; filename="Rajaswa_Nyayalaya_Case_Diary.apk"',
    });

    task.on(
      'state_changed',
      (snap) => {
        setApkUploadProgress(
          Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        );
      },
      (err) => {
        setApkUploadProgress(null);
        setApkError(
          `Firebase Storage APK अपलोड विफल रहा (${err.code || 'storage-error'}): कृपया सुनिश्चित करें कि Firebase Console में Storage सक्षम है और storage.rules डिप्लॉय हैं। विकल्प के रूप में आप अपनी .APK फ़ाइल Google Drive या GitHub Releases पर अपलोड करके उसका लिंक नीचे पेस्ट कर सकते हैं।`
        );
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          setApkDownloadUrl(url);
          setApkUploadProgress(null);
          setActionMsg(
            'APK फ़ाइल सफलतापूर्वक अपलोड हो गई! अब नीचे "सेटिंग्स सहेजें" दबाएँ ताकि सभी उपयोगकर्ताओं को Direct Download APK बटन दिखने लगे।'
          );
        } catch (err) {
          setApkUploadProgress(null);
          setApkError(
            err instanceof Error ? err.message : 'डाउनलोड लिंक प्राप्त करने में त्रुटि।'
          );
        }
      }
    );
  };

  const handleCopyApkLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedApkLink(true);
      setTimeout(() => setCopiedApkLink(false), 2000);
    } catch {
      // clipboard restricted in iframe
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setApkError('');
    setActionMsg('');

    const rawApkUrl = apkDownloadUrl.trim();
    const normalizedApkUrl = rawApkUrl ? normalizeDirectApkUrl(rawApkUrl) : '';
    if (rawApkUrl && !normalizedApkUrl) {
      setApkError(
        'कृपया केवल वैध https:// डायरेक्ट .APK डाउनलोड लिंक दर्ज करें (Google Drive / GitHub Releases / Firebase Storage)।'
      );
      return;
    }

    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'app'), {
        appName: sanitizeStr(appName || 'राजस्व न्यायालय केस डायरी', 120),
        maintenanceMode,
        announcement: sanitizeStr(announcement, 500),
        allowNewRegistrations,
        defaultReminderDays: Math.min(30, Math.max(0, Number(defaultReminderDays) || 3)),
        apkDownloadUrl: sanitizeStr(normalizedApkUrl, 2000),
        apkVersion: sanitizeStr(apkVersion || 'v1.0.0', 40),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
      setApkDownloadUrl(normalizedApkUrl);
      setActionMsg(
        normalizedApkUrl
          ? 'एप्लिकेशन सेटिंग्स एवं Direct APK डाउनलोड लिंक सफलतापूर्वक लाइव हो गया!'
          : 'एप्लिकेशन सेटिंग्स सफलतापूर्वक सहेजी गईं।'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/app');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0B1D3A] text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#C9A227]/20 border border-[#C9A227]/50 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-[#E5C665]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">व्यवस्थापक पैनल (Admin Panel)</h2>
            <p className="text-xs text-slate-300 mt-0.5">
              उपयोगकर्ता प्रबंधन, धोखाधड़ी खाते ब्लॉक करना, समग्र आंकड़े एवं एप्लिकेशन सेटिंग्स
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#E5C665] bg-white/5 px-3.5 py-2 rounded-xl border border-white/10">
          <Lock className="w-4 h-4 shrink-0" />
          <span>निजी केस दस्तावेज़ गोपनीय (एडमिन पहुँच प्रतिबंधित)</span>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Aggregate App Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'पंजीकृत उपयोगकर्ता', value: totalUsers, color: 'text-[#0B1D3A]' },
          { label: 'सक्रिय खाते', value: activeUsers, color: 'text-emerald-700' },
          { label: 'ब्लॉक किए गए खाते', value: blockedUsers, color: 'text-red-700' },
          { label: 'कुल दर्ज वाद (संकेतक)', value: totalDeclaredCases, color: 'text-[#9A7410]' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-slate-200 p-4"
          >
            <p className={`text-2xl sm:text-3xl font-bold font-mono-num ${stat.color}`}>
              {stat.value}
            </p>
            <p className="text-xs text-slate-600 font-medium mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Registered Users Management */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#A17C14]" />
            <h3 className="text-base font-bold text-[#0B1D3A]">
              पंजीकृत उपयोगकर्ता सूची ({filteredUsers.length})
            </h3>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="नाम, मोबाइल या जिला खोजें..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 text-xs sm:text-sm"
            />
          </div>
        </div>

        {loadingUsers ? (
          <p className="text-xs text-slate-500 py-8 text-center">उपयोगकर्ता सूची लोड हो रही है...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">कोई उपयोगकर्ता नहीं मिला।</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-[#0B1D3A]">
                  <th className="py-3 px-3">नाम एवं पदनाम</th>
                  <th className="py-3 px-3">मोबाइल / ईमेल</th>
                  <th className="py-3 px-3">जिला / तहसील</th>
                  <th className="py-3 px-3">वाद संख्या</th>
                  <th className="py-3 px-3">स्थिति</th>
                  <th className="py-3 px-3 text-right">प्रबंधन</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredUsers.map((u) => {
                  const isSelf = u.uid === currentUser.uid;
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-[#0B1D3A]">{u.name}</p>
                        <p className="text-xs text-slate-500">
                          {u.designation || 'उपयोगकर्ता'} · {u.role === 'admin' ? 'व्यवस्थापक' : 'सदस्य'}
                        </p>
                      </td>
                      <td className="py-3 px-3 font-mono-num text-xs text-slate-700">
                        <p>{u.mobileNumber || '—'}</p>
                        {u.email && <p className="text-slate-400">{u.email}</p>}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">
                        {u.district || '—'}
                        {u.tehsil ? `, ${u.tehsil}` : ''}
                      </td>
                      <td className="py-3 px-3 font-mono-num font-semibold text-[#0B1D3A]">
                        {u.caseCount || 0}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-xs font-bold ${
                            u.isBlocked ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          {u.isBlocked ? 'ब्लॉक' : 'सक्रिय'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {isSelf ? (
                          <span className="text-xs text-slate-400">स्वयं (एडमिन)</span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleBlock(u)}
                              className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                u.isBlocked
                                  ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'bg-red-50 text-red-700 hover:bg-red-100'
                              }`}
                            >
                              <Ban className="w-3.5 h-3.5" />
                              {u.isBlocked ? 'अनब्लॉक' : 'ब्लॉक करें'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleAdminRole(u)}
                              className="min-h-[34px] px-2.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {u.role === 'admin' ? 'एडमिन हटाएँ' : 'एडमिन बनाएँ'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Global Application Settings */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Settings className="w-5 h-5 text-[#A17C14]" />
          <h3 className="text-base font-bold text-[#0B1D3A]">एप्लिकेशन सेटिंग्स</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              एप्लिकेशन का नाम
            </label>
            <input
              type="text"
              maxLength={120}
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              स्वचालित रिमाइंडर दिवस (पेशी से कितने दिन पूर्व)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={defaultReminderDays}
              onChange={(e) => setDefaultReminderDays(Number(e.target.value))}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            सार्वजनिक सूचना / घोषणा बैनर (सभी उपयोगकर्ताओं के डैशबोर्ड पर दिखेगा)
          </label>
          <textarea
            rows={2}
            maxLength={500}
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="उदा. आगामी शनिवार को राजस्व लोक अदालत का आयोजन किया जाएगा..."
            className="w-full p-3.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        {/* Direct Android APK Distribution Settings */}
        <div className="pt-4 border-t border-slate-100 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#A17C14]" />
              <h4 className="text-sm font-bold text-[#0B1D3A]">
                Android .APK डायरेक्ट डाउनलोड लिंक (Direct Download APK)
              </h4>
            </div>
            <label className="min-h-[36px] px-3 rounded-lg bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132C54] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5 text-[#E5C665]" />
              {apkUploadProgress !== null
                ? `अपलोड हो रहा है (${apkUploadProgress}%)`
                : 'सीधे .APK अपलोड करें'}
              <input
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                className="hidden"
                onChange={handleApkFileUpload}
                disabled={apkUploadProgress !== null}
              />
            </label>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            यहाँ अपनी Android <strong>.APK</strong> फ़ाइल अपलोड करें या GitHub Releases / Google Drive / Firebase Storage का <strong>https://</strong> लिंक पेस्ट करें (Google Drive शेयर लिंक स्वतः Direct Download लिंक में बदल जाएगा)। सहेजते ही सभी उपयोगकर्ताओं को ऐप के शीर्ष बार और प्रोफाइल में 1-क्लिक <strong>डायरेक्ट APK डाउनलोड</strong> बटन दिखने लगेगा।
          </p>

          {apkError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
              {apkError}
            </div>
          )}

          {apkUploadProgress !== null && (
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A227] transition-all"
                style={{ width: `${apkUploadProgress}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Direct APK डाउनलोड लिंक (HTTPS)
              </label>
              <input
                type="url"
                maxLength={2000}
                value={apkDownloadUrl}
                onChange={(e) => setApkDownloadUrl(e.target.value)}
                placeholder="https://github.com/.../app-release.apk या Google Drive शेयर लिंक"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ऐप वर्ज़न
              </label>
              <input
                type="text"
                maxLength={40}
                value={apkVersion}
                onChange={(e) => setApkVersion(e.target.value)}
                placeholder="v1.0.0"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num"
              />
            </div>
          </div>

          {appSettings?.apkDownloadUrl && (
            <div className="p-4 rounded-xl bg-[#FBF5E2] border border-[#E5C665]/70 space-y-2.5">
              <p className="text-xs font-bold text-[#0B1D3A]">
                सक्रिय Direct APK डाउनलोड लिंक ({appSettings.apkVersion || 'v1.0.0'}):
              </p>
              <p className="text-[11px] font-mono-num text-slate-700 break-all bg-white/80 rounded-lg px-3 py-2 border border-[#E5C665]/40">
                {appSettings.apkDownloadUrl}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={appSettings.apkDownloadUrl}
                  download="Rajaswa_Nyayalaya_Case_Diary.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-3.5 rounded-lg bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132C54] inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[#E5C665]" />
                  सीधे .APK डाउनलोड करें
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyApkLink(appSettings.apkDownloadUrl || '')}
                  className="min-h-[38px] px-3.5 rounded-lg bg-white border border-slate-300 text-[#0B1D3A] text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {copiedApkLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedApkLink ? 'लिंक कॉपी हुआ' : 'लिंक कॉपी करें'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `राजस्व न्यायालय केस डायरी (उत्तर प्रदेश) — निर्माता: ${APP_CREATOR_CREDIT}\nAndroid ऐप (.APK) सीधे डाउनलोड करें:\n${appSettings.apkDownloadUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-3.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  WhatsApp पर भेजें
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-6 pt-2">
          <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer min-h-[40px]">
            <input
              type="checkbox"
              checked={allowNewRegistrations}
              onChange={(e) => setAllowNewRegistrations(e.target.checked)}
              className="w-4 h-4 rounded accent-[#0B1D3A]"
            />
            नए उपयोगकर्ता पंजीकरण की अनुमति दें
          </label>
          <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer min-h-[40px]">
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              className="w-4 h-4 rounded accent-[#0B1D3A]"
            />
            रखरखाव मोड (Maintenance Mode) सक्रिय करें
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingSettings}
            className="min-h-[44px] px-6 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4 text-[#E5C665]" />
            {savingSettings ? 'सहेज रहे हैं...' : 'सेटिंग्स सहेजें'}
          </button>
        </div>
      </form>
    </div>
  );
};
