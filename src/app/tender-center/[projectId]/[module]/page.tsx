import { TenderCenterHubModuleView } from '../tender-center-hub-module';

export default async function TenderCenterModulePage({
  params,
}: {
  params: Promise<{ projectId: string; module: string }>;
}) {
  const { projectId, module } = await params;
  return <TenderCenterHubModuleView projectId={projectId} module={module} />;
}
