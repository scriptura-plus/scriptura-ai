type Lang = "ru" | "en" | "es";

const BOOK_NAMES: Record<string, Record<Lang, string>> = {
  genesis:          { ru: "Бытие",              en: "Genesis",          es: "Génesis" },
  exodus:           { ru: "Исход",               en: "Exodus",           es: "Éxodo" },
  leviticus:        { ru: "Левит",               en: "Leviticus",        es: "Levítico" },
  numbers:          { ru: "Числа",               en: "Numbers",          es: "Números" },
  deuteronomy:      { ru: "Второзаконие",         en: "Deuteronomy",      es: "Deuteronomio" },
  joshua:           { ru: "Иисус Навин",          en: "Joshua",           es: "Josué" },
  judges:           { ru: "Судьи",               en: "Judges",           es: "Jueces" },
  ruth:             { ru: "Руфь",                en: "Ruth",             es: "Rut" },
  "1samuel":        { ru: "1 Царств",             en: "1 Samuel",         es: "1 Samuel" },
  "2samuel":        { ru: "2 Царств",             en: "2 Samuel",         es: "2 Samuel" },
  "1kings":         { ru: "3 Царств",             en: "1 Kings",          es: "1 Reyes" },
  "2kings":         { ru: "4 Царств",             en: "2 Kings",          es: "2 Reyes" },
  "1chronicles":    { ru: "1 Паралипоменон",       en: "1 Chronicles",     es: "1 Crónicas" },
  "2chronicles":    { ru: "2 Паралипоменон",       en: "2 Chronicles",     es: "2 Crónicas" },
  ezra:             { ru: "Ездра",               en: "Ezra",             es: "Esdras" },
  nehemiah:         { ru: "Неемия",              en: "Nehemiah",         es: "Nehemías" },
  esther:           { ru: "Есфирь",              en: "Esther",           es: "Ester" },
  job:              { ru: "Иов",                 en: "Job",              es: "Job" },
  psalms:           { ru: "Псалтирь",            en: "Psalms",           es: "Salmos" },
  proverbs:         { ru: "Притчи",              en: "Proverbs",         es: "Proverbios" },
  ecclesiastes:     { ru: "Екклесиаст",          en: "Ecclesiastes",     es: "Eclesiastés" },
  songofsolomon:    { ru: "Песня Песней",         en: "Song of Solomon",  es: "Cantares" },
  isaiah:           { ru: "Исаия",               en: "Isaiah",           es: "Isaías" },
  jeremiah:         { ru: "Иеремия",             en: "Jeremiah",         es: "Jeremías" },
  lamentations:     { ru: "Плач Иеремии",         en: "Lamentations",     es: "Lamentaciones" },
  ezekiel:          { ru: "Иезекииль",           en: "Ezekiel",          es: "Ezequiel" },
  daniel:           { ru: "Даниил",              en: "Daniel",           es: "Daniel" },
  hosea:            { ru: "Осия",                en: "Hosea",            es: "Oseas" },
  joel:             { ru: "Иоиль",               en: "Joel",             es: "Joel" },
  amos:             { ru: "Амос",                en: "Amos",             es: "Amós" },
  obadiah:          { ru: "Авдий",               en: "Obadiah",          es: "Abdías" },
  jonah:            { ru: "Иона",                en: "Jonah",            es: "Jonás" },
  micah:            { ru: "Михей",               en: "Micah",            es: "Miqueas" },
  nahum:            { ru: "Наум",                en: "Nahum",            es: "Nahúm" },
  habakkuk:         { ru: "Аввакум",             en: "Habakkuk",         es: "Habacuc" },
  zephaniah:        { ru: "Софония",             en: "Zephaniah",        es: "Sofonías" },
  haggai:           { ru: "Аггей",               en: "Haggai",           es: "Hageo" },
  zechariah:        { ru: "Захария",             en: "Zechariah",        es: "Zacarías" },
  malachi:          { ru: "Малахия",             en: "Malachi",          es: "Malaquías" },
  matthew:          { ru: "Матфея",              en: "Matthew",          es: "Mateo" },
  mark:             { ru: "Марка",               en: "Mark",             es: "Marcos" },
  luke:             { ru: "Луки",                en: "Luke",             es: "Lucas" },
  john:             { ru: "Иоанна",              en: "John",             es: "Juan" },
  acts:             { ru: "Деяния",              en: "Acts",             es: "Hechos" },
  romans:           { ru: "Римлянам",            en: "Romans",           es: "Romanos" },
  "1corinthians":   { ru: "1 Коринфянам",         en: "1 Corinthians",    es: "1 Corintios" },
  "2corinthians":   { ru: "2 Коринфянам",         en: "2 Corinthians",    es: "2 Corintios" },
  galatians:        { ru: "Галатам",             en: "Galatians",        es: "Gálatas" },
  ephesians:        { ru: "Ефесянам",            en: "Ephesians",        es: "Efesios" },
  philippians:      { ru: "Филиппийцам",          en: "Philippians",      es: "Filipenses" },
  colossians:       { ru: "Колоссянам",           en: "Colossians",       es: "Colosenses" },
  "1thessalonians": { ru: "1 Фессалоникийцам",    en: "1 Thessalonians",  es: "1 Tesalonicenses" },
  "2thessalonians": { ru: "2 Фессалоникийцам",    en: "2 Thessalonians",  es: "2 Tesalonicenses" },
  "1timothy":       { ru: "1 Тимофею",            en: "1 Timothy",        es: "1 Timoteo" },
  "2timothy":       { ru: "2 Тимофею",            en: "2 Timothy",        es: "2 Timoteo" },
  titus:            { ru: "Титу",                en: "Titus",            es: "Tito" },
  philemon:         { ru: "Филимону",            en: "Philemon",         es: "Filemón" },
  hebrews:          { ru: "Евреям",              en: "Hebrews",          es: "Hebreos" },
  james:            { ru: "Иакова",              en: "James",            es: "Santiago" },
  "1peter":         { ru: "1 Петра",             en: "1 Peter",          es: "1 Pedro" },
  "2peter":         { ru: "2 Петра",             en: "2 Peter",          es: "2 Pedro" },
  "1john":          { ru: "1 Иоанна",            en: "1 John",           es: "1 Juan" },
  "2john":          { ru: "2 Иоанна",            en: "2 John",           es: "2 Juan" },
  "3john":          { ru: "3 Иоанна",            en: "3 John",           es: "3 Juan" },
  jude:             { ru: "Иуды",                en: "Jude",             es: "Judas" },
  revelation:       { ru: "Откровение",          en: "Revelation",       es: "Apocalipsis" },
};

export function formatReference(args: {
  bookKey: string | null | undefined;
  chapter: number;
  verse: number;
  lang: Lang;
}): string | null {
  if (!args.bookKey) return null;
  const key = args.bookKey.toLowerCase().replace(/-/g, "");
  const names = BOOK_NAMES[key];
  if (!names) return null;
  return `${names[args.lang] ?? names.en} ${args.chapter}:${args.verse}`;
}
