import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Share2,
  Shield,
  Smartphone,
  Terminal,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { APP_CREATOR_CREDIT, type AppSettings } from '../types';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
  appSettings?: AppSettings | null;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onOpenDownloadPage?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  appSettings,
  isAdmin = false,
  onOpenAdmin,
  onOpenDownloadPage,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const directApkUrl =
    appSettings?.apkDownloadUrl && appSettings.apkDownloadUrl.startsWith('https://')
      ? appSettings.apkDownloadUrl
      : '';
  const apkVersion = appSettings?.apkVersion || 'v1.0.0';

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const isAIStudioPreview =
    currentOrigin.includes('ais-dev-') ||
    currentOrigin.includes('ais-pre-') ||
    (typeof window !== 'undefined' && window.self !== window.top);

  const firebaseHostingUrl = 'https://glassy-time-gxq1s.web.app';
  const deployCmd =
    'npm install && npm run build && npx firebase-tools login && npx firebase-tools deploy --only hosting';

  const whatsappShareUrl = directApkUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `राजस्व न्यायालय केस डायरी (उत्तर प्रदेश) — निर्माता: ${APP_CREATOR_CREDIT}\nAndroid ऐप (.APK ${apkVersion}) सीधे डाउनलोड करें:\n${directApkUrl}`
      )}`
    : '';

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // clipboard restricted in iframe
    }
  };

  const handlePrimaryClick = async () => {
    if (isInstallable) {
      await install();
    } else if (onOpenDownloadPage) {
      onOpenDownloadPage();
    } else {
      setShowGuideModal(true);
    }
  };

  if (isInstalled && !directApkUrl && variant === 'header') {
    return null;
  }

  return (
    <>
      {variant === 'header' ? (
        directApkUrl ? (
          <a
            href={directApkUrl}
            download="Rajaswa_Nyayalaya_Case_Diary.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-3 rounded-lg bg-[#C9A227] text-[#071326] text-xs font-bold hover:bg-[#D9B53B] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>APK डाउनलोड</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={handlePrimaryClick}
            className="min-h-[38px] px-3 rounded-lg bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132C54] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#E5C665]" />
            <span>{isInstallable ? 'ऐप इंस्टॉल करें' : 'APK डाउनलोड'}</span>
          </button>
        )
      ) : (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0B1D3A] text-[#E5C665] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#0B1D3A]">
                Android ऐप डायरेक्ट .APK डाउनलोड
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {directApkUrl
                  ? `सीधे Android .APK फ़ाइल (${apkVersion}) डाउनलोड करें और अपने फ़ोन में इंस्टॉल करें।`
                  : 'अपने Android फ़ोन के लिए सीधी .APK डाउनलोड लिंक सेट करें या GitHub Actions से 1-क्लिक .APK बिल्ड करें।'}
              </p>
            </div>
          </div>

          {directApkUrl ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href={directApkUrl}
                  download="Rajaswa_Nyayalaya_Case_Diary.apk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <Download className="w-4 h-4 text-[#E5C665]" />
                  सीधे .APK डाउनलोड करें ({apkVersion})
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy(directApkUrl, 'apk-url')}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-[#0B1D3A] text-xs sm:text-sm font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {copiedKey === 'apk-url' ? (
                    <Check className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copiedKey === 'apk-url' ? 'लिंक कॉपी हुआ' : 'डायरेक्ट लिंक कॉपी करें'}
                </button>
                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" />
                  WhatsApp पर शेयर करें
                </a>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                इंस्टॉल विधि: डाउनलोड हुई <strong>.APK</strong> फ़ाइल पर टैप करें → यदि पूछा जाए तो <strong>"Unknown Sources / इस स्रोत से इंस्टॉल करें"</strong> की अनुमति दें → <strong>Install</strong> दबाएँ।
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              {onOpenDownloadPage && (
                <button
                  type="button"
                  onClick={onOpenDownloadPage}
                  className="min-h-[44px] px-5 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4 text-[#E5C665]" />
                  डायरेक्ट डाउनलोड पेज व लिंक खोलें
                </button>
              )}
              {isAdmin && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="min-h-[44px] px-5 rounded-xl bg-[#C9A227] text-[#071326] text-xs sm:text-sm font-bold hover:bg-[#D9B53B] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Shield className="w-4 h-4" />
                  एडमिन पैनल में Direct .APK लिंक जोड़ें / अपलोड करें
                </button>
              )}
              {!isInstalled && isInstallable && (
                <button
                  type="button"
                  onClick={handlePrimaryClick}
                  className="min-h-[44px] px-5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4 text-[#E5C665]" />
                  फ़ोन में तुरंत इंस्टॉल करें
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-[#0B1D3A] text-xs sm:text-sm font-semibold hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                .APK बनाने व लिंक सेट करने की विधि
              </button>
            </div>
          )}
        </section>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#0B1D3A] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-[#E5C665]" />
                <h3 className="text-base font-bold">
                  Android Direct .APK डाउनलोड सेटअप
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
                aria-label="बंद करें"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-sm text-slate-700 max-h-[75vh] overflow-y-auto">
              {isAdmin && onOpenAdmin && (
                <div className="p-4 rounded-xl bg-[#FBF5E2] border border-[#E5C665]/75 space-y-2.5">
                  <p className="text-xs font-bold text-[#0B1D3A]">
                    व्यवस्थापक त्वरित विकल्प (Direct Download APK लिंक चालू करें):
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    यदि आपके पास तैयार <strong>.APK</strong> फ़ाइल है, तो <strong>व्यवस्थापक पैनल → एप्लिकेशन सेटिंग्स</strong> में सीधे <strong>.APK अपलोड करें</strong> या Google Drive / GitHub Release लिंक पेस्ट करें। इसके बाद ऊपर हेडर और प्रोफाइल में सभी उपयोगकर्ताओं के लिए 1-क्लिक <strong>डायरेक्ट APK डाउनलोड</strong> बटन लाइव हो जाएगा।
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGuideModal(false);
                      onOpenAdmin();
                    }}
                    className="min-h-[40px] px-4 rounded-xl bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#E5C665]" />
                    व्यवस्थापक पैनल खोलें
                  </button>
                </div>
              )}

              {isAIStudioPreview && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>जानकारी:</strong> AI Studio वेब प्रीव्यू सर्वर में Android SDK नहीं होता, इसलिए वास्तविक इंस्टॉल होने वाली <strong>.APK</strong> फ़ाइल नीचे दिए गए मुफ़्त GitHub Actions बिल्डर से 2 मिनट में बनाई जाती है और फिर उसे यहाँ Direct Download लिंक के रूप में जोड़ा जा सकता है।
                  </div>
                </div>
              )}

              {/* Method 1: Free Cloud APK via GitHub Actions */}
              <div className="space-y-2">
                <h4 className="font-bold text-[#0B1D3A]">
                  चरण 1: बिना किसी सॉफ्टवेयर के मुफ़्त में वास्तविक .APK बनाएँ (GitHub Actions)
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <li>
                    AI Studio के ऊपर दाईं ओर से इस प्रोजेक्ट को <strong>GitHub पर Export / Push</strong> करें।
                  </li>
                  <li>
                    अपनी GitHub रिपॉजिटरी में <strong>Actions</strong> टैब खोलें और <strong>"Build Android APK"</strong> पर क्लिक करके <strong>Run workflow</strong> दबाएँ।
                  </li>
                  <li>
                    2–3 मिनट में बिल्ड पूरा होने पर नीचे <strong>Artifacts</strong> में <strong>rajaswa-nyayalaya-case-diary-apk</strong> डाउनलोड करें (उसमें <strong>app-debug.apk</strong> मिलेगी)।
                  </li>
                  <li>
                    उस <strong>.APK</strong> को व्यवस्थापक पैनल में अपलोड करें या Google Drive पर डालकर उसका शेयर लिंक पेस्ट कर दें — आपका <strong>Direct APK Download Link</strong> तुरंत सक्रिय हो जाएगा।
                  </li>
                </ol>
              </div>

              {/* Method 2: Firebase Hosting + PWABuilder */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <h4 className="font-bold text-[#0B1D3A]">
                  वैकल्पिक तरीका: Firebase Hosting पर लाइव करें और PWABuilder से .APK बनाएँ
                </h4>
                <div className="bg-slate-900 text-slate-100 rounded-xl p-3 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Terminal className="w-4 h-4 text-[#E5C665] shrink-0 mt-0.5" />
                    <code className="text-[11px] font-mono-num break-all leading-relaxed">
                      {deployCmd}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(deployCmd, 'cmd')}
                    className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'cmd' ? (
                      <Check className="w-3.5 h-3.5 text-[#E5C665]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedKey === 'cmd' ? 'कॉपी हुआ' : 'कॉपी'}
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  डिप्लॉय होते ही आपका पब्लिक URL{' '}
                  <strong className="font-mono-num text-[#0B1D3A]">
                    {firebaseHostingUrl}
                  </strong>{' '}
                  लाइव हो जाएगा, जिसे Android Chrome में सीधे इंस्टॉल किया जा सकता है या <strong>pwabuilder.com</strong> से .APK बनाया जा सकता है।
                </p>
              </div>

              {isIOS && (
                <div className="pt-4 border-t border-slate-100 text-xs text-slate-600">
                  <strong>iPhone / iPad उपयोगकर्ता:</strong> Safari में पब्लिक URL खोलें → <strong>Share</strong> → <strong>Add to Home Screen</strong>।
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[40px] px-5 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132C54] cursor-pointer"
              >
                बंद करें
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white shadow-lg no-print"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>ऑफ़लाइन मोड — इंटरनेट कनेक्शन उपलब्ध नहीं है।</span>
    </div>
  );
};
