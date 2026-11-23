import type { Metadata } from 'next';
import { ClassroomToolsDisplay } from '@/components/classroom-tools/ClassroomToolsDisplay';

export const metadata: Metadata = { title: 'Classroom tools · Projector' };

export default function ClassroomToolsDisplayPage() {
  return <ClassroomToolsDisplay />;
}
