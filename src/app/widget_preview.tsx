import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { ArrowLeft, Fuel, Wrench } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, typography, useTheme } from "../theme";

type VehicleForWidget = {
  id: number;
  name: string;
  brand: string | null;
  model: string | null;
};

type FuelLog = {
  id: number;
  odometer_km: number;
  fuel_liters: number;
  is_full: number;
  is_baseline: number;
  created_at: string;
};

type WidgetData = {
  vehicle: VehicleForWidget;
  latestRefuel: FuelLog;
  economy: number | null;
  distance: number | null;
};

type OilVehicleRow = VehicleForWidget & {
  oil_change_interval_km: number;
  last_oil_odometer: number | null;
  last_oil_type: string | null;
  last_fuel_odometer: number | null;
};

type OilWidgetData = {
  vehicle: VehicleForWidget;
  interval: number;
  lastOdometer: number | null;
  currentOdometer: number;
  nextDue: number | null;
  remaining: number | null;
  serviceType: string | null;
};

function calculateLatestStats(logs: FuelLog[]) {
  const fullLogs = logs.filter((log) => log.is_full === 1);
  const intervals: { distance: number; liters: number }[] = [];
  let previousFull: FuelLog | undefined;

  for (const full of fullLogs) {
    if (full.is_baseline === 1) {
      previousFull = full;
      continue;
    }
    if (!previousFull) continue;

    const intervalLogs = logs.filter(
      (log) =>
        log.odometer_km > previousFull!.odometer_km &&
        log.odometer_km <= full.odometer_km,
    );
    const liters = intervalLogs.reduce((sum, log) => sum + log.fuel_liters, 0);
    const distance = full.odometer_km - previousFull.odometer_km;
    if (distance > 0 && liters > 0) intervals.push({ distance, liters });
    previousFull = full;
  }

  const latest = intervals[intervals.length - 1];
  return latest
    ? { economy: latest.distance / latest.liters, distance: latest.distance }
    : { economy: null, distance: null };
}

export default function WidgetPreviewScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null);
  const [oilWidgetData, setOilWidgetData] = useState<OilWidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const previewSize = Math.max(0, Math.min(windowWidth - spacing.screen * 2, 340));
  const vehicleSubtitle = useMemo(() => {
    if (!widgetData) return "";
    return [widgetData.vehicle.brand, widgetData.vehicle.model]
      .filter(Boolean)
      .join(" · ");
  }, [widgetData]);
  const oilVehicleSubtitle = useMemo(() => {
    if (!oilWidgetData) return "";
    return [oilWidgetData.vehicle.brand, oilWidgetData.vehicle.model]
      .filter(Boolean)
      .join(" · ");
  }, [oilWidgetData]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadWidgetData = async () => {
        setLoading(true);
        try {
          const [latestVehicle, oilVehicles] = await Promise.all([
            db.getFirstAsync<VehicleForWidget>(
              `SELECT v.id, v.name, v.brand, v.model
               FROM fuel_logs AS f
               INNER JOIN vehicles AS v ON v.id = f.vehicle_id
               ORDER BY f.created_at DESC, f.id DESC
               LIMIT 1`,
            ),
            db.getAllAsync<OilVehicleRow>(
              `SELECT v.id, v.name, v.brand, v.model,
                      v.oil_change_interval_km,
                      (SELECT odometer_km FROM oil_logs
                       WHERE vehicle_id = v.id
                       ORDER BY odometer_km DESC, id DESC LIMIT 1) AS last_oil_odometer,
                      (SELECT oil_type FROM oil_logs
                       WHERE vehicle_id = v.id
                       ORDER BY odometer_km DESC, id DESC LIMIT 1) AS last_oil_type,
                      (SELECT odometer_km FROM fuel_logs
                       WHERE vehicle_id = v.id
                       ORDER BY odometer_km DESC, id DESC LIMIT 1) AS last_fuel_odometer
               FROM vehicles AS v
               WHERE v.oil_change_interval_km IS NOT NULL
               ORDER BY v.id ASC`,
            ),
          ]);

          const oilReminders = oilVehicles
            .map((row) => {
              const currentOdometer = Math.max(
                row.last_oil_odometer ?? 0,
                row.last_fuel_odometer ?? 0,
              );
              const nextDue =
                row.last_oil_odometer === null
                  ? null
                  : row.last_oil_odometer + row.oil_change_interval_km;
              return {
                vehicle: {
                  id: row.id,
                  name: row.name,
                  brand: row.brand,
                  model: row.model,
                },
                interval: row.oil_change_interval_km,
                lastOdometer: row.last_oil_odometer,
                currentOdometer,
                nextDue,
                remaining: nextDue === null ? null : nextDue - currentOdometer,
                serviceType: row.last_oil_type,
              } satisfies OilWidgetData;
            })
            .sort((a, b) => {
              if (a.remaining === null) return b.remaining === null ? 0 : 1;
              if (b.remaining === null) return -1;
              return a.remaining - b.remaining;
            });

          if (active) setOilWidgetData(oilReminders[0] ?? null);

          if (!latestVehicle) {
            if (active) setWidgetData(null);
            return;
          }

          const logs = await db.getAllAsync<FuelLog>(
            `SELECT id, odometer_km, fuel_liters, is_full, is_baseline, created_at
             FROM fuel_logs WHERE vehicle_id = ?
             ORDER BY odometer_km ASC, id ASC`,
            latestVehicle.id,
          );
          const latestRefuel = [...logs].sort(
            (a, b) =>
              b.created_at.localeCompare(a.created_at) || b.id - a.id,
          )[0];
          if (active) {
            setWidgetData(
              latestRefuel
                ? {
                    vehicle: latestVehicle,
                    latestRefuel,
                    ...calculateLatestStats(logs),
                  }
                : null,
            );
          }
        } catch (error) {
          console.error("Failed to load widget preview", error);
          if (active) {
            setWidgetData(null);
            setOilWidgetData(null);
          }
        } finally {
          if (active) setLoading(false);
        }
      };

      void loadWidgetData();
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={21} color={colors.icon} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[typography.header, { color: colors.text }]}>WIDGET PREVIEW</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Two 1 × 1 widget concepts</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewHeading}>
          <Text style={[typography.label, { color: colors.textSecondary }]}>01 / FUEL CONSUMPTION</Text>
          <Text style={[typography.bodySmall, styles.previewDescription, { color: colors.textSecondary }]}>
            Shows the vehicle with the most recent fuel entry and its latest completed fuel stats.
          </Text>
        </View>

        <View style={styles.stage}>
          <View
            style={[
              styles.widget,
              {
                width: previewSize,
                height: previewSize,
              },
            ]}
          >
            <View style={styles.widgetTop}>
              <View style={styles.widgetBrand}>
                <View style={styles.brandMark}>
                  <View style={styles.brandDot} />
                  <View style={styles.brandDot} />
                  <View style={styles.brandDot} />
                  <View style={styles.brandDot} />
                </View>
                <Text style={styles.widgetEyebrow}>FUELSENSE</Text>
              </View>
              <Fuel size={18} color="#F4F4F4" strokeWidth={1.8} />
            </View>

            {loading ? (
              <View style={styles.widgetEmpty}>
                <ActivityIndicator color="#F4F4F4" />
              </View>
            ) : widgetData ? (
              <>
                <View style={styles.vehicleBlock}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.vehicleName}>
                    {widgetData.vehicle.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.vehicleSubtitle}>
                    {vehicleSubtitle || "VEHICLE"}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>ECONOMY</Text>
                    <View style={styles.statValueRow}>
                      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statValue}>
                        {widgetData.economy === null
                          ? "—"
                          : widgetData.economy.toFixed(1)}
                      </Text>
                      <Text style={styles.statUnit}>km/L</Text>
                    </View>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>LAST FULL TANK</Text>
                    <View style={styles.statValueRow}>
                      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statValue}>
                        {widgetData.distance === null
                          ? "—"
                          : widgetData.distance.toLocaleString()}
                      </Text>
                      <Text style={styles.statUnit}>km</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.widgetFooter}>
                  <View style={styles.liveDot} />
                  <Text style={styles.footerText}>
                    REFUELED {new Date(widgetData.latestRefuel.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.widgetEmpty}>
                <Text style={styles.emptyTitle}>NO FUEL DATA</Text>
                <Text style={styles.emptyDescription}>Add a fuel entry to preview stats.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.previewHeading}>
          <Text style={[typography.label, { color: colors.textSecondary }]}>02 / OIL CHANGE REMINDER</Text>
          <Text style={[typography.bodySmall, styles.previewDescription, { color: colors.textSecondary }]}>
            Highlights the vehicle with the nearest oil service due, including overdue changes.
          </Text>
        </View>

        <View style={styles.stage}>
          <View
            style={[
              styles.widget,
              {
                width: previewSize,
                height: previewSize,
              },
            ]}
          >
            <View style={styles.widgetTop}>
              <View style={styles.widgetBrand}>
                <View style={styles.brandMark}>
                  <View style={styles.brandDot} />
                  <View style={styles.brandDot} />
                  <View style={styles.brandDot} />
                  <View style={styles.brandDot} />
                </View>
                <Text style={styles.widgetEyebrow}>FUELSENSE</Text>
              </View>
              <Wrench size={18} color="#F4F4F4" strokeWidth={1.8} />
            </View>

            {loading ? (
              <View style={styles.widgetEmpty}>
                <ActivityIndicator color="#F4F4F4" />
              </View>
            ) : oilWidgetData ? (
              <>
                <View style={styles.vehicleBlock}>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.vehicleName}>
                    {oilWidgetData.vehicle.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.vehicleSubtitle}>
                    {oilVehicleSubtitle || "VEHICLE"}
                  </Text>
                </View>

                <View style={styles.divider} />

                {oilWidgetData.remaining === null ? (
                  <View style={styles.oilFirstChange}>
                    <Text style={styles.statLabel}>OIL SERVICE</Text>
                    <Text style={styles.oilFirstChangeValue}>LOG FIRST CHANGE</Text>
                    <Text style={styles.emptyDescription}>
                      Then reminders can track this vehicle’s next due mileage.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.reminderBlock}>
                      <Text style={styles.statLabel}>NEXT OIL CHANGE</Text>
                      <View style={styles.reminderValueRow}>
                        <Text
                          adjustsFontSizeToFit
                          numberOfLines={1}
                          style={[
                            styles.reminderValue,
                            oilWidgetData.remaining < 0 && styles.overdueValue,
                          ]}
                        >
                          {Math.abs(oilWidgetData.remaining).toLocaleString()}
                        </Text>
                        <View style={styles.reminderUnits}>
                          <Text style={styles.reminderUnit}>
                            {oilWidgetData.remaining < 0 ? "KM OVERDUE" : "KM LEFT"}
                          </Text>
                          <Text style={styles.reminderDueAt}>
                            DUE AT {oilWidgetData.nextDue!.toLocaleString()} KM
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                ((oilWidgetData.currentOdometer - oilWidgetData.lastOdometer!) /
                                  oilWidgetData.interval) *
                                  100,
                              ),
                            )}%`,
                            backgroundColor:
                              oilWidgetData.remaining <=
                                Math.max(100, oilWidgetData.interval * 0.1) ||
                              oilWidgetData.remaining < 0
                                ? "#E33A3A"
                                : "#F4F4F4",
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.widgetFooter}>
                      <View
                        style={[
                          styles.liveDot,
                          oilWidgetData.remaining >= 0 && styles.safeDot,
                        ]}
                      />
                      <Text style={styles.footerText} numberOfLines={1}>
                        {(oilWidgetData.serviceType || "OIL SERVICE").toUpperCase()} · LAST CHANGE {oilWidgetData.lastOdometer!.toLocaleString()} KM
                      </Text>
                    </View>
                  </>
                )}
              </>
            ) : (
              <View style={styles.widgetEmpty}>
                <Text style={styles.emptyTitle}>NO OIL SCHEDULE</Text>
                <Text style={styles.emptyDescription}>
                  Set an oil interval and log a change to preview reminders.
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[typography.label, { color: colors.textSecondary }]}>PREVIEW ONLY</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            This is an in-app design preview. It does not add a home screen widget yet.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
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
    gap: spacing.lg,
  },
  previewHeading: { gap: spacing.xs },
  previewDescription: { maxWidth: 420, lineHeight: 20 },
  stage: {
    minHeight: 370,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.large,
    backgroundColor: "#E6E6E6",
    padding: spacing.md,
  },
  widget: {
    maxWidth: "100%",
    aspectRatio: 1,
    justifyContent: "space-between",
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#292929",
    backgroundColor: "#090909",
    padding: 20,
  },
  widgetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  widgetBrand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 20, flexDirection: "row", flexWrap: "wrap", gap: 3 },
  brandDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: "#F4F4F4" },
  widgetEyebrow: { color: "#F4F4F4", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  vehicleBlock: { gap: 3, marginTop: spacing.sm },
  vehicleName: { color: "#FFFFFF", fontSize: 22, lineHeight: 27, fontWeight: "700", letterSpacing: -0.5 },
  vehicleSubtitle: { color: "#A8A8A8", fontSize: 10, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase" },
  divider: { height: 1, backgroundColor: "#333333", marginVertical: spacing.sm },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stat: { flex: 1, minWidth: 0, gap: 6 },
  statDivider: { width: 1, height: 43, backgroundColor: "#333333" },
  statLabel: { color: "#9B9B9B", fontSize: 9, fontWeight: "700", letterSpacing: 1.1 },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  statValue: { flexShrink: 1, color: "#FFFFFF", fontSize: 27, fontWeight: "700", letterSpacing: -1 },
  statUnit: { color: "#B7B7B7", fontSize: 10, fontWeight: "600" },
  reminderBlock: { gap: 9 },
  reminderValueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reminderValue: { flexShrink: 1, color: "#FFFFFF", fontSize: 38, lineHeight: 42, fontWeight: "700", letterSpacing: -1.5 },
  overdueValue: { color: "#FF5A5A" },
  reminderUnits: { flexShrink: 0, gap: 4 },
  reminderUnit: { color: "#D0D0D0", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  reminderDueAt: { color: "#868686", fontSize: 8, fontWeight: "600", letterSpacing: 0.7 },
  progressTrack: { height: 4, overflow: "hidden", borderRadius: 2, backgroundColor: "#333333" },
  progressFill: { height: "100%", borderRadius: 2 },
  safeDot: { backgroundColor: "#F4F4F4" },
  oilFirstChange: { flex: 1, justifyContent: "center", gap: 8 },
  oilFirstChangeValue: { color: "#FFFFFF", fontSize: 19, fontWeight: "700", letterSpacing: -0.3 },
  widgetFooter: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#E33A3A" },
  footerText: { color: "#A0A0A0", fontSize: 9, fontWeight: "600", letterSpacing: 1 },
  widgetEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  emptyTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", letterSpacing: 1.4 },
  emptyDescription: { color: "#A0A0A0", fontSize: 11, textAlign: "center" },
  note: { borderWidth: 1, borderRadius: radius.medium, padding: spacing.md, gap: spacing.xs },
});
