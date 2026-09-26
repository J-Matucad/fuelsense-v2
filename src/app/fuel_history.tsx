import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { ArrowLeft, Fuel } from "lucide-react-native";
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

type FuelLog = {
  id: number;
  odometer_km: number;
  fuel_liters: number;
  price_per_liter: number | null;
  station: string | null;
  is_full: number;
  is_baseline: number;
  created_at: string;
};

export default function FuelHistoryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const [vehicleName, setVehicleName] = useState("");
  const [logs, setLogs] = useState<FuelLog[]>([]);
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
          const [vehicle, fuelLogs] = await Promise.all([
            db.getFirstAsync<{ name: string }>(
              "SELECT name FROM vehicles WHERE id = ?",
              vehicleId,
            ),
            db.getAllAsync<FuelLog>(
              `SELECT id, odometer_km, fuel_liters, price_per_liter, station,
                      is_full, is_baseline, created_at
               FROM fuel_logs WHERE vehicle_id = ?
               ORDER BY odometer_km DESC, id DESC`,
              vehicleId,
            ),
          ]);
          if (active) {
            setVehicleName(vehicle?.name ?? "Vehicle");
            setLogs(fuelLogs);
          }
        } catch (error) {
          console.error("Failed to load fuel history", error);
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
            REFUEL HISTORY
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
              <Fuel size={22} color={colors.iconSecondary} />
              <Text style={[typography.body, { color: colors.textSecondary }]}>
                No refuel history yet.
              </Text>
            </View>
          ) : (
            logs.map((log) => {
              const total =
                log.price_per_liter === null
                  ? null
                  : log.fuel_liters * log.price_per_liter;
              return (
                <View
                  key={log.id}
                  style={[
                    styles.entryCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.entryHeader}>
                    <Text
                      style={[
                        typography.button,
                        styles.station,
                        { color: colors.text },
                      ]}
                    >
                      {log.station ||
                        (log.is_baseline ? "Starting baseline" : "Refuel")}
                    </Text>
                    <Text
                      style={[
                        typography.caption,
                        styles.entryType,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {log.is_baseline
                        ? "BASELINE"
                        : log.is_full
                          ? "FULL TANK"
                          : "PARTIAL"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {new Date(log.created_at).toLocaleDateString()}
                  </Text>
                  <View style={styles.entryDetails}>
                    <View style={styles.detail}>
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        ODOMETER
                      </Text>
                      <Text style={[typography.body, { color: colors.text }]}>
                        {log.odometer_km.toLocaleString()} km
                      </Text>
                    </View>
                    <View style={styles.detail}>
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        FUEL
                      </Text>
                      <Text style={[typography.body, { color: colors.text }]}>
                        {log.fuel_liters.toFixed(2)} L
                      </Text>
                    </View>
                    <View style={[styles.detail, styles.totalDetail]}>
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        TOTAL
                      </Text>
                      <Text style={[typography.body, { color: colors.text }]}>
                        {total === null ? "—" : total.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  {log.price_per_liter !== null ? (
                    <Text
                      style={[
                        typography.caption,
                        styles.unitPrice,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {log.price_per_liter.toFixed(2)} per liter
                    </Text>
                  ) : null}
                </View>
              );
            })
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
  station: { flex: 1 },
  entryType: { letterSpacing: 0.5 },
  entryDetails: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  detail: { flex: 1, gap: spacing.xs },
  totalDetail: { alignItems: "flex-end" },
  unitPrice: { textAlign: "right" },
});
