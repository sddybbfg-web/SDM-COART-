import React, { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Briefcase,
  Check,
  Copy,
  Edit3,
  Mail,
  MapPin,
  Phone,
  PhoneCall,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CaseContact,
  CONTACT_ROLES,
  ContactRole,
  RevenueCase,
} from '../types';
import { sanitizeStr } from '../utils/dateAndExport';
import { ConfirmModal } from './ConfirmModal';

interface ContactsViewProps {
  ownerId: string;
  contacts: CaseContact[];
  cases: RevenueCase[];
  lockedCase?: RevenueCase;
  onSelectCase?: (c: RevenueCase) => void;
}

function formatTelHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  return `tel:${cleaned}`;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  ownerId,
  contacts,
  cases,
  lockedCase,
  onSelectCase,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<ContactRole | 'all'>('all');
  const [caseFilter, setCaseFilter] = useState(lockedCase ? lockedCase.id : '');

  // Form Modal / Panel State
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<CaseContact | null>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState<ContactRole>('पक्षकार');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [barRegOrRelation, setBarRegOrRelation] = useState('');
  const [address, setAddress] = useState('');
  const [linkedCaseId, setLinkedCaseId] = useState(lockedCase ? lockedCase.id : '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Copy & Delete state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contactToDelete, setContactToDelete] = useState<CaseContact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const scopedContacts = useMemo(() => {
    if (lockedCase) {
      return contacts.filter((c) => c.caseId === lockedCase.id);
    }
    return contacts;
  }, [contacts, lockedCase]);

  const roleCounts = useMemo(() => {
    const counts = {
      all: scopedContacts.length,
      'विपक्षी अधिवक्ता': 0,
      'पक्षकार': 0,
      'गवाह': 0,
      'अन्य': 0,
    };
    for (const c of scopedContacts) {
      if (c.role in counts) {
        counts[c.role]++;
      }
    }
    return counts;
  }, [scopedContacts]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedContacts
      .filter((c) => {
        if (roleFilter !== 'all' && c.role !== roleFilter) return false;
        if (!lockedCase && caseFilter && c.caseId !== caseFilter) return false;
        if (q) {
          const hay = [
            c.name,
            c.role,
            c.phone,
            c.alternatePhone,
            c.email,
            c.barRegOrRelation,
            c.address,
            c.caseNumber,
            c.notes,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'hi'));
  }, [scopedContacts, roleFilter, caseFilter, lockedCase, searchQuery]);

  const openCreateForm = (presetRole?: ContactRole) => {
    setEditingContact(null);
    setName('');
    setRole(presetRole || 'पक्षकार');
    setPhone('');
    setAlternatePhone('');
    setEmail('');
    setBarRegOrRelation('');
    setAddress('');
    setLinkedCaseId(lockedCase ? lockedCase.id : '');
    setNotes('');
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (contact: CaseContact) => {
    setEditingContact(contact);
    setName(contact.name);
    setRole(contact.role);
    setPhone(contact.phone);
    setAlternatePhone(contact.alternatePhone || '');
    setEmail(contact.email || '');
    setBarRegOrRelation(contact.barRegOrRelation || '');
    setAddress(contact.address || '');
    setLinkedCaseId(lockedCase ? lockedCase.id : contact.caseId || '');
    setNotes(contact.notes || '');
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = sanitizeStr(name, 120);
    const cleanPhone = sanitizeStr(phone.replace(/[^\d+\-\s]/g, ''), 20);
    const digitCount = cleanPhone.replace(/\D/g, '').length;

    if (!cleanName) {
      setFormError('कृपया संपर्क व्यक्ति का नाम दर्ज करें।');
      return;
    }
    if (digitCount < 7) {
      setFormError('कृपया वैध मोबाइल / फ़ोन नंबर दर्ज करें।');
      return;
    }

    const effectiveCaseId = lockedCase ? lockedCase.id : linkedCaseId;
    const matchedCase = effectiveCaseId
      ? cases.find((c) => c.id === effectiveCaseId)
      : undefined;

    const payload = {
      name: cleanName,
      role,
      phone: cleanPhone,
      alternatePhone: sanitizeStr(alternatePhone.replace(/[^\d+\-\s]/g, ''), 20),
      email: sanitizeStr(email, 160),
      address: sanitizeStr(address, 400),
      barRegOrRelation: sanitizeStr(barRegOrRelation, 160),
      caseId: matchedCase ? sanitizeStr(matchedCase.id, 128) : '',
      caseNumber: matchedCase ? sanitizeStr(matchedCase.caseNumber, 100) : '',
      notes: sanitizeStr(notes, 1000),
      updatedAt: serverTimestamp(),
    };

    setSaving(true);
    try {
      if (editingContact) {
        await updateDoc(doc(db, 'contacts', editingContact.id), payload);
      } else {
        await addDoc(collection(db, 'contacts'), {
          ...payload,
          ownerId,
          createdAt: serverTimestamp(),
        });
      }
      setShowForm(false);
      setEditingContact(null);
    } catch (err) {
      handleFirestoreError(
        err,
        editingContact ? OperationType.UPDATE : OperationType.CREATE,
        editingContact ? `contacts/${editingContact.id}` : 'contacts'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'contacts', contactToDelete.id));
      setContactToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `contacts/${contactToDelete.id}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyPhone = async (contact: CaseContact) => {
    try {
      await navigator.clipboard.writeText(contact.phone);
      setCopiedId(contact.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // clipboard unavailable
    }
  };

  const getRoleAccentColor = (r: ContactRole) => {
    if (r === 'विपक्षी अधिवक्ता') return 'text-[#0B1D3A]';
    if (r === 'पक्षकार') return 'text-emerald-700';
    if (r === 'गवाह') return 'text-[#9A7410]';
    return 'text-slate-600';
  };

  return (
    <div className="space-y-5">
      {/* Compact KPI Row (Full Directory Mode) */}
      {!lockedCase && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'all' as const, label: 'कुल संपर्क', value: roleCounts.all, color: 'text-[#0B1D3A]' },
            {
              key: 'विपक्षी अधिवक्ता' as const,
              label: 'विपक्षी अधिवक्ता',
              value: roleCounts['विपक्षी अधिवक्ता'],
              color: 'text-indigo-800',
            },
            {
              key: 'पक्षकार' as const,
              label: 'पक्षकार / मुवक्किल',
              value: roleCounts['पक्षकार'],
              color: 'text-emerald-800',
            },
            {
              key: 'गवाह' as const,
              label: 'गवाह',
              value: roleCounts['गवाह'],
              color: 'text-[#9A7410]',
            },
          ].map((stat) => (
            <button
              key={stat.key}
              type="button"
              onClick={() => setRoleFilter(stat.key)}
              className={`bg-white rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                roleFilter === stat.key
                  ? 'border-[#0B1D3A] shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className={`text-2xl font-bold font-mono-num ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-xs text-slate-600 font-medium mt-1 truncate">
                {stat.label}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Search, Filter & Add Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-[#0B1D3A]">
              {lockedCase
                ? `वाद सं. ${lockedCase.caseNumber} से जुड़े संपर्क`
                : 'संपर्क निर्देशिका (विपक्षी अधिवक्ता, पक्षकार एवं गवाह)'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              सीधे एक क्लिक पर कॉल करें · कुल{' '}
              <span className="font-mono-num font-semibold text-[#0B1D3A]">
                {filteredContacts.length}
              </span>{' '}
              संपर्क
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreateForm()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 text-[#E5C665]" />
            नया संपर्क जोड़ें
          </button>
        </div>

        {/* Search + Case Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="खोजें: नाम, मोबाइल नंबर, वाद संख्या, चैंबर या पता..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A] focus:ring-2 focus:ring-[#0B1D3A]/10"
            />
          </div>

          {!lockedCase && (
            <select
              value={caseFilter}
              onChange={(e) => setCaseFilter(e.target.value)}
              aria-label="मुकदमे के अनुसार फ़िल्टर"
              className="sm:w-64 h-11 px-3 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-[#0B1D3A]"
            >
              <option value="">सभी मुकदमे (सामान्य सहित)</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  वाद सं. {c.caseNumber} — {c.plaintiffName}
                </option>
              ))}
            </select>
          )}

          {(searchQuery || roleFilter !== 'all' || (!lockedCase && caseFilter)) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
                if (!lockedCase) setCaseFilter('');
              }}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-[#0B1D3A] text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              रीसेट
            </button>
          )}
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-[#0B1D3A] text-white'
                : 'bg-slate-100 text-slate-600 hover:text-[#0B1D3A]'
            }`}
          >
            सभी ({roleCounts.all})
          </button>
          {CONTACT_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                roleFilter === r
                  ? 'bg-[#0B1D3A] text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-[#0B1D3A]'
              }`}
            >
              {r} ({roleCounts[r]})
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List / Empty State */}
      {filteredContacts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#0B1D3A] flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-base font-bold text-[#0B1D3A]">कोई संपर्क नहीं मिला</p>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5">
            {scopedContacts.length === 0
              ? 'विपक्षी अधिवक्ताओं, पक्षकारों और गवाहों के मोबाइल नंबर व विवरण यहाँ सहेजें ताकि कोर्ट से सीधे एक टैप में कॉल कर सकें।'
              : 'कृपया खोज शब्द या श्रेणी फ़िल्टर बदलकर पुनः प्रयास करें।'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => openCreateForm('विपक्षी अधिवक्ता')}
              className="min-h-[42px] px-4 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132C54] cursor-pointer"
            >
              विपक्षी अधिवक्ता जोड़ें
            </button>
            <button
              type="button"
              onClick={() => openCreateForm('पक्षकार')}
              className="min-h-[42px] px-4 rounded-xl border border-slate-300 bg-white text-[#0B1D3A] text-xs sm:text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              पक्षकार जोड़ें
            </button>
            <button
              type="button"
              onClick={() => openCreateForm('गवाह')}
              className="min-h-[42px] px-4 rounded-xl border border-slate-300 bg-white text-[#0B1D3A] text-xs sm:text-sm font-semibold hover:bg-slate-50 cursor-pointer"
            >
              गवाह जोड़ें
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop High-Density Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0B1D3A] text-white text-xs font-semibold">
                    <th className="py-3.5 px-4">नाम एवं श्रेणी</th>
                    <th className="py-3.5 px-4">मोबाइल नंबर (क्लिक-टू-कॉल)</th>
                    <th className="py-3.5 px-4">संबंधित मुकदमा</th>
                    <th className="py-3.5 px-4">चैंबर / संबंध / पता</th>
                    <th className="py-3.5 px-4 text-right">कार्यवाही</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredContacts.map((contact) => {
                    const linkedCase = contact.caseId
                      ? cases.find((c) => c.id === contact.caseId)
                      : undefined;
                    return (
                      <tr key={contact.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 align-top">
                          <p className="font-bold text-[#0B1D3A]">{contact.name}</p>
                          <p className={`text-xs font-semibold mt-0.5 ${getRoleAccentColor(contact.role)}`}>
                            {contact.role}
                          </p>
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#0B1D3A] mt-1"
                            >
                              <Mail className="w-3 h-3" />
                              {contact.email}
                            </a>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <a
                                href={formatTelHref(contact.phone)}
                                className="inline-flex items-center gap-1.5 font-mono-num font-bold text-[#0B1D3A] hover:text-emerald-700 transition-colors whitespace-nowrap"
                                title="सीधे कॉल करें"
                              >
                                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                                {contact.phone}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopyPhone(contact)}
                                className="p-1 rounded text-slate-400 hover:text-[#0B1D3A] cursor-pointer"
                                title="नंबर कॉपी करें"
                                aria-label="नंबर कॉपी करें"
                              >
                                {copiedId === contact.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {contact.alternatePhone && (
                              <a
                                href={formatTelHref(contact.alternatePhone)}
                                className="inline-flex items-center gap-1.5 text-xs font-mono-num text-slate-600 hover:text-emerald-700 whitespace-nowrap"
                              >
                                <Phone className="w-3 h-3 text-slate-400" />
                                {contact.alternatePhone} (वैकल्पिक)
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          {linkedCase && onSelectCase ? (
                            <button
                              type="button"
                              onClick={() => onSelectCase(linkedCase)}
                              className="text-left group cursor-pointer"
                            >
                              <p className="text-xs font-mono-num font-bold text-[#0B1D3A] group-hover:underline">
                                वाद सं. {linkedCase.caseNumber}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                                {linkedCase.plaintiffName} बनाम {linkedCase.defendantName || '—'}
                              </p>
                            </button>
                          ) : contact.caseNumber ? (
                            <span className="text-xs font-mono-num text-slate-700">
                              वाद सं. {contact.caseNumber}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">सामान्य संपर्क</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-top text-xs text-slate-600 max-w-[260px]">
                          {contact.barRegOrRelation && (
                            <p className="font-medium text-slate-800">{contact.barRegOrRelation}</p>
                          )}
                          {contact.address && (
                            <p className="text-slate-500 mt-0.5">{contact.address}</p>
                          )}
                          {contact.notes && (
                            <p className="text-slate-500 italic mt-1 line-clamp-2">{contact.notes}</p>
                          )}
                          {!contact.barRegOrRelation && !contact.address && !contact.notes && '—'}
                        </td>

                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={formatTelHref(contact.phone)}
                              className="min-h-[36px] px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              कॉल करें
                            </a>
                            <button
                              type="button"
                              onClick={() => openEditForm(contact)}
                              className="p-2 rounded-lg text-slate-600 hover:text-[#9A7410] hover:bg-amber-50 cursor-pointer"
                              title="संपादित करें"
                              aria-label="संपर्क संपादित करें"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setContactToDelete(contact)}
                              className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                              title="हटाएं"
                              aria-label="संपर्क हटाएं"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Touch-First Contact Cards */}
          <div className="lg:hidden space-y-3">
            {filteredContacts.map((contact) => {
              const linkedCase = contact.caseId
                ? cases.find((c) => c.id === contact.caseId)
                : undefined;

              return (
                <article
                  key={contact.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${getRoleAccentColor(contact.role)}`}>
                        {contact.role}
                        {contact.caseNumber ? ` · वाद सं. ${contact.caseNumber}` : ''}
                      </p>
                      <h4 className="text-base font-bold text-[#0B1D3A] mt-0.5 leading-snug">
                        {contact.name}
                      </h4>
                      <p className="text-sm font-mono-num font-semibold text-slate-800 mt-1">
                        {contact.phone}
                        {contact.alternatePhone ? ` / ${contact.alternatePhone}` : ''}
                      </p>
                    </div>

                    <a
                      href={formatTelHref(contact.phone)}
                      className="min-h-[44px] px-3.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                    >
                      <PhoneCall className="w-4 h-4" />
                      कॉल करें
                    </a>
                  </div>

                  {(contact.barRegOrRelation || contact.address || contact.email || contact.notes) && (
                    <div className="text-xs text-slate-600 space-y-1">
                      {contact.barRegOrRelation && (
                        <p className="flex items-center gap-1.5 text-slate-800 font-medium">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{contact.barRegOrRelation}</span>
                        </p>
                      )}
                      {contact.address && (
                        <p className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{contact.address}</span>
                        </p>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#0B1D3A]"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{contact.email}</span>
                        </a>
                      )}
                      {contact.notes && (
                        <p className="text-slate-500 pt-0.5">{contact.notes}</p>
                      )}
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {contact.alternatePhone && (
                        <a
                          href={formatTelHref(contact.alternatePhone)}
                          className="min-h-[38px] px-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          वैकल्पिक कॉल
                        </a>
                      )}
                      {linkedCase && onSelectCase && !lockedCase && (
                        <button
                          type="button"
                          onClick={() => onSelectCase(linkedCase)}
                          className="min-h-[38px] px-3 rounded-lg bg-slate-100 text-[#0B1D3A] text-xs font-semibold cursor-pointer"
                        >
                          मुकदमा खोलें
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(contact)}
                        className="min-h-[38px] px-2.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === contact.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedId === contact.id ? 'कॉपी' : 'कॉपी'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(contact)}
                        className="min-h-[38px] px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                      >
                        संपादित
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactToDelete(contact)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-red-700 hover:bg-red-50 cursor-pointer"
                        aria-label="संपर्क हटाएं"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Contact Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !saving && setShowForm(false)}
        >
          <div
            className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#0B1D3A] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-[#E5C665]" />
                <h3 className="text-base font-bold">
                  {editingContact ? 'संपर्क विवरण संपादित करें' : 'नया संपर्क जोड़ें'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !saving && setShowForm(false)}
                className="min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer"
                aria-label="बंद करें"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="p-6 space-y-4 max-h-[78vh] overflow-y-auto"
            >
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {formError}
                </div>
              )}

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
                    placeholder="उदा. एडवोकेट सुरेश त्रिपाठी"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    संपर्क श्रेणी <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as ContactRole)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#0B1D3A]"
                  >
                    {CONTACT_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    मुख्य मोबाइल नंबर <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={20}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    वैकल्पिक मोबाइल नंबर
                  </label>
                  <input
                    type="tel"
                    maxLength={20}
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    placeholder="वैकल्पिक नंबर (यदि हो)"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    चैंबर / बार पंजीकरण / वाद से संबंध
                  </label>
                  <input
                    type="text"
                    maxLength={160}
                    value={barRegOrRelation}
                    onChange={(e) => setBarRegOrRelation(e.target.value)}
                    placeholder={
                      role === 'विपक्षी अधिवक्ता'
                        ? 'उदा. चैंबर नं. 18, तहसील सदर'
                        : role === 'गवाह'
                          ? 'उदा. वादी पक्ष के मुख्य गवाह (पड़ोसी)'
                          : 'उदा. वादी / सह-खातेदार'
                    }
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ईमेल (वैकल्पिक)
                  </label>
                  <input
                    type="email"
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                  />
                </div>
              </div>

              {!lockedCase && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    संबंधित मुकदमा (वैकल्पिक)
                  </label>
                  <select
                    value={linkedCaseId}
                    onChange={(e) => setLinkedCaseId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#0B1D3A]"
                  >
                    <option value="">सामान्य संपर्क (किसी विशिष्ट वाद से नहीं)</option>
                    {cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        वाद सं. {c.caseNumber} — {c.plaintiffName} बनाम {c.defendantName || '—'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  पता / ग्राम / तहसील
                </label>
                <input
                  type="text"
                  maxLength={400}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="पूरा पता या ग्राम का नाम..."
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  विशेष टिप्पणी / नोट्स
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="संपर्क से जुड़ी कोई आवश्यक जानकारी..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm text-slate-700 cursor-pointer"
                >
                  रद्द करें
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-6 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4 text-[#E5C665]" />
                  {saving ? 'सहेज रहे हैं...' : editingContact ? 'अपडेट करें' : 'संपर्क सहेजें'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(contactToDelete)}
        title="संपर्क हटाएं?"
        message={`क्या आप वाकई "${contactToDelete?.name || ''}" (${contactToDelete?.phone || ''}) को अपनी संपर्क निर्देशिका से स्थायी रूप से हटाना चाहते हैं?`}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setContactToDelete(null)}
      />
    </div>
  );
};
