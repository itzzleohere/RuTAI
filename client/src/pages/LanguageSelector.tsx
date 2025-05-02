import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/store/auth";
import { useLanguage } from "@/lib/i18n";

export default function LanguageSelector() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { setLanguage, t } = useLanguage();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleLanguageSelect = (lang: string) => {
    setLanguage(lang);
    navigate('/login');
  };

  return (
    <div className="p-4 pt-6 bg-white">
      <h1 className="text-2xl font-bold text-center mb-8">
        {t('common.appTitle')}
      </h1>
      <div className="mb-4 text-center">
        <p className="mb-6 text-neutral-700">{t('language.selectPrompt')}</p>
        <div className="grid grid-cols-1 gap-4 max-w-xs mx-auto">
          <button 
            className="flex items-center justify-between p-4 rounded-lg border border-primary-100 hover:bg-primary-50 transition-colors duration-200"
            onClick={() => handleLanguageSelect('en')}
          >
            <span className="font-medium">English</span>
            <span className="text-lg">🇬🇧</span>
          </button>
          <button 
            className="flex items-center justify-between p-4 rounded-lg border border-primary-100 hover:bg-primary-50 transition-colors duration-200"
            onClick={() => handleLanguageSelect('hi')}
          >
            <span className="font-medium">हिन्दी</span>
            <span className="text-lg">🇮🇳</span>
          </button>
          <button 
            className="flex items-center justify-between p-4 rounded-lg border border-primary-100 hover:bg-primary-50 transition-colors duration-200"
            onClick={() => handleLanguageSelect('ta')}
          >
            <span className="font-medium">தமிழ்</span>
            <span className="text-lg">🇮🇳</span>
          </button>
        </div>
      </div>
    </div>
  );
}
