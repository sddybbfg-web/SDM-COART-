import React, { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Share2,
  ShieldCheck,
  Smartphone,
  Upload,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  APP_CREATOR_CREDIT,
  type AppSettings,
  LEGAL_EMBLEM_URL,
} from '../types';
import { normalizeDirectApkUrl, sanitizeStr } from '../utils/dateAndExport';

interface AppDownloadViewProps {
  appSettings: AppSettings | null;
  isAdmin: boolean;
  currentUserUid?: string;
  isLoggedIn: boolean;
  onBack: () => void;
}

export const AppDownloadView: React.FC<AppDownloadViewProps> = ({
  appSettings,
  isAdmin,
  currentUserUid,
  isLoggedIn,
  onBack,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [installDone, setInstallDone] = useState(false);

  // Admin quick APK link / upload state
  const [apkUrlInput, setApkUrlInput] = useState(appSettings?.apkDownloadUrl || '');
  const [apkVersionInput, setApkVersionInput] = useState(
    appSettings?.apkVersion || 'v1.0.0'
  );
  const [uploadingApk, setUploadingApk] = useState<number | null>(null);
  const [savingApk, setSavingApk] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');
  const [adminErr, setAdminErr] = useState('');

  const directApkUrl =
    appSettings?.apkDownloadUrl && appSettings.apkDownloadUrl.startsWith('https://')
      ? appSettings.apkDownloadUrl
      : '';
  const apkVersion = appSettings?.apkVersion || 'v1.0.0';

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const isDevPreview = currentOrigin.includes('ais-dev-');
  const isInIframe =
    typeof window !== 'undefined' && window.self !== window.top;

  const directPageLink = currentOrigin ? `${currentOrigin}/#download` : '#download';
  const primaryShareLink = directApkUrl || directPageLink;
  const standaloneAppUrl = currentOrigin || '/';

  const whatsappText = directApkUrl
    ? `राजस्व न्यायालय केस डायरी (उत्तर प्रदेश)\nनिर्माता: ${APP_CREATOR_CREDIT}\n\nAndroid .APK सीधे डाउनलोड करें (${apkVersion}):\n${directApkUrl}`
    : `राजस्व न्यायालय केस डायरी (उत्तर प्रदेश)\nनिर्माता: ${APP_CREATOR_CREDIT}\n\nऐप सीधे डाउनलोड व इंस्टॉल करने के लिए लिंक खोलें:\n${directPageLink}`;

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // Fallback copy for restricted iframe contexts
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2200);
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    }
  };

  const handleInstallClick = async () => {
    const ok = await install();
    if (ok) setInstallDone(true);
  };

  const handleApkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserUid) return;
    setAdminErr('');
    setAdminMsg('');

    if (!file.name.toLowerCase().endsWith('.apk')) {
      setAdminErr('कृपया केवल वैध Android .APK फ़ाइल चुनें।');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setAdminErr('APK फ़ाइल का आकार 100 MB से कम होना चाहिए।');
      return;
    }

    const safeFileName = `Rajaswa_Case_Diary_${Date.now()}.apk`;
    const fileRef = storageRef(storage, `public/releases/${safeFileName}`);
    setUploadingApk(5);

    const task = uploadBytesResumable(fileRef, file, {
      contentType: 'application/vnd.android.package-archive',
      contentDisposition: 'attachment; filename="Rajaswa_Nyayalaya_Case_Diary.apk"',
    });

    task.on(
      'state_changed',
      (snap) => {
        setUploadingApk(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      (err) => {
        setUploadingApk(null);
        setAdminErr(
          `Firebase Storage अपलोड विफल (${err.code || 'storage-error'}): आप .APK फ़ाइल को Google Drive या GitHub Releases पर रखकर उसका लिंक नीचे पेस्ट कर सकते हैं।`
        );
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          setApkUrlInput(url);
          setUploadingApk(null);
          setAdminMsg('APK अपलोड हो गई! अब "डायरेक्ट APK लिंक लाइव करें" बटन दबाएँ।');
        } catch (err) {
          setUploadingApk(null);
          setAdminErr(err instanceof Error ? err.message : 'लिंक प्राप्त करने में त्रुटि।');
        }
      }
    );
  };

  const handleSaveDirectApkUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserUid) return;
    setAdminErr('');
    setAdminMsg('');

    const raw = apkUrlInput.trim();
    const normalized = raw ? normalizeDirectApkUrl(raw) : '';
    if (raw && !normalized) {
      setAdminErr('कृपया वैध https:// लिंक दर्ज करें (Google Drive / GitHub / Firebase Storage)।');
      return;
    }

    setSavingApk(true);
    try {
      await setDoc(doc(db, 'settings', 'app'), {
        appName: sanitizeStr(
          appSettings?.appName || 'राजस्व न्यायालय केस डायरी',
          120
        ),
        maintenanceMode: appSettings?.maintenanceMode ?? false,
        announcement: sanitizeStr(appSettings?.announcement || '', 500),
        allowNewRegistrations: appSettings?.allowNewRegistrations ?? true,
        defaultReminderDays: appSettings?.defaultReminderDays ?? 3,
        apkDownloadUrl: sanitizeStr(normalized, 2000),
        apkVersion: sanitizeStr(apkVersionInput || 'v1.0.0', 40),
        updatedAt: serverTimestamp(),
        updatedBy: currentUserUid,
      });
      setApkUrlInput(normalized);
      setAdminMsg(
        normalized
          ? 'डायरेक्ट .APK डाउनलोड लिंक सफलतापूर्वक लाइव हो गया!'
          : 'APK लिंक हटा दिया गया।'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/app');
    } finally {
      setSavingApk(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] py-6 px-4 sm:px-6 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-5">
        {/* Top Back Bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[42px] px-4 rounded-xl bg-white border border-slate-200 text-[#0B1D3A] text-xs sm:text-sm font-semibold hover:bg-slate-50 inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {isLoggedIn ? 'डैशबोर्ड पर वापस जाएँ' : 'लॉगिन / ऐप खोलें'}
          </button>
          <span className="text-xs font-bold tracking-wide text-[#9A7410]">
            {APP_CREATOR_CREDIT}
          </span>
        </div>

        {/* Hero App Card */}
        <section className="bg-[#0B1D3A] text-white rounded-2xl p-6 sm:p-8 border border-[#C9A227]/35 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <img
              src={LEGAL_EMBLEM_URL}
              alt="राजस्व न्यायालय केस डायरी"
              referrerPolicy="no-referrer"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-[#C9A227]/60 object-cover shrink-0 bg-[#071326]"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-wider text-[#E5C665]">
                प्रस्तुति: {APP_CREATOR_CREDIT}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mt-0.5">
                {appSettings?.appName || 'राजस्व न्यायालय केस डायरी'}
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                उत्तर प्रदेश राजस्व न्यायालय प्रबंधन ऐप · वर्ज़न{' '}
                <span className="font-mono-num text-[#E5C665] font-semibold">
                  {apkVersion}
                </span>
              </p>
            </div>
          </div>

          {/* Primary Download / Install Actions */}
          <div className="space-y-3">
            {directApkUrl ? (
              <a
                href={directApkUrl}
                download="Rajaswa_Nyayalaya_Case_Diary.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[52px] px-6 rounded-xl bg-[#C9A227] text-[#071326] text-sm sm:text-base font-bold hover:bg-[#D9B53B] transition-colors flex items-center justify-center gap-2.5 shadow-sm"
              >
                <Download className="w-5 h-5" />
                सीधे Android .APK डाउनलोड करें ({apkVersion})
              </a>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full min-h-[52px] px-6 rounded-xl bg-[#C9A227] text-[#071326] text-sm sm:text-base font-bold hover:bg-[#D9B53B] transition-colors flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
              >
                <Download className="w-5 h-5" />
                फ़ोन में सीधे ऐप इंस्टॉल करें (1-क्लिक)
              </button>
            ) : isInIframe ? (
              <a
                href={standaloneAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[52px] px-6 rounded-xl bg-[#C9A227] text-[#071326] text-sm sm:text-base font-bold hover:bg-[#D9B53B] transition-colors flex items-center justify-center gap-2.5 shadow-sm"
              >
                <ExternalLink className="w-5 h-5" />
                नए Chrome टैब में ऐप खोलें (Install करने के लिए)
              </a>
            ) : (
              <div className="p-4 rounded-xl bg-white/10 border border-[#E5C665]/40 text-xs sm:text-sm text-white space-y-1.5 leading-relaxed">
                <p className="font-bold text-[#E5C665] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  अभी Chrome में ऐप इंस्टॉल करें (3 आसान चरण):
                </p>
                <p className="text-slate-200">
                  1. ऊपर दाईं ओर Chrome के <strong>तीन बिंदु (⋮)</strong> दबाएँ → 2.{' '}
                  <strong>"Install app"</strong> या{' '}
                  <strong>"Add to Home screen"</strong> चुनें → 3.{' '}
                  <strong>Install / Add</strong> दबाएँ।
                </p>
              </div>
            )}

            {(isInstalled || installDone) && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs text-emerald-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>यह ऐप आपके डिवाइस पर इंस्टॉल हो चुका है।</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleCopy(primaryShareLink, 'direct-link')}
                className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedKey === 'direct-link' ? (
                  <Check className="w-4 h-4 text-[#E5C665]" />
                ) : (
                  <Copy className="w-4 h-4 text-[#E5C665]" />
                )}
                {copiedKey === 'direct-link' ? 'लिंक कॉपी हुआ' : 'डायरेक्ट लिंक कॉपी करें'}
              </button>

              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                WhatsApp पर डाउनलोड लिंक भेजें
              </a>
            </div>
          </div>

          <div className="pt-4 border-t border-white/15 grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <p className="font-bold text-[#E5C665]">100% सुरक्षित</p>
              <p className="text-slate-300 mt-0.5">निजी डेटा सुरक्षा</p>
            </div>
            <div>
              <p className="font-bold text-[#E5C665]">ऑफ़लाइन सपोर्ट</p>
              <p className="text-slate-300 mt-0.5">तेज़ मोबाइल अनुभव</p>
            </div>
            <div>
              <p className="font-bold text-[#E5C665]">निःशुल्क अपडेट</p>
              <p className="text-slate-300 mt-0.5">क्लाउड सिंक</p>
            </div>
          </div>
        </section>

        {/* Shareable Direct Download URL Box */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#A17C14]" />
            <h2 className="text-sm font-bold text-[#0B1D3A]">
              डायरेक्ट ऐप डाउनलोड लिंक (Direct Download Link)
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              value={primaryShareLink}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono-num text-[#0B1D3A]"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopy(primaryShareLink, 'url-box')}
                className="min-h-[44px] px-4 rounded-xl bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132C54] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {copiedKey === 'url-box' ? (
                  <Check className="w-4 h-4 text-[#E5C665]" />
                ) : (
                  <Copy className="w-4 h-4 text-[#E5C665]" />
                )}
                {copiedKey === 'url-box' ? 'कॉपी हुआ' : 'कॉपी करें'}
              </button>
              <a
                href={primaryShareLink}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-[#0B1D3A] text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                खोलें
              </a>
            </div>
          </div>

          {isDevPreview && !directApkUrl && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <strong>ध्यान दें (404 से बचने के लिए):</strong> दूसरों को लिंक भेजने से पहले AI Studio के ऊपर दाईं ओर <strong>Share / Deploy</strong> बटन दबाकर ऐप को पब्लिश करें (ताकि पब्लिक लिंक सक्रिय हो जाए), अथवा नीचे अपनी <strong>.APK</strong> फ़ाइल का Google Drive / GitHub लिंक जोड़ें — वह लिंक सभी फ़ोन पर बिना लॉगिन सीधे काम करेगा।
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1.5 leading-relaxed">
            <p className="font-bold text-[#0B1D3A]">
              {directApkUrl
                ? 'Android फ़ोन में .APK इंस्टॉल करने की विधि:'
                : isIOS
                  ? 'iPhone / iPad पर इंस्टॉल करने की विधि:'
                  : 'Android फ़ोन में 10 सेकंड में इंस्टॉल करने की विधि:'}
            </p>
            {directApkUrl ? (
              <ol className="list-decimal list-inside space-y-1">
                <li>ऊपर दिए <strong>"सीधे Android .APK डाउनलोड करें"</strong> बटन पर टैप करें।</li>
                <li>डाउनलोड पूरी होने पर <strong>.APK</strong> फ़ाइल खोलें।</li>
                <li>यदि अनुमति माँगी जाए तो <strong>"इस स्रोत से अनुमति दें (Allow from this source)"</strong> चालू करके <strong>Install</strong> दबाएँ।</li>
              </ol>
            ) : isIOS ? (
              <ol className="list-decimal list-inside space-y-1">
                <li>इस लिंक को <strong>Safari</strong> ब्राउज़र में खोलें।</li>
                <li>नीचे <strong>Share</strong> आइकन पर टैप करें।</li>
                <li><strong>"Add to Home Screen"</strong> चुनें और <strong>Add</strong> दबाएँ।</li>
              </ol>
            ) : (
              <ol className="list-decimal list-inside space-y-1">
                <li>इस डायरेक्ट लिंक को <strong>Google Chrome</strong> में खोलें।</li>
                <li>ऊपर दाईं ओर <strong>तीन बिंदु (⋮)</strong> पर टैप करें।</li>
                <li><strong>"Install app"</strong> या <strong>"Add to Home screen"</strong> चुनें — ऐप आइकन सीधे होम स्क्रीन पर जुड़ जाएगा।</li>
              </ol>
            )}
          </div>
        </section>

        {/* Admin Direct APK Upload / Link Attach Panel */}
        {isAdmin && currentUserUid && (
          <form
            onSubmit={handleSaveDirectApkUrl}
            className="bg-white rounded-2xl border border-[#C9A227]/60 p-5 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#A17C14]" />
                <h3 className="text-sm font-bold text-[#0B1D3A]">
                  व्यवस्थापक सेटअप: अपनी .APK फ़ाइल जोड़ें (Direct .APK Download)
                </h3>
              </div>
              <label className="min-h-[36px] px-3 rounded-lg bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132C54] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <Upload className="w-3.5 h-3.5 text-[#E5C665]" />
                {uploadingApk !== null ? `अपलोड (${uploadingApk}%)` : '.APK अपलोड करें'}
                <input
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  className="hidden"
                  onChange={handleApkUpload}
                  disabled={uploadingApk !== null}
                />
              </label>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              अपनी बनी हुई Android <strong>.APK</strong> फ़ाइल सीधे अपलोड करें या Google Drive / GitHub Releases लिंक यहाँ पेस्ट करके सेव करें — सहेजते ही ऊपर दिया मुख्य बटन सीधे <strong>.APK फ़ाइल डाउनलोड</strong> करने लगेगा।
            </p>

            {adminErr && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                {adminErr}
              </div>
            )}
            {adminMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {adminMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="url"
                maxLength={2000}
                value={apkUrlInput}
                onChange={(e) => setApkUrlInput(e.target.value)}
                placeholder="https://drive.google.com/file/d/... या GitHub .apk लिंक"
                className="sm:col-span-3 h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono-num"
              />
              <input
                type="text"
                maxLength={40}
                value={apkVersionInput}
                onChange={(e) => setApkVersionInput(e.target.value)}
                placeholder="v1.0.0"
                className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingApk}
                className="min-h-[42px] px-5 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132C54] cursor-pointer disabled:opacity-60"
              >
                {savingApk ? 'सहेज रहे हैं...' : 'डायरेक्ट APK लिंक लाइव करें'}
              </button>
            </div>
          </form>
        )}

        <footer className="text-center text-xs text-slate-500 pt-2">
          राजस्व न्यायालय केस डायरी (उत्तर प्रदेश) · निर्माता:{' '}
          <strong className="text-[#0B1D3A]">{APP_CREATOR_CREDIT}</strong>
        </footer>
      </div>
    </div>
  );
};
