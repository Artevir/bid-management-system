import { TenderCenterHubModuleView } from '../tender-center-hub-module';

export default async function TenderCenterTemplatesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <TenderCenterHubModuleView projectId={projectId} module="templates" />;
}
