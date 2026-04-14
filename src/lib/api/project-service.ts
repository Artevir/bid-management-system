/**
 * 项目业务 API 服务
 */

import { api } from './client';
import { unwrapPaginatedItems, unwrapSuccessData } from './response';

export const projectService = {
  getProjects: () =>
    api
      .get<any>('/api/projects')
      .then((res) => unwrapPaginatedItems<any>(res)),
  getProject: (id: number) =>
    api
      .get<any>(`/api/projects/${id}`)
      .then((res) => unwrapSuccessData<any>(res) || null),
};
