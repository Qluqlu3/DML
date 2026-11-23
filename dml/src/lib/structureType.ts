import { StructureType } from '@/generated/prisma/enums';

export const STRUCTURE_TYPE_LABELS: Record<StructureType, string> = {
  [StructureType.WOODEN]: '木造住宅',
  [StructureType.LIGHT_STEEL]: '軽量鉄骨造',
  [StructureType.STEEL]: '鉄骨造',
  [StructureType.RC]: 'RC造（鉄筋コンクリート）',
  [StructureType.OTHER]: 'その他',
};

export const STRUCTURE_TYPE_OPTIONS = Object.values(StructureType).map((value) => ({
  value,
  label: STRUCTURE_TYPE_LABELS[value],
}));
