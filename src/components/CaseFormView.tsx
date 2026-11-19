import React, { useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { ArrowLeft, Building2, Plus, Save, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CASE_STATUSES,
  CaseStatus,
  COMMON_REVENUE_SECTIONS,
  DEFAULT_COURTS,
  RevenueCase,
  UP_DISTRICTS,
  UserProfile,
} from '../types';
import { getLocalDateString, sanitizeStr } from '../utils/dateAndExport';

interface CaseFormViewProps {
  ownerId: string;
  profile: UserProfile;
  allCourtNames: string[];
  editingCase: RevenueCase | null;
  totalExistingCases: number;
  onSaved: (savedCaseId?: string) => void;
  onCancel: () => void;
}

export const CaseFormView: React.FC<CaseFormViewProps> = ({
  ownerId,
  profile,
  allCourtNames,
  editingCase,
  totalExistingCases,
  onSaved,
  onCancel,
}) => {
  const [caseNumber, setCaseNumber] = useState(editingCase?.caseNumber || '');
  const [computerizedCaseNumber, setComputerizedCaseNumber] = useState(
    editingCase?.computerizedCaseNumber || ''
  );
  const [courtName, setCourtName] = useState(
    editingCase?.courtName || DEFAULT_COURTS[0]
  );
  const [presidingOfficer, setPresidingOfficer] = useState(
    editingCase?.presidingOfficer || ''
  );
  const [plaintiffName, setPlaintiffName] = useState(
    editingCase?.plaintiffName || ''
  );
  const [defendantName, setDefendantName] = useState(
    editingCase?.defendantName || ''
  );
  const [advocateName, setAdvocateName] = useState(
    editingCase?.advocateName || profile.name || ''
  );
  const [clientMobile, setClientMobile] = useState(
    editingCase?.clientMobile || ''
  );
  const [village, setVillage] = useState(editingCase?.village || '');
  const [pargana, setPargana] = useState(editingCase?.pargana || '');
  const [tehsil, setTehsil] = useState(editingCase?.tehsil || profile.tehsil || '');
  const [district, setDistrict] = useState(
    editingCase?.district || profile.district || 'लखनऊ'
  );
  const [gataNumber, setGataNumber] = useState(editingCase?.gataNumber || '');
  const [section, setSection] = useState(editingCase?.section || '');
  const [subject, setSubject] = useState(editingCase?.subject || '');
  const [filingDate, setFilingDate] = useState(
    editingCase?.filingDate || getLocalDateString()
  );
  const [previousDate, setPreviousDate] = useState(
    editingCase?.previousDate || ''
  );
  const [nextDate, setNextDate] = useState(editingCase?.nextDate || '');
  const [status, setStatus] = useState<CaseStatus>(
    editingCase?.status || 'नवीन वाद'
  );
  const [lekhpalReportPending, setLekhpalReportPending] = useState(
    editingCase?.lekhpalReportPending || false
  );
  const [kanungoReportPending, setKanungoReportPending] = useState(
    editingCase?.kanungoReportPending || false
  );
  const [notes, setNotes] = useState(editingCase?.notes || '');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Quick Add Custom Court Modal
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtCategory, setNewCourtCategory] = useState(DEFAULT_COURTS[0]);
  const [newCourtOfficer, setNewCourtOfficer] = useState('');
  const [addingCourt, setAddingCourt] = useState(false);

  const isDisposedLocked = editingCase?.status === 'निस्तारित';

  const handleAddCustomCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeStr(newCourtName, 160);
    if (!clean) return;

    setAddingCourt(true);
    try {
      await addDoc(collection(db, 'courts'), {
        ownerId,
        name: clean,
        category: sanitizeStr(newCourtCategory, 100),
        presidingOfficer: sanitizeStr(newCourtOfficer, 120),
        tehsil: sanitizeStr(tehsil, 100),
        district: sanitizeStr(district, 100),
        createdAt: serverTimestamp(),
      });
      setCourtName(clean);
      if (newCourtOfficer && !presidingOfficer) {
        setPresidingOfficer(newCourtOfficer);
      }
      setNewCourtName('');
      setNewCourtOfficer('');
      setShowAddCourt(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'courts');
    } finally {
      setAddingCourt(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCaseNo = sanitizeStr(caseNumber, 100);
    const cleanPlaintiff = sanitizeStr(plaintiffName, 160);
    const cleanCourt = sanitizeStr(courtName, 160);

    if (!cleanCaseNo) {
      setErrorMsg('कृपया वाद संख्या दर्ज करें।');
      return;
    }
    if (!cleanPlaintiff) {
      setErrorMsg('कृपया वादी का नाम दर्ज करें।');
      return;
    }
    if (!cleanCourt) {
      setErrorMsg('कृपया न्यायालय का नाम चुनें।');
      return;
    }

    setSaving(true);
    const commonFields = {
      caseNumber: cleanCaseNo,
      computerizedCaseNumber: sanitizeStr(computerizedCaseNumber, 120),
      courtName: cleanCourt,
      presidingOfficer: sanitizeStr(presidingOfficer, 120),
      plaintiffName: cleanPlaintiff,
      defendantName: sanitizeStr(defendantName, 160),
      advocateName: sanitizeStr(advocateName, 160),
      clientMobile: sanitizeStr(clientMobile.replace(/[^\d+\-\s]/g, ''), 20),
      village: sanitizeStr(village, 120),
      pargana: sanitizeStr(pargana, 120),
      tehsil: sanitizeStr(tehsil, 120),
      district: sanitizeStr(district, 120),
      gataNumber: sanitizeStr(gataNumber, 120),
      section: sanitizeStr(section, 120),
      subject: sanitizeStr(subject, 300),
      filingDate: sanitizeStr(filingDate, 20),
      previousDate: sanitizeStr(previousDate, 20),
      nextDate: sanitizeStr(nextDate, 20),
      status,
      lekhpalReportPending,
      kanungoReportPending,
      notes: sanitizeStr(notes, 1000),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingCase) {
        const ref = doc(db, 'cases', editingCase.id);
        await updateDoc(ref, commonFields);
        onSaved(editingCase.id);
      } else {
        const docRef = await addDoc(collection(db, 'cases'), {
          ...commonFields,
          ownerId,
          createdAt: serverTimestamp(),
        });
        // Update user's aggregate case count for admin summary (privacy-safe)
        try {
          await updateDoc(doc(db, 'users', ownerId), {
            caseCount: totalExistingCases + 1,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // non-blocking counter sync
        }
        onSaved(docRef.id);
      }
    } catch (err) {
      handleFirestoreError(
        err,
        editingCase ? OperationType.UPDATE : OperationType.CREATE,
        editingCase ? `cases/${editingCase.id}` : 'cases'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 cursor-pointer"
            aria-label="वापस जाएँ"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0B1D3A]">
              {editingCase ? 'मुकदमा विवरण संपादित करें' : 'नया मुकदमा दर्ज करें'}
            </h2>
            <p className="text-xs text-slate-500">
              सभी विवरण आपकी निजी केस डायरी में सुरक्षित रूप से सहेजे जाएँगे
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {isDisposedLocked && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          यह वाद <strong>निस्तारित</strong> स्थिति में है। आप इसे केवल <strong>निस्तारित</strong> रख सकते हैं या <strong>अपील</strong> में स्थानांतरित कर सकते हैं।
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: न्यायालय एवं वाद पहचान */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-[#0B1D3A]">
              1. न्यायालय एवं वाद संख्या विवरण
            </h3>
            <button
              type="button"
              onClick={() => setShowAddCourt(true)}
              className="text-xs font-semibold text-[#9A7410] hover:text-[#0B1D3A] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              नया न्यायालय जोड़ें
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                वाद संख्या <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="उदा. 245/2026"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                कम्प्यूटरीकृत वाद संख्या (RCCMS)
              </label>
              <input
                type="text"
                maxLength={120}
                value={computerizedCaseNumber}
                onChange={(e) => setComputerizedCaseNumber(e.target.value)}
                placeholder="उदा. T202610460201452"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                न्यायालय का नाम <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={courtName}
                onChange={(e) => setCourtName(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#0B1D3A]"
              >
                {allCourtNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                पीठासीन अधिकारी का नाम
              </label>
              <input
                type="text"
                maxLength={120}
                value={presidingOfficer}
                onChange={(e) => setPresidingOfficer(e.target.value)}
                placeholder="उदा. श्री अशोक कुमार सिंह (पी.सी.एस.)"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>
          </div>
        </section>

        {/* Section 2: पक्षकार एवं अधिवक्ता विवरण */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-[#0B1D3A] pb-3 border-b border-slate-100">
            2. पक्षकार एवं अधिवक्ता विवरण
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                वादी का नाम <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={plaintiffName}
                onChange={(e) => setPlaintiffName(e.target.value)}
                placeholder="वादी का पूरा नाम"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                प्रतिवादी का नाम
              </label>
              <input
                type="text"
                maxLength={160}
                value={defendantName}
                onChange={(e) => setDefendantName(e.target.value)}
                placeholder="प्रतिवादी का नाम / ग्राम सभा / उत्तर प्रदेश सरकार"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                अधिवक्ता का नाम
              </label>
              <input
                type="text"
                maxLength={160}
                value={advocateName}
                onChange={(e) => setAdvocateName(e.target.value)}
                placeholder="अधिवक्ता का नाम"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                पक्षकार / संपर्क मोबाइल नंबर
              </label>
              <input
                type="tel"
                maxLength={20}
                value={clientMobile}
                onChange={(e) => setClientMobile(e.target.value)}
                placeholder="10 अंकों का मोबाइल नंबर"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>
          </div>
        </section>

        {/* Section 3: भूमि एवं राजस्व ग्राम विवरण */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-[#0B1D3A] pb-3 border-b border-slate-100">
            3. राजस्व ग्राम, गाटा एवं धारा विवरण
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ग्राम
              </label>
              <input
                type="text"
                maxLength={120}
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="राजस्व ग्राम का नाम"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                परगना
              </label>
              <input
                type="text"
                maxLength={120}
                value={pargana}
                onChange={(e) => setPargana(e.target.value)}
                placeholder="परगना का नाम"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                तहसील
              </label>
              <input
                type="text"
                maxLength={120}
                value={tehsil}
                onChange={(e) => setTehsil(e.target.value)}
                placeholder="तहसील"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                जिला
              </label>
              <input
                type="text"
                list="up-districts-list"
                maxLength={120}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="उत्तर प्रदेश जिला"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
              />
              <datalist id="up-districts-list">
                {UP_DISTRICTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                गाटा संख्या / खसरा संख्या
              </label>
              <input
                type="text"
                maxLength={120}
                value={gataNumber}
                onChange={(e) => setGataNumber(e.target.value)}
                placeholder="उदा. 142मि, 145क"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                मुकदमे की धारा (उ.प्र. राजस्व संहिता 2006)
              </label>
              <input
                type="text"
                list="revenue-sections-list"
                maxLength={120}
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="उदा. धारा 24 (सीमांकन)"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
              />
              <datalist id="revenue-sections-list">
                {COMMON_REVENUE_SECTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              मुकदमे का विषय
            </label>
            <input
              type="text"
              maxLength={300}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="उदा. भूमि सीमांकन / नामांतरण / खाता विभाजन / अभिलेख दुरुस्ती"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
            />
          </div>
        </section>

        {/* Section 4: तारीखें एवं वर्तमान स्थिति */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-[#0B1D3A] pb-3 border-b border-slate-100">
            4. तारीखें, स्थिति एवं रिपोर्ट ट्रैकिंग
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                दाखिल होने की तारीख
              </label>
              <input
                type="date"
                value={filingDate}
                onChange={(e) => setFilingDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                पिछली तारीख
              </label>
              <input
                type="date"
                value={previousDate}
                onChange={(e) => setPreviousDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                अगली तारीख (पेशी)
              </label>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                मुकदमे की वर्तमान स्थिति
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CaseStatus)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#0B1D3A]"
              >
                {CASE_STATUSES.map((st) => (
                  <option
                    key={st}
                    value={st}
                    disabled={isDisposedLocked && st !== 'निस्तारित' && st !== 'अपील'}
                  >
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer min-h-[40px]">
              <input
                type="checkbox"
                checked={lekhpalReportPending}
                onChange={(e) => setLekhpalReportPending(e.target.checked)}
                className="w-4 h-4 rounded accent-[#0B1D3A]"
              />
              लेखपाल रिपोर्ट लंबित है
            </label>
            <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer min-h-[40px]">
              <input
                type="checkbox"
                checked={kanungoReportPending}
                onChange={(e) => setKanungoReportPending(e.target.checked)}
                className="w-4 h-4 rounded accent-[#0B1D3A]"
              />
              कानूनगो / राजस्व निरीक्षक रिपोर्ट लंबित है
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              विशेष टिप्पणी / अतिरिक्त विवरण
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="वाद से संबंधित कोई महत्वपूर्ण नोट या निर्देश..."
              className="w-full p-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
            />
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            रद्द करें
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[48px] px-7 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4 text-[#E5C665]" />
            {saving
              ? 'सहेजा जा रहा है...'
              : editingCase
                ? 'परिवर्तन सहेजें'
                : 'मुकदमा सहेजें'}
          </button>
        </div>
      </form>

      {/* Inline Add Custom Court Modal */}
      {showAddCourt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#A17C14]" />
                <h3 className="text-base font-bold text-[#0B1D3A]">
                  नया न्यायालय जोड़ें
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCourt(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCustomCourt} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  न्यायालय का नाम <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={newCourtName}
                  onChange={(e) => setNewCourtName(e.target.value)}
                  placeholder="उदा. अपर उपजिलाधिकारी न्यायालय (द्वितीय)"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  न्यायालय श्रेणी
                </label>
                <select
                  value={newCourtCategory}
                  onChange={(e) => setNewCourtCategory(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  {DEFAULT_COURTS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="अन्य राजस्व न्यायालय">अन्य राजस्व न्यायालय</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  पीठासीन अधिकारी (वैकल्पिक)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={newCourtOfficer}
                  onChange={(e) => setNewCourtOfficer(e.target.value)}
                  placeholder="अधिकारी का नाम"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCourt(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm text-slate-700 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={addingCourt}
                  className="min-h-[44px] px-5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] cursor-pointer disabled:opacity-60"
                >
                  {addingCourt ? 'जोड़ रहे हैं...' : 'न्यायालय जोड़ें'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
