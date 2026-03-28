/**
 * 项目业务 React Query Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { projectService } from '@/lib/api/project-service';

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getProjects(),
  });
};

export const useProject = (id: number) => {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.getProject(id),
    enabled: !!id,
  });
};
