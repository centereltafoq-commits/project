export interface GradeLevel {
  id: string;
  name: string;
  code: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGradeLevelPayload {
  name: string;
  code?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface UpdateGradeLevelPayload {
  name?: string;
  code?: string;
  orderIndex?: number;
  isActive?: boolean;
}
