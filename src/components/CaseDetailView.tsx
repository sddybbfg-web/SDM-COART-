import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Plus,
  Printer,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import {
  CASE_STATUSES,
  CaseContact,
  CaseDocument,
  CaseStatus,
  DailyDiaryEntry,
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  RevenueCase,
  UserProfile,
} from '../types';
import {
  formatHindiDate,
  getLocalDateString,
  printCasesAsOfficialPDF,
  sanitizeStr,
} from '../utils/dateAndExport';
import { ConfirmModal } from './ConfirmModal';
import { ContactsView } from './ContactsView';

interface CaseDetailViewProps {
  ownerId: string;
  profile: UserProfile;
  caseItem: RevenueCase;
  contacts: CaseContact[];
  onBack: () => void;
  onEditCase: (c: RevenueCase) => void;
  onDeleteCase: (c: RevenueCase) => void;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  ownerId,
  profile,
  caseItem,
  contacts,
  onBack,
  onEditCase,
  onDeleteCase,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'diary' | 'details' | 'documents' | 'contacts'>('diary');
  const caseContacts = contacts.filter((c) => c.caseId === caseItem.id);

  // Daily Diary State
  const [entries, setEntries] = useState<DailyDiaryEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [showDiaryForm, setShowDiaryForm] = useState(false);
  const [chronOrder, setChronOrder] = useState<'asc' | 'desc'>('desc');
  const [savingEntry, setSavingEntry] = useState(false);

  const [entryDate, setEntryDate] = useState(getLocalDateString());
  const [proceedings, setProceedings] = useState('');
  const [partyPresent, setPartyPresent] = useState('वादी उपस्थित');
  const [advocatePresent, setAdvocatePresent] = useState('उपस्थित');
  const [oppositePartyPresent, setOppositePartyPresent] = useState('अनुपस्थित');
  const [lekhpalReportStatus, setLekhpalReportStatus] = useState('अपेक्षित नहीं');
  const [kanungoReportStatus, setKanungoReportStatus] = useState('अपेक्षित नहीं');
  const [reportFiled, setReportFiled] = useState(false);
  const [orderPassed, setOrderPassed] = useState(false);
  const [orderDetails, setOrderDetails] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [nextDateWork, setNextDateWork] = useState('');
  const [newCaseStatus, setNewCaseStatus] = useState<CaseStatus>(caseItem.status);

  // Documents State
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('PDF');
  const [docNotes, setDocNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [docError, setDocError] = useState('');
  const [docSuccess, setDocSuccess] = useState('');
  const [useExternalLinkMode, setUseExternalLinkMode] = useState(false);

  // Confirm delete modals
  const [entryToDelete, setEntryToDelete] = useState<DailyDiaryEntry | null>(null);
  const [docToDelete, setDocToDelete] = useState<CaseDocument | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  useEffect(() => {
    setNewCaseStatus(caseItem.status);
  }, [caseItem.status]);

  // Listen to Daily Diary Entries
  useEffect(() => {
    const path = `cases/${caseItem.id}/dailyEntries`;
    const q = query(
      collection(db, 'cases', caseItem.id, 'dailyEntries'),
      where('ownerId', '==', ownerId),
      where('caseId', '==', caseItem.id)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: DailyDiaryEntry[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DailyDiaryEntry, 'id'>),
        }));
        setEntries(list);
        setLoadingEntries(false);
      },
      (err) => {
        setLoadingEntries(false);
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
  }, [caseItem.id, ownerId]);

  // Listen to Case Documents
  useEffect(() => {
    const path = `cases/${caseItem.id}/documents`;
    const q = query(
      collection(db, 'cases', caseItem.id, 'documents'),
      where('ownerId', '==', ownerId),
      where('caseId', '==', caseItem.id)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: CaseDocument[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CaseDocument, 'id'>),
        }));
        setDocuments(list);
        setLoadingDocs(false);
      },
      (err) => {
        setLoadingDocs(false);
        handleFirestoreError(err, OperationType.LIST, path);
      }
    );
    return () => unsub();
  }, [caseItem.id, ownerId]);

  const sortedEntries = [...entries].sort((a, b) => {
    const cmp = a.entryDate.localeCompare(b.entryDate);
    if (cmp !== 0) return chronOrder === 'asc' ? cmp : -cmp;
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return chronOrder === 'asc' ? ta - tb : tb - ta;
  });

  const handleSaveDailyEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanitizeStr(proceedings, 2000)) return;
    setSavingEntry(true);

    try {
      const batch = writeBatch(db);
      const entryRef = doc(collection(db, 'cases', caseItem.id, 'dailyEntries'));
      batch.set(entryRef, {
        ownerId,
        caseId: caseItem.id,
        entryDate: sanitizeStr(entryDate, 20),
        proceedings: sanitizeStr(proceedings, 2000),
        partyPresent: sanitizeStr(partyPresent, 200),
        advocatePresent: sanitizeStr(advocatePresent, 100),
        oppositePartyPresent: sanitizeStr(oppositePartyPresent, 100),
        lekhpalReportStatus: sanitizeStr(lekhpalReportStatus, 120),
        kanungoReportStatus: sanitizeStr(kanungoReportStatus, 120),
        reportFiled,
        orderPassed,
        orderDetails: sanitizeStr(orderDetails, 2000),
        nextDate: sanitizeStr(nextDate, 20),
        nextDateWork: sanitizeStr(nextDateWork, 500),
        createdAt: serverTimestamp(),
      });

      // Automatically sync parent case dates, report flags & status
      const nextStatus: CaseStatus =
        caseItem.status === 'निस्तारित' &&
        newCaseStatus !== 'निस्तारित' &&
        newCaseStatus !== 'अपील'
          ? 'निस्तारित'
          : orderPassed && newCaseStatus === caseItem.status && caseItem.status !== 'निस्तारित'
            ? 'आदेश पारित'
            : newCaseStatus;

      const caseRef = doc(db, 'cases', caseItem.id);
      batch.update(caseRef, {
        previousDate: sanitizeStr(entryDate, 20),
        nextDate: nextDate ? sanitizeStr(nextDate, 20) : caseItem.nextDate,
        status: nextStatus,
        lekhpalReportPending:
          lekhpalReportStatus === 'लंबित' ? true : reportFiled ? false : caseItem.lekhpalReportPending,
        kanungoReportPending:
          kanungoReportStatus === 'लंबित' ? true : reportFiled ? false : caseItem.kanungoReportPending,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      // Reset form
      setProceedings('');
      setOrderDetails('');
      setNextDate('');
      setNextDateWork('');
      setReportFiled(false);
      setOrderPassed(false);
      setShowDiaryForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `cases/${caseItem.id}/dailyEntries`);
    } finally {
      setSavingEntry(false);
    }
  };

  const handleConfirmDeleteEntry = async () => {
    if (!entryToDelete) return;
    setDeletingItem(true);
    try {
      await deleteDoc(doc(db, 'cases', caseItem.id, 'dailyEntries', entryToDelete.id));
      setEntryToDelete(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `cases/${caseItem.id}/dailyEntries/${entryToDelete.id}`
      );
    } finally {
      setDeletingItem(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocError('');
    setDocSuccess('');

    const cleanTitle = sanitizeStr(docTitle, 200);
    if (!cleanTitle) {
      setDocError('कृपया दस्तावेज़ का शीर्षक दर्ज करें।');
      return;
    }

    if (useExternalLinkMode) {
      const cleanUrl = sanitizeStr(externalUrl, 2000);
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        setDocError('कृपया वैध https:// या http:// दस्तावेज़ लिंक दर्ज करें।');
        return;
      }
      setUploadProgress(50);
      try {
        await addDoc(collection(db, 'cases', caseItem.id, 'documents'), {
          ownerId,
          caseId: caseItem.id,
          title: cleanTitle,
          category: docCategory,
          fileName: `${cleanTitle}.link`,
          fileType: 'text/uri-list',
          fileSize: 0,
          downloadUrl: cleanUrl,
          storagePath: '',
          notes: sanitizeStr(docNotes, 500),
          uploadedAt: serverTimestamp(),
        });
        setDocTitle('');
        setDocNotes('');
        setExternalUrl('');
        setUploadProgress(null);
        setDocSuccess('दस्तावेज़ लिंक सफलतापूर्वक संलग्न किया गया।');
      } catch (err) {
        setUploadProgress(null);
        handleFirestoreError(err, OperationType.CREATE, `cases/${caseItem.id}/documents`);
      }
      return;
    }

    if (!selectedFile) {
      setDocError('कृपया अपलोड करने के लिए PDF, इमेज या दस्तावेज़ फ़ाइल चुनें।');
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setDocError('फ़ाइल का आकार 15 MB से अधिक नहीं होना चाहिए।');
      return;
    }

    const safeFileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const path = `users/${ownerId}/cases/${caseItem.id}/${safeFileName}`;
    const fileRef = storageRef(storage, path);

    setUploadProgress(5);
    const uploadTask = uploadBytesResumable(fileRef, selectedFile);

    uploadTask.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploadProgress(pct);
      },
      (err) => {
        setUploadProgress(null);
        const msg = err?.message || '';
        setDocError(
          `Firebase Storage अपलोड विफल रहा (${err.code || 'storage-error'}): कृपया सुनिश्चित करें कि Firebase Console में Storage सक्षम है और storage.rules डिप्लॉय किए गए हैं। तब तक आप "बाहरी लिंक जोड़ें" विकल्प का उपयोग कर सकते हैं। ${msg}`
        );
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'cases', caseItem.id, 'documents'), {
            ownerId,
            caseId: caseItem.id,
            title: cleanTitle,
            category: docCategory,
            fileName: sanitizeStr(selectedFile.name, 255),
            fileType: sanitizeStr(selectedFile.type || 'application/octet-stream', 100),
            fileSize: selectedFile.size,
            downloadUrl: sanitizeStr(url, 2000),
            storagePath: sanitizeStr(path, 500),
            notes: sanitizeStr(docNotes, 500),
            uploadedAt: serverTimestamp(),
          });
          setDocTitle('');
          setDocNotes('');
          setSelectedFile(null);
          setUploadProgress(null);
          setDocSuccess('दस्तावेज़ सफलतापूर्वक अपलोड और केस से संलग्न किया गया।');
        } catch (err) {
          setUploadProgress(null);
          handleFirestoreError(err, OperationType.CREATE, `cases/${caseItem.id}/documents`);
        }
      }
    );
  };

  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    setDeletingItem(true);
    try {
      if (docToDelete.storagePath) {
        try {
          await deleteObject(storageRef(storage, docToDelete.storagePath));
        } catch {
          // If object already removed in storage, still remove metadata record
        }
      }
      await deleteDoc(doc(db, 'cases', caseItem.id, 'documents', docToDelete.id));
      setDocToDelete(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `cases/${caseItem.id}/documents/${docToDelete.id}`
      );
    } finally {
      setDeletingItem(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Dossier Header */}
      <div className="bg-[#0B1D3A] text-white rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            केस डायरी पर वापस
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                printCasesAsOfficialPDF(
                  [caseItem],
                  `वाद विवरण — ${caseItem.caseNumber}`,
                  caseItem.courtName,
                  profile
                )
              }
              className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#E5C665]" />
              प्रिंट
            </button>
            <button
              type="button"
              onClick={() => onEditCase(caseItem)}
              className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#E5C665]" />
              संपादित
            </button>
            <button
              type="button"
              onClick={() => onDeleteCase(caseItem)}
              className="min-h-[40px] px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-100 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              हटाएं
            </button>
          </div>
        </div>

        <p className="text-xs text-[#E5C665] font-mono-num">
          वाद संख्या: {caseItem.caseNumber}
          {caseItem.computerizedCaseNumber ? ` · कम्प्यूटरीकृत सं.: ${caseItem.computerizedCaseNumber}` : ''}
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-white mt-1 leading-snug">
          {caseItem.plaintiffName} <span className="font-normal text-slate-300">बनाम</span>{' '}
          {caseItem.defendantName || '—'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 mt-1.5">
          {caseItem.courtName}
          {caseItem.village ? ` · ग्राम ${caseItem.village}` : ''}
          {caseItem.gataNumber ? ` · गाटा ${caseItem.gataNumber}` : ''}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/15 text-xs">
          <div>
            <p className="text-slate-400">वर्तमान स्थिति</p>
            <p className="text-sm font-bold text-[#E5C665] mt-0.5">{caseItem.status}</p>
          </div>
          <div>
            <p className="text-slate-400">अगली तारीख (पेशी)</p>
            <p className="text-sm font-bold font-mono-num text-white mt-0.5">
              {formatHindiDate(caseItem.nextDate)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">पिछली तारीख</p>
            <p className="text-sm font-semibold font-mono-num text-slate-200 mt-0.5">
              {formatHindiDate(caseItem.previousDate)}
            </p>
          </div>
          <div>
            <p className="text-slate-400">धारा / विषय</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5 truncate">
              {caseItem.section || caseItem.subject || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('diary')}
          className={`flex-1 min-h-[42px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeSubTab === 'diary'
              ? 'bg-[#0B1D3A] text-white'
              : 'text-slate-600 hover:text-[#0B1D3A]'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          दैनिक केस डायरी ({entries.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('details')}
          className={`flex-1 min-h-[42px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeSubTab === 'details'
              ? 'bg-[#0B1D3A] text-white'
              : 'text-slate-600 hover:text-[#0B1D3A]'
          }`}
        >
          <FileText className="w-4 h-4" />
          संपूर्ण वाद विवरण
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('documents')}
          className={`flex-1 min-h-[42px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeSubTab === 'documents'
              ? 'bg-[#0B1D3A] text-white'
              : 'text-slate-600 hover:text-[#0B1D3A]'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          दस्तावेज़ ({documents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('contacts')}
          className={`flex-1 min-h-[42px] px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            activeSubTab === 'contacts'
              ? 'bg-[#0B1D3A] text-white'
              : 'text-slate-600 hover:text-[#0B1D3A]'
          }`}
        >
          <Users className="w-4 h-4" />
          संपर्क ({caseContacts.length})
        </button>
      </div>

      {/* TAB 1: DAILY DIARY UPDATE */}
      {activeSubTab === 'diary' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-[#0B1D3A]">दैनिक कार्यवाही इतिहास</h3>
              <p className="text-xs text-slate-500">
                सभी पूर्व प्रविष्टियाँ स्थायी रूप से तिथिवार सुरक्षित रहती हैं
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChronOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
                className="min-h-[42px] px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
              >
                क्रम: {chronOrder === 'desc' ? 'नवीनतम पहले' : 'पुरानी पहले'}
              </button>
              <button
                type="button"
                onClick={() => setShowDiaryForm((v) => !v)}
                className="min-h-[42px] px-4 rounded-xl bg-[#C9A227] text-[#071326] text-xs sm:text-sm font-bold hover:bg-[#D9B53B] transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                दैनिक प्रविष्टि जोड़ें
              </button>
            </div>
          </div>

          {/* ADD DAILY ENTRY FORM */}
          {showDiaryForm && (
            <form
              onSubmit={handleSaveDailyEntry}
              className="bg-white rounded-2xl border border-[#0B1D3A]/25 p-5 sm:p-6 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="text-base font-bold text-[#0B1D3A]">
                  नई दैनिक कार्यवाही प्रविष्टि
                </h4>
                <button
                  type="button"
                  onClick={() => setShowDiaryForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  बंद करें
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    आज की तारीख <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono-num"
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
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    मुकदमे की अद्यतन स्थिति
                  </label>
                  <select
                    value={newCaseStatus}
                    onChange={(e) => setNewCaseStatus(e.target.value as CaseStatus)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    {CASE_STATUSES.map((st) => (
                      <option
                        key={st}
                        value={st}
                        disabled={
                          caseItem.status === 'निस्तारित' &&
                          st !== 'निस्तारित' &&
                          st !== 'अपील'
                        }
                      >
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  आज की कार्यवाही <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={2000}
                  value={proceedings}
                  onChange={(e) => setProceedings(e.target.value)}
                  placeholder="आज न्यायालय में क्या कार्यवाही हुई, पत्रावली पेश हुई, बहस हुई या समय माँगा गया..."
                  className="w-full p-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    किस पक्ष की उपस्थिति हुई
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={partyPresent}
                    onChange={(e) => setPartyPresent(e.target.value)}
                    placeholder="वादी / प्रतिवादी / दोनों पक्ष / कोई नहीं"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    अधिवक्ता की उपस्थिति
                  </label>
                  <select
                    value={advocatePresent}
                    onChange={(e) => setAdvocatePresent(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="उपस्थित">उपस्थित</option>
                    <option value="अनुपस्थित">अनुपस्थित</option>
                    <option value="स्थगन प्रार्थना पत्र दिया गया">स्थगन प्रार्थना पत्र दिया गया</option>
                    <option value="अधिवक्ता हड़ताल / कार्य से विरत">अधिवक्ता कार्य से विरत</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    विपक्षी की उपस्थिति
                  </label>
                  <select
                    value={oppositePartyPresent}
                    onChange={(e) => setOppositePartyPresent(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="उपस्थित">उपस्थित</option>
                    <option value="अनुपस्थित">अनुपस्थित</option>
                    <option value="अधिवक्ता के माध्यम से उपस्थित">अधिवक्ता के माध्यम से उपस्थित</option>
                    <option value="नोटिस अप्राप्त">नोटिस अप्राप्त</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    लेखपाल रिपोर्ट की स्थिति
                  </label>
                  <select
                    value={lekhpalReportStatus}
                    onChange={(e) => setLekhpalReportStatus(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="अपेक्षित नहीं">अपेक्षित नहीं</option>
                    <option value="लंबित">लंबित</option>
                    <option value="दाखिल हुई">दाखिल हुई</option>
                    <option value="पुनः आख्या तलब">पुनः आख्या तलब</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    कानूनगो रिपोर्ट की स्थिति
                  </label>
                  <select
                    value={kanungoReportStatus}
                    onChange={(e) => setKanungoReportStatus(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                  >
                    <option value="अपेक्षित नहीं">अपेक्षित नहीं</option>
                    <option value="लंबित">लंबित</option>
                    <option value="दाखिल हुई">दाखिल हुई</option>
                    <option value="पुनः आख्या तलब">पुनः आख्या तलब</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-1">
                <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={reportFiled}
                    onChange={(e) => setReportFiled(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#0B1D3A]"
                  />
                  आख्या दाखिल हुई
                </label>
                <label className="inline-flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={orderPassed}
                    onChange={(e) => setOrderPassed(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#0B1D3A]"
                  />
                  आदेश पारित हुआ
                </label>
              </div>

              {orderPassed && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    आदेश का विवरण
                  </label>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={orderDetails}
                    onChange={(e) => setOrderDetails(e.target.value)}
                    placeholder="न्यायालय द्वारा पारित आदेश का संक्षिप्त विवरण दर्ज करें..."
                    className="w-full p-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  अगली तारीख पर होने वाला कार्य
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={nextDateWork}
                  onChange={(e) => setNextDateWork(e.target.value)}
                  placeholder="उदा. वादी साक्ष्य / प्रतिवादी जवाब / लेखपाल आख्या / अंतिम बहस"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiaryForm(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm text-slate-700 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={savingEntry}
                  className="min-h-[44px] px-6 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] cursor-pointer disabled:opacity-60"
                >
                  {savingEntry ? 'सहेजा जा रहा है...' : 'प्रविष्टि सहेजें'}
                </button>
              </div>
            </form>
          )}

          {/* Chronological Daily Entries List */}
          {loadingEntries ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              दैनिक डायरी लोड हो रही है...
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <p className="text-base font-bold text-[#0B1D3A]">
                अभी कोई दैनिक कार्यवाही दर्ज नहीं है
              </p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                प्रत्येक पेशी के बाद "दैनिक प्रविष्टि जोड़ें" पर क्लिक करके कार्यवाही, उपस्थिति, आख्या व अगली तारीख रिकॉर्ड करें।
              </p>
              <button
                type="button"
                onClick={() => setShowDiaryForm(true)}
                className="min-h-[44px] px-5 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132C54] cursor-pointer"
              >
                प्रथम दैनिक प्रविष्टि जोड़ें
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedEntries.map((entry, index) => (
                <article
                  key={entry.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 text-sm">
                      <Calendar className="w-4 h-4 text-[#A17C14]" />
                      <span className="font-mono-num font-bold text-[#0B1D3A]">
                        {formatHindiDate(entry.entryDate)}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500">
                        प्रविष्टि #{chronOrder === 'desc' ? sortedEntries.length - index : index + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {entry.nextDate && (
                        <span className="text-xs font-semibold text-[#0B1D3A] font-mono-num">
                          अगली तारीख: {formatHindiDate(entry.nextDate)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setEntryToDelete(entry)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        aria-label="प्रविष्टि हटाएं"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">आज की कार्यवाही</p>
                    <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
                      {entry.proceedings}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 rounded-xl p-3.5">
                    <div>
                      <span className="text-slate-500">पक्ष उपस्थिति: </span>
                      <strong className="text-slate-800">{entry.partyPresent || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">अधिवक्ता: </span>
                      <strong className="text-slate-800">{entry.advocatePresent || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">विपक्षी: </span>
                      <strong className="text-slate-800">{entry.oppositePartyPresent || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">लेखपाल रिपोर्ट: </span>
                      <strong className="text-slate-800">{entry.lekhpalReportStatus || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">कानूनगो रिपोर्ट: </span>
                      <strong className="text-slate-800">{entry.kanungoReportStatus || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">आख्या दाखिल: </span>
                      <strong className={entry.reportFiled ? 'text-emerald-700' : 'text-slate-700'}>
                        {entry.reportFiled ? 'हाँ' : 'नहीं'}
                      </strong>
                    </div>
                  </div>

                  {entry.orderPassed && (
                    <div className="p-3.5 rounded-xl bg-[#FBF5E2] border border-[#E5C665]/60 text-xs">
                      <p className="font-bold text-[#0B1D3A] mb-1">आदेश पारित हुआ</p>
                      <p className="text-slate-800 leading-relaxed">
                        {entry.orderDetails || 'आदेश पत्रावली में संलग्न है।'}
                      </p>
                    </div>
                  )}

                  {entry.nextDateWork && (
                    <p className="text-xs text-slate-700">
                      <span className="font-semibold text-[#0B1D3A]">अगली तारीख का कार्य: </span>
                      {entry.nextDateWork}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPLETE CASE DETAILS SHEET */}
      {activeSubTab === 'details' && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-[#0B1D3A] mb-4 pb-3 border-b border-slate-100">
            राजस्व वाद पत्रावली विवरण
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            {[
              ['वाद संख्या', caseItem.caseNumber],
              ['कम्प्यूटरीकृत वाद संख्या', caseItem.computerizedCaseNumber || '—'],
              ['न्यायालय का नाम', caseItem.courtName],
              ['पीठासीन अधिकारी', caseItem.presidingOfficer || '—'],
              ['वादी का नाम', caseItem.plaintiffName],
              ['प्रतिवादी का नाम', caseItem.defendantName || '—'],
              ['अधिवक्ता का नाम', caseItem.advocateName || '—'],
              ['मोबाइल नंबर', caseItem.clientMobile || '—'],
              ['ग्राम', caseItem.village || '—'],
              ['परगना', caseItem.pargana || '—'],
              ['तहसील', caseItem.tehsil || '—'],
              ['जिला', caseItem.district || '—'],
              ['गाटा संख्या', caseItem.gataNumber || '—'],
              ['मुकदमे की धारा', caseItem.section || '—'],
              ['मुकदमे का विषय', caseItem.subject || '—'],
              ['दाखिल होने की तारीख', formatHindiDate(caseItem.filingDate)],
              ['पिछली तारीख', formatHindiDate(caseItem.previousDate)],
              ['अगली तारीख', formatHindiDate(caseItem.nextDate)],
              ['वर्तमान स्थिति', caseItem.status],
              ['लेखपाल रिपोर्ट', caseItem.lekhpalReportPending ? 'लंबित' : 'लंबित नहीं'],
              ['कानूनगो रिपोर्ट', caseItem.kanungoReportPending ? 'लंबित' : 'लंबित नहीं'],
            ].map(([label, val]) => (
              <div key={label} className="pb-2.5 border-b border-slate-100">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="font-semibold text-[#0B1D3A] mt-0.5 break-words">{val}</dd>
              </div>
            ))}
          </dl>
          {caseItem.notes && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1">विशेष टिप्पणी</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {caseItem.notes}
              </p>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: DOCUMENT MANAGEMENT */}
      {activeSubTab === 'documents' && (
        <div className="space-y-5">
          <form
            onSubmit={handleUploadDocument}
            className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-[#0B1D3A]">नया दस्तावेज़ अपलोड करें</h3>
                <p className="text-xs text-slate-500">
                  PDF, न्यायालय आदेश, वाद पत्र, खतौनी, खसरा, नक्शा, लेखपाल रिपोर्ट आदि
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUseExternalLinkMode((v) => !v);
                  setDocError('');
                }}
                className="text-xs font-semibold text-[#9A7410] hover:text-[#0B1D3A] inline-flex items-center gap-1 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                {useExternalLinkMode ? 'फ़ाइल अपलोड करें' : 'या बाहरी लिंक संलग्न करें'}
              </button>
            </div>

            {docError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
                {docError}
              </div>
            )}
            {docSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{docSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  दस्तावेज़ का शीर्षक <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="उदा. अद्यतन खतौनी 1430-1435 फसली"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  दस्तावेज़ श्रेणी
                </label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {useExternalLinkMode ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  दस्तावेज़ URL लिंक (Google Drive / सरकारी पोर्टल PDF) <span className="text-red-600">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  फ़ाइल चुनें (PDF, JPG, PNG, DOC — अधिकतम 15 MB) <span className="text-red-600">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*,.doc,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0B1D3A] file:text-white hover:file:bg-[#132C54] file:cursor-pointer border border-slate-300 rounded-xl p-1.5"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                टिप्पणी (वैकल्पिक)
              </label>
              <input
                type="text"
                maxLength={500}
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                placeholder="दस्तावेज़ के बारे में संक्षिप्त जानकारी..."
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            {uploadProgress !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>अपलोड हो रहा है...</span>
                  <span className="font-mono-num font-semibold">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C9A227] transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={uploadProgress !== null}
                className="min-h-[44px] px-5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Upload className="w-4 h-4 text-[#E5C665]" />
                {uploadProgress !== null ? 'अपलोड जारी...' : 'दस्तावेज़ संलग्न करें'}
              </button>
            </div>
          </form>

          {/* Attached Documents List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <h4 className="text-base font-bold text-[#0B1D3A] mb-4">
              संलग्न दस्तावेज़ सूची ({documents.length})
            </h4>

            {loadingDocs ? (
              <p className="text-xs text-slate-500 py-6 text-center">दस्तावेज़ लोड हो रहे हैं...</p>
            ) : documents.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center bg-slate-50 rounded-xl">
                इस मुकदमे के साथ अभी कोई दस्तावेज़ संलग्न नहीं है।
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((docItem) => (
                  <div
                    key={docItem.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0B1D3A] truncate">
                        {docItem.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {docItem.category} · {docItem.fileName}
                        {docItem.fileSize > 0
                          ? ` · ${(docItem.fileSize / 1024).toFixed(0)} KB`
                          : ''}
                      </p>
                      {docItem.notes && (
                        <p className="text-xs text-slate-600 mt-1">{docItem.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {docItem.downloadUrl && (
                        <a
                          href={docItem.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[38px] px-3 rounded-lg bg-slate-100 text-[#0B1D3A] text-xs font-semibold hover:bg-slate-200 inline-flex items-center gap-1.5"
                        >
                          {docItem.storagePath ? (
                            <Download className="w-3.5 h-3.5" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                          खोलें
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setDocToDelete(docItem)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-red-700 hover:bg-red-50 cursor-pointer"
                        aria-label="दस्तावेज़ हटाएं"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CASE CONTACTS */}
      {activeSubTab === 'contacts' && (
        <ContactsView
          ownerId={ownerId}
          contacts={contacts}
          cases={[caseItem]}
          lockedCase={caseItem}
        />
      )}

      {/* Confirm Delete Modals */}
      <ConfirmModal
        open={Boolean(entryToDelete)}
        title="दैनिक प्रविष्टि हटाएं?"
        message="क्या आप वाकई इस दैनिक कार्यवाही प्रविष्टि को स्थायी रूप से हटाना चाहते हैं?"
        loading={deletingItem}
        onConfirm={handleConfirmDeleteEntry}
        onCancel={() => setEntryToDelete(null)}
      />

      <ConfirmModal
        open={Boolean(docToDelete)}
        title="दस्तावेज़ हटाएं?"
        message={`क्या आप "${docToDelete?.title || ''}" दस्तावेज़ को इस मुकदमे से स्थायी रूप से हटाना चाहते हैं?`}
        loading={deletingItem}
        onConfirm={handleConfirmDeleteDoc}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  );
};
