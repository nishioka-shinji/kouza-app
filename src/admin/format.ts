// students.status の英語値と画面表示の対訳。散らさずここ 1 箇所にまとめる。
// migrations の CHECK 制約と値の集合を一致させること。片方だけ増やすと CHECK 違反で 500 になる。
export const STUDENT_STATUS_LABELS = {
  enrolled: '受講中',
  completed: '修了',
} as const

export type StudentStatus = keyof typeof STUDENT_STATUS_LABELS

export const formatStudentStatus = (status: string): string =>
  STUDENT_STATUS_LABELS[status as StudentStatus] ?? status
