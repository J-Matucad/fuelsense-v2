import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { ArrowLeft, Wrench } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { radius, spacing, typography, useTheme } from "../theme";

type OilLog = {
  id: number;
  odometer_km: number;
  oil_type: string | null;
  notes: string | null;
  created_at: string;
};

export default function OilHistoryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const [vehicleName, setVehicleName] = useState("");
  const [logs, setLogs] = useState<OilLog[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadHistory = async () => {
        const vehicleId = Number(id);
        if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
          if (active) setLoading(false);
          return;
        }

        setLoading(true);
        try {
          const [vehicle, oilLogs] = await Promise.all([
            db.getFirstAsync<{ name: string }>(
              "SELECT name FROM vehicles WHERE id = ?",
              vehicleId,
            ),
            db.getAllAsync<OilLog>(
              `SELECT id, odometer_km, oil_type, notes, created_at
               FROM oil_logs WHERE vehicle_id = ?
               ORDER BY odometer_km DESC, id DESC`,
              vehicleId,
            ),
          ]);
          if (active) {
            setVehicleName(vehicle?.name ?? "Vehicle");
            setLogs(oilLogs);
          }
        } catch (error) {
          console.error("Failed to load oil change history", error);
          if (active) setLogs([]);
        } finally {
          if (active) setLoading(false);
        }
      };

      void loadHistory();
      return () => {
        active = false;
      };
    }, [db, id]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() =>
            router.replace({
              pathname: "/vehicle",
              params: { id },
            })
          }
          style={styles.backButton}
        >
          <ArrowLeft size={21} color={colors.icon} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[typography.header, { color: colors.text }]}>
            OIL CHANGE HISTORY
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            {vehicleName}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              typography.label,
              styles.count,
              { color: colors.textSecondary },
            ]}
          >
            {logs.length} {logs.length === 1 ? "ENTRY" : "ENTRIES"}
          </Text>
          {logs.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Wrench size={22} color={colors.iconSecondary} />
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                No oil change history yet.
              </Text>
            </View>
          ) : (
            logs.map((log) => (
              <View
                key={log.id}
                style={[
                  styles.entryCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.entryHeader}>
                  <Text
                    style={[typography.button, { color: colors.text }]}
                  >
                    {log.oil_type || "Oil change"}
                  </Text>
                  <Wrench size={17} color={colors.primary} />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {new Date(log.created_at).toLocaleDateString()}
                </Text>
                <View style={styles.entryDetails}>
                  <View style={styles.detail}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>
                      ODOMETER
                    </Text>
                    <Text style={[typography.body, { color: colors.text }]}>
                      {log.odometer_km.toLocaleString()} km
                    </Text>
                  </View>
                </View>
                {log.notes ? (
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {log.notes}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: 58,
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  headerText: { flex: 1, gap: spacing.xs },
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 130,
    gap: spacing.md,
  },
  count: { marginBottom: spacing.xs },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyCard: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radius.large,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  entryCard: {
    borderWidth: 1,
    borderRadius: radius.large,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  entryDetails: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  detail: { flex: 1, gap: spacing.xs },
});
