import type { Timestamp } from 'firebase/firestore';

export type CaseStatus =
  | 'नवीन वाद'
  | 'नोटिस जारी'
  | 'नोटिस तामील'
  | 'जवाब दाखिल'
  | 'साक्ष्य'
  | 'बहस'
  | 'आदेश सुरक्षित'
  | 'आदेश पारित'
  | 'निस्तारित'
  | 'अपील'
  | 'स्थगित';

export type DocumentCategory =
  | 'PDF'
  | 'न्यायालय आदेश'
  | 'वाद पत्र'
  | 'लिखित कथन'
  | 'राजस्व अभिलेख'
  | 'खतौनी'
  | 'खसरा'
  | 'नक्शा'
  | 'लेखपाल रिपोर्ट'
  | 'अन्य दस्तावेज़';

export type ContactRole =
  | 'विपक्षी अधिवक्ता'
  | 'पक्षकार'
  | 'गवाह'
  | 'अन्य';

export const CONTACT_ROLES: ContactRole[] = [
  'विपक्षी अधिवक्ता',
  'पक्षकार',
  'गवाह',
  'अन्य',
];

export const DEFAULT_COURTS: string[] = [
  'उपजिलाधिकारी न्यायालय',
  'उपजिलाधिकारी न्यायिक न्यायालय',
  'तहसीलदार न्यायालय',
  'तहसीलदार न्यायिक न्यायालय',
  'नायब तहसीलदार न्यायालय',
  'ग्राम न्यायालय',
];

export const CASE_STATUSES: CaseStatus[] = [
  'नवीन वाद',
  'नोटिस जारी',
  'नोटिस तामील',
  'जवाब दाखिल',
  'साक्ष्य',
  'बहस',
  'आदेश सुरक्षित',
  'आदेश पारित',
  'निस्तारित',
  'अपील',
  'स्थगित',
];

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'PDF',
  'न्यायालय आदेश',
  'वाद पत्र',
  'लिखित कथन',
  'राजस्व अभिलेख',
  'खतौनी',
  'खसरा',
  'नक्शा',
  'लेखपाल रिपोर्ट',
  'अन्य दस्तावेज़',
];

export const COMMON_REVENUE_SECTIONS: string[] = [
  'धारा 24 (सीमांकन / मेड़बंदी)',
  'धारा 25 (मार्गाधिकार / चकरोड)',
  'धारा 34 (नामांतरण / दाखिल-खारिज)',
  'धारा 38 (अभिलेख एवं नक्शा दुरुस्ती)',
  'धारा 67 (ग्राम सभा भूमि से बेदखली)',
  'धारा 80 (अकृषिक भूमि घोषणा)',
  'धारा 101 (भूमि विनिमय)',
  'धारा 116 (खाता विभाजन / बंटवारा)',
  'धारा 144 (घोषणात्मक वाद)',
  'धारा 207 (अपील)',
  'धारा 210 (निगरानी)',
  'धारा 209 (पुनर्स्थापन / रिकॉल)',
];

export const UP_DISTRICTS: string[] = [
  'आगरा', 'अलीगढ़', 'अम्बेडकर नगर', 'अमेठी', 'अमरोहा', 'औरैया', 'अयोध्या', 'आजमगढ़',
  'बागपत', 'बहराइच', 'बलिया', 'बलरामपुर', 'बांदा', 'बाराबंकी', 'बरेली', 'बस्ती',
  'भदोही', 'बिजनौर', 'बदायूँ', 'बुलंदशहर', 'चंदौली', 'चित्रकूट', 'देवरिया', 'एटा',
  'इटावा', 'फर्रुखाबाद', 'फतेहपुर', 'फिरोजाबाद', 'गौतम बुद्ध नगर', 'गाजियाबाद', 'गाजीपुर',
  'गोंडा', 'गोरखपुर', 'हमीरपुर', 'हापुड़', 'हरदोई', 'हाथरस', 'जालौन', 'जौनपुर',
  'झांसी', 'कन्नौज', 'कानपुर देहात', 'कानपुर नगर', 'कासगंज', 'कौशाम्बी', 'कुशीनगर',
  'लखीमपुर खीरी', 'ललितपुर', 'लखनऊ', 'महाराजगंज', 'महोबा', 'मैनपुरी', 'मथुरा', 'मऊ',
  'मेरठ', 'मिर्जापुर', 'मुरादाबाद', 'मुजफ्फरनगर', 'पीलीभीत', 'प्रतापगढ़', 'प्रयागराज',
  'रायबरेली', 'रामपुर', 'सहारनपुर', 'संभल', 'संत कबीर नगर', 'शाहजहाँपुर', 'शामली',
  'श्रावस्ती', 'सिद्धार्थनगर', 'सीतापुर', 'सोनभद्र', 'सुल्तानपुर', 'उन्नाव', 'वाराणसी',
];

export interface UserProfile {
  uid: string;
  name: string;
  mobileNumber: string;
  email?: string;
  address: string;
  designation: string;
  district: string;
  tehsil: string;
  photoUrl?: string;
  role: 'user' | 'admin';
  isBlocked: boolean;
  caseCount: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AppSettings {
  appName: string;
  maintenanceMode: boolean;
  announcement: string;
  allowNewRegistrations: boolean;
  defaultReminderDays: number;
  apkDownloadUrl?: string;
  apkVersion?: string;
  updatedAt?: Timestamp | null;
  updatedBy: string;
}

export interface UserCourt {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  presidingOfficer?: string;
  tehsil?: string;
  district?: string;
  createdAt?: Timestamp | null;
}

export interface RevenueCase {
  id: string;
  ownerId: string;
  caseNumber: string;
  computerizedCaseNumber: string;
  courtName: string;
  presidingOfficer: string;
  plaintiffName: string;
  defendantName: string;
  advocateName: string;
  clientMobile: string;
  village: string;
  pargana: string;
  tehsil: string;
  district: string;
  gataNumber: string;
  section: string;
  subject: string;
  filingDate: string;
  previousDate: string;
  nextDate: string;
  status: CaseStatus;
  lekhpalReportPending: boolean;
  kanungoReportPending: boolean;
  notes: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface DailyDiaryEntry {
  id: string;
  ownerId: string;
  caseId: string;
  entryDate: string;
  proceedings: string;
  partyPresent: string;
  advocatePresent: string;
  oppositePartyPresent: string;
  lekhpalReportStatus: string;
  kanungoReportStatus: string;
  reportFiled: boolean;
  orderPassed: boolean;
  orderDetails: string;
  nextDate: string;
  nextDateWork: string;
  createdAt?: Timestamp | null;
}

export interface CaseDocument {
  id: string;
  ownerId: string;
  caseId: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  fileType: string;
  fileSize: number;
  downloadUrl: string;
  storagePath: string;
  notes: string;
  uploadedAt?: Timestamp | null;
}

export interface CustomReminder {
  id: string;
  ownerId: string;
  caseId: string;
  caseNumber: string;
  title: string;
  reminderDate: string;
  reminderTime: string;
  note: string;
  isCompleted: boolean;
  createdAt?: Timestamp | null;
}

export interface CaseContact {
  id: string;
  ownerId: string;
  name: string;
  role: ContactRole;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  barRegOrRelation: string;
  caseId: string;
  caseNumber: string;
  notes: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AutoNotification {
  id: string;
  type: 'today' | 'tomorrow' | 'threeDays' | 'custom';
  urgency: 'high' | 'medium' | 'info';
  title: string;
  subtitle: string;
  date: string;
  caseId?: string;
  reminderId?: string;
}

export type ActiveTab =
  | 'home'
  | 'cases'
  | 'new-case'
  | 'calendar'
  | 'profile'
  | 'reports'
  | 'admin';

export type CasePresetFilter =
  | 'all'
  | 'today'
  | 'tomorrow'
  | 'next7'
  | 'pending'
  | 'disposed'
  | 'orderPending'
  | 'reportPending';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'uk3190156@gmail.com';
export const APP_CREATOR_CREDIT = 'UMESH VERMA ADVOCATE';
export const LEGAL_EMBLEM_URL = '/src/assets/images/legal_emblem_seal_1795087335830.jpg';
export const COURTHOUSE_HERO_URL = '/src/assets/images/courthouse_twilight_hero_1795087317554.jpg';
