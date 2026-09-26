import { BlurView } from "expo-blur";
import { Bike, Menu, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../theme";

type NavbarProps = {
  state: any;
  navigation: any;
};

export default function Navbar({ state, navigation }: NavbarProps) {
  const { colors, isDark } = useTheme();
  const visibleRouteNames = ["index", "add_vehicle", "menu"];
  const visibleRoutes = visibleRouteNames
    .map((name) => state.routes.find((route: any) => route.name === name))
    .filter(Boolean);

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View
        style={[
          styles.shadow,
          {
            shadowColor: "#000000",
            shadowOpacity: isDark ? 0.35 : 0.15,
          },
        ]}
      >
        <BlurView
          intensity={85}
          tint={isDark ? "dark" : "light"}
          style={[
            styles.navbar,
            {
              backgroundColor: isDark
                ? "rgba(30, 30, 30, 0.72)"
                : "rgba(235, 235, 235, 0.72)",

              borderColor: isDark
                ? "rgba(255, 255, 255, 0.14)"
                : "rgba(255, 255, 255, 0.85)",
            },
          ]}
        >
          <View style={styles.inner}>
            {visibleRoutes.map((route: any) => {
              const index = state.routes.findIndex(
                (item: any) => item.key === route.key,
              );
              const isFocused = state.index === index;

              let Icon = Bike;

              if (route.name === "add_vehicle") {
                Icon = Plus;
              } else if (route.name === "menu") {
                Icon = Menu;
              }

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: "tabLongPress",
                  target: route.key,
                });
              };

              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityLabel={route.name}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={({ pressed }) => [
                    styles.tab,

                    isFocused && {
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.14)"
                        : "rgba(255, 255, 255, 0.95)",
                    },

                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    size={23}
                    color={isFocused ? colors.primary : colors.icon}
                    strokeWidth={isFocused ? 2.3 : 1.8}
                  />
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 50,

    alignItems: "center",
    alignSelf: "center",
  },

  shadow: {
    borderRadius: 32,

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowRadius: 20,

    elevation: 12,

    overflow: "visible",
  },

  navbar: {
    borderRadius: 32,
    overflow: "hidden",

    borderWidth: 1,
  },

  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    height: 60,

    paddingHorizontal: 6,
    gap: 1,
  },

  tab: {
    width: 50,
    height: 50,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 25,
  },

  pressed: {
    opacity: 0.5,
  },
});
