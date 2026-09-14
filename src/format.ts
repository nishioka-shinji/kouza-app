// D1 の CURRENT_TIMESTAMP は "YYYY-MM-DD HH:MM:SS" 形式の UTC で、タイムゾーン指示子を持たない。
// そのまま new Date() に渡すとローカルタイム扱いになるため、T区切り・Z付与でUTCと確定させる。
export const formatJst = (utcTimestamp: string | null): string => {
  if (utcTimestamp === null) {
    return ''
  }

  const date = new Date(`${utcTimestamp.replace(' ', 'T')}Z`)

  if (Number.isNaN(date.getTime())) {
    return utcTimestamp
  }

  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}
