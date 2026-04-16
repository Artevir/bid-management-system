import { redirect } from 'next/navigation';

export default async function TenderCenterProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/tender-center/${projectId}/overview`);
}
