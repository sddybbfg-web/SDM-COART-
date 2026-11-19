import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Edit3,
  Eye,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  CASE_STATUSES,
  CasePresetFilter,
  CaseStatus,
  RevenueCase,
} from '../types';
import {
  addDaysToDateStr,
  formatHindiDate,
  getLocalDateString,
} from '../utils/dateAndExport';

interface CaseListViewProps {
  cases: RevenueCase[];
  allCourtNames: string[];
  presetFilter: CasePresetFilter;
  initialCourtFilter: string;
  onChangePreset: (preset: CasePresetFilter) => void;
  onClearCourtFilter: () => void;
  onSelectCase: (c: RevenueCase) => void;
  onEditCase: (c: RevenueCase) => void;
  onDeleteCase: (c: RevenueCase) => void;
  onAddNewCase: () => void;
}

const PRESET_TABS: { id: CasePresetFilter; label: string }[] = [
  { id: 'all', label: 'सभी मुकदमे' },
  { id: 'today', label: 'आज की पेशी' },
  { id: 'tomorrow', label: 'कल की पेशी' },
  { id: 'next7', label: 'आगामी 7 दिन' },
  { id: 'pending', label: 'लंबित' },
  { id: 'disposed', label: 'निस्तारित' },
  { id: 'orderPending', label: 'आदेश हेतु' },
  { id: 'reportPending', label: 'रिपोर्ट हेतु' },
];

export const CaseListView: React.FC<CaseListViewProps> = ({
  cases,
  allCourtNames,
  presetFilter,
  initialCourtFilter,
  onChangePreset,
  onClearCourtFilter,
  onSelectCase,
  onEditCase,
  onDeleteCase,
  onAddNewCase,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourt, setSelectedCourt] = useState(initialCourtFilter);
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus | ''>('');
  const [selectedNextDate, setSelectedNextDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(Boolean(initialCourtFilter));

  React.useEffect(() => {
    setSelectedCourt(initialCourtFilter);
    if (initialCourtFilter) setShowAdvancedFilters(true);
  }, [initialCourtFilter]);

  const filteredCases = useMemo(() => {
    const today = getLocalDateString();
    const tomorrow = addDaysToDateStr(today, 1);
    const next7End = addDaysToDateStr(today, 7);
    const q = searchQuery.trim().toLowerCase();

    return cases
      .filter((c) => {
        if (presetFilter === 'today') {
          if (c.status === 'निस्तारित' || c.nextDate !== today) return false;
        } else if (presetFilter === 'tomorrow') {
          if (c.status === 'निस्तारित' || c.nextDate !== tomorrow) return false;
        } else if (presetFilter === 'next7') {
          if (
            c.status === 'निस्तारित' ||
            !c.nextDate ||
            c.nextDate < today ||
            c.nextDate > next7End
          ) {
            return false;
          }
        } else if (presetFilter === 'pending') {
          if (c.status === 'निस्तारित') return false;
        } else if (presetFilter === 'disposed') {
          if (c.status !== 'निस्तारित') return false;
        } else if (presetFilter === 'orderPending') {
          if (c.status !== 'आदेश सुरक्षित') return false;
        } else if (presetFilter === 'reportPending') {
          if (!c.lekhpalReportPending && !c.kanungoReportPending) return false;
        }

        if (selectedCourt && c.courtName !== selectedCourt) return false;
        if (selectedStatus && c.status !== selectedStatus) return false;
        if (selectedNextDate && c.nextDate !== selectedNextDate) return false;

        if (q) {
          const haystack = [
            c.plaintiffName,
            c.defendantName,
            c.caseNumber,
            c.computerizedCaseNumber,
            c.gataNumber,
            c.village,
            c.courtName,
            c.nextDate,
            formatHindiDate(c.nextDate),
            c.clientMobile,
            c.advocateName,
            c.section,
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.nextDate && b.nextDate) return a.nextDate.localeCompare(b.nextDate);
        if (a.nextDate) return -1;
        if (b.nextDate) return 1;
        return a.caseNumber.localeCompare(b.caseNumber);
      });
  }, [cases, presetFilter, searchQuery, selectedCourt, selectedStatus, selectedNextDate]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCourt('');
    setSelectedStatus('');
    setSelectedNextDate('');
    onChangePreset('all');
    onClearCourtFilter();
  };

  const getStatusTextColor = (status: CaseStatus) => {
    if (status === 'निस्तारित' || status === 'आदेश पारित') return 'text-emerald-700';
    if (status === 'आदेश सुरक्षित' || status === 'बहस') return 'text-rose-700';
    if (status === 'स्थगित' || status === 'अपील') return 'text-amber-700';
    return 'text-[#0B1D3A]';
  };

  return (
    <div className="space-y-5">
      {/* Header & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0B1D3A]">केस डायरी रजिस्टर</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              कुल <span className="font-mono-num font-semibold text-[#0B1D3A]">{filteredCases.length}</span> मुकदमे प्रदर्शित (कुल {cases.length} में से)
            </p>
          </div>
          <button
            type="button"
            onClick={onAddNewCase}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#E5C665]" />
            नया मुकदमा जोड़ें
          </button>
        </div>

        {/* Fast Multi-Field Search Input */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="खोजें: वादी, प्रतिवादी, वाद संख्या, कम्प्यूटरीकृत संख्या, गाटा, ग्राम, न्यायालय, तारीख या मोबाइल नंबर..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0B1D3A] focus:ring-2 focus:ring-[#0B1D3A]/10"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((v) => !v)}
              className={`min-h-[44px] px-3.5 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                showAdvancedFilters || selectedCourt || selectedStatus || selectedNextDate
                  ? 'border-[#0B1D3A] bg-[#0B1D3A]/5 text-[#0B1D3A]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              फ़िल्टर
            </button>
            {(searchQuery || selectedCourt || selectedStatus || selectedNextDate || presetFilter !== 'all') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] px-3.5 rounded-xl border border-slate-300 bg-white text-slate-600 hover:text-[#0B1D3A] text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                रीसेट
              </button>
            )}
          </div>
        </div>

        {/* Preset Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {PRESET_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangePreset(tab.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                presetFilter === tab.id
                  ? 'bg-[#0B1D3A] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-[#0B1D3A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Advanced Dropdown Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                न्यायालय चुनें
              </label>
              <select
                value={selectedCourt}
                onChange={(e) => setSelectedCourt(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-[#0B1D3A]"
              >
                <option value="">सभी न्यायालय</option>
                {allCourtNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                मुकदमे की स्थिति
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as CaseStatus | '')}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-[#0B1D3A]"
              >
                <option value="">सभी स्थितियाँ</option>
                {CASE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                अगली तारीख (पेशी)
              </label>
              <input
                type="date"
                value={selectedNextDate}
                onChange={(e) => setSelectedNextDate(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs sm:text-sm font-mono-num focus:outline-none focus:border-[#0B1D3A]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredCases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <p className="text-base font-bold text-[#0B1D3A]">कोई मुकदमा नहीं मिला</p>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5">
            {cases.length === 0
              ? 'आपकी केस डायरी अभी खाली है। नया मुकदमा जोड़कर शुरुआत करें।'
              : 'कृपया खोज शब्द या फ़िल्टर बदलकर पुनः प्रयास करें।'}
          </p>
          {cases.length === 0 ? (
            <button
              type="button"
              onClick={onAddNewCase}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0B1D3A] text-white text-sm font-semibold hover:bg-[#132C54] transition-colors cursor-pointer"
            >
              नया मुकदमा दर्ज करें
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              सभी फ़िल्टर हटाएँ
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop High-Density Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0B1D3A] text-white text-xs font-semibold">
                    <th className="py-3.5 px-4">वाद संख्या</th>
                    <th className="py-3.5 px-4">वादी बनाम प्रतिवादी</th>
                    <th className="py-3.5 px-4">न्यायालय</th>
                    <th className="py-3.5 px-4">ग्राम / गाटा / धारा</th>
                    <th className="py-3.5 px-4">अगली तारीख</th>
                    <th className="py-3.5 px-4">स्थिति</th>
                    <th className="py-3.5 px-4 text-right">कार्यवाही</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredCases.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCase(c)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 align-top">
                        <p className="font-mono-num font-bold text-[#0B1D3A]">{c.caseNumber}</p>
                        {c.computerizedCaseNumber && (
                          <p className="font-mono-num text-[11px] text-slate-500 mt-0.5">
                            {c.computerizedCaseNumber}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <p className="font-semibold text-slate-900">
                          {c.plaintiffName} <span className="text-slate-400 font-normal">बनाम</span>{' '}
                          {c.defendantName || '—'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          अधिवक्ता: {c.advocateName || '—'}
                          {c.clientMobile ? ` · ${c.clientMobile}` : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <p className="text-slate-800 font-medium">{c.courtName}</p>
                        {c.presidingOfficer && (
                          <p className="text-xs text-slate-500 mt-0.5">{c.presidingOfficer}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top text-xs text-slate-600">
                        <p className="text-slate-800 font-medium">
                          {c.village || '—'}
                          {c.gataNumber ? ` · गाटा ${c.gataNumber}` : ''}
                        </p>
                        <p className="text-slate-500 mt-0.5">{c.section || '—'}</p>
                      </td>
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <p className="font-mono-num font-bold text-[#0B1D3A]">
                          {formatHindiDate(c.nextDate)}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono-num mt-0.5">
                          पिछली: {formatHindiDate(c.previousDate)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <p className={`text-xs font-bold ${getStatusTextColor(c.status)}`}>
                          {c.status}
                        </p>
                        {(c.lekhpalReportPending || c.kanungoReportPending) && (
                          <p className="text-[11px] text-orange-700 mt-0.5">रिपोर्ट लंबित</p>
                        )}
                      </td>
                      <td
                        className="py-3.5 px-4 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectCase(c)}
                            title="केस डायरी खोलें"
                            className="p-2 rounded-lg text-slate-600 hover:text-[#0B1D3A] hover:bg-slate-100 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditCase(c)}
                            title="संपादित करें"
                            className="p-2 rounded-lg text-slate-600 hover:text-[#9A7410] hover:bg-amber-50 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCase(c)}
                            title="हटाएं"
                            className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Clean Card List */}
          <div className="lg:hidden space-y-3">
            {filteredCases.map((c) => (
              <div
                key={c.id}
                onClick={() => onSelectCase(c)}
                className="bg-white rounded-2xl border border-slate-200 p-4 active:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono-num text-slate-500">
                      वाद सं. <strong className="text-[#0B1D3A]">{c.caseNumber}</strong>
                      {c.computerizedCaseNumber ? ` · ${c.computerizedCaseNumber}` : ''}
                    </p>
                    <h3 className="text-base font-bold text-[#0B1D3A] mt-1 leading-snug">
                      {c.plaintiffName}{' '}
                      <span className="font-normal text-slate-400 text-sm">बनाम</span>{' '}
                      {c.defendantName || '—'}
                    </h3>
                  </div>
                  <span
                    className={`text-xs font-bold shrink-0 ${getStatusTextColor(c.status)}`}
                  >
                    {c.status}
                  </span>
                </div>

                <div className="mt-2.5 text-xs text-slate-600 space-y-1">
                  <p className="font-medium text-slate-800">{c.courtName}</p>
                  <p className="text-slate-500">
                    ग्राम: {c.village || '—'}
                    {c.gataNumber ? ` · गाटा: ${c.gataNumber}` : ''}
                    {c.section ? ` · ${c.section}` : ''}
                  </p>
                </div>

                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar className="w-3.5 h-3.5 text-[#A17C14]" />
                    <span className="text-slate-500">अगली तारीख:</span>
                    <strong className="font-mono-num text-[#0B1D3A]">
                      {formatHindiDate(c.nextDate)}
                    </strong>
                  </div>

                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onEditCase(c)}
                      className="min-h-[38px] px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
                    >
                      संपादित
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCase(c)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-red-700 hover:bg-red-50 cursor-pointer"
                      aria-label="मुकदमा हटाएं"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
