import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { ArrowLeft, Edit3, Fuel, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { radius, spacing, typography, useTheme } from "../theme";
import { refreshHomeScreenWidgets } from "../utils/refreshWidgets";

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

function cleanDecimalInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole, ...fraction] = cleaned.split(".");
  return fraction.length ? `${whole}.${fraction.join("")}` : whole;
}

export default function FuelHistoryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const [vehicleName, setVehicleName] = useState("");
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [editOdometer, setEditOdometer] = useState("");
  const [editLiters, setEditLiters] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStation, setEditStation] = useState("");
  const [editFull, setEditFull] = useState(false);
  const [saving, setSaving] = useState(false);

  const reloadLogs = async () => {
    const vehicleId = Number(id);
    if (!Number.isInteger(vehicleId) || vehicleId <= 0) return;
    const rows = await db.getAllAsync<FuelLog>(
      `SELECT id, odometer_km, fuel_liters, price_per_liter, station,
              is_full, is_baseline, created_at
       FROM fuel_logs WHERE vehicle_id = ?
       ORDER BY odometer_km DESC, id DESC`,
      vehicleId,
    );
    setLogs(rows);
  };

  const startEditing = (log: FuelLog) => {
    setEditingLog(log);
    setEditOdometer(String(log.odometer_km));
    setEditLiters(String(log.fuel_liters));
    setEditPrice(log.price_per_liter === null ? "" : String(log.price_per_liter));
    setEditStation(log.station ?? "");
    setEditFull(log.is_full === 1);
  };

  const saveEdit = async () => {
    if (!editingLog) return;
    const odometer = Number(editOdometer);
    const liters = Number(editLiters);
    const price = editPrice.trim() ? Number(editPrice) : null;
    if (!editOdometer.trim() || !Number.isFinite(odometer) || odometer < 0 ||
        !editLiters.trim() || !Number.isFinite(liters) || liters <= 0 ||
        (price === null || !Number.isFinite(price) || price < 0)) {
      Alert.alert("Check fuel entry", "Enter a valid odometer, fuel amount, and price.");
      return;
    }
    const earlier = logs.find((log) => log.odometer_km < editingLog.odometer_km ||
      (log.odometer_km === editingLog.odometer_km && log.id < editingLog.id));
    const later = [...logs].reverse().find((log) => log.odometer_km > editingLog.odometer_km ||
      (log.odometer_km === editingLog.odometer_km && log.id > editingLog.id));
    if ((earlier && odometer < earlier.odometer_km) || (later && odometer > later.odometer_km)) {
      Alert.alert("Check odometer", "Keep this reading between the previous and next fuel entries.");
      return;
    }
    setSaving(true);
    try {
      await db.runAsync(
        `UPDATE fuel_logs SET odometer_km = ?, fuel_liters = ?, price_per_liter = ?,
          station = ?, is_full = ? WHERE id = ?`,
        odometer, liters, price, editStation.trim() || null,
        editingLog.is_baseline ? 1 : editFull ? 1 : 0, editingLog.id,
      );
      refreshHomeScreenWidgets();
      await reloadLogs();
      setEditingLog(null);
    } catch (error) {
      console.error("Failed to update fuel entry", error);
      Alert.alert("Could not update fuel entry", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteLog = (log: FuelLog) => {
    Alert.alert("Delete fuel entry?", "This entry will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void (async () => {
        try {
          await db.runAsync("DELETE FROM fuel_logs WHERE id = ?", log.id);
          refreshHomeScreenWidgets();
          await reloadLogs();
        } catch (error) {
          console.error("Failed to delete fuel entry", error);
          Alert.alert("Could not delete fuel entry", "Please try again.");
        }
      })() },
    ]);
  };

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
                  <View style={styles.entryMain}>
                    <View style={styles.entryHeader}>
                      <Text
                        numberOfLines={1}
                        style={[
                          typography.subHeader,
                          styles.station,
                          { color: colors.text },
                        ]}
                      >
                        {log.station ||
                          (log.is_baseline ? "Starting baseline" : "Refuel")}
                      </Text>
                      <View style={[styles.entryTypeBadge, { backgroundColor: colors.background }]}>
                        <Text
                          style={[
                            typography.caption,
                            styles.entryType,
                            { color: log.is_full || log.is_baseline ? colors.primary : colors.textSecondary },
                          ]}
                        >
                          {log.is_baseline
                            ? "BASELINE"
                            : log.is_full
                              ? "FULL TANK"
                              : "PARTIAL"}
                        </Text>
                      </View>
                    </View>
                    <Text style={[typography.caption, styles.entryDate, { color: colors.textSecondary }]}>
                      {new Date(log.created_at).toLocaleDateString()}
                    </Text>
                    <View style={styles.entryDetails}>
                      <View style={styles.detail}>
                      <Text
                        numberOfLines={1}
                        style={[
                          typography.caption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        ODO
                      </Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[typography.body, { color: colors.text }]}>
                        {log.odometer_km.toLocaleString()} km
                      </Text>
                      </View>
                      <View style={styles.detail}>
                      <Text
                        numberOfLines={1}
                        style={[
                          typography.caption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        FUEL ADDED
                      </Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[typography.body, { color: colors.text }]}>
                        {log.fuel_liters.toFixed(2)} L
                      </Text>
                      </View>
                      <View style={styles.detail}>
                      <Text
                        numberOfLines={1}
                        style={[
                          typography.caption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        PRICE / L
                      </Text>
                      <Text numberOfLines={1} adjustsFontSizeToFit style={[typography.body, { color: colors.text }]}>
                        {log.price_per_liter === null ? "—" : log.price_per_liter.toFixed(2)}
                      </Text>
                      </View>
                      <View style={[styles.detail, styles.totalDetail]}>
                        <Text numberOfLines={1} style={[typography.caption, { color: colors.textSecondary }]}>TOTAL</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={[typography.body, { color: colors.text }]}>
                          {total === null ? "—" : total.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Edit fuel entry" onPress={() => startEditing(log)} style={styles.actionButton}>
                      <Edit3 size={16} color={colors.primary} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Delete fuel entry" onPress={() => deleteLog(log)} style={styles.actionButton}>
                      <Trash2 size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal
        visible={editingLog !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setEditingLog(null)}
      >
        <KeyboardAvoidingView
          style={[styles.editScreen, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.editContent}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => setEditingLog(null)} style={styles.editBackButton}>
              <ArrowLeft size={21} color={colors.icon} />
              <Text style={[typography.body, { color: colors.text }]}>Back</Text>
            </Pressable>
            <Text style={[typography.header, styles.editTitle, { color: colors.text }]}>EDIT FUEL ENTRY</Text>
            <Text style={[typography.bodySmall, styles.editHint, { color: colors.textSecondary }]}>Update the odometer and fuel details for this entry.</Text>

            <View style={styles.inputWrap}>
              <Text style={[typography.label, styles.inputLabel, { color: colors.textSecondary }]}>ODOMETER (KM) *</Text>
              <TextInput value={editOdometer} onChangeText={(value) => setEditOdometer(cleanDecimalInput(value))} placeholder="Odometer reading" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" style={[styles.input, typography.body, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} />
            </View>
            <View style={styles.inputWrap}>
              <Text style={[typography.label, styles.inputLabel, { color: colors.textSecondary }]}>FUEL ADDED (L) *</Text>
              <TextInput value={editLiters} onChangeText={(value) => setEditLiters(cleanDecimalInput(value))} placeholder="Liters on receipt" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" style={[styles.input, typography.body, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} />
            </View>
            <View style={styles.inputWrap}>
              <Text style={[typography.label, styles.inputLabel, { color: colors.textSecondary }]}>PRICE PER LITER *</Text>
              <TextInput value={editPrice} onChangeText={(value) => setEditPrice(cleanDecimalInput(value))} placeholder="e.g. 64.50" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" style={[styles.input, typography.body, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} />
            </View>
            <View style={styles.inputWrap}>
              <Text style={[typography.label, styles.inputLabel, { color: colors.textSecondary }]}>GAS STATION</Text>
              <TextInput value={editStation} onChangeText={setEditStation} placeholder="Station name (optional)" placeholderTextColor={colors.textTertiary} style={[styles.input, typography.body, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]} />
            </View>

            {editingLog ? (
              <Pressable
                disabled={editingLog.is_baseline === 1}
                onPress={() => setEditFull((full) => !full)}
                style={[
                  styles.fullTankToggle,
                  {
                    borderColor: editFull || editingLog.is_baseline ? colors.primary : colors.border,
                    backgroundColor: editFull || editingLog.is_baseline ? colors.surface : colors.background,
                  },
                ]}
              >
                <Text style={[typography.button, { color: editFull || editingLog.is_baseline ? colors.primary : colors.textSecondary }]}>
                  {editFull || editingLog.is_baseline
                    ? "✓  TANK FILLED COMPLETELY"
                    : "TAP IF THIS FILL COMPLETED THE TANK"}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditingLog(null)} style={[styles.modalButton, { backgroundColor: colors.surface }]}>
                <Text style={[typography.button, { color: colors.text }]}>CANCEL</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={() => void saveEdit()} style={[styles.modalButton, { backgroundColor: colors.primary }]}>
                <Text style={[typography.button, { color: colors.primaryText }]}>{saving ? "SAVING..." : "SAVE ENTRY"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.small,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  entryMain: { flex: 1, minWidth: 0, gap: 1 },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  station: { flex: 1, fontSize: 16 },
  entryType: { letterSpacing: 0.5, fontSize: 9 },
  entryTypeBadge: { borderRadius: radius.small, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  entryDate: { marginTop: -spacing.xs },
  actions: { flexDirection: "column", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  actionButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  entryDetails: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  detail: { flex: 1, minWidth: 0, gap: 2 },
  totalDetail: { alignItems: "flex-end" },
  editScreen: { flex: 1 },
  editContent: { flexGrow: 1, paddingTop: 58, paddingHorizontal: spacing.screen, paddingBottom: 140 },
  editBackButton: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  editTitle: { marginBottom: spacing.xs },
  editHint: { marginTop: spacing.sm, marginBottom: spacing.lg },
  inputWrap: { marginBottom: spacing.md },
  inputLabel: { marginBottom: spacing.xs },
  input: { minHeight: 46, borderWidth: 1, borderRadius: radius.medium, paddingHorizontal: spacing.md },
  fullTankToggle: { minHeight: 48, borderWidth: 1, borderRadius: radius.medium, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, marginBottom: spacing.md },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.xs },
  modalButton: { minWidth: 92, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.medium, paddingHorizontal: spacing.md },
});
