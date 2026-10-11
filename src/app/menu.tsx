import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Cloud, Fuel, Moon, Sun } from "lucide-react-native";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { radius, spacing, typography, useTheme } from "../theme";

export default function MenuScreen() {
  const router = useRouter();
  const { isDark, colors, toggleTheme } = useTheme();
  const appName = Constants.expoConfig?.name ?? "FuelSense";
  const appVersion = Constants.expoConfig?.version;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={[typography.header, styles.title, { color: colors.text }]}>
          MENU
        </Text>

        <Text style={[typography.label, styles.sectionTitle, { color: colors.textSecondary }]}>
          ACCOUNT
        </Text>
        <View
          style={[
            styles.menuItem,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.iconContainer}>
            <Cloud size={19} color={colors.icon} strokeWidth={1.8} />
          </View>
          <View style={styles.itemText}>
            <Text style={[typography.button, styles.itemTitle, { color: colors.text }]}>
              Sync your data
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Sign in to back up your vehicles and records
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          disabled
          style={[
            styles.googleButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[typography.button, { color: colors.textSecondary }]}>
            Continue with Google · Coming soon
          </Text>
        </Pressable>

        <Text style={[typography.label, styles.sectionTitle, { color: colors.textSecondary }]}>
          PREFERENCES
        </Text>
        <View
          style={[
            styles.menuItem,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.iconContainer}>
            {isDark ? (
              <Moon size={19} color={colors.icon} strokeWidth={1.8} />
            ) : (
              <Sun size={19} color={colors.icon} strokeWidth={1.8} />
            )}
          </View>

          <View style={styles.itemText}>
            <Text style={[typography.button, styles.itemTitle, { color: colors.text }]}>
              Appearance
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {isDark ? "Dark mode" : "Light mode"}
            </Text>
          </View>

          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.border}
          />
        </View>

        <Text style={[typography.label, styles.sectionTitle, { color: colors.textSecondary }]}>
          WIDGETS
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/widget_preview")}
          style={({ pressed }) => [
            styles.menuItem,
            styles.widgetItem,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <Fuel size={19} color={colors.icon} strokeWidth={1.8} />
          </View>
          <View style={styles.itemText}>
            <Text style={[typography.button, styles.itemTitle, { color: colors.text }]}>
              Fuel stats widget
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Review the 1 × 1 home screen design
            </Text>
          </View>
        </Pressable>

        <Text style={[typography.label, styles.sectionTitle, { color: colors.textSecondary }]}>
          APP
        </Text>
        <View
          style={[
            styles.menuItem,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.itemText}>
            <Text style={[typography.button, styles.itemTitle, { color: colors.text }]}>
              {appName}
            </Text>
            {appVersion ? (
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Version {appVersion}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingTop: 75,
    paddingHorizontal: spacing.screen,
    paddingBottom: 130,
  },
  title: { marginBottom: spacing.xl },
  sectionTitle: { marginBottom: spacing.sm, marginTop: spacing.lg },
  menuItem: {
    minHeight: 64,
    borderRadius: radius.medium,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  widgetItem: { marginBottom: spacing.xs },
  googleButton: {
    minHeight: 52,
    borderRadius: radius.medium,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    opacity: 0.72,
  },
  iconContainer: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  itemText: { flex: 1 },
  itemTitle: { marginBottom: 3 },
});
