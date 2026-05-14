/**
 * @alio/mock-data — hardcoded fixtures.
 * Types here act as the implicit data contract for the engineer's later backend integration.
 */

export type Person = {
  id: string;
  name: string;
  avatarUrl?: string;
};

export const SAMPLE_ELDER: Person = {
  id: 'elder-001',
  name: 'Harold Mitchell',
};

// =============================================================
// Caregiver Logs — conversation fixtures
// =============================================================

export type ConversationTurn =
  | { kind: 'user-audio'; id: string; time: string; transcript: string }
  | { kind: 'user-text'; id: string; text: string }
  | { kind: 'ai-tasks'; id: string; intro: string; tasks: { id: string; label: string; done: boolean }[] }
  | { kind: 'ai-summary'; id: string; summary: string; mood: string; medicationsNoted: string[]; urgent: boolean }
  | { kind: 'report'; id: string; reportId: string; patientName: string; visitDate: string; visitTime: string | null };

export const INITIAL_CONVERSATION: ConversationTurn[] = [
  {
    kind: 'user-audio',
    id: 'turn-1',
    time: '2:39',
    transcript:
      'I just measured the blood pressure and the results shows normal. Gonna give her her daily medication next.',
  },
  {
    kind: 'ai-tasks',
    id: 'turn-2',
    intro: 'I got the number done. Here are the rest of the two do for today.',
    tasks: [
      { id: 't1', label: 'Clean the toilet', done: true },
      { id: 't2', label: 'Help Sarah shower', done: false },
      { id: 't3', label: 'Daily medication', done: false },
      { id: 't4', label: 'Daily medication', done: false },
    ],
  },
  {
    kind: 'user-audio',
    id: 'turn-3',
    time: '3:02',
    transcript:
      'I just measured the blood pressure and the results shows normal. Gonna give her her daily medication next.',
  },
  {
    kind: 'ai-tasks',
    id: 'turn-4',
    intro: 'I got the number done. Here are the rest of the two do for today.',
    tasks: [
      { id: 't5', label: 'Clean the toilet', done: true },
      { id: 't6', label: 'Help Sarah shower', done: true },
      { id: 't7', label: 'Daily medication', done: false },
      { id: 't8', label: 'Daily medication', done: false },
    ],
  },
];

// =============================================================
// Caregiver Logs — history fixtures
// =============================================================

export type LogHistoryItem = {
  id: string;
  patientName: string;
  date: string; // "2026/4/5 13:03"
};

export const LOGS_HISTORY: LogHistoryItem[] = [
  { id: 'log-1', patientName: "Sarah's Log", date: '2026/4/5 13:03' },
  { id: 'log-2', patientName: "Jassie's Log", date: '2026/2/9 13:03' },
  { id: 'log-3', patientName: "Aaron's Log", date: '2026/9/9 13:43' },
  { id: 'log-4', patientName: "Feis's Log", date: '2026/9/9 13:43' },
  { id: 'log-5', patientName: "Naomi's Log", date: '2026/9/9 13:43' },
  { id: 'log-6', patientName: "Jack's Log", date: '2026/9/9 13:43' },
];

// =============================================================
// Recording — simulated transcript text reveal
// =============================================================

export const SIMULATED_TRANSCRIPT =
  'I just measured the blood pressure and the results shows normal. Gonna give her her daily medication next.';

// =============================================================
// Patients — for caregiver Home patient list + patient switcher
// =============================================================

export type Patient = {
  id: string;
  name: string;
  time: string;        // "10:00 AM"
  address: string;     // "1234 Maple St"
  fullAddress: string; // "1234 Maple St, Portland, OR"
  avatarUrl?: string;
  emergencyContacts: PatientContact[];
};

export type PatientContact = {
  id: string;
  name: string;
  relation: string;    // "Daughter", "Son"
  phone: string;
};

export const SAMPLE_PATIENTS: Patient[] = [
  {
    id: 'dorothy-chen',
    name: 'Dorothy Chen',
    time: '10:00 AM',
    address: '1234 Maple St',
    fullAddress: '1234 Maple St, Portland, OR',
    avatarUrl: '/avatars/elder1.png',
    emergencyContacts: [
      { id: 'c1', name: 'Janet Chen', relation: 'Daughter', phone: '(503) 555-0192' },
      { id: 'c2', name: 'Robert Chen', relation: 'Son', phone: '(503) 555-0192' },
    ],
  },
  {
    id: 'margaret-williams',
    name: 'Margaret Williams',
    time: '10:00 AM',
    address: '1234 Maple St',
    fullAddress: '1234 Maple St, Portland, OR',
    avatarUrl: '/avatars/elder2.avif',
    emergencyContacts: [
      { id: 'c1', name: 'Patricia Williams', relation: 'Daughter', phone: '(503) 555-0123' },
    ],
  },
  {
    id: 'harold-foster',
    name: 'Harold Foster',
    time: '4:00 PM',
    address: '890 Pine Blvd',
    fullAddress: '890 Pine Blvd, Portland, OR',
    avatarUrl: '/avatars/elder3.webp',
    emergencyContacts: [
      { id: 'c1', name: 'Mary Foster', relation: 'Wife', phone: '(503) 555-0145' },
    ],
  },
];

// The caregiver themselves (for CG Home header)
export const SAMPLE_CG_USER = {
  id: 'caregiver-001',
  name: 'Sarah Mitchell',
  role: 'Caregiver' as const,
  avatarUrl: '/avatars/nurse.png',
  notifications: 2,
};

// =============================================================
// Medical records (Family Records tab)
// =============================================================

export type RecordType = 'Lab report' | 'Prescription' | 'Other';

export type MedicalRecord = {
  id: string;
  title: string;
  type: RecordType;
  date: string; // "May 02, 2026"
};

export const SAMPLE_RECORDS: MedicalRecord[] = [
  { id: 'r1', title: 'Cardiology Follow-up',   type: 'Lab report',   date: 'May 02, 2026' },
  { id: 'r2', title: 'Metformin 150mg',         type: 'Prescription', date: 'May 01, 2026' },
  { id: 'r3', title: 'Physical Therapy Plan',   type: 'Other',        date: 'Mar 03, 2026' },
  { id: 'r4', title: 'HbA1c Test',              type: 'Lab report',   date: 'May 02, 2026' },
  { id: 'r5', title: 'Ibuprofen 150mg',         type: 'Prescription', date: 'May 01, 2026' },
  { id: 'r6', title: 'Blood Pressure Log',      type: 'Lab report',   date: 'April 22, 2026' },
];

export const RECORDS_OWNER = {
  label: "Dr. Harold's Records",
  countLabel: '6 records on file',
  syncStatus: 'Synced' as const,
};

// =============================================================
// Family Home — caregiver status + vitals + calendar + appointments
// =============================================================

export type CaregiverStatus = 'on-the-way' | 'arrived' | 'in-progress' | 'complete';

export type Caregiver = {
  id: string;
  name: string;
  visits: number;
  avatarUrl?: string;
};

export const SAMPLE_CAREGIVER: Caregiver = {
  id: 'caregiver-001',
  name: 'Sarah Mitchell',
  visits: 87,
};

export type Vital = {
  id: string;
  label: string;
  value: string;
  // icon name — UI maps this to an actual icon component
  iconHint:
    | 'blood-count'
    | 'blood-status'
    | 'heart-rate'
    | 'pressure'
    | 'medications';
};

export const SAMPLE_VITALS: Vital[] = [
  { id: 'v1', label: 'Blood Count', value: '80-90', iconHint: 'blood-count' },
  { id: 'v2', label: 'Blood Stutas', value: '116/70', iconHint: 'blood-status' }, // typo from Figma kept
  { id: 'v3', label: 'Heart Rate', value: '120 bpm', iconHint: 'heart-rate' },
  { id: 'v4', label: 'Pressure', value: 'Normal', iconHint: 'pressure' },
];

export type Medication = {
  id: string;
  name: string;
  dose: string;
};

export const SAMPLE_MEDICATIONS: Medication[] = [
  { id: 'm1', name: 'Metaformin', dose: '150mg' },
];

export type Appointment = {
  id: string;
  month: string; // "May"
  day: number; // 20
  title: string;
  provider: string;
  time: string;
};

export const SAMPLE_APPOINTMENTS: Appointment[] = [
  {
    id: 'a1',
    month: 'May',
    day: 20,
    title: 'Primary Care Checkup',
    provider: 'Dr. Rowan',
    time: '10:00 AM',
  },
  {
    id: 'a2',
    month: 'May',
    day: 24,
    title: 'Physical Therapy',
    provider: 'Portland PT',
    time: '11:00 AM',
  },
  {
    id: 'a3',
    month: 'May',
    day: 30,
    title: 'Cardiology Follow-up',
    provider: 'Dr. Rowan',
    time: '10:00 AM',
  },
];

// Calendar metadata for the displayed month
export type CalendarMonth = {
  monthLabel: string; // "May 2026"
  year: number;
  month: number; // 0-indexed
  todayDay: number; // 18
  selectedDay: number; // 24 (user-selected)
};

export const SAMPLE_CALENDAR: CalendarMonth = {
  monthLabel: 'May 2026',
  year: 2026,
  month: 4, // May
  todayDay: 18,
  selectedDay: 24,
};

// =============================================================
// Chat — thread list + conversation messages (Caregiver portal)
// =============================================================

export type ChatThread = {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  pinned?: boolean;
  isGroup?: boolean;
  isTyping?: boolean;
  /** Online status — only meaningful for 1:1 threads. */
  status?: 'online' | 'offline';
  /** Path to a single avatar image (1:1 threads + as primary on the conversation header). */
  avatarUrl?: string;
  /** For group threads — 2-3 image paths rendered as stacked/overlapping faces. */
  groupAvatars?: string[];
};

export const SAMPLE_CHAT_THREADS: ChatThread[] = [
  {
    id: 'sarah-circle',
    name: "Sarah Mitchell's care circle",
    lastMessage: 'Thank you very much!',
    timestamp: '11:38AM',
    unreadCount: 2,
    pinned: true,
    isGroup: true,
    status: 'online',
    avatarUrl: '/avatars/nurse.png',
    groupAvatars: ['/avatars/nurse.png', '/avatars/person1.avif', '/avatars/person2.webp'],
  },
  {
    id: 'mitchells-family',
    name: 'Mitchells Family',
    lastMessage: 'Danna is typing...',
    timestamp: '10:18AM',
    unreadCount: 1,
    isGroup: true,
    isTyping: true,
    avatarUrl: '/avatars/person2.webp',
    groupAvatars: ['/avatars/person2.webp', '/avatars/person3.avif', '/avatars/person4.avif'],
  },
  {
    id: 'miranda',
    name: 'Miranda',
    lastMessage: 'I will let her know.',
    timestamp: '10:10AM',
    unreadCount: 1,
    avatarUrl: '/avatars/person1.avif',
  },
  {
    id: 'charles',
    name: 'Charles',
    lastMessage: "When's the next appointment...",
    timestamp: '10:10AM',
    unreadCount: 1,
    avatarUrl: '/avatars/person3.avif',
  },
  {
    id: 'emily',
    name: 'Emily',
    lastMessage: "When's the next appointment...",
    timestamp: '10:08AM',
    unreadCount: 1,
    avatarUrl: '/avatars/person4.avif',
  },
];

export type ChatMessage = {
  id: string;
  sender: 'me' | 'them';
  text: string;
  /** Optional image attached to a "me" message (e.g., AI image recognition uploads). */
  imageUrl?: string;
  timestamp?: string;
};

// =============================================================
// Family AI Check — conversation w/ image recognition
// =============================================================

export const SAMPLE_AI_CONVERSATION: ChatMessage[] = [
  {
    id: 'a1',
    sender: 'me',
    text: 'Dorothy seems to have some side effect on the drugs',
    imageUrl: '/chat/hand-closeup.jpg',
  },
  {
    id: 'a2',
    sender: 'them',
    text: 'Got it. Included in daily report. Do you want me to generate more specific medical influence summary?',
  },
];

// =============================================================
// Family-side chat — same data shape, different cast of contacts
// (the user is a family member; their threads are with the caregiver,
//  other family members, and a doctor).
// =============================================================

export const SAMPLE_FM_CHAT_THREADS: ChatThread[] = [
  {
    id: 'sarah-caregiver',
    name: 'Sarah Mitchell',
    lastMessage: 'Just finished morning meds, all good!',
    timestamp: '11:24AM',
    unreadCount: 1,
    pinned: true,
    status: 'online',
    avatarUrl: '/avatars/nurse.png',
  },
  {
    id: 'dorothy-circle',
    name: "Dorothy's Care Circle",
    lastMessage: "Janet: Will visit Sunday",
    timestamp: '10:42AM',
    unreadCount: 3,
    isGroup: true,
    avatarUrl: '/avatars/elder1.png',
    groupAvatars: ['/avatars/elder1.png', '/avatars/nurse.png', '/avatars/person1.avif'],
  },
  {
    id: 'dr-rowan',
    name: 'Dr. Rowan',
    lastMessage: 'Following up on the test results',
    timestamp: '9:18AM',
    unreadCount: 1,
    avatarUrl: '/avatars/person4.avif',
  },
  {
    id: 'patricia',
    name: 'Patricia Williams',
    lastMessage: 'Patricia is typing...',
    timestamp: '8:55AM',
    unreadCount: 0,
    isTyping: true,
    avatarUrl: '/avatars/person2.webp',
  },
  {
    id: 'janet',
    name: 'Janet Chen',
    lastMessage: 'Mom seems happier today',
    timestamp: 'Yesterday',
    unreadCount: 0,
    avatarUrl: '/avatars/person1.avif',
  },
];

export const SAMPLE_FM_CONVERSATIONS: Record<string, ChatMessage[]> = {
  'sarah-caregiver': [
    { id: 'fm-m1', sender: 'them', text: 'Good morning! Just arrived at the house.' },
    { id: 'fm-m2', sender: 'me',   text: 'Thanks Sarah! How is mom doing today?' },
    { id: 'fm-m3', sender: 'them', text: 'She is in good spirits. BP looks normal — 120/80.' },
    { id: 'fm-m4', sender: 'me',   text: 'Wonderful. Could you make sure she takes her morning meds?' },
    { id: 'fm-m5', sender: 'them', text: 'Just finished morning meds, all good!' },
  ],
  'dorothy-circle': [
    { id: 'fm-d1', sender: 'them', text: 'Sarah: Dorothy had a great morning today 🌞' },
    { id: 'fm-d2', sender: 'me',   text: "That's wonderful to hear!" },
    { id: 'fm-d3', sender: 'them', text: 'Janet: Will visit Sunday' },
  ],
  'dr-rowan': [
    { id: 'fm-r1', sender: 'them', text: 'Following up on the test results from last week.' },
    { id: 'fm-r2', sender: 'them', text: 'Everything looks within normal range — I want to schedule a follow-up in 4 weeks.' },
  ],
  janet: [
    { id: 'fm-j1', sender: 'them', text: 'Mom seems happier today' },
    { id: 'fm-j2', sender: 'me',   text: 'I noticed too — the new physical therapy plan might be helping.' },
  ],
};

/** Sample conversation per thread. Defaults to a "no messages yet" empty state. */
export const SAMPLE_CONVERSATIONS: Record<string, ChatMessage[]> = {
  'sarah-circle': [
    { id: 'm1', sender: 'me', text: 'Hi Sarah, how is Harold doing today?' },
    { id: 'm2', sender: 'them', text: "He's stable. Blood pressure looks good — 116/70." },
    { id: 'm3', sender: 'me', text: 'Did he take the morning meds?' },
    { id: 'm4', sender: 'them', text: 'Yes, all of them. He had toast and tea for breakfast.' },
    { id: 'm5', sender: 'me', text: 'Thank you very much!' },
  ],
  miranda: [
    { id: 'm1', sender: 'them', text: 'Hey, has Mom been eating well this week?' },
    { id: 'm2', sender: 'me', text: 'Sarah reports she had toast + tea this morning and finished her dinner yesterday.' },
    { id: 'm3', sender: 'them', text: 'I will let her know.' },
  ],
};
