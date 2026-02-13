/**
 * Detect date/deadline patterns in text and parse into structured items.
 * Used for "Capture from page" to find dates the user might want to add to calendar.
 */

export interface CapturedDateItem {
  id: string;
  title: string;
  date: Date;
  endDate?: Date; // optional end for events; same day + 1hr if not set
  context: string; // snippet of surrounding text
}

const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec';

// Regex patterns that capture a date and optional preceding context (title/deadline wording)
const PATTERNS: Array<{
  regex: RegExp;
  extract: (match: RegExpMatchArray, fullText: string) => { date: Date; title: string; context: string } | null;
}> = [
    // Due: Jan 15, 2025 / Due Jan 15
    {
      regex: new RegExp(
        `(?:due|deadline|by|on|date)\\s*:?\\s*(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?`,
        'gi'
      ),
      extract: (m, full) => {
        const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
        const month = parseMonth(m[1]);
        const day = parseInt(m[2], 10);
        if (!month || day < 1 || day > 31) return null;
        const date = new Date(year, month, day);
        if (isNaN(date.getTime())) return null;
        const context = getContext(full, m.index!, m[0].length);
        return { date, title: context.slice(0, 60), context };
      },
    },
    // 2025-02-14, 02/14/2025, 2/14/25
    {
      regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
      extract: (m, full) => {
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10) - 1;
        const d = parseInt(m[3], 10);
        const date = new Date(y, mo, d);
        if (isNaN(date.getTime())) return null;
        const context = getContext(full, m.index!, m[0].length);
        return { date, title: context.slice(0, 60), context };
      },
    },
    {
      regex: /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g,
      extract: (m, full) => {
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        let y = parseInt(m[3], 10);
        if (y < 100) y += y < 50 ? 2000 : 1900;
        const date = new Date(y, b - 1, a); // US style MM/DD/YYYY
        if (isNaN(date.getTime())) return null;
        const context = getContext(full, m.index!, m[0].length);
        return { date, title: context.slice(0, 60), context };
      },
    },
    // January 15, 2025 / Jan 15
    {
      regex: new RegExp(`(${MONTHS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?`, 'gi'),
      extract: (m, full) => {
        const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
        const month = parseMonth(m[1]);
        const day = parseInt(m[2], 10);
        if (!month || day < 1 || day > 31) return null;
        const date = new Date(year, month, day);
        if (isNaN(date.getTime())) return null;
        const context = getContext(full, m.index!, m[0].length);
        return { date, title: context.slice(0, 60), context };
      },
    },
  ];

function parseMonth(s: string): number | null {
  const m: Record<string, number> = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5,
    july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
  };
  const n = m[s.toLowerCase().trim()];
  return n !== undefined ? n : null;
}

function getContext(text: string, start: number, matchLen: number): string {
  const before = Math.max(0, start - 80);
  const after = Math.min(text.length, start + matchLen + 60);
  let snippet = text.slice(before, after).replace(/\s+/g, ' ').trim();
  if (snippet.length > 120) snippet = snippet.slice(0, 117) + '...';
  return snippet || 'Detected date';
}

/**
 * Scan text for date-like patterns and return deduplicated items (same day merged by title).
 */
export function detectDatesInText(text: string, pageTitle?: string): CapturedDateItem[] {
  const seen = new Set<string>();
  const results: CapturedDateItem[] = [];
  const normalized = text.replace(/\s+/g, ' ');

  for (const { regex, extract } of PATTERNS) {
    let m: RegExpMatchArray | null;
    regex.lastIndex = 0;
    while ((m = regex.exec(normalized)) !== null) {
      const parsed = extract(m, normalized);
      if (!parsed) continue;
      const key = `${parsed.date.toDateString()}-${parsed.title.slice(0, 30)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Only include future or today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsed.date < today) continue;
      const endDate = new Date(parsed.date);
      endDate.setHours(endDate.getHours() + 1, endDate.getMinutes(), 0, 0);
      results.push({
        id: `cap-${results.length}-${Date.now()}`,
        title: parsed.title || pageTitle || 'Captured event',
        date: parsed.date,
        endDate,
        context: parsed.context,
      });
    }
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Generate an .ics file string that Google Calendar can import.
 */
export function buildIcsFile(items: CapturedDateItem[], _calendarName = 'Orbit Captured'): string {
  const formatICSDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}${m}${day}T${h}${min}${s}Z`;
  };
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const events = items
    .map((item) => {
      const start = formatICSDate(item.date);
      const end = item.endDate ? formatICSDate(item.endDate) : formatICSDate(new Date(item.date.getTime() + 60 * 60 * 1000));
      const uid = `${item.id}-${item.date.getTime()}@orbit`;
      const stamp = formatICSDate(new Date());
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escape(item.title)}`,
        `DESCRIPTION:${escape(item.context)}`,
        'END:VEVENT',
      ].join('\r\n');
    })
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Orbit//Capture//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Trigger download of an .ics file in the browser.
 */
export function downloadIcs(icsContent: string, filename = 'orbit-captured.ics'): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
