import React, { useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  Building2,
  Camera,
  CheckCircle2,
  FileBarChart2,
  LogOut,
  Plus,
  Save,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import {
  APP_CREATOR_CREDIT,
  AppSettings,
  DEFAULT_COURTS,
  UP_DISTRICTS,
  UserCourt,
  UserProfile,
} from '../types';
import { sanitizeStr } from '../utils/dateAndExport';
import { ConfirmModal } from './ConfirmModal';
import { PWAInstallButton } from './PWAInstallButton';

interface ProfileViewProps {
  profile: UserProfile;
  isAdmin: boolean;
  appSettings: AppSettings | null;
  customCourts: UserCourt[];
  onSignOut: () => void;
  onOpenReports: () => void;
  onOpenAdmin: () => void;
  onOpenDownloadPage?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  isAdmin,
  appSettings,
  customCourts,
  onSignOut,
  onOpenReports,
  onOpenAdmin,
  onOpenDownloadPage,
}) => {
  const [name, setName] = useState(profile.name);
  const [mobileNumber, setMobileNumber] = useState(profile.mobileNumber);
  const [address, setAddress] = useState(profile.address);
  const [designation, setDesignation] = useState(profile.designation);
  const [district, setDistrict] = useState(profile.district);
  const [tehsil, setTehsil] = useState(profile.tehsil);
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || '');

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [photoErr, setPhotoErr] = useState('');

  // Custom Court Form
  const [courtName, setCourtName] = useState('');
  const [courtCategory, setCourtCategory] = useState(DEFAULT_COURTS[0]);
  const [courtOfficer, setCourtOfficer] = useState('');
  const [addingCourt, setAddingCourt] = useState(false);
  const [courtToDelete, setCourtToDelete] = useState<UserCourt | null>(null);
  const [deletingCourt, setDeletingCourt] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice('');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name: sanitizeStr(name, 120),
        mobileNumber: sanitizeStr(mobileNumber, 20),
        address: sanitizeStr(address, 400),
        designation: sanitizeStr(designation, 120),
        district: sanitizeStr(district, 100),
        tehsil: sanitizeStr(tehsil, 100),
        photoUrl: sanitizeStr(photoUrl, 1000),
        updatedAt: serverTimestamp(),
      });
      setSavedNotice('आपका प्रोफाइल सफलतापूर्वक अपडेट किया गया।');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErr('');
    if (file.size > 5 * 1024 * 1024) {
      setPhotoErr('प्रोफाइल फोटो का आकार 5 MB से कम होना चाहिए।');
      return;
    }

    setUploadingPhoto(true);
    try {
      const safeName = `avatar_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const ref = storageRef(storage, `users/${profile.uid}/profile/${safeName}`);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      setPhotoUrl(url);
      await updateDoc(doc(db, 'users', profile.uid), {
        photoUrl: sanitizeStr(url, 1000),
        updatedAt: serverTimestamp(),
      });
      setSavedNotice('प्रोफाइल फोटो अपडेट हो गई है।');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPhotoErr(
        `फोटो अपलोड विफल रहा (सुनिश्चित करें कि Firebase Console में Storage सक्षम है): ${msg}`
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeStr(courtName, 160);
    if (!clean) return;
    setAddingCourt(true);
    try {
      await addDoc(collection(db, 'courts'), {
        ownerId: profile.uid,
        name: clean,
        category: sanitizeStr(courtCategory, 100),
        presidingOfficer: sanitizeStr(courtOfficer, 120),
        tehsil: sanitizeStr(tehsil, 100),
        district: sanitizeStr(district, 100),
        createdAt: serverTimestamp(),
      });
      setCourtName('');
      setCourtOfficer('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'courts');
    } finally {
      setAddingCourt(false);
    }
  };

  const handleConfirmDeleteCourt = async () => {
    if (!courtToDelete) return;
    setDeletingCourt(true);
    try {
      await deleteDoc(doc(db, 'courts', courtToDelete.id));
      setCourtToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `courts/${courtToDelete.id}`);
    } finally {
      setDeletingCourt(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Identity Header */}
      <section className="bg-[#0B1D3A] text-white rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-2xl bg-white/10 border border-[#C9A227]/50 overflow-hidden flex items-center justify-center shrink-0">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={profile.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-[#E5C665]" />
            )}
            <label
              className="absolute inset-0 bg-black/45 opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
              title="फोटो बदलें"
            >
              <Camera className="w-5 h-5 text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
              />
            </label>
          </div>

          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white truncate">{profile.name}</h2>
            <p className="text-xs text-[#E5C665] mt-0.5">
              {profile.designation || 'अधिवक्ता'} · {profile.district || 'उत्तर प्रदेश'}
            </p>
            <p className="text-xs text-slate-300 font-mono-num mt-0.5">
              {profile.mobileNumber}
              {profile.email ? ` · ${profile.email}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenReports}
            className="min-h-[42px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <FileBarChart2 className="w-4 h-4 text-[#E5C665]" />
            रिपोर्ट्स
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#C9A227] text-[#071326] text-xs font-bold hover:bg-[#D9B53B] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Shield className="w-4 h-4" />
              व्यवस्थापक पैनल
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[42px] px-3.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            लॉगआउट
          </button>
        </div>
      </section>

      {photoErr && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
          {photoErr}
        </div>
      )}

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* Edit Profile Form */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-[#0B1D3A]">व्यक्तिगत प्रोफाइल विवरण</h3>
          <label className="text-xs font-semibold text-[#9A7410] hover:text-[#0B1D3A] cursor-pointer">
            {uploadingPhoto ? 'अपलोड हो रहा है...' : 'प्रोफाइल फोटो अपलोड करें'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              मोबाइल नंबर <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              required
              maxLength={20}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              पदनाम (Designation)
            </label>
            <input
              type="text"
              maxLength={120}
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              जिला (District)
            </label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
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
              तहसील (Tehsil)
            </label>
            <input
              type="text"
              maxLength={100}
              value={tehsil}
              onChange={(e) => setTehsil(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              प्रोफाइल फोटो URL (वैकल्पिक)
            </label>
            <input
              type="url"
              maxLength={1000}
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            पता (Address)
          </label>
          <textarea
            rows={2}
            maxLength={400}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full p-3.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-6 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4 text-[#E5C665]" />
            {saving ? 'सहेज रहे हैं...' : 'प्रोफाइल अपडेट करें'}
          </button>
        </div>
      </form>

      {/* Court Management Section */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Building2 className="w-5 h-5 text-[#A17C14]" />
          <div>
            <h3 className="text-base font-bold text-[#0B1D3A]">न्यायालय प्रबंधन</h3>
            <p className="text-xs text-slate-500">
              उत्तर प्रदेश के 6 मानक राजस्व न्यायालय उपलब्ध हैं; आप अतिरिक्त न्यायालय भी जोड़ सकते हैं
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {DEFAULT_COURTS.map((c, idx) => (
            <div
              key={c}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-medium text-[#0B1D3A]"
            >
              <span className="font-mono-num text-slate-400 mr-1.5">{idx + 1}.</span>
              {c}
            </div>
          ))}
        </div>

        {/* Add Custom Court Form */}
        <form onSubmit={handleAddCourt} className="pt-4 border-t border-slate-100 space-y-3">
          <p className="text-xs font-bold text-[#0B1D3A]">अतिरिक्त न्यायालय मैन्युअल रूप से जोड़ें</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              maxLength={160}
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              placeholder="नए न्यायालय का नाम"
              className="h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
            />
            <select
              value={courtCategory}
              onChange={(e) => setCourtCategory(e.target.value)}
              className="h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
            >
              {DEFAULT_COURTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="अपर आयुक्त / मंडलायुक्त न्यायालय">
                अपर आयुक्त / मंडलायुक्त न्यायालय
              </option>
              <option value="जिलाधिकारी / कलेक्टर न्यायालय">
                जिलाधिकारी / कलेक्टर न्यायालय
              </option>
              <option value="राजस्व परिषद उत्तर प्रदेश">राजस्व परिषद उत्तर प्रदेश</option>
              <option value="अन्य न्यायालय">अन्य न्यायालय</option>
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={120}
                value={courtOfficer}
                onChange={(e) => setCourtOfficer(e.target.value)}
                placeholder="पीठासीन अधिकारी (वैकल्पिक)"
                className="flex-1 min-w-0 h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
              <button
                type="submit"
                disabled={addingCourt}
                className="min-h-[44px] px-4 rounded-xl bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132C54] inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 text-[#E5C665]" />
                जोड़ें
              </button>
            </div>
          </div>
        </form>

        {customCourts.length > 0 && (
          <div className="pt-2 divide-y divide-slate-100">
            <p className="text-xs font-semibold text-slate-500 pb-2">
              आपके द्वारा जोड़े गए न्यायालय ({customCourts.length})
            </p>
            {customCourts.map((c) => (
              <div
                key={c.id}
                className="py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#0B1D3A] truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.category}
                    {c.presidingOfficer ? ` · ${c.presidingOfficer}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCourtToDelete(c)}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                  aria-label="न्यायालय हटाएं"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Android PWA Install & Direct APK Download Card */}
      <PWAInstallButton
        variant="card"
        appSettings={appSettings}
        isAdmin={isAdmin}
        onOpenAdmin={onOpenAdmin}
        onOpenDownloadPage={onOpenDownloadPage}
      />

      {/* App Creator Attribution */}
      <section className="bg-[#0B1D3A] text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-[#C9A227]/35">
        <div>
          <p className="text-[11px] text-[#E5C665] font-semibold tracking-wide">
            निर्माता एवं प्रस्तुति
          </p>
          <p className="text-base font-bold tracking-wider text-white mt-0.5">
            {APP_CREATOR_CREDIT}
          </p>
        </div>
        <p className="text-xs text-slate-300">
          राजस्व न्यायालय केस डायरी — उत्तर प्रदेश
        </p>
      </section>

      <ConfirmModal
        open={Boolean(courtToDelete)}
        title="कस्टम न्यायालय हटाएं?"
        message={`क्या आप "${courtToDelete?.name || ''}" को अपनी न्यायालय सूची से हटाना चाहते हैं? (मौजूदा मुकदमों पर कोई असर नहीं पड़ेगा)`}
        loading={deletingCourt}
        onConfirm={handleConfirmDeleteCourt}
        onCancel={() => setCourtToDelete(null)}
      />
    </div>
  );
};
