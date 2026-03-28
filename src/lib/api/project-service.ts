/**
 * 项目业务 API 服务
 */

import { api } from './client';

export const projectService = {
  getProjects: () => api.get<any[]>('/api/projects').then(res => res.data),
  getProject: (id: number) => api.get<any>(`/api/projects/${id}`).then(res => res.data),
};
