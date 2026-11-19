import * as XLSX from 'xlsx';
import {
  APP_CREATOR_CREDIT,
  type AutoNotification,
  type CustomReminder,
  type RevenueCase,
  type UserProfile,
} from '../types';

export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return getLocalDateString(dt);
}

export function diffDays(fromDateStr: string, toDateStr: string): number {
  if (!fromDateStr || !toDateStr) return NaN;
  const [fy, fm, fd] = fromDateStr.split('-').map(Number);
  const [ty, tm, td] = toDateStr.split('-').map(Number);
  const from = Date.UTC(fy, (fm || 1) - 1, fd || 1);
  const to = Date.UTC(ty, (tm || 1) - 1, td || 1);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export function formatHindiDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export const HINDI_MONTHS = [
  'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितम्बर', 'अक्टूबर', 'नवम्बर', 'दिसम्बर',
];

export const HINDI_WEEKDAYS_SHORT = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

export function sanitizeStr(val: string | undefined | null, maxLen: number): string {
  return (val ?? '').trim().slice(0, maxLen);
}

export function computeDashboardStats(cases: RevenueCase[]) {
  const today = getLocalDateString();
  const tomorrow = addDaysToDateStr(today, 1);
  const next7End = addDaysToDateStr(today, 7);

  let todayCount = 0;
  let tomorrowCount = 0;
  let next7Count = 0;
  let pendingCount = 0;
  let disposedCount = 0;
  let orderPendingCount = 0;
  let reportPendingCount = 0;

  const courtMap = new Map<string, { court: string; total: number; pending: number; disposed: number }>();

  for (const c of cases) {
    const isDisposed = c.status === 'निस्तारित';
    if (isDisposed) {
      disposedCount++;
    } else {
      pendingCount++;
    }

    if (c.status === 'आदेश सुरक्षित') {
      orderPendingCount++;
    }

    if (c.lekhpalReportPending || c.kanungoReportPending) {
      reportPendingCount++;
    }

    if (!isDisposed && c.nextDate) {
      if (c.nextDate === today) todayCount++;
      if (c.nextDate === tomorrow) tomorrowCount++;
      if (c.nextDate >= today && c.nextDate <= next7End) next7Count++;
    }

    const courtKey = c.courtName || 'अन्य न्यायालय';
    const existing = courtMap.get(courtKey) || { court: courtKey, total: 0, pending: 0, disposed: 0 };
    existing.total++;
    if (isDisposed) existing.disposed++;
    else existing.pending++;
    courtMap.set(courtKey, existing);
  }

  return {
    total: cases.length,
    todayCount,
    tomorrowCount,
    next7Count,
    pendingCount,
    disposedCount,
    orderPendingCount,
    reportPendingCount,
    courtStats: Array.from(courtMap.values()).sort((a, b) => b.total - a.total),
  };
}

export function generateAutoNotifications(
  cases: RevenueCase[],
  reminders: CustomReminder[],
  reminderLeadDays = 3
): AutoNotification[] {
  const today = getLocalDateString();
  const list: AutoNotification[] = [];

  for (const c of cases) {
    if (c.status === 'निस्तारित' || !c.nextDate) continue;
    const d = diffDays(today, c.nextDate);
    if (d === 0) {
      list.push({
        id: `auto-today-${c.id}`,
        type: 'today',
        urgency: 'high',
        title: `आज की पेशी: वाद सं. ${c.caseNumber}`,
        subtitle: `${c.plaintiffName} बनाम ${c.defendantName || '—'} · ${c.courtName}`,
        date: c.nextDate,
        caseId: c.id,
      });
    } else if (d === 1) {
      list.push({
        id: `auto-tomorrow-${c.id}`,
        type: 'tomorrow',
        urgency: 'medium',
        title: `कल की पेशी: वाद सं. ${c.caseNumber}`,
        subtitle: `${c.plaintiffName} बनाम ${c.defendantName || '—'} · ${c.courtName}`,
        date: c.nextDate,
        caseId: c.id,
      });
    } else if (d > 1 && d <= reminderLeadDays) {
      list.push({
        id: `auto-soon-${c.id}`,
        type: 'threeDays',
        urgency: 'info',
        title: `${d} दिन बाद पेशी: वाद सं. ${c.caseNumber}`,
        subtitle: `${c.plaintiffName} · ${c.courtName} (${formatHindiDate(c.nextDate)})`,
        date: c.nextDate,
        caseId: c.id,
      });
    }
  }

  for (const r of reminders) {
    if (r.isCompleted) continue;
    const d = diffDays(today, r.reminderDate);
    if (d >= -1 && d <= reminderLeadDays) {
      list.push({
        id: `custom-${r.id}`,
        type: 'custom',
        urgency: d <= 0 ? 'high' : 'medium',
        title: `कस्टम रिमाइंडर: ${r.title}`,
        subtitle: `${r.caseNumber ? `वाद सं. ${r.caseNumber} · ` : ''}${formatHindiDate(r.reminderDate)}${r.reminderTime ? ` (${r.reminderTime})` : ''}`,
        date: r.reminderDate,
        caseId: r.caseId || undefined,
        reminderId: r.id,
      });
    }
  }

  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function exportCasesToExcel(
  cases: RevenueCase[],
  reportTitle: string,
  fileNameBase: string
) {
  const rows = cases.map((c, idx) => ({
    'क्र.सं.': idx + 1,
    'वाद संख्या': c.caseNumber,
    'कम्प्यूटरीकृत वाद संख्या': c.computerizedCaseNumber || '—',
    'न्यायालय का नाम': c.courtName,
    'पीठासीन अधिकारी': c.presidingOfficer || '—',
    'वादी का नाम': c.plaintiffName,
    'प्रतिवादी का नाम': c.defendantName || '—',
    'अधिवक्ता का नाम': c.advocateName || '—',
    'मोबाइल नंबर': c.clientMobile || '—',
    'ग्राम': c.village || '—',
    'परगना': c.pargana || '—',
    'तहसील': c.tehsil || '—',
    'जिला': c.district || '—',
    'गाटा संख्या': c.gataNumber || '—',
    'धारा': c.section || '—',
    'विषय': c.subject || '—',
    'दाखिल तारीख': formatHindiDate(c.filingDate),
    'पिछली तारीख': formatHindiDate(c.previousDate),
    'अगली तारीख': formatHindiDate(c.nextDate),
    'वर्तमान स्थिति': c.status,
    'लेखपाल रिपोर्ट लंबित': c.lekhpalReportPending ? 'हाँ' : 'नहीं',
    'कानूनगो रिपोर्ट लंबित': c.kanungoReportPending ? 'हाँ' : 'नहीं',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 7 }, { wch: 16 }, { wch: 22 }, { wch: 28 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    { wch: 24 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 16 },
    { wch: 14 }, { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, reportTitle.slice(0, 30));
  XLSX.writeFile(workbook, `${fileNameBase}_${getLocalDateString()}.xlsx`);
}

export function printCasesAsOfficialPDF(
  cases: RevenueCase[],
  reportTitle: string,
  subtitle: string,
  profile: UserProfile | null
) {
  const printFrame = document.createElement('iframe');
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);

  const rowsHtml = cases
    .map(
      (c, i) => `
      <tr>
        <td style="text-align:center;">${i + 1}</td>
        <td><strong>${escapeHtml(c.caseNumber)}</strong><br/><span style="font-size:10px;color:#475569;">${escapeHtml(c.computerizedCaseNumber || '')}</span></td>
        <td>${escapeHtml(c.courtName)}</td>
        <td><strong>${escapeHtml(c.plaintiffName)}</strong><br/>बनाम ${escapeHtml(c.defendantName || '—')}</td>
        <td>${escapeHtml(c.village || '—')}${c.gataNumber ? `<br/>गाटा: ${escapeHtml(c.gataNumber)}` : ''}</td>
        <td>${escapeHtml(c.section || '—')}</td>
        <td style="white-space:nowrap;">${formatHindiDate(c.previousDate)}</td>
        <td style="white-space:nowrap;font-weight:700;color:#0B1D3A;">${formatHindiDate(c.nextDate)}</td>
        <td>${escapeHtml(c.status)}</td>
      </tr>
    `
    )
    .join('');

  const html = `<!doctype html>
  <html lang="hi">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(reportTitle)} — राजस्व न्यायालय केस डायरी</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: 'Noto Sans Devanagari', sans-serif; color: #0F172A; margin: 0; padding: 8px; font-size: 11px; }
      .header { border-bottom: 2px solid #0B1D3A; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
      .title { font-size: 18px; font-weight: 700; color: #0B1D3A; margin: 0; }
      .sub { font-size: 12px; color: #475569; margin: 3px 0 0; }
      .meta { text-align: right; font-size: 11px; color: #334155; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #0B1D3A; color: #FFFFFF; padding: 7px 6px; text-align: left; font-weight: 600; font-size: 11px; border: 1px solid #0B1D3A; }
      td { padding: 6px; border: 1px solid #CBD5E1; vertical-align: top; }
      tr:nth-child(even) td { background: #F8FAFC; }
      .footer { margin-top: 14px; font-size: 10px; color: #64748B; display: flex; justify-content: space-between; border-top: 1px solid #E2E8F0; padding-top: 6px; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <h1 class="title">राजस्व न्यायालय केस डायरी — ${escapeHtml(reportTitle)}</h1>
        <p class="sub">${escapeHtml(subtitle)} · कुल मुकदमे: ${cases.length}</p>
      </div>
      <div class="meta">
        ${profile ? `<div><strong>${escapeHtml(profile.name)}</strong> (${escapeHtml(profile.designation || 'अधिवक्ता')})</div>` : ''}
        ${profile?.district ? `<div>तहसील: ${escapeHtml(profile.tehsil || '—')}, जिला: ${escapeHtml(profile.district)}</div>` : ''}
        <div>दिनांक: ${formatHindiDate(getLocalDateString())}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:36px;text-align:center;">क्र.</th>
          <th>वाद संख्या</th>
          <th>न्यायालय</th>
          <th>वादी बनाम प्रतिवादी</th>
          <th>ग्राम / गाटा</th>
          <th>धारा</th>
          <th>पिछली तारीख</th>
          <th>अगली तारीख</th>
          <th>स्थिति</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="9" style="text-align:center;padding:18px;">इस रिपोर्ट में कोई मुकदमा उपलब्ध नहीं है।</td></tr>'}
      </tbody>
    </table>
    <div class="footer">
      <span>राजस्व न्यायालय केस डायरी (उत्तर प्रदेश) · निर्माता: ${escapeHtml(APP_CREATOR_CREDIT)}</span>
      <span>यह कंप्यूटर जनित आधिकारिक वाद सूची है।</span>
    </div>
  </body>
  </html>`;

  const doc = printFrame.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(printFrame);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();
    setTimeout(() => {
      if (printFrame.parentNode) document.body.removeChild(printFrame);
    }, 1500);
  }, 450);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Normalizes an HTTPS APK link into a direct-download URL.
 * Automatically converts Google Drive and Dropbox share links into 1-tap direct download URLs.
 */
export function normalizeDirectApkUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().slice(0, 2000);
  if (!trimmed) return '';
  if (!trimmed.startsWith('https://')) return '';

  // Convert Google Drive /file/d/<ID>/view or open?id=<ID> to direct download
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`;
  }
  const driveOpenMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveOpenMatch[1]}`;
  }

  // Convert Dropbox share link to direct download (?dl=1)
  if (trimmed.includes('dropbox.com/')) {
    if (trimmed.includes('dl=0')) return trimmed.replace('dl=0', 'dl=1');
    if (!trimmed.includes('dl=1')) {
      return `${trimmed}${trimmed.includes('?') ? '&' : '?'}dl=1`;
    }
  }

  return trimmed;
}
