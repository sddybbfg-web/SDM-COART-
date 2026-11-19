import React, { useEffect, useRef, useState } from 'react';
import {
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  User,
  signInWithPhoneNumber,
  signInWithPopup,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  KeyRound,
  Lock,
  Phone,
  Scale,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  APP_CREATOR_CREDIT,
  BOOTSTRAPPED_ADMIN_EMAIL,
  COURTHOUSE_HERO_URL,
  LEGAL_EMBLEM_URL,
  UP_DISTRICTS,
  UserProfile,
} from '../types';
import { sanitizeStr } from '../utils/dateAndExport';

interface AuthScreenProps {
  firebaseUser: User | null;
  needsProfileSetup: boolean;
  onProfileCreated: (profile: UserProfile) => void;
  onOpenDownloadPage?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  firebaseUser,
  needsProfileSetup,
  onProfileCreated,
  onOpenDownloadPage,
}) => {
  const [authTab, setAuthTab] = useState<'otp' | 'google'>('otp');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [showPhoneSetupHint, setShowPhoneSetupHint] = useState(false);

  // Onboarding Profile State
  const [name, setName] = useState(firebaseUser?.displayName || '');
  const [mobileNumber, setMobileNumber] = useState(
    firebaseUser?.phoneNumber?.replace(/^\+91/, '') || ''
  );
  const [address, setAddress] = useState('');
  const [designation, setDesignation] = useState('अधिवक्ता (राजस्व न्यायालय)');
  const [district, setDistrict] = useState('लखनऊ');
  const [tehsil, setTehsil] = useState('');

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (firebaseUser) {
      if (firebaseUser.displayName && !name) setName(firebaseUser.displayName);
      if (firebaseUser.phoneNumber && !mobileNumber) {
        setMobileNumber(firebaseUser.phoneNumber.replace(/^\+91/, ''));
      }
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setInterval(() => setResendSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendSeconds]);

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        try {
          recaptchaRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
        recaptchaRef.current = null;
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear();
      } catch {
        // ignore
      }
      recaptchaRef.current = null;
    }
    recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
    return recaptchaRef.current;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setShowPhoneSetupHint(false);

    const cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setErrorMsg('कृपया 10 अंकों का वैध भारतीय मोबाइल नंबर दर्ज करें।');
      return;
    }

    setLoading(true);
    try {
      const verifier = setupRecaptcha();
      const formattedPhone = `+91${cleaned}`;
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(result);
      setResendSeconds(60);
      setInfoMsg(`+91 ${cleaned} पर 6 अंकों का OTP सफलतापूर्वक भेजा गया है।`);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const msg = err instanceof Error ? err.message : String(err);
      if (
        code === 'auth/operation-not-allowed' ||
        code === 'auth/billing-not-enabled' ||
        code === 'auth/invalid-app-credential' ||
        code === 'auth/captcha-check-failed' ||
        msg.includes('operation-not-allowed') ||
        msg.includes('billing-not-enabled')
      ) {
        setShowPhoneSetupHint(true);
        setErrorMsg(
          'Firebase Console में Phone OTP प्रदाता अभी सक्रिय नहीं है या इस डोमेन के लिए अधिकृत नहीं है। आप नीचे "Google खाते से तुरंत लॉगिन" का उपयोग कर सकते हैं, या Firebase Console में Phone Auth सक्षम करें।'
        );
      } else if (code === 'auth/too-many-requests') {
        setErrorMsg('बहुत अधिक प्रयास किए गए हैं। कृपया थोड़ी देर बाद पुनः प्रयास करें।');
      } else {
        setErrorMsg(`OTP भेजने में समस्या आई: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setErrorMsg('');

    const code = otpInput.replace(/\D/g, '');
    if (code.length !== 6) {
      setErrorMsg('कृपया 6 अंकों का OTP दर्ज करें।');
      return;
    }

    setLoading(true);
    try {
      await confirmationResult.confirm(code);
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code || '';
      if (errCode === 'auth/invalid-verification-code') {
        setErrorMsg('दर्ज किया गया OTP गलत है। कृपया पुनः जांचें।');
      } else if (errCode === 'auth/code-expired') {
        setErrorMsg('OTP की समय-सीमा समाप्त हो गई है। कृपया नया OTP मंगवाएँ।');
      } else {
        setErrorMsg('OTP सत्यापन विफल रहा। कृपया पुनः प्रयास करें।');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code || '';
      if (errCode === 'auth/popup-closed-by-user') {
        setErrorMsg('लॉगिन विंडो बंद कर दी गई। कृपया पुनः प्रयास करें।');
      } else {
        setErrorMsg('Google लॉगिन में त्रुटि आई। कृपया पुनः प्रयास करें।');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setErrorMsg('');

    const cleanName = sanitizeStr(name, 120);
    const cleanPhone = sanitizeStr(mobileNumber.replace(/[^\d+]/g, ''), 20);
    if (!cleanName) {
      setErrorMsg('कृपया अपना पूरा नाम दर्ज करें।');
      return;
    }
    if (cleanPhone.length < 10) {
      setErrorMsg('कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।');
      return;
    }

    setLoading(true);
    const isAdminEmail =
      firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;

    const payload = {
      uid: firebaseUser.uid,
      name: cleanName,
      mobileNumber: cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone.slice(-10)}`,
      email: sanitizeStr(firebaseUser.email || '', 160),
      address: sanitizeStr(address || 'उत्तर प्रदेश', 400),
      designation: sanitizeStr(designation || 'अधिवक्ता', 120),
      district: sanitizeStr(district || 'लखनऊ', 100),
      tehsil: sanitizeStr(tehsil || 'सदर', 100),
      photoUrl: sanitizeStr(firebaseUser.photoURL || '', 1000),
      role: (isAdminEmail ? 'admin' : 'user') as 'user' | 'admin',
      isBlocked: false,
      caseCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', firebaseUser.uid), payload);
      onProfileCreated({
        ...payload,
        createdAt: null,
        updatedAt: null,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] grid lg:grid-cols-12">
      {/* Left Institutional Panel */}
      <div className="relative lg:col-span-6 bg-[#0B1D3A] text-white overflow-hidden flex flex-col justify-between p-8 sm:p-12 lg:p-14 min-h-[280px] lg:min-h-screen">
        <img
          src={COURTHOUSE_HERO_URL}
          alt="उत्तर प्रदेश राजस्व न्यायालय भवन"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071326] via-[#0B1D3A]/85 to-[#0B1D3A]/70" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#C9A227]/45 shadow-md bg-[#0B1D3A] shrink-0">
            <img
              src={LEGAL_EMBLEM_URL}
              alt="राजस्व न्यायालय प्रतीक"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-xs text-[#E5C665] font-medium tracking-wide">
              उत्तर प्रदेश राजस्व न्यायालय प्रबंधन
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              राजस्व न्यायालय केस डायरी
            </h1>
            <p className="text-xs font-bold tracking-wider text-[#E5C665] mt-1">
              प्रस्तुति: {APP_CREATOR_CREDIT}
            </p>
          </div>
        </div>

        <div className="relative z-10 my-8 lg:my-0 max-w-lg">
          <h2 className="text-2xl sm:text-4xl font-bold leading-snug text-white mb-4">
            हर मुकदमे की पेशी, दैनिक कार्यवाही और दस्तावेज़ — सुरक्षित निजी डायरी में।
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-8">
            उपजिलाधिकारी, तहसीलदार, नायब तहसीलदार एवं ग्राम न्यायालय के वादों का संपूर्ण डिजिटल रिकॉर्ड, स्वचालित पेशी रिमाइंडर तथा PDF/Excel रिपोर्ट जनरेशन।
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/15 text-sm">
            <div>
              <p className="text-[#E5C665] font-semibold">100% निजी डेटा</p>
              <p className="text-xs text-slate-300 mt-1">
                प्रत्येक उपयोगकर्ता की अलग एन्क्रिप्टेड केस डायरी
              </p>
            </div>
            <div>
              <p className="text-[#E5C665] font-semibold">दैनिक कार्यवाही</p>
              <p className="text-xs text-slate-300 mt-1">
                लेखपाल/कानूनगो रिपोर्ट, आदेश एवं अगली तारीख का स्थायी इतिहास
              </p>
            </div>
            <div>
              <p className="text-[#E5C665] font-semibold">तत्काल रिपोर्ट</p>
              <p className="text-xs text-slate-300 mt-1">
                PDF और Excel में दैनिक व न्यायालयवार वाद सूची निर्यात
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>Firebase Authentication एवं Cloud Firestore सुरक्षा नियमों द्वारा संरक्षित</span>
          </div>
          <span className="font-semibold tracking-wider text-[#E5C665]">
            निर्माता: {APP_CREATOR_CREDIT}
          </span>
        </div>
      </div>

      {/* Right Auth / Profile Onboarding Panel */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md">
          {needsProfileSetup && firebaseUser ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[#0B1D3A] text-[#E5C665] flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#0B1D3A]">अपना प्रोफाइल पूरा करें</h2>
                  <p className="text-xs text-slate-500">
                    यह जानकारी आपकी निजी केस डायरी और PDF रिपोर्ट हेडर में उपयोग होगी
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleCreateProfile} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    पूरा नाम <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="उदा. एडवोकेट राजेश कुमार वर्मा"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A] focus:ring-2 focus:ring-[#0B1D3A]/10"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      मोबाइल नंबर <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      maxLength={15}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="10 अंकों का मोबाइल नंबर"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A] focus:ring-2 focus:ring-[#0B1D3A]/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      पदनाम / भूमिका <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="अधिवक्ता / मुंशी / पक्षकार"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A] focus:ring-2 focus:ring-[#0B1D3A]/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      जिला (उत्तर प्रदेश) <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#0B1D3A]"
                    >
                      {UP_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      तहसील <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={tehsil}
                      onChange={(e) => setTehsil(e.target.value)}
                      placeholder="उदा. सदर / मोहनलालगंज"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    पता / चैंबर पता
                  </label>
                  <textarea
                    rows={2}
                    maxLength={400}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="चैंबर संख्या, तहसील परिसर, जिला..."
                    className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[48px] rounded-xl bg-[#0B1D3A] text-white font-semibold text-sm hover:bg-[#132C54] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? 'प्रोफाइल सहेजा जा रहा है...' : 'प्रोफाइल सहेजें और डैशबोर्ड खोलें'}
                  <ArrowRight className="w-4 h-4 text-[#E5C665]" />
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#0B1D3A]">सुरक्षित लॉगिन / पंजीकरण</h2>
                <p className="text-sm text-slate-500 mt-1">
                  अपनी निजी केस डायरी खोलने के लिए मोबाइल OTP या Google से सत्यापन करें।
                </p>
              </div>

              {/* Segmented Login Mode Selector */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('otp');
                    setErrorMsg('');
                    setInfoMsg('');
                  }}
                  className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    authTab === 'otp'
                      ? 'bg-white text-[#0B1D3A] shadow-xs'
                      : 'text-slate-600 hover:text-[#0B1D3A]'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  मोबाइल OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('google');
                    setErrorMsg('');
                    setInfoMsg('');
                  }}
                  className={`min-h-[42px] rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                    authTab === 'google'
                      ? 'bg-white text-[#0B1D3A] shadow-xs'
                      : 'text-slate-600 hover:text-[#0B1D3A]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Google खाता
                </button>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
                  {errorMsg}
                  {showPhoneSetupHint && (
                    <div className="mt-2 pt-2 border-t border-red-200 text-slate-700 space-y-1">
                      <p className="font-semibold text-[#0B1D3A]">
                        Phone OTP सक्रिय करने के चरण (Firebase Console):
                      </p>
                      <p>1. Firebase Console → Authentication → Sign-in method → Phone को Enable करें।</p>
                      <p>2. Settings → Authorized domains में इस ऐप का डोमेन जोड़ें।</p>
                    </div>
                  )}
                </div>
              )}

              {infoMsg && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {authTab === 'otp' ? (
                !confirmationResult ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        मोबाइल नंबर (भारत +91)
                      </label>
                      <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-[#0B1D3A] focus-within:ring-2 focus-within:ring-[#0B1D3A]/10 overflow-hidden bg-white">
                        <span className="px-3.5 py-3 bg-slate-50 border-r border-slate-200 text-sm font-mono-num font-semibold text-slate-700">
                          +91
                        </span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          required
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="9876543210"
                          className="w-full h-11 px-3.5 text-sm font-mono-num focus:outline-none"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        प्रत्येक मोबाइल नंबर का अलग और पूर्णतः निजी खाता बनाया जाएगा। OTP कभी भी सामान्य टेक्स्ट में संग्रहीत नहीं होता।
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || phoneInput.length !== 10}
                      className="w-full min-h-[48px] rounded-xl bg-[#0B1D3A] text-white font-semibold text-sm hover:bg-[#132C54] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <KeyRound className="w-4 h-4 text-[#E5C665]" />
                      {loading ? 'OTP भेजा जा रहा है...' : 'OTP प्राप्त करें'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        6 अंकों का OTP दर्ज करें (+91 {phoneInput})
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="• • • • • •"
                        className="w-full h-12 px-4 text-center tracking-[0.45em] text-lg font-mono-num font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-[#0B1D3A] focus:ring-2 focus:ring-[#0B1D3A]/10"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otpInput.length !== 6}
                      className="w-full min-h-[48px] rounded-xl bg-[#0B1D3A] text-white font-semibold text-sm hover:bg-[#132C54] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'सत्यापन हो रहा है...' : 'OTP सत्यापित करें और लॉगिन करें'}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmationResult(null);
                          setOtpInput('');
                          setInfoMsg('');
                        }}
                        className="text-slate-600 hover:text-[#0B1D3A] font-medium cursor-pointer"
                      >
                        नंबर बदलें
                      </button>
                      <button
                        type="button"
                        disabled={resendSeconds > 0 || loading}
                        onClick={handleSendOtp}
                        className="text-[#9A7410] font-semibold disabled:text-slate-400 cursor-pointer"
                      >
                        {resendSeconds > 0
                          ? `पुनः भेजें (${resendSeconds}s)`
                          : 'OTP पुनः भेजें'}
                      </button>
                    </div>
                  </form>
                )
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    अपने सत्यापित Google खाते से एक क्लिक में सुरक्षित लॉगिन करें। आपका डेटा सभी डिवाइस पर स्वचालित रूप से सिंक रहेगा।
                  </p>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full min-h-[48px] rounded-xl bg-[#0B1D3A] text-white font-semibold text-sm hover:bg-[#132C54] transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <Scale className="w-4 h-4 text-[#E5C665]" />
                    {loading ? 'लॉगिन हो रहा है...' : 'Google खाते से लॉगिन करें'}
                  </button>
                </div>
              )}

              {/* Quick Alternate Login */}
              {authTab === 'otp' && (
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white text-[#0B1D3A] text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#A17C14]" />
                    अथवा Google खाते से तुरंत लॉगिन करें
                  </button>
                </div>
              )}

              <div id="recaptcha-container" />
            </div>
          )}

          {onOpenDownloadPage && (
            <div className="mt-4">
              <button
                type="button"
                onClick={onOpenDownloadPage}
                className="w-full min-h-[44px] px-4 rounded-xl bg-[#FBF5E2] border border-[#E5C665] text-[#0B1D3A] text-xs sm:text-sm font-bold hover:bg-[#F5E8BE] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#9A7410]" />
                Android ऐप डाउनलोड / डायरेक्ट डाउनलोड लिंक
              </button>
            </div>
          )}

          <p className="mt-5 text-center text-xs text-slate-500">
            निर्माता एवं परिकल्पना:{' '}
            <span className="font-bold text-[#0B1D3A] tracking-wide">
              {APP_CREATOR_CREDIT}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
