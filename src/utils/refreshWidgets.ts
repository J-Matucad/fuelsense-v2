import { NativeModules, Platform } from "react-native";

export function refreshHomeScreenWidgets() {
  if (Platform.OS !== "android") return;
  const widgetModule = NativeModules.FuelSenseWidget;
  if (!widgetModule?.refreshWidgets) return;

  void widgetModule.refreshWidgets().catch((error: unknown) => {
    console.warn("Could not refresh home screen widgets", error);
  });
}
