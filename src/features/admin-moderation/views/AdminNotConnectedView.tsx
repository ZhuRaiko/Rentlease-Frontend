import { AdminHeading, AdminNotConnected } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';

/** Actions and Audit have no backend source yet. They show that plainly instead of sample restrictions or history. */
export function AdminNotConnectedView({ section }: { section: 'enforcement' | 'audit' }) {
  return section === 'enforcement' ? (
    <AdminScaffold title="Actions">
      <AdminHeading title="Account and listing actions" />
      <AdminNotConnected
        body="Warning, restricting or suspending accounts and removing listings are not available in the app yet. Report decisions only record an outcome; they do not change any account or listing."
        title="No actions can be taken from here"
      />
    </AdminScaffold>
  ) : (
    <AdminScaffold title="Audit history">
      <AdminHeading title="Audit history" />
      <AdminNotConnected
        body="Admin decisions are saved, but a readable audit history is not connected to the app yet. Nothing is listed here until it is."
        title="No audit history to show"
      />
    </AdminScaffold>
  );
}
