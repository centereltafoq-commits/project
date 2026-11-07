import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gradeLevelsApi } from './grade-levels-api';

export function useGradeLevels(activeOnly = true) {
  const query = useQuery({
    queryKey: ['grade-levels', { activeOnly }],
    queryFn: () => gradeLevelsApi.list(activeOnly),
    staleTime: 1000 * 60 * 5,
  });

  const options = useMemo(() => {
    return (query.data || []).map((item) => ({
      value: item.name,
      label: item.name,
    }));
  }, [query.data]);

  return {
    ...query,
    gradeLevels: query.data || [],
    options,
  };
}

