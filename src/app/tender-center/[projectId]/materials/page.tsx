import { TenderCenterHubModuleView } from '../tender-center-hub-module';

export default async function TenderCenterMaterialsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <TenderCenterHubModuleView projectId={projectId} module="materials" />;
}
