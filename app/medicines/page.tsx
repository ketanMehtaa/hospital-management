import ManagementPageShell from '../components/ManagementPageShell';
import MedicineManager from './MedicineManager';

export default function MedicinesPage() {
  return (
    <ManagementPageShell
      eyebrow="Medicine inventory"
      title="Inventory"
      description="Manage medicine stock, pricing, batches, and expiry details from one dashboard."
    >
      <MedicineManager />
    </ManagementPageShell>
  );
}
