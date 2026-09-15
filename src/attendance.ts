// attendances.status の英語値と画面表示の対訳。webhook と管理画面の両方から使うため src/admin には置かない。
// migrations の CHECK 制約と値の集合を一致させること。片方だけ増やすと CHECK 違反で 500 になる。
export const ATTENDANCE_STATUS_LABELS = {
  present: '出席',
  absent: '欠席',
  late: '遅刻',
} as const

export type AttendanceStatus = keyof typeof ATTENDANCE_STATUS_LABELS

export const formatAttendanceStatus = (status: string): string =>
  ATTENDANCE_STATUS_LABELS[status as AttendanceStatus] ?? status
