import ManagementPageShell from '../components/ManagementPageShell';
import PatientManager from './PatientManager';

export default function PatientsPage() {
  return (
    <ManagementPageShell
      eyebrow="Patient management"
      title="Patients"
      description="Add new patients, store visit details, and review recent patient records from a single interface."
    >
      <PatientManager />
    </ManagementPageShell>
  );
}
