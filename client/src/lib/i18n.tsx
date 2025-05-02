import React, { createContext, useContext, useState, useEffect } from "react";
import en from "./locales/en";
import hi from "./locales/hi";
import ta from "./locales/ta";

type Translations = {
  [key: string]: string | { [key: string]: string | { [key: string]: string } };
};

type LanguageContextType = {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
};

const translations: { [key: string]: Translations } = {
  en,
  hi,
  ta,
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: () => "",
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage && Object.keys(translations).includes(savedLanguage)) {
      setLanguageState(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: string) => {
    if (Object.keys(translations).includes(lang)) {
      localStorage.setItem("language", lang);
      setLanguageState(lang);
    }
  };

  const t = (key: string, params?: Record<string, string>) => {
    // Split the key by dots to access nested objects
    const keys = key.split(".");
    let value: any = translations[language];
    
    // Navigate through the nested objects
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        // If the key doesn't exist in the current language, try English as fallback
        value = translations["en"];
        for (const fallbackKey of keys) {
          if (value && typeof value === "object" && fallbackKey in value) {
            value = value[fallbackKey];
          } else {
            return key; // Return the key itself if not found in fallback
          }
        }
      }
    }
    
    // If the final value is not a string, return the key
    if (typeof value !== "string") {
      return key;
    }
    
    // Replace parameters if they exist
    if (params) {
      return Object.entries(params).reduce(
        (acc, [paramKey, paramValue]) => 
          acc.replace(new RegExp(`{{${paramKey}}}`, "g"), paramValue),
        value
      );
    }
    
    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

// Wrap the main app with this provider
export const withLanguage = (Component: React.ComponentType) => {
  return function WithLanguage(props: any) {
    return (
      <LanguageProvider>
        <Component {...props} />
      </LanguageProvider>
    );
  };
};