import { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";

import { darkColors, lightColors } from "./colors";

type ThemeContextType = {
  isDark: boolean;
  colors: typeof lightColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();

  const [isDark, setIsDark] = useState(systemScheme === "dark");

  const colors = isDark ? darkColors : lightColors;

  const toggleTheme = () => {
    setIsDark((current) => !current);
  };

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        colors,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
