export const SUPPORTED_LOCALES = [
  'en', 'ru', 'de', 'fr', 'es', 'pt-BR', 'it', 'pl', 'uk', 'tr', 'ja', 'ko', 'zh-CN', 'zh-TW',
] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

const en = {
  heading: 'HowLongToBeat', unofficial: 'Unofficial', loading: 'Loading completion times…',
  mainStory: 'Main Story', mainPlusExtras: 'Main + Extras', completionist: 'Completionist', unavailable: '—',
  cached: 'Cached', stale: 'Saved result', updated: 'Updated {date}', checked: 'Checked {date}',
  openHltb: 'Open on HowLongToBeat', searchHltb: 'Search on HowLongToBeat',
  notFound: 'No confident title match was found.', network: 'HowLongToBeat is temporarily unavailable.',
  networkDetail: 'Failed during HLTB {stage}{status}.', initializationStage: 'initialization', searchStage: 'search',
  rateLimited: 'Too many requests. Try again later.', serviceError: 'The completion times could not be loaded.',
  settings: 'Settings', categories: 'Visible categories', timeFormat: 'Time format', decimal: 'Decimal hours',
  hoursMinutes: 'Hours and minutes', cacheDuration: 'Cache duration', oneDay: '1 day', sevenDays: '7 days',
  thirtyDays: '30 days', clearCache: 'Clear cached games', cacheCleared: 'Cache cleared', saved: 'Saved',
  saveError: 'Extension connection failed',
} as const;

export type MessageKey = keyof typeof en;
type Catalog = Record<MessageKey, string>;

const messages: Record<Locale, Catalog> = {
  en,
  ru: {
    heading: 'HowLongToBeat', unofficial: 'Неофициально', loading: 'Загружаем время прохождения…',
    mainStory: 'Основной сюжет', mainPlusExtras: 'Сюжет + дополнения', completionist: 'Полное прохождение', unavailable: '—',
    cached: 'Из кэша', stale: 'Сохранённый результат', updated: 'Обновлено {date}', checked: 'Проверено {date}',
    openHltb: 'Открыть на HowLongToBeat', searchHltb: 'Найти на HowLongToBeat',
    notFound: 'Надёжное совпадение названия не найдено.', network: 'HowLongToBeat временно недоступен.',
    networkDetail: 'Сбой на этапе HLTB: {stage}{status}.', initializationStage: 'инициализация', searchStage: 'поиск',
    rateLimited: 'Слишком много запросов. Попробуйте позже.', serviceError: 'Не удалось загрузить время прохождения.',
    settings: 'Настройки', categories: 'Показываемые категории', timeFormat: 'Формат времени', decimal: 'Десятичные часы',
    hoursMinutes: 'Часы и минуты', cacheDuration: 'Срок хранения кэша', oneDay: '1 день', sevenDays: '7 дней',
    thirtyDays: '30 дней', clearCache: 'Очистить кэш игр', cacheCleared: 'Кэш очищен', saved: 'Сохранено',
    saveError: 'Нет связи с расширением',
  },
  de: {
    heading: 'HowLongToBeat', unofficial: 'Inoffiziell', loading: 'Spielzeiten werden geladen…',
    mainStory: 'Hauptgeschichte', mainPlusExtras: 'Hauptstory + Extras', completionist: 'Komplett', unavailable: '—',
    cached: 'Im Cache', stale: 'Gespeichertes Ergebnis', updated: 'Aktualisiert: {date}', checked: 'Geprüft: {date}',
    openHltb: 'Auf HowLongToBeat öffnen', searchHltb: 'Auf HowLongToBeat suchen',
    notFound: 'Keine eindeutige Titelübereinstimmung gefunden.', network: 'HowLongToBeat ist vorübergehend nicht verfügbar.',
    networkDetail: 'HLTB-Fehler bei {stage}{status}.', initializationStage: 'Initialisierung', searchStage: 'Suche',
    rateLimited: 'Zu viele Anfragen. Versuche es später erneut.', serviceError: 'Die Spielzeiten konnten nicht geladen werden.',
    settings: 'Einstellungen', categories: 'Sichtbare Kategorien', timeFormat: 'Zeitformat', decimal: 'Dezimalstunden',
    hoursMinutes: 'Stunden und Minuten', cacheDuration: 'Cache-Dauer', oneDay: '1 Tag', sevenDays: '7 Tage',
    thirtyDays: '30 Tage', clearCache: 'Spielcache leeren', cacheCleared: 'Cache geleert', saved: 'Gespeichert',
    saveError: 'Verbindung zur Erweiterung fehlgeschlagen',
  },
  fr: {
    heading: 'HowLongToBeat', unofficial: 'Non officiel', loading: 'Chargement des durées…',
    mainStory: 'Histoire principale', mainPlusExtras: 'Histoire + extras', completionist: 'Complétionniste', unavailable: '—',
    cached: 'En cache', stale: 'Résultat enregistré', updated: 'Mis à jour le {date}', checked: 'Vérifié le {date}',
    openHltb: 'Ouvrir sur HowLongToBeat', searchHltb: 'Rechercher sur HowLongToBeat',
    notFound: 'Aucune correspondance de titre fiable.', network: 'HowLongToBeat est temporairement indisponible.',
    networkDetail: 'Échec HLTB pendant {stage}{status}.', initializationStage: 'l’initialisation', searchStage: 'la recherche',
    rateLimited: 'Trop de requêtes. Réessayez plus tard.', serviceError: 'Impossible de charger les durées.',
    settings: 'Paramètres', categories: 'Catégories visibles', timeFormat: 'Format de durée', decimal: 'Heures décimales',
    hoursMinutes: 'Heures et minutes', cacheDuration: 'Durée du cache', oneDay: '1 jour', sevenDays: '7 jours',
    thirtyDays: '30 jours', clearCache: 'Vider le cache des jeux', cacheCleared: 'Cache vidé', saved: 'Enregistré',
    saveError: 'Connexion à l’extension impossible',
  },
  es: {
    heading: 'HowLongToBeat', unofficial: 'No oficial', loading: 'Cargando tiempos de juego…',
    mainStory: 'Historia principal', mainPlusExtras: 'Historia + extras', completionist: 'Completista', unavailable: '—',
    cached: 'En caché', stale: 'Resultado guardado', updated: 'Actualizado el {date}', checked: 'Comprobado el {date}',
    openHltb: 'Abrir en HowLongToBeat', searchHltb: 'Buscar en HowLongToBeat',
    notFound: 'No se encontró una coincidencia de título fiable.', network: 'HowLongToBeat no está disponible temporalmente.',
    networkDetail: 'Error de HLTB durante {stage}{status}.', initializationStage: 'la inicialización', searchStage: 'la búsqueda',
    rateLimited: 'Demasiadas solicitudes. Inténtalo más tarde.', serviceError: 'No se pudieron cargar los tiempos.',
    settings: 'Ajustes', categories: 'Categorías visibles', timeFormat: 'Formato de tiempo', decimal: 'Horas decimales',
    hoursMinutes: 'Horas y minutos', cacheDuration: 'Duración de la caché', oneDay: '1 día', sevenDays: '7 días',
    thirtyDays: '30 días', clearCache: 'Borrar caché de juegos', cacheCleared: 'Caché borrada', saved: 'Guardado',
    saveError: 'Falló la conexión con la extensión',
  },
  'pt-BR': {
    heading: 'HowLongToBeat', unofficial: 'Não oficial', loading: 'Carregando tempos de jogo…',
    mainStory: 'História principal', mainPlusExtras: 'História + extras', completionist: 'Complecionista', unavailable: '—',
    cached: 'Em cache', stale: 'Resultado salvo', updated: 'Atualizado em {date}', checked: 'Verificado em {date}',
    openHltb: 'Abrir no HowLongToBeat', searchHltb: 'Buscar no HowLongToBeat',
    notFound: 'Nenhuma correspondência confiável de título.', network: 'HowLongToBeat está temporariamente indisponível.',
    networkDetail: 'Falha do HLTB durante {stage}{status}.', initializationStage: 'a inicialização', searchStage: 'a busca',
    rateLimited: 'Muitas solicitações. Tente novamente mais tarde.', serviceError: 'Não foi possível carregar os tempos.',
    settings: 'Configurações', categories: 'Categorias visíveis', timeFormat: 'Formato de tempo', decimal: 'Horas decimais',
    hoursMinutes: 'Horas e minutos', cacheDuration: 'Duração do cache', oneDay: '1 dia', sevenDays: '7 dias',
    thirtyDays: '30 dias', clearCache: 'Limpar cache de jogos', cacheCleared: 'Cache limpo', saved: 'Salvo',
    saveError: 'Falha na conexão com a extensão',
  },
  it: {
    heading: 'HowLongToBeat', unofficial: 'Non ufficiale', loading: 'Caricamento dei tempi…',
    mainStory: 'Storia principale', mainPlusExtras: 'Storia + extra', completionist: 'Completista', unavailable: '—',
    cached: 'In cache', stale: 'Risultato salvato', updated: 'Aggiornato il {date}', checked: 'Verificato il {date}',
    openHltb: 'Apri su HowLongToBeat', searchHltb: 'Cerca su HowLongToBeat',
    notFound: 'Nessuna corrispondenza affidabile del titolo.', network: 'HowLongToBeat è temporaneamente non disponibile.',
    networkDetail: 'Errore HLTB durante {stage}{status}.', initializationStage: 'l’inizializzazione', searchStage: 'la ricerca',
    rateLimited: 'Troppe richieste. Riprova più tardi.', serviceError: 'Impossibile caricare i tempi.',
    settings: 'Impostazioni', categories: 'Categorie visibili', timeFormat: 'Formato del tempo', decimal: 'Ore decimali',
    hoursMinutes: 'Ore e minuti', cacheDuration: 'Durata cache', oneDay: '1 giorno', sevenDays: '7 giorni',
    thirtyDays: '30 giorni', clearCache: 'Svuota cache giochi', cacheCleared: 'Cache svuotata', saved: 'Salvato',
    saveError: 'Connessione all’estensione non riuscita',
  },
  pl: {
    heading: 'HowLongToBeat', unofficial: 'Nieoficjalne', loading: 'Wczytywanie czasu gry…',
    mainStory: 'Główna fabuła', mainPlusExtras: 'Fabuła + dodatki', completionist: 'Ukończenie 100%', unavailable: '—',
    cached: 'Z pamięci podręcznej', stale: 'Zapisany wynik', updated: 'Zaktualizowano {date}', checked: 'Sprawdzono {date}',
    openHltb: 'Otwórz w HowLongToBeat', searchHltb: 'Szukaj w HowLongToBeat',
    notFound: 'Nie znaleziono pewnego dopasowania tytułu.', network: 'HowLongToBeat jest tymczasowo niedostępny.',
    networkDetail: 'Błąd HLTB podczas etapu: {stage}{status}.', initializationStage: 'inicjalizacja', searchStage: 'wyszukiwanie',
    rateLimited: 'Zbyt wiele żądań. Spróbuj ponownie później.', serviceError: 'Nie udało się wczytać czasu gry.',
    settings: 'Ustawienia', categories: 'Widoczne kategorie', timeFormat: 'Format czasu', decimal: 'Godziny dziesiętne',
    hoursMinutes: 'Godziny i minuty', cacheDuration: 'Czas przechowywania', oneDay: '1 dzień', sevenDays: '7 dni',
    thirtyDays: '30 dni', clearCache: 'Wyczyść pamięć gier', cacheCleared: 'Pamięć wyczyszczona', saved: 'Zapisano',
    saveError: 'Błąd połączenia z rozszerzeniem',
  },
  uk: {
    heading: 'HowLongToBeat', unofficial: 'Неофіційно', loading: 'Завантаження часу проходження…',
    mainStory: 'Основний сюжет', mainPlusExtras: 'Сюжет + додаткове', completionist: 'Повне проходження', unavailable: '—',
    cached: 'Із кешу', stale: 'Збережений результат', updated: 'Оновлено {date}', checked: 'Перевірено {date}',
    openHltb: 'Відкрити на HowLongToBeat', searchHltb: 'Знайти на HowLongToBeat',
    notFound: 'Надійного збігу назви не знайдено.', network: 'HowLongToBeat тимчасово недоступний.',
    networkDetail: 'Помилка HLTB на етапі {stage}{status}.', initializationStage: 'ініціалізації', searchStage: 'пошуку',
    rateLimited: 'Забагато запитів. Спробуйте пізніше.', serviceError: 'Не вдалося завантажити час проходження.',
    settings: 'Налаштування', categories: 'Видимі категорії', timeFormat: 'Формат часу', decimal: 'Десяткові години',
    hoursMinutes: 'Години та хвилини', cacheDuration: 'Термін зберігання кешу', oneDay: '1 день', sevenDays: '7 днів',
    thirtyDays: '30 днів', clearCache: 'Очистити кеш ігор', cacheCleared: 'Кеш очищено', saved: 'Збережено',
    saveError: 'Немає зв’язку з розширенням',
  },
  tr: {
    heading: 'HowLongToBeat', unofficial: 'Resmî değil', loading: 'Oynama süreleri yükleniyor…',
    mainStory: 'Ana hikâye', mainPlusExtras: 'Ana hikâye + ekler', completionist: 'Tamamlama', unavailable: '—',
    cached: 'Önbellekten', stale: 'Kayıtlı sonuç', updated: 'Güncelleme: {date}', checked: 'Kontrol: {date}',
    openHltb: 'HowLongToBeat’te aç', searchHltb: 'HowLongToBeat’te ara',
    notFound: 'Güvenilir bir başlık eşleşmesi bulunamadı.', network: 'HowLongToBeat geçici olarak kullanılamıyor.',
    networkDetail: 'HLTB {stage} aşamasında başarısız oldu{status}.', initializationStage: 'başlatma', searchStage: 'arama',
    rateLimited: 'Çok fazla istek. Daha sonra tekrar deneyin.', serviceError: 'Oynama süreleri yüklenemedi.',
    settings: 'Ayarlar', categories: 'Görünür kategoriler', timeFormat: 'Süre biçimi', decimal: 'Ondalık saat',
    hoursMinutes: 'Saat ve dakika', cacheDuration: 'Önbellek süresi', oneDay: '1 gün', sevenDays: '7 gün',
    thirtyDays: '30 gün', clearCache: 'Oyun önbelleğini temizle', cacheCleared: 'Önbellek temizlendi', saved: 'Kaydedildi',
    saveError: 'Uzantı bağlantısı başarısız',
  },
  ja: {
    heading: 'HowLongToBeat', unofficial: '非公式', loading: 'クリア時間を読み込んでいます…',
    mainStory: 'メインストーリー', mainPlusExtras: 'メイン＋追加要素', completionist: 'コンプリート', unavailable: '—',
    cached: 'キャッシュ', stale: '保存済み結果', updated: '{date}更新', checked: '{date}確認',
    openHltb: 'HowLongToBeatで開く', searchHltb: 'HowLongToBeatで検索',
    notFound: '確実に一致するタイトルが見つかりません。', network: 'HowLongToBeatは一時的に利用できません。',
    networkDetail: 'HLTBの{stage}中に失敗しました{status}。', initializationStage: '初期化', searchStage: '検索',
    rateLimited: 'リクエストが多すぎます。後でもう一度お試しください。', serviceError: 'クリア時間を読み込めませんでした。',
    settings: '設定', categories: '表示するカテゴリー', timeFormat: '時間形式', decimal: '小数時間',
    hoursMinutes: '時間と分', cacheDuration: 'キャッシュ期間', oneDay: '1日', sevenDays: '7日',
    thirtyDays: '30日', clearCache: 'ゲームキャッシュを消去', cacheCleared: 'キャッシュを消去しました', saved: '保存しました',
    saveError: '拡張機能に接続できません',
  },
  ko: {
    heading: 'HowLongToBeat', unofficial: '비공식', loading: '플레이 시간을 불러오는 중…',
    mainStory: '메인 스토리', mainPlusExtras: '메인 + 추가 요소', completionist: '완전 공략', unavailable: '—',
    cached: '캐시됨', stale: '저장된 결과', updated: '{date} 업데이트', checked: '{date} 확인',
    openHltb: 'HowLongToBeat에서 열기', searchHltb: 'HowLongToBeat에서 검색',
    notFound: '확실하게 일치하는 제목을 찾지 못했습니다.', network: 'HowLongToBeat를 일시적으로 사용할 수 없습니다.',
    networkDetail: 'HLTB {stage} 중 실패했습니다{status}.', initializationStage: '초기화', searchStage: '검색',
    rateLimited: '요청이 너무 많습니다. 나중에 다시 시도하세요.', serviceError: '플레이 시간을 불러올 수 없습니다.',
    settings: '설정', categories: '표시할 카테고리', timeFormat: '시간 형식', decimal: '십진 시간',
    hoursMinutes: '시간 및 분', cacheDuration: '캐시 기간', oneDay: '1일', sevenDays: '7일',
    thirtyDays: '30일', clearCache: '게임 캐시 지우기', cacheCleared: '캐시를 지웠습니다', saved: '저장됨',
    saveError: '확장 프로그램 연결 실패',
  },
  'zh-CN': {
    heading: 'HowLongToBeat', unofficial: '非官方', loading: '正在加载通关时间…',
    mainStory: '主线剧情', mainPlusExtras: '主线 + 额外内容', completionist: '完全通关', unavailable: '—',
    cached: '缓存', stale: '已保存结果', updated: '更新于 {date}', checked: '检查于 {date}',
    openHltb: '在 HowLongToBeat 中打开', searchHltb: '在 HowLongToBeat 中搜索',
    notFound: '未找到可靠的标题匹配。', network: 'HowLongToBeat 暂时不可用。',
    networkDetail: 'HLTB 在{stage}时失败{status}。', initializationStage: '初始化', searchStage: '搜索',
    rateLimited: '请求过多，请稍后重试。', serviceError: '无法加载通关时间。',
    settings: '设置', categories: '显示类别', timeFormat: '时间格式', decimal: '十进制小时',
    hoursMinutes: '小时和分钟', cacheDuration: '缓存期限', oneDay: '1 天', sevenDays: '7 天',
    thirtyDays: '30 天', clearCache: '清除游戏缓存', cacheCleared: '缓存已清除', saved: '已保存',
    saveError: '扩展程序连接失败',
  },
  'zh-TW': {
    heading: 'HowLongToBeat', unofficial: '非官方', loading: '正在載入通關時間…',
    mainStory: '主線劇情', mainPlusExtras: '主線 + 額外內容', completionist: '完全通關', unavailable: '—',
    cached: '快取', stale: '已儲存結果', updated: '更新於 {date}', checked: '檢查於 {date}',
    openHltb: '在 HowLongToBeat 中開啟', searchHltb: '在 HowLongToBeat 中搜尋',
    notFound: '找不到可靠的標題配對。', network: 'HowLongToBeat 暫時無法使用。',
    networkDetail: 'HLTB 在{stage}時失敗{status}。', initializationStage: '初始化', searchStage: '搜尋',
    rateLimited: '要求過多，請稍後再試。', serviceError: '無法載入通關時間。',
    settings: '設定', categories: '顯示類別', timeFormat: '時間格式', decimal: '十進位小時',
    hoursMinutes: '小時和分鐘', cacheDuration: '快取期限', oneDay: '1 天', sevenDays: '7 天',
    thirtyDays: '30 天', clearCache: '清除遊戲快取', cacheCleared: '快取已清除', saved: '已儲存',
    saveError: '擴充功能連線失敗',
  },
};

const baseLocales: Record<string, Locale> = {
  en: 'en', ru: 'ru', de: 'de', fr: 'fr', es: 'es', pt: 'pt-BR', it: 'it',
  pl: 'pl', uk: 'uk', tr: 'tr', ja: 'ja', ko: 'ko',
};

export function detectLocale(language = navigator.language): Locale {
  const normalized = language.replace('_', '-').toLocaleLowerCase();
  if (normalized.startsWith('zh')) {
    return /(?:^|-)tw|(?:^|-)hk|(?:^|-)mo|(?:^|-)hant/.test(normalized) ? 'zh-TW' : 'zh-CN';
  }
  return baseLocales[normalized.split('-')[0] ?? ''] ?? 'en';
}

export function translate(key: MessageKey, locale: Locale, replacements: Record<string, string> = {}): string {
  let value = messages[locale][key];
  for (const [name, replacement] of Object.entries(replacements)) value = value.replace(`{${name}}`, replacement);
  return value;
}
