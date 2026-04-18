import ManagementPageShell from '../components/ManagementPageShell';
import BillManager from './BillManager';

export default function BillsPage() {
  return (
    <ManagementPageShell
      eyebrow="Billing management"
      title="Bills"
      description="Create and manage patient bills with detailed item breakdowns."
    >
      <BillManager />
    </ManagementPageShell>
  );
}