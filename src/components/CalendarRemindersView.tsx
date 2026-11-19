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
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Plus,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { AutoNotification, CustomReminder, RevenueCase } from '../types';
import {
  formatHindiDate,
  getLocalDateString,
  HINDI_MONTHS,
  HINDI_WEEKDAYS_SHORT,
  sanitizeStr,
} from '../utils/dateAndExport';
import { ConfirmModal } from './ConfirmModal';

interface CalendarRemindersViewProps {
  ownerId: string;
  cases: RevenueCase[];
  reminders: CustomReminder[];
  notifications: AutoNotification[];
  onSelectCase: (c: RevenueCase) => void;
}

export const CalendarRemindersView: React.FC<CalendarRemindersViewProps> = ({
  ownerId,
  cases,
  reminders,
  notifications,
  onSelectCase,
}) => {
  const today = new Date();
  const todayStr = getLocalDateString(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Add Custom Reminder Form
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [remTitle, setRemTitle] = useState('');
  const [remDate, setRemDate] = useState(todayStr);
  const [remTime, setRemTime] = useState('10:00');
  const [remCaseId, setRemCaseId] = useState('');
  const [remNote, setRemNote] = useState('');
  const [savingRem, setSavingRem] = useState(false);
  const [remToDelete, setRemToDelete] = useState<CustomReminder | null>(null);
  const [deletingRem, setDeletingRem] = useState(false);

  // Map date -> counts for calendar badges
  const casesByDate = useMemo(() => {
    const map = new Map<string, RevenueCase[]>();
    for (const c of cases) {
      if (!c.nextDate || c.status === 'निस्तारित') continue;
      const list = map.get(c.nextDate) || [];
      list.push(c);
      map.set(c.nextDate, list);
    }
    return map;
  }, [cases]);

  const remindersByDate = useMemo(() => {
    const map = new Map<string, CustomReminder[]>();
    for (const r of reminders) {
      if (!r.reminderDate) continue;
      const list = map.get(r.reminderDate) || [];
      list.push(r);
      map.set(r.reminderDate, list);
    }
    return map;
  }, [reminders]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(viewMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push(`${viewYear}-${mStr}-${dStr}`);
    }
    return cells;
  }, [viewYear, viewMonth]);

  const selectedDateCases = casesByDate.get(selectedDate) || [];
  const selectedDateReminders = remindersByDate.get(selectedDate) || [];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sanitizeStr(remTitle, 200)) return;
    setSavingRem(true);
    const linkedCase = cases.find((c) => c.id === remCaseId);

    try {
      await addDoc(collection(db, 'reminders'), {
        ownerId,
        caseId: linkedCase ? linkedCase.id : '',
        caseNumber: linkedCase ? sanitizeStr(linkedCase.caseNumber, 100) : '',
        title: sanitizeStr(remTitle, 200),
        reminderDate: sanitizeStr(remDate, 20),
        reminderTime: sanitizeStr(remTime, 10),
        note: sanitizeStr(remNote, 500),
        isCompleted: false,
        createdAt: serverTimestamp(),
      });
      setRemTitle('');
      setRemNote('');
      setRemCaseId('');
      setShowReminderForm(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reminders');
    } finally {
      setSavingRem(false);
    }
  };

  const handleToggleReminder = async (r: CustomReminder) => {
    try {
      await updateDoc(doc(db, 'reminders', r.id), {
        isCompleted: !r.isCompleted,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reminders/${r.id}`);
    }
  };

  const handleConfirmDeleteRem = async () => {
    if (!remToDelete) return;
    setDeletingRem(true);
    try {
      await deleteDoc(doc(db, 'reminders', remToDelete.id));
      setRemToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reminders/${remToDelete.id}`);
    } finally {
      setDeletingRem(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0B1D3A]">
            पेशी तारीख कैलेंडर एवं रिमाइंडर
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            तारीख पर क्लिक करें और उस दिन की सभी पेशियाँ व कस्टम रिमाइंडर देखें
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRemDate(selectedDate);
            setShowReminderForm((v) => !v);
          }}
          className="min-h-[44px] px-4 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4 text-[#E5C665]" />
          कस्टम रिमाइंडर जोड़ें
        </button>
      </div>

      {/* Add Custom Reminder Form */}
      {showReminderForm && (
        <form
          onSubmit={handleCreateReminder}
          className="bg-white rounded-2xl border border-[#0B1D3A]/25 p-5 space-y-4 shadow-xs"
        >
          <h3 className="text-base font-bold text-[#0B1D3A]">नया कस्टम रिमाइंडर</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                रिमाइंडर शीर्षक <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={remTitle}
                onChange={(e) => setRemTitle(e.target.value)}
                placeholder="उदा. लेखपाल से रिपोर्ट की कॉपी प्राप्त करनी है"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                तारीख <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={remDate}
                onChange={(e) => setRemDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                समय
              </label>
              <input
                type="time"
                value={remTime}
                onChange={(e) => setRemTime(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                संबंधित मुकदमा (वैकल्पिक)
              </label>
              <select
                value={remCaseId}
                onChange={(e) => setRemCaseId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm"
              >
                <option value="">सामान्य रिमाइंडर (कोई मुकदमा नहीं)</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    वाद सं. {c.caseNumber} — {c.plaintiffName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                अतिरिक्त नोट
              </label>
              <input
                type="text"
                maxLength={500}
                value={remNote}
                onChange={(e) => setRemNote(e.target.value)}
                placeholder="संक्षिप्त विवरण..."
                className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowReminderForm(false)}
              className="min-h-[42px] px-4 rounded-xl border border-slate-300 text-sm text-slate-700 cursor-pointer"
            >
              रद्द करें
            </button>
            <button
              type="submit"
              disabled={savingRem}
              className="min-h-[42px] px-5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] cursor-pointer disabled:opacity-60"
            >
              {savingRem ? 'सहेज रहे हैं...' : 'रिमाइंडर सहेजें'}
            </button>
          </div>
        </form>
      )}

      {/* Main 2-Column Calendar + Day Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Monthly Calendar Grid */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer"
              aria-label="पिछला महीना"
            >
              <ChevronLeft className="w-5 h-5 text-[#0B1D3A]" />
            </button>
            <div className="text-center">
              <h3 className="text-lg font-bold text-[#0B1D3A]">
                {HINDI_MONTHS[viewMonth]} {viewYear}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setViewYear(today.getFullYear());
                  setViewMonth(today.getMonth());
                  setSelectedDate(todayStr);
                }}
                className="text-[11px] font-semibold text-[#9A7410] hover:underline cursor-pointer"
              >
                आज पर जाएँ ({formatHindiDate(todayStr)})
              </button>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer"
              aria-label="अगला महीना"
            >
              <ChevronRight className="w-5 h-5 text-[#0B1D3A]" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {HINDI_WEEKDAYS_SHORT.map((day) => (
              <div key={day} className="text-xs font-semibold text-slate-500 py-1.5">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((dateStr, idx) => {
              if (!dateStr) return <div key={`empty-${idx}`} className="h-12 sm:h-14" />;
              const dayNum = Number(dateStr.split('-')[2]);
              const hearingCount = (casesByDate.get(dateStr) || []).length;
              const remCount = (remindersByDate.get(dateStr) || []).length;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`h-12 sm:h-14 rounded-xl border flex flex-col items-center justify-center transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0B1D3A] text-white border-[#0B1D3A]'
                      : isToday
                        ? 'bg-[#FBF5E2] text-[#0B1D3A] border-[#C9A227]'
                        : 'bg-white text-slate-800 border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs sm:text-sm font-mono-num font-bold leading-none">
                    {dayNum}
                  </span>
                  {(hearingCount > 0 || remCount > 0) && (
                    <span
                      className={`text-[10px] font-mono-num font-semibold mt-1 leading-none ${
                        isSelected ? 'text-[#E5C665]' : 'text-[#9A7410]'
                      }`}
                    >
                      {hearingCount > 0 ? `${hearingCount} वाद` : `${remCount} याद`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Right Side: Selected Date Agenda + Automatic Notifications */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selected Date Details */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#A17C14]" />
                <h3 className="text-base font-bold text-[#0B1D3A]">
                  दिनांक {formatHindiDate(selectedDate)} का विवरण
                </h3>
              </div>
              <span className="text-xs font-mono-num text-slate-500">
                {selectedDateCases.length} पेशी
              </span>
            </div>

            {selectedDateCases.length === 0 && selectedDateReminders.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center bg-slate-50 rounded-xl">
                इस तारीख को कोई पेशी या रिमाइंडर निर्धारित नहीं है।
              </p>
            ) : (
              <div className="space-y-2.5">
                {selectedDateCases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCase(c)}
                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-[#0B1D3A]/40 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono-num font-bold text-[#0B1D3A]">
                        वाद सं. {c.caseNumber}
                      </span>
                      <span className="text-[11px] font-semibold text-amber-800">{c.status}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 mt-1">
                      {c.plaintiffName} बनाम {c.defendantName || '—'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{c.courtName}</p>
                  </button>
                ))}

                {selectedDateReminders.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-[#FBF5E2]/60 border border-[#E5C665]/60 flex items-start justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleReminder(r)}
                      className="flex items-start gap-2.5 text-left cursor-pointer"
                    >
                      {r.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#A17C14] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p
                          className={`text-sm font-semibold ${
                            r.isCompleted ? 'line-through text-slate-400' : 'text-[#0B1D3A]'
                          }`}
                        >
                          {r.title}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {r.reminderTime ? `${r.reminderTime} · ` : ''}
                          {r.caseNumber ? `वाद सं. ${r.caseNumber} · ` : ''}
                          {r.note}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemToDelete(r)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 cursor-pointer"
                      aria-label="रिमाइंडर हटाएं"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Auto Hearing Reminders Box */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
              <Bell className="w-4 h-4 text-[#A17C14]" />
              <h3 className="text-base font-bold text-[#0B1D3A]">
                स्वचालित पेशी सूचनाएँ ({notifications.length})
              </h3>
            </div>
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                आगामी 3 दिनों में कोई स्वचालित पेशी सूचना नहीं है।
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="py-2.5">
                    <p
                      className={`text-xs font-bold ${
                        n.urgency === 'high'
                          ? 'text-red-700'
                          : n.urgency === 'medium'
                            ? 'text-amber-800'
                            : 'text-[#0B1D3A]'
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.subtitle}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* All Custom Reminders Section */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <h3 className="text-base font-bold text-[#0B1D3A] mb-4">
          सभी कस्टम रिमाइंडर ({reminders.length})
        </h3>
        {reminders.length === 0 ? (
          <p className="text-xs text-slate-500 py-5 text-center bg-slate-50 rounded-xl">
            आपने अभी कोई कस्टम रिमाइंडर नहीं जोड़ा है।
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {[...reminders]
              .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate))
              .map((r) => (
                <div
                  key={r.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleReminder(r)}
                    className="flex items-start gap-3 text-left cursor-pointer min-w-0"
                  >
                    {r.isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          r.isCompleted ? 'line-through text-slate-400' : 'text-[#0B1D3A]'
                        }`}
                      >
                        {r.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono-num">{formatHindiDate(r.reminderDate)}</span>
                        {r.reminderTime ? ` · ${r.reminderTime}` : ''}
                        {r.caseNumber ? ` · वाद सं. ${r.caseNumber}` : ''}
                        {r.note ? ` · ${r.note}` : ''}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemToDelete(r)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer shrink-0"
                    aria-label="रिमाइंडर हटाएं"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(remToDelete)}
        title="रिमाइंडर हटाएं?"
        message={`क्या आप "${remToDelete?.title || ''}" रिमाइंडर को हटाना चाहते हैं?`}
        loading={deletingRem}
        onConfirm={handleConfirmDeleteRem}
        onCancel={() => setRemToDelete(null)}
      />
    </div>
  );
};
