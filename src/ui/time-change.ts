import type { TimeChange, TimeFormat } from '../core/contracts';
import type { Locale } from './i18n';

const words: Record<Locale, { new: string; removed: string; increased: string; decreased: string; since: string }> = {
  en: { new: 'NEW', removed: 'REMOVED', increased: 'Increased', decreased: 'Decreased', since: 'since' },
  ru: { new: 'НОВОЕ', removed: 'УДАЛЕНО', increased: 'Увеличилось', decreased: 'Уменьшилось', since: 'с' },
  de: { new: 'NEU', removed: 'ENTFERNT', increased: 'Gestiegen', decreased: 'Gesunken', since: 'seit' },
  fr: { new: 'NOUVEAU', removed: 'RETIRÉ', increased: 'Augmenté', decreased: 'Diminué', since: 'depuis' },
  es: { new: 'NUEVO', removed: 'RETIRADO', increased: 'Aumentó', decreased: 'Disminuyó', since: 'desde' },
  'pt-BR': { new: 'NOVO', removed: 'REMOVIDO', increased: 'Aumentou', decreased: 'Diminuiu', since: 'desde' },
  it: { new: 'NUOVO', removed: 'RIMOSSO', increased: 'Aumentato', decreased: 'Diminuito', since: 'dal' },
  pl: { new: 'NOWE', removed: 'USUNIĘTE', increased: 'Wzrosło', decreased: 'Spadło', since: 'od' },
  uk: { new: 'НОВЕ', removed: 'ВИДАЛЕНО', increased: 'Збільшилось', decreased: 'Зменшилось', since: 'з' },
  tr: { new: 'YENİ', removed: 'KALDIRILDI', increased: 'Arttı', decreased: 'Azaldı', since: 'tarihinden beri' },
  ja: { new: '新規', removed: '削除', increased: '増加', decreased: '減少', since: '以降' },
  ko: { new: '신규', removed: '삭제됨', increased: '증가', decreased: '감소', since: '이후' },
  'zh-CN': { new: '新增', removed: '已移除', increased: '增加', decreased: '减少', since: '自' },
  'zh-TW': { new: '新增', removed: '已移除', increased: '增加', decreased: '減少', since: '自' },
};

function compactDuration(minutes: number, format: TimeFormat, locale: Locale): string | null {
  const absolute = Math.abs(minutes);
  if (format === 'decimal') {
    const rounded = Math.round(absolute / 30) * 30;
    if (rounded === 0) return null;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(rounded / 60)}h`;
  }
  if (absolute === 0) return null;
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  return `${hours ? `${hours}h` : ''}${hours && remainder ? ' ' : ''}${remainder ? `${remainder}m` : ''}`;
}

export function describeTimeChange(change: TimeChange, format: TimeFormat, locale: Locale, baselineAt: number | null): { text: string; tone: 'up' | 'down' | 'new' | 'removed'; description: string } | null {
  if (!change) return null;
  const dictionary = words[locale];
  const date = baselineAt === null ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(baselineAt);
  const suffix = date ? ` ${dictionary.since} ${date}` : '';
  if (change.kind === 'new') return { text: dictionary.new, tone: 'new', description: `${dictionary.new}${suffix}` };
  if (change.kind === 'removed') return { text: dictionary.removed, tone: 'removed', description: `${dictionary.removed}${suffix}` };
  const duration = compactDuration(change.minutes, format, locale);
  if (!duration) return null;
  const up = change.minutes > 0;
  return {
    text: `${up ? '▲' : '▼'} ${duration}`,
    tone: up ? 'up' : 'down',
    description: `${up ? dictionary.increased : dictionary.decreased} ${duration}${suffix}`,
  };
}
