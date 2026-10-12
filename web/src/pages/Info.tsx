import { useParams } from 'react-router-dom';
import { EmptyState, PageHeader } from '../components/ui';

const DRAFT = (
  <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
    <strong>Draft placeholder.</strong> This text has not been reviewed by a lawyer and isn’t the final policy. It shows where the content will go.
  </p>
);

const PAGES: Record<string, { title: string; body: JSX.Element }> = {
  terms: { title: 'Terms of Use', body: <>{DRAFT}<ul className="list-disc space-y-2 pl-5">
    <li>This platform helps people find and arrange personal, cost-shared carpools. We are not a transportation provider, taxi or ride-hailing service.</li>
    <li>You must be 18 or older. Drivers must hold a valid licence and insurance, and only offer seats on trips they are already making.</li>
    <li>Contributions are proposed by drivers toward trip costs, are not fares, and are settled directly between users.</li>
    <li>We may suspend accounts that break these terms or the Community Safety Rules.</li>
    <li>Final terms, including liability and dispute provisions, will be prepared with legal counsel before launch.</li>
  </ul></> },
  privacy: { title: 'Privacy Notice', body: <>{DRAFT}<ul className="list-disc space-y-2 pl-5">
    <li><b>What we collect:</b> email, password (hashed by our auth provider), display name, full name, optional phone and photo, trips, bookings, messages, reports, feedback and basic usage events.</li>
    <li><b>Who sees what:</b> other members see only your display name, optional photo, short bio, member-since date and completed-ride count. Exact meeting points are shown only to accepted passengers. Phone numbers are shared only if both people opt in after acceptance.</li>
    <li><b>We don’t</b> collect home addresses or payment information, use advertising trackers, or sell data.</li>
    <li><b>Retention, access and deletion:</b> details to be confirmed. Contact the pilot privacy contact.</li>
  </ul></> },
  safety: { title: 'Community Safety Rules', body: <>{DRAFT}<ul className="list-disc space-y-2 pl-5">
    <li>Meet only at public pickup zones. Never share your home address.</li>
    <li>Be respectful. Harassment and discrimination aren’t tolerated.</li>
    <li>Drivers: no impairment, obey traffic laws, everyone wears a seatbelt, and use child seats as required by law.</li>
    <li>Anyone may decline or end a ride if they feel unsafe.</li>
    <li>Share your trip details with someone you trust.</li>
    <li>In an emergency, call 911. Then report it to us in the app.</li>
    <li>We don’t verify identity, licences or insurance. Use your judgement.</li>
  </ul></> },
  contributions: { title: 'How contributions work', body: <ul className="list-disc space-y-2 pl-5">
    <li>Drivers may propose a per-passenger contribution toward trip costs such as fuel, parking and wear. They can also ask for nothing.</li>
    <li>It is not a fare, and drivers should not make a profit. The pilot sets a cap.</li>
    <li>You settle directly, e.g. cash or e-Transfer. The platform doesn’t process payments or take a commission.</li>
    <li>After the trip, we’ll ask whether the contribution was settled. This helps us learn, and we never collect banking details.</li>
  </ul> },
  faq: { title: 'Pilot FAQ', body: <div className="space-y-3">
    <div><b>How long is the pilot?</b><p>Four weeks, covering Surrey, South Surrey and White Rock.</p></div>
    <div><b>Will there always be a ride?</b><p>No. Trips depend on what neighbours publish. If nothing fits, tell us the ride you need.</p></div>
    <div><b>Are drivers verified?</b><p>No. Drivers self-declare that they hold a licence and insurance. We don’t verify this.</p></div>
    <div><b>What if someone cancels?</b><p>Either party can cancel in the app. Cancelling within 2 hours of departure is recorded as a late cancellation.</p></div>
  </div> },
};

export function InfoPage() {
  const { page = '' } = useParams();
  const p = PAGES[page];
  if (!p) return <EmptyState title="Page not found" />;
  return <div className="mx-auto max-w-2xl"><PageHeader title={p.title} back="/" /><div className="card text-sm leading-relaxed text-ink-700">{p.body}</div></div>;
}
