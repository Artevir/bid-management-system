import { NextResponse } from 'next/server';

export type TenderCenterErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'UNKNOWN_ERROR';

function statusToCode(status: number): TenderCenterErrorCode {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'UNKNOWN_ERROR';
}

export function tenderCenterError(
  message: string,
  status: number,
  errorCode?: TenderCenterErrorCode
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      errorCode: errorCode || statusToCode(status),
    },
    { status }
  );
}
