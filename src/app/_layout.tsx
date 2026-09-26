import { Tabs } from "expo-router";

import { useFonts } from "expo-font";
import Navbar from "../components/Navbar";
import { ThemeProvider } from "../theme";
import { SQLiteProvider } from "expo-sqlite";
import { migrateDatabase } from "../database/migrations";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NType82: require("../../assets/fonts/NType82-Regular.otf"),
    NType82Headline: require("../../assets/fonts/NType82-Headline.otf"),
    NType82Mono: require("../../assets/fonts/NType82Mono-Regular.otf"),

    Ndot57: require("../../assets/fonts/Ndot57-Regular.otf"),
    Ndot57Caps: require("../../assets/fonts/Ndot57Caps-Regular.otf"),
    Ndot55: require("../../assets/fonts/Ndot55-Regular.otf"),

    LetteraMono: require("../../assets/fonts/LetteraMonoLL-Regular.otf"),
    LetteraMonoMedium: require("../../assets/fonts/LetteraMonoLL-Medium.otf"),
    LetteraMonoLight: require("../../assets/fonts/LetteraMonoLL-Light.otf"),

    SpaceGrotesk: require("../../assets/fonts/SpaceGrotesk-Regular.otf"),
    SpaceMono: require("../../assets/fonts/SpaceMono-Regular.otf"),

    Inter: require("../../assets/fonts/Inter-Regular.ttf"),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <SQLiteProvider databaseName="fuelsense.db" onInit={migrateDatabase}>
        <Tabs
          tabBar={(props) => <Navbar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Home" }} />
          <Tabs.Screen name="add_vehicle" options={{ title: "Add vehicle" }} />
          <Tabs.Screen name="menu" options={{ title: "Menu" }} />
          <Tabs.Screen name="vehicle" options={{ href: null }} />
          <Tabs.Screen name="edit_vehicle" options={{ href: null }} />
          <Tabs.Screen name="fuel_history" options={{ href: null }} />
          <Tabs.Screen name="oil_history" options={{ href: null }} />
          <Tabs.Screen name="widget_preview" options={{ href: null }} />
        </Tabs>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
