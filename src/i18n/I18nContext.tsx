import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { zh, en, type Lang, type TranslationKey } from './translations';

interface I18nCtx {
  lang: Lang;
  t: (key: TranslationKey) => string;
  toggleLang: () => void;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nCtx>({
  lang: 'zh',
  t: (k) => zh[k],
  toggleLang: () => {},
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('monn-lang');
    return saved === 'en' ? 'en' : 'zh';
  });

  const t = useCallback((key: TranslationKey): string => {
    const map = lang === 'zh' ? zh : en;
    return map[key] ?? key;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('monn-lang', l);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'zh' ? 'en' : 'zh');
  }, [lang, setLang]);

  return (
    <I18nContext.Provider value={{ lang, t, toggleLang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
