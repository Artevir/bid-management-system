import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/middleware', () => ({
  withAuth: async (request: NextRequest, handler: (req: NextRequest, userId: number) => unknown) =>
    handler(request, 1),
  withPermission: async (
    request: NextRequest,
    _permission: string,
    handler: (req: NextRequest, userId: number) => unknown
  ) => handler(request, 1),
}));

import { GET as getTemplateVariables } from '@/app/api/tender-center/templates/[templateId]/variables/route';
import { GET as getRequirementDetail } from '@/app/api/tender-center/requirements/[requirementId]/route';
import { POST as closeRisk } from '@/app/api/tender-center/risks/[riskId]/close/route';
import { POST as submitReview } from '@/app/api/tender-center/reviews/[reviewTaskId]/submit/route';
import { POST as resolveConflict } from '@/app/api/tender-center/conflicts/[conflictId]/resolve/route';

describe('Tender Center Contract Guards', () => {
  it('returns 400 for invalid templateId', async () => {
    const req = new NextRequest('http://localhost/api/tender-center/templates/x/variables');
    const res = await getTemplateVariables(req, {
      params: Promise.resolve({ templateId: 'bad-template-id' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for invalid requirementId', async () => {
    const req = new NextRequest('http://localhost/api/tender-center/requirements/abc');
    const res = await getRequirementDetail(req, {
      params: Promise.resolve({ requirementId: 'abc' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for invalid riskId close action', async () => {
    const req = new NextRequest('http://localhost/api/tender-center/risks/invalid/close', {
      method: 'POST',
      body: JSON.stringify({ comment: 'x' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await closeRisk(req, {
      params: Promise.resolve({ riskId: 'invalid' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for invalid reviewTaskId submit action', async () => {
    const req = new NextRequest('http://localhost/api/tender-center/reviews/invalid/submit', {
      method: 'POST',
      body: JSON.stringify({ decision: 'approved' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await submitReview(req, {
      params: Promise.resolve({ reviewTaskId: 'invalid' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for invalid risk action', async () => {
    const req = new NextRequest('http://localhost/api/tender-center/risks/req-1/close', {
      method: 'POST',
      body: JSON.stringify({ action: 'invalid_action' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await closeRisk(req, {
      params: Promise.resolve({ riskId: 'req-1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('errorCode', 'BAD_REQUEST');
  });

  it('returns 400 for invalid conflict resolutionType', async () => {
    const req = new NextRequest('http://localhost/api/tender-center/conflicts/conflict-1/resolve', {
      method: 'POST',
      body: JSON.stringify({ resolutionType: 'invalid_type' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await resolveConflict(req, {
      params: Promise.resolve({ conflictId: 'conflict-1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('errorCode', 'BAD_REQUEST');
  });
});
