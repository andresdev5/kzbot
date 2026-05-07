import { Gender, PollyVoice } from '../enums/PollyVoice';

export interface VoiceInfo {
  id: PollyVoice;
  language: string;
  languageCode: string;
  gender: Gender;
}

export const VOICE_CATALOG: VoiceInfo[] = [
  { id: PollyVoice.Zeina, language: 'Arabic', languageCode: 'arb', gender: 'Female' },
  { id: PollyVoice.Zhiyu, language: 'Chinese (Mandarin)', languageCode: 'cmn-CN', gender: 'Female' },
  { id: PollyVoice.Naja, language: 'Danish', languageCode: 'da-DK', gender: 'Female' },
  { id: PollyVoice.Mads, language: 'Danish', languageCode: 'da-DK', gender: 'Male' },
  { id: PollyVoice.Lotte, language: 'Dutch', languageCode: 'nl-NL', gender: 'Female' },
  { id: PollyVoice.Ruben, language: 'Dutch', languageCode: 'nl-NL', gender: 'Male' },
  { id: PollyVoice.Nicole, language: 'English (Australian)', languageCode: 'en-AU', gender: 'Female' },
  { id: PollyVoice.Russell, language: 'English (Australian)', languageCode: 'en-AU', gender: 'Male' },
  { id: PollyVoice.Amy, language: 'English (British)', languageCode: 'en-GB', gender: 'Female' },
  { id: PollyVoice.Emma, language: 'English (British)', languageCode: 'en-GB', gender: 'Female' },
  { id: PollyVoice.Brian, language: 'English (British)', languageCode: 'en-GB', gender: 'Male' },
  { id: PollyVoice.Aditi, language: 'English (Indian)', languageCode: 'en-IN', gender: 'Female' },
  { id: PollyVoice.Raveena, language: 'English (Indian)', languageCode: 'en-IN', gender: 'Female' },
  { id: PollyVoice.Ivy, language: 'English (US)', languageCode: 'en-US', gender: 'Female (child)' },
  { id: PollyVoice.Joanna, language: 'English (US)', languageCode: 'en-US', gender: 'Female' },
  { id: PollyVoice.Kendra, language: 'English (US)', languageCode: 'en-US', gender: 'Female' },
  { id: PollyVoice.Kimberly, language: 'English (US)', languageCode: 'en-US', gender: 'Female' },
  { id: PollyVoice.Salli, language: 'English (US)', languageCode: 'en-US', gender: 'Female' },
  { id: PollyVoice.Joey, language: 'English (US)', languageCode: 'en-US', gender: 'Male' },
  { id: PollyVoice.Kevin, language: 'English (US)', languageCode: 'en-US', gender: 'Male (child)' },
  { id: PollyVoice.Geraint, language: 'English (Welsh)', languageCode: 'en-GB-WLS', gender: 'Male' },
  { id: PollyVoice.Celine, language: 'French', languageCode: 'fr-FR', gender: 'Female' },
  { id: PollyVoice.Lea, language: 'French', languageCode: 'fr-FR', gender: 'Female' },
  { id: PollyVoice.Mathieu, language: 'French', languageCode: 'fr-FR', gender: 'Male' },
  { id: PollyVoice.Chantal, language: 'French (Canadian)', languageCode: 'fr-CA', gender: 'Female' },
  { id: PollyVoice.Marlene, language: 'German', languageCode: 'de-DE', gender: 'Female' },
  { id: PollyVoice.Vicki, language: 'German', languageCode: 'de-DE', gender: 'Female' },
  { id: PollyVoice.Hans, language: 'German', languageCode: 'de-DE', gender: 'Male' },
  { id: PollyVoice.Dora, language: 'Icelandic', languageCode: 'is-IS', gender: 'Female' },
  { id: PollyVoice.Karl, language: 'Icelandic', languageCode: 'is-IS', gender: 'Male' },
  { id: PollyVoice.Carla, language: 'Italian', languageCode: 'it-IT', gender: 'Female' },
  { id: PollyVoice.Bianca, language: 'Italian', languageCode: 'it-IT', gender: 'Female' },
  { id: PollyVoice.Giorgio, language: 'Italian', languageCode: 'it-IT', gender: 'Male' },
  { id: PollyVoice.Mizuki, language: 'Japanese', languageCode: 'ja-JP', gender: 'Female' },
  { id: PollyVoice.Takumi, language: 'Japanese', languageCode: 'ja-JP', gender: 'Male' },
  { id: PollyVoice.Seoyeon, language: 'Korean', languageCode: 'ko-KR', gender: 'Female' },
  { id: PollyVoice.Liv, language: 'Norwegian', languageCode: 'nb-NO', gender: 'Female' },
  { id: PollyVoice.Ewa, language: 'Polish', languageCode: 'pl-PL', gender: 'Female' },
  { id: PollyVoice.Maja, language: 'Polish', languageCode: 'pl-PL', gender: 'Female' },
  { id: PollyVoice.Jacek, language: 'Polish', languageCode: 'pl-PL', gender: 'Male' },
  { id: PollyVoice.Jan, language: 'Polish', languageCode: 'pl-PL', gender: 'Male' },
  { id: PollyVoice.Camila, language: 'Portuguese (Brazilian)', languageCode: 'pt-BR', gender: 'Female' },
  { id: PollyVoice.Vitoria, language: 'Portuguese (Brazilian)', languageCode: 'pt-BR', gender: 'Female' },
  { id: PollyVoice.Ricardo, language: 'Portuguese (Brazilian)', languageCode: 'pt-BR', gender: 'Male' },
  { id: PollyVoice.Ines, language: 'Portuguese (European)', languageCode: 'pt-PT', gender: 'Female' },
  { id: PollyVoice.Cristiano, language: 'Portuguese (European)', languageCode: 'pt-PT', gender: 'Male' },
  { id: PollyVoice.Carmen, language: 'Romanian', languageCode: 'ro-RO', gender: 'Female' },
  { id: PollyVoice.Tatyana, language: 'Russian', languageCode: 'ru-RU', gender: 'Female' },
  { id: PollyVoice.Maxim, language: 'Russian', languageCode: 'ru-RU', gender: 'Male' },
  { id: PollyVoice.Conchita, language: 'Spanish (Spain)', languageCode: 'es-ES', gender: 'Female' },
  { id: PollyVoice.Lucia, language: 'Spanish (Spain)', languageCode: 'es-ES', gender: 'Female' },
  { id: PollyVoice.Enrique, language: 'Spanish (Spain)', languageCode: 'es-ES', gender: 'Male' },
  { id: PollyVoice.Mia, language: 'Spanish (Mexican)', languageCode: 'es-MX', gender: 'Female' },
  { id: PollyVoice.Lupe, language: 'Spanish (US)', languageCode: 'es-US', gender: 'Female' },
  { id: PollyVoice.Penelope, language: 'Spanish (US)', languageCode: 'es-US', gender: 'Female' },
  { id: PollyVoice.Miguel, language: 'Spanish (US)', languageCode: 'es-US', gender: 'Male' },
  { id: PollyVoice.Astrid, language: 'Swedish', languageCode: 'sv-SE', gender: 'Female' },
  { id: PollyVoice.Filiz, language: 'Turkish', languageCode: 'tr-TR', gender: 'Female' },
  { id: PollyVoice.Gwyneth, language: 'Welsh', languageCode: 'cy-GB', gender: 'Female' },
];

const VOICE_BY_LOWER = new Map(VOICE_CATALOG.map((v) => [v.id.toLowerCase(), v]));

export function findVoice(name: string): VoiceInfo | undefined {
  return VOICE_BY_LOWER.get(name.trim().toLowerCase());
}

export function isValidVoice(name: string): boolean {
  return VOICE_BY_LOWER.has(name.trim().toLowerCase());
}

export function groupByLanguage(): Map<string, VoiceInfo[]> {
  const groups = new Map<string, VoiceInfo[]>();
  for (const voice of VOICE_CATALOG) {
    const key = `${voice.language} (${voice.languageCode})`;
    const list = groups.get(key) ?? [];
    list.push(voice);
    groups.set(key, list);
  }
  return groups;
}
