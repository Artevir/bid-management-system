/**
 * Shared access checks for /api/support/* application resources.
 * Centralizes project membership + ownership rules to avoid nested-route drift.
 */

import { db } from '@/db';
import {
  authorizationApplications,
  authorizationManufacturers,
  authorizationQualifications,
  authorizationTodos,
  partnerApplications,
  sampleApplications,
  priceApplications,
  partnerMaterials,
  partnerFees,
  partnerTodos,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { hasProjectPermission } from '@/lib/project/member';

export async function canAccessAuthorizationApplication(
  applicationId: number,
  userId: number,
  action: 'view' | 'edit'
) {
  const [application] = await db
    .select({
      id: authorizationApplications.id,
      projectId: authorizationApplications.projectId,
      createdBy: authorizationApplications.createdBy,
      handlerId: authorizationApplications.handlerId,
    })
    .from(authorizationApplications)
    .where(eq(authorizationApplications.id, applicationId))
    .limit(1);

  if (!application) return { allowed: false, exists: false };
  if (application.createdBy === userId || application.handlerId === userId) {
    return { allowed: true, exists: true };
  }

  const hasAccess = await hasProjectPermission(
    application.projectId,
    userId,
    action === 'view' ? 'view' : 'edit'
  );
  return { allowed: hasAccess, exists: true };
}

export async function canAccessPartnerApplication(
  applicationId: number,
  userId: number,
  action: 'view' | 'edit'
) {
  const [application] = await db
    .select({
      id: partnerApplications.id,
      projectId: partnerApplications.projectId,
      createdBy: partnerApplications.createdBy,
      handlerId: partnerApplications.handlerId,
    })
    .from(partnerApplications)
    .where(eq(partnerApplications.id, applicationId))
    .limit(1);

  if (!application) return { allowed: false, exists: false };
  if (application.createdBy === userId || application.handlerId === userId) {
    return { allowed: true, exists: true };
  }

  if (application.projectId) {
    const hasAccess = await hasProjectPermission(
      application.projectId,
      userId,
      action === 'view' ? 'view' : 'edit'
    );
    return { allowed: hasAccess, exists: true };
  }

  return { allowed: false, exists: true };
}

export async function canAccessSampleApplication(
  applicationId: number,
  userId: number,
  action: 'view' | 'edit'
) {
  const [application] = await db
    .select({
      id: sampleApplications.id,
      projectId: sampleApplications.projectId,
      createdBy: sampleApplications.createdBy,
      handlerId: sampleApplications.handlerId,
    })
    .from(sampleApplications)
    .where(eq(sampleApplications.id, applicationId))
    .limit(1);

  if (!application) return { allowed: false, exists: false };
  if (application.createdBy === userId || application.handlerId === userId) {
    return { allowed: true, exists: true };
  }

  if (application.projectId) {
    const hasAccess = await hasProjectPermission(
      application.projectId,
      userId,
      action === 'view' ? 'view' : 'edit'
    );
    return { allowed: hasAccess, exists: true };
  }

  return { allowed: false, exists: true };
}

export async function canAccessPriceApplication(
  applicationId: number,
  userId: number,
  action: 'view' | 'edit'
) {
  const [application] = await db
    .select({
      id: priceApplications.id,
      projectId: priceApplications.projectId,
      createdBy: priceApplications.createdBy,
      handlerId: priceApplications.handlerId,
    })
    .from(priceApplications)
    .where(eq(priceApplications.id, applicationId))
    .limit(1);

  if (!application) return { allowed: false, exists: false };
  if (application.createdBy === userId || application.handlerId === userId) {
    return { allowed: true, exists: true };
  }

  if (application.projectId) {
    const hasAccess = await hasProjectPermission(
      application.projectId,
      userId,
      action === 'view' ? 'view' : 'edit'
    );
    return { allowed: hasAccess, exists: true };
  }

  return { allowed: false, exists: true };
}

export async function assertPartnerMaterialBelongs(applicationId: number, materialId: number) {
  const row = await db.query.partnerMaterials.findFirst({
    where: and(
      eq(partnerMaterials.id, materialId),
      eq(partnerMaterials.applicationId, applicationId)
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function assertPartnerFeeBelongs(applicationId: number, feeId: number) {
  const row = await db.query.partnerFees.findFirst({
    where: and(eq(partnerFees.id, feeId), eq(partnerFees.applicationId, applicationId)),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function assertPartnerTodoBelongs(applicationId: number, todoId: number) {
  const row = await db.query.partnerTodos.findFirst({
    where: and(eq(partnerTodos.id, todoId), eq(partnerTodos.applicationId, applicationId)),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function assertAuthorizationManufacturerBelongs(
  applicationId: number,
  manufacturerId: number
) {
  const row = await db.query.authorizationManufacturers.findFirst({
    where: and(
      eq(authorizationManufacturers.id, manufacturerId),
      eq(authorizationManufacturers.applicationId, applicationId)
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function assertAuthorizationTodoBelongs(applicationId: number, todoId: number) {
  const row = await db.query.authorizationTodos.findFirst({
    where: and(
      eq(authorizationTodos.id, todoId),
      eq(authorizationTodos.applicationId, applicationId)
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function getAuthorizationTodoApplicationId(todoId: number): Promise<number | null> {
  const row = await db.query.authorizationTodos.findFirst({
    where: eq(authorizationTodos.id, todoId),
    columns: { applicationId: true },
  });
  return row?.applicationId ?? null;
}

export async function assertAuthorizationQualificationBelongsToManufacturer(
  manufacturerId: number,
  qualificationId: number
) {
  const row = await db.query.authorizationQualifications.findFirst({
    where: and(
      eq(authorizationQualifications.id, qualificationId),
      eq(authorizationQualifications.manufacturerId, manufacturerId)
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

export async function getAuthorizationManufacturerApplicationId(
  manufacturerId: number
): Promise<number | null> {
  const row = await db.query.authorizationManufacturers.findFirst({
    where: eq(authorizationManufacturers.id, manufacturerId),
    columns: { applicationId: true },
  });
  return row?.applicationId ?? null;
}

export async function getAuthorizationQualificationApplicationId(
  qualificationId: number
): Promise<number | null> {
  const row = await db
    .select({ applicationId: authorizationManufacturers.applicationId })
    .from(authorizationQualifications)
    .innerJoin(
      authorizationManufacturers,
      eq(authorizationQualifications.manufacturerId, authorizationManufacturers.id)
    )
    .where(eq(authorizationQualifications.id, qualificationId))
    .limit(1);
  return row[0]?.applicationId ?? null;
}
