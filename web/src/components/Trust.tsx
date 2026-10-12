import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { blockUser, fileReport } from '../mock/engine';
import { Modal } from './ui';
import type { ReportCategory } from '../types';

const CATEGORIES: [ReportCategory, string][] = [
  ['safety_concern', 'Safety concern'], ['unsafe_driving', 'Unsafe driving'], ['harassment', 'Harassment or discrimination'],
  ['no_show', 'No-show'], ['late_cancellation', 'Late cancellation'], ['commercial_activity', 'Looks like a commercial ride service'],
  ['inappropriate_content', 'Inappropriate content'], ['other', 'Something else'],
];

export function TrustActions({ reportedId, tripId, bookingId, allowBlock = true }: { reportedId?: string; tripId?: string; bookingId?: string; allowBlock?: boolean }) {
  const { me, run } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'report' | 'block' | null>(null);
  const [category, setCategory] = useState<ReportCategory>('safety_concern');
  const [details, setDetails] = useState('');
  if (!me || me.id === reportedId) return null;

  return (
    <>
      <div className="flex gap-2 text-sm">
        <button className="btn-ghost min-h-[36px] text-red-700" onClick={() => setMode('report')}>⚑ Report</button>
        {allowBlock && reportedId && <button className="btn-ghost min-h-[36px]" onClick={() => setMode('block')}>⦸ Block</button>}
      </div>
      <Modal open={mode === 'report'} title="Report a problem" onClose={() => setMode(null)}>
        <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-800">In danger right now? <strong>Call 911.</strong> This platform is not an emergency service.</p>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          if (run((db, now) => fileReport(db, me.id, { reportedId, tripId, bookingId, category, details }, now), 'Report sent. The pilot team reviews reports within 24 hours.')) {
            setMode(null); setDetails('');
          }
        }}>
          <div><label htmlFor="rc" className="label">What happened?</label>
            <select id="rc" className="input" value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></div>
          <div><label htmlFor="rd" className="label">Details</label>
            <textarea id="rd" required maxLength={2000} rows={4} className="input" value={details} onChange={(e) => setDetails(e.target.value)} />
            <p className="hint">Only the pilot team will see this. The person you report won’t see it.</p></div>
          <button className="btn-primary w-full">Send report</button>
        </form>
      </Modal>
      <Modal open={mode === 'block'} title="Block this person?" onClose={() => setMode(null)}>
        <p className="text-sm text-ink-700">You won’t see each other’s trips or profiles, and neither of you can request seats from or message the other. They aren’t told. You can unblock from your profile.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn-outline flex-1" onClick={() => setMode(null)}>Cancel</button>
          <button className="btn-danger flex-1" onClick={() => { if (run((db) => blockUser(db, me.id, reportedId!), 'Blocked.')) { setMode(null); navigate('/search'); } }}>Block</button>
        </div>
      </Modal>
    </>
  );
}
