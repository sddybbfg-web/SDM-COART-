import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import type { RevenueCase, UserProfile } from '../types';
import {
  addDaysToDateStr,
  exportCasesToExcel,
  formatHindiDate,
  getLocalDateString,
  printCasesAsOfficialPDF,
} from '../utils/dateAndExport';

type ReportType =
  | 'daily'
  | 'courtWise'
  | 'monthly'
  | 'pending'
  | 'disposed'
  | 'nextHearing';

interface ReportsViewProps {
  cases: RevenueCase[];
  allCourtNames: string[];
  profile: UserProfile;
  onSelectCase: (c: RevenueCase) => void;
}

const REPORT_TYPES: { id: ReportType; title: string; subtitle: string }[] = [
  { id: 'daily', title: 'दैनिक वाद सूची', subtitle: 'चयनित तारीख की सभी पेशियाँ' },
  { id: 'courtWise', title: 'न्यायालयवार वाद सूची', subtitle: 'किसी विशिष्ट न्यायालय के समस्त वाद' },
  { id: 'monthly', title: 'मासिक वाद रिपोर्ट', subtitle: 'चयनित माह में नियत या दाखिल मुकदमे' },
  { id: 'pending', title: 'लंबित वाद रिपोर्ट', subtitle: 'वर्तमान में विचाराधीन समस्त मुकदमे' },
  { id: 'disposed', title: 'निस्तारित वाद रिपोर्ट', subtitle: 'अंतिम रूप से निस्तारित मुकदमे' },
  { id: 'nextHearing', title: 'आगामी पेशी रिपोर्ट', subtitle: 'आगामी 30 दिनों की पेशी सूची' },
];

export const ReportsView: React.FC<ReportsViewProps> = ({
  cases,
  allCourtNames,
  profile,
  onSelectCase,
}) => {
  const todayStr = getLocalDateString();
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedCourt, setSelectedCourt] = useState(allCourtNames[0] || '');
  const [selectedMonth, setSelectedMonth] = useState(todayStr.slice(0, 7));

  const activeMeta = REPORT_TYPES.find((r) => r.id === reportType)!;

  const reportCases = useMemo(() => {
    const next30 = addDaysToDateStr(todayStr, 30);

    return cases
      .filter((c) => {
        switch (reportType) {
          case 'daily':
            return c.nextDate === selectedDate && c.status !== 'निस्तारित';
          case 'courtWise':
            return !selectedCourt || c.courtName === selectedCourt;
          case 'monthly':
            return (
              c.nextDate?.startsWith(selectedMonth) ||
              c.filingDate?.startsWith(selectedMonth)
            );
          case 'pending':
            return c.status !== 'निस्तारित';
          case 'disposed':
            return c.status === 'निस्तारित';
          case 'nextHearing':
            return (
              c.status !== 'निस्तारित' &&
              Boolean(c.nextDate) &&
              c.nextDate >= todayStr &&
              c.nextDate <= next30
            );
          default:
            return true;
        }
      })
      .sort((a, b) => (a.nextDate || '9999').localeCompare(b.nextDate || '9999'));
  }, [cases, reportType, selectedDate, selectedCourt, selectedMonth, todayStr]);

  const reportSubtitle = useMemo(() => {
    if (reportType === 'daily') return `दिनांक: ${formatHindiDate(selectedDate)}`;
    if (reportType === 'courtWise') return `न्यायालय: ${selectedCourt || 'सभी न्यायालय'}`;
    if (reportType === 'monthly') return `माह: ${selectedMonth}`;
    if (reportType === 'nextHearing') return `आगामी 30 दिन (${formatHindiDate(todayStr)} से)`;
    return activeMeta.subtitle;
  }, [reportType, selectedDate, selectedCourt, selectedMonth, todayStr, activeMeta]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0B1D3A]">
            वाद रिपोर्ट एवं निर्यात केंद्र
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            किसी भी रिपोर्ट को PDF (प्रिंट-रेडी हिंदी) या Excel (.xlsx) में तुरंत डाउनलोड करें
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              printCasesAsOfficialPDF(
                reportCases,
                activeMeta.title,
                reportSubtitle,
                profile
              )
            }
            className="min-h-[44px] px-4 rounded-xl bg-[#0B1D3A] text-white text-xs sm:text-sm font-semibold hover:bg-[#132C54] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4 text-[#E5C665]" />
            PDF निर्यात / प्रिंट
          </button>
          <button
            type="button"
            onClick={() =>
              exportCasesToExcel(reportCases, activeMeta.title, `report_${reportType}`)
            }
            className="min-h-[44px] px-4 rounded-xl bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* 6 Report Type Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setReportType(r.id)}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              reportType === r.id
                ? 'bg-[#0B1D3A] text-white border-[#0B1D3A]'
                : 'bg-white text-slate-800 border-slate-200 hover:border-[#0B1D3A]/40'
            }`}
          >
            <p className="text-xs sm:text-sm font-bold leading-snug">{r.title}</p>
            <p
              className={`text-[11px] mt-1 line-clamp-2 ${
                reportType === r.id ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {r.subtitle}
            </p>
          </button>
        ))}
      </div>

      {/* Contextual Parameter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          {reportType === 'daily' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                दिनांक चुनें
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num"
              />
            </div>
          )}

          {reportType === 'courtWise' && (
            <div className="min-w-[240px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                न्यायालय चुनें
              </label>
              <select
                value={selectedCourt}
                onChange={(e) => setSelectedCourt(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
              >
                <option value="">सभी न्यायालय</option>
                {allCourtNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType === 'monthly' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                माह चुनें
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num"
              />
            </div>
          )}

          <div>
            <p className="text-xs text-slate-500">{reportSubtitle}</p>
            <p className="text-sm font-bold text-[#0B1D3A] font-mono-num">
              कुल परिणाम: {reportCases.length} मुकदमे
            </p>
          </div>
        </div>
      </div>

      {/* Report Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-[#0B1D3A]">
                <th className="py-3 px-4">क्र.</th>
                <th className="py-3 px-4">वाद संख्या</th>
                <th className="py-3 px-4">वादी बनाम प्रतिवादी</th>
                <th className="py-3 px-4">न्यायालय</th>
                <th className="py-3 px-4">ग्राम / गाटा</th>
                <th className="py-3 px-4">अगली तारीख</th>
                <th className="py-3 px-4">स्थिति</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {reportCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    चयनित मापदंड के अनुसार कोई मुकदमा उपलब्ध नहीं है।
                  </td>
                </tr>
              ) : (
                reportCases.map((c, idx) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCase(c)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono-num text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono-num font-semibold text-[#0B1D3A] whitespace-nowrap">
                      {c.caseNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {c.plaintiffName} बनाम {c.defendantName || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{c.courtName}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {c.village || '—'}
                      {c.gataNumber ? ` (${c.gataNumber})` : ''}
                    </td>
                    <td className="py-3 px-4 font-mono-num font-semibold text-[#0B1D3A] whitespace-nowrap">
                      {formatHindiDate(c.nextDate)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-700">
                      {c.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
