import React from 'react';
import {
  ArrowUpRight,
  Bell,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileBarChart2,
  FileText,
  FolderKanban,
  Gavel,
  Plus,
  Scale,
} from 'lucide-react';
import type {
  AppSettings,
  AutoNotification,
  CasePresetFilter,
  RevenueCase,
  UserProfile,
} from '../types';
import {
  computeDashboardStats,
  formatHindiDate,
  getLocalDateString,
} from '../utils/dateAndExport';

interface DashboardViewProps {
  profile: UserProfile;
  cases: RevenueCase[];
  notifications: AutoNotification[];
  appSettings: AppSettings | null;
  onOpenPreset: (preset: CasePresetFilter) => void;
  onOpenCourtFilter: (courtName: string) => void;
  onSelectCase: (caseItem: RevenueCase) => void;
  onAddNewCase: () => void;
  onOpenReports: () => void;
  onOpenCalendar: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  cases,
  notifications,
  appSettings,
  onOpenPreset,
  onOpenCourtFilter,
  onSelectCase,
  onAddNewCase,
  onOpenReports,
  onOpenCalendar,
}) => {
  const stats = computeDashboardStats(cases);
  const todayStr = getLocalDateString();

  const upcomingCases = cases
    .filter((c) => c.status !== 'निस्तारित' && c.nextDate && c.nextDate >= todayStr)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    .slice(0, 6);

  const kpiCards: {
    id: CasePresetFilter;
    label: string;
    value: number;
    tone: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'all',
      label: 'कुल मुकदमे',
      value: stats.total,
      tone: 'text-[#0B1D3A]',
      icon: <FolderKanban className="w-4 h-4 text-[#0B1D3A]" />,
    },
    {
      id: 'today',
      label: 'आज के मुकदमे',
      value: stats.todayCount,
      tone: 'text-[#9A7410]',
      icon: <CalendarClock className="w-4 h-4 text-[#A17C14]" />,
    },
    {
      id: 'tomorrow',
      label: 'कल के मुकदमे',
      value: stats.tomorrowCount,
      tone: 'text-sky-800',
      icon: <CalendarDays className="w-4 h-4 text-sky-700" />,
    },
    {
      id: 'next7',
      label: 'आगामी 7 दिन',
      value: stats.next7Count,
      tone: 'text-indigo-800',
      icon: <Clock className="w-4 h-4 text-indigo-700" />,
    },
    {
      id: 'pending',
      label: 'लंबित मुकदमे',
      value: stats.pendingCount,
      tone: 'text-amber-800',
      icon: <Scale className="w-4 h-4 text-amber-700" />,
    },
    {
      id: 'disposed',
      label: 'निस्तारित मुकदमे',
      value: stats.disposedCount,
      tone: 'text-emerald-800',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-700" />,
    },
    {
      id: 'orderPending',
      label: 'आदेश हेतु लंबित',
      value: stats.orderPendingCount,
      tone: 'text-rose-800',
      icon: <Gavel className="w-4 h-4 text-rose-700" />,
    },
    {
      id: 'reportPending',
      label: 'रिपोर्ट हेतु लंबित',
      value: stats.reportPendingCount,
      tone: 'text-orange-800',
      icon: <FileText className="w-4 h-4 text-orange-700" />,
    },
  ];

  const maxCourtTotal = Math.max(1, ...stats.courtStats.map((c) => c.total));

  return (
    <div className="space-y-6">
      {/* Admin Announcement Banner */}
      {appSettings?.announcement && (
        <div className="bg-[#FBF5E2] border border-[#E5C665] rounded-xl px-4 py-3 text-sm text-[#0B1D3A] flex items-start gap-2.5">
          <Bell className="w-4 h-4 text-[#A17C14] shrink-0 mt-0.5" />
          <p className="leading-relaxed">{appSettings.announcement}</p>
        </div>
      )}

      {/* Executive Welcome Hero Card */}
      <section className="bg-[#0B1D3A] text-white rounded-2xl p-5 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <p className="text-xs text-[#E5C665] font-medium">
            {profile.designation || 'अधिवक्ता'} · तहसील {profile.tehsil || '—'}, जिला {profile.district || 'उत्तर प्रदेश'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
            नमस्कार, {profile.name}
          </h2>
          <p className="text-sm text-slate-300 mt-1.5">
            आज दिनांक <span className="font-mono-num text-white">{formatHindiDate(todayStr)}</span> को आपके{' '}
            <strong className="text-[#E5C665] font-mono-num">{stats.todayCount}</strong> मुकदमे पेशी पर हैं और{' '}
            <strong className="text-white font-mono-num">{stats.tomorrowCount}</strong> मुकदमे कल के लिए नियत हैं।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onAddNewCase}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#C9A227] text-[#071326] text-sm font-bold hover:bg-[#D9B53B] transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            नया मुकदमा जोड़ें
          </button>
          <button
            type="button"
            onClick={onOpenReports}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 text-white border border-white/15 text-sm font-medium hover:bg-white/15 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <FileBarChart2 className="w-4 h-4 text-[#E5C665]" />
            रिपोर्ट निर्यात
          </button>
        </div>
      </section>

      {/* 8 Dashboard KPI Metric Grid */}
      <section aria-label="मुकदमा सांख्यिकी">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {kpiCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpenPreset(card.id)}
              className="group bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-[#0B1D3A]/40 hover:shadow-xs transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                  {card.icon}
                </span>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#0B1D3A] transition-colors" />
              </div>
              <p className={`text-2xl sm:text-3xl font-bold font-mono-num ${card.tone}`}>
                {card.value}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 truncate">
                {card.label}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* 2-Column Main Dashboard Body: Court-Wise Stats + Upcoming Hearings & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Court-wise Case Statistics */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-bold text-[#0B1D3A]">न्यायालयवार मुकदमों का विवरण</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                किसी भी न्यायालय पर क्लिक करके उसके सभी मुकदमे देखें
              </p>
            </div>
            <Building2 className="w-5 h-5 text-[#A17C14] shrink-0" />
          </div>

          {stats.courtStats.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl">
              <p className="text-sm font-medium text-slate-700">अभी कोई मुकदमा दर्ज नहीं है</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                अपना पहला राजस्व वाद जोड़ें ताकि न्यायालयवार आंकड़े यहाँ दिख सकें।
              </p>
              <button
                type="button"
                onClick={onAddNewCase}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132C54] transition-colors cursor-pointer"
              >
                प्रथम मुकदमा जोड़ें
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.courtStats.map((item) => {
                const widthPct = Math.max(6, Math.round((item.total / maxCourtTotal) * 100));
                return (
                  <button
                    key={item.court}
                    type="button"
                    onClick={() => onOpenCourtFilter(item.court)}
                    className="w-full py-3.5 text-left hover:bg-slate-50/80 transition-colors rounded-lg px-2 -mx-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-sm font-semibold text-[#0B1D3A] truncate">
                        {item.court}
                      </span>
                      <span className="text-xs text-slate-500 font-mono-num whitespace-nowrap shrink-0">
                        कुल <strong className="text-[#0B1D3A]">{item.total}</strong> · लंबित{' '}
                        <strong className="text-amber-700">{item.pending}</strong> · निस्तारित{' '}
                        <strong className="text-emerald-700">{item.disposed}</strong>
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0B1D3A] rounded-full transition-all duration-300"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Reminders & Upcoming Hearings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Notifications & Hearing Reminders */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0B1D3A]">पेशी रिमाइंडर एवं सूचनाएँ</h3>
                <p className="text-xs text-slate-500">आज, कल व आगामी 3 दिनों की स्वचालित सूचना</p>
              </div>
              <button
                type="button"
                onClick={onOpenCalendar}
                className="text-xs font-semibold text-[#9A7410] hover:text-[#0B1D3A] whitespace-nowrap cursor-pointer"
              >
                कैलेंडर देखें
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                आगामी 3 दिनों में कोई पेशी या लंबित रिमाइंडर नहीं है।
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.slice(0, 5).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      const found = n.caseId ? cases.find((c) => c.id === n.caseId) : undefined;
                      if (found) onSelectCase(found);
                      else onOpenCalendar();
                    }}
                    className="w-full py-3 flex items-start justify-between gap-3 text-left hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          n.urgency === 'high'
                            ? 'text-red-700'
                            : n.urgency === 'medium'
                              ? 'text-amber-800'
                              : 'text-[#0B1D3A]'
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{n.subtitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Next Hearings List */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-bold text-[#0B1D3A]">आगामी पेशी सूची</h3>
              <button
                type="button"
                onClick={() => onOpenPreset('next7')}
                className="text-xs font-semibold text-[#9A7410] hover:text-[#0B1D3A] whitespace-nowrap cursor-pointer"
              >
                सभी देखें
              </button>
            </div>

            {upcomingCases.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                कोई आगामी पेशी निर्धारित नहीं है।
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingCases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCase(c)}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0B1D3A] truncate">
                        {c.plaintiffName} बनाम {c.defendantName || '—'}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        वाद सं. <span className="font-mono-num">{c.caseNumber}</span> · {c.courtName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold font-mono-num text-[#0B1D3A]">
                        {formatHindiDate(c.nextDate)}
                      </p>
                      <p className="text-[11px] text-slate-500">{c.status}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
