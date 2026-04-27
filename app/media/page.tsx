import type { Metadata } from 'next';

import MediaManager from './MediaManager';

export const metadata: Metadata = {
  title: 'Patient Media — Hospital Management',
  description: 'Upload and manage patient photos and videos',
};

export default function MediaPage() {
  return <MediaManager />;
}
