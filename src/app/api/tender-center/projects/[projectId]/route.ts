import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { success } from '@/lib/api/error-handler';
import { resolveHubProjectAndVersion } from '@/app/api/tender-center/_hub';

// 040: GET /api/tender-center/projects/{projectId}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  return withAuth(request, async (_req, userId) => {
    const { project } = await resolveHubProjectAndVersion({ projectId, userId });
    return success(project);
  });
}
