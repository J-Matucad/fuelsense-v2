import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { ArrowLeft, Edit3, Trash2, Wrench } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { radius, spacing, typography, useTheme } from "../theme";
import { refreshHomeScreenWidgets } from "../utils/refreshWidgets";

const OIL_SERVICE_OPTIONS = ["Engine oil", "Gear oil"] as const;
type OilService = (typeof OIL_SERVICE_OPTIONS)[number];

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
  const [editingLog, setEditingLog] = useState<OilLog | null>(null);
  const [editOdometer, setEditOdometer] = useState("");
  const [editServices, setEditServices] = useState<OilService[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reloadLogs = async () => {
    const vehicleId = Number(id);
    if (!Number.isInteger(vehicleId) || vehicleId <= 0) return;
    const rows = await db.getAllAsync<OilLog>(
      `SELECT id, odometer_km, oil_type, notes, created_at
       FROM oil_logs WHERE vehicle_id = ?
       ORDER BY odometer_km DESC, id DESC`,
      vehicleId,
    );
    setLogs(rows);
  };

  const startEditing = (log: OilLog) => {
    setEditingLog(log);
    setEditOdometer(String(log.odometer_km));
    setEditServices(OIL_SERVICE_OPTIONS.filter((option) =>
      log.oil_type?.toLowerCase().includes(option.toLowerCase()),
    ));
    setEditNotes(log.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editingLog) return;
    const odometer = Number(editOdometer);
    if (!editOdometer.trim() || !Number.isFinite(odometer) || odometer < 0 || editServices.length === 0) {
      Alert.alert("Check oil entry", "Enter a valid odometer and select at least one oil service.");
      return;
    }
    const earlier = logs.find((log) => log.odometer_km < editingLog.odometer_km ||
      (log.odometer_km === editingLog.odometer_km && log.id < editingLog.id));
    const later = [...logs].reverse().find((log) => log.odometer_km > editingLog.odometer_km ||
      (log.odometer_km === editingLog.odometer_km && log.id > editingLog.id));
    if ((earlier && odometer < earlier.odometer_km) || (later && odometer > later.odometer_km)) {
      Alert.alert("Check odometer", "Keep this reading between the previous and next oil entries.");
      return;
    }
    setSaving(true);
    try {
      await db.runAsync(
        "UPDATE oil_logs SET odometer_km = ?, oil_type = ?, notes = ? WHERE id = ?",
        odometer, editServices.join(", "), editNotes.trim() || null, editingLog.id,
      );
      refreshHomeScreenWidgets();
      await reloadLogs();
      setEditingLog(null);
    } catch (error) {
      console.error("Failed to update oil entry", error);
      Alert.alert("Could not update oil entry", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteLog = (log: OilLog) => {
    Alert.alert("Delete oil entry?", "This entry will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void (async () => {
        try {
          await db.runAsync("DELETE FROM oil_logs WHERE id = ?", log.id);
          refreshHomeScreenWidgets();
          await reloadLogs();
        } catch (error) {
          console.error("Failed to delete oil entry", error);
          Alert.alert("Could not delete oil entry", "Please try again.");
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
                <View style={styles.entryMain}>
                  <Text style={[typography.button, styles.entryDate, { color: colors.text }]}>
                    {new Date(log.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    <Text style={[typography.body, { color: colors.text }]}>{log.odometer_km.toLocaleString()} km</Text>
                  </Text>
                  <View style={styles.badgesAndNotes}>
                    <View style={styles.serviceBadges}>
                      {OIL_SERVICE_OPTIONS.filter((service) =>
                        log.oil_type?.toLowerCase().includes(service.toLowerCase()),
                      ).map((service) => (
                        <View
                          key={service}
                          style={[styles.serviceBadge, { backgroundColor: colors.background, borderColor: colors.primary }]}
                        >
                          <Text style={[typography.caption, styles.serviceBadgeText, { color: colors.primary }]}>
                            {service}
                          </Text>
                        </View>
                      ))}
                      {!OIL_SERVICE_OPTIONS.some((service) =>
                        log.oil_type?.toLowerCase().includes(service.toLowerCase()),
                      ) ? (
                        <View style={[styles.serviceBadge, { backgroundColor: colors.background, borderColor: colors.primary }]}>
                          <Text style={[typography.caption, styles.serviceBadgeText, { color: colors.primary }]}>
                            {log.oil_type || "Oil change"}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {log.notes ? (
                      <Text style={[typography.bodySmall, styles.notes, { color: colors.textSecondary }]}>
                        {log.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Edit oil entry" onPress={() => startEditing(log)} style={styles.actionButton}>
                    <Edit3 size={16} color={colors.primary} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Delete oil entry" onPress={() => deleteLog(log)} style={styles.actionButton}>
                    <Trash2 size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))
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
            keyboardDismissMode="none"
            showsVerticalScrollIndicator={false}
          >
            <Pressable onPress={() => setEditingLog(null)} style={styles.editBackButton}>
              <ArrowLeft size={21} color={colors.icon} />
              <Text style={[typography.body, { color: colors.text }]}>Back</Text>
            </Pressable>
            <Text style={[typography.header, styles.editTitle, { color: colors.text }]}>EDIT OIL CHANGE</Text>
            <Text style={[typography.bodySmall, styles.editHint, { color: colors.textSecondary }]}>
              Update the odometer reading and oil services for this entry.
            </Text>

            <View style={styles.inputWrap}>
              <Text style={[typography.label, styles.inputLabel, { color: colors.textSecondary }]}>ODOMETER (KM) *</Text>
              <TextInput
                value={editOdometer}
                onChangeText={(value) => setEditOdometer(value.replace(/[^0-9.]/g, ""))}
                placeholder="Odometer reading"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
                style={[styles.input, typography.body, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              />
            </View>

            <View style={styles.inputWrap}>
              <Text style={[typography.label, styles.inputLabel, { color: colors.textSecondary }]}>OIL CHANGED</Text>
              <View style={styles.serviceOptions}>
                {OIL_SERVICE_OPTIONS.map((option) => {
                  const selected = editServices.includes(option);
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setEditServices((current) => selected
                        ? current.filter((item) => item !== option)
                        : [...current, option])}
                      style={[
                        styles.serviceOption,
                        {
                          backgroundColor: selected ? colors.background : colors.surface,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[typography.caption, { color: selected ? colors.primary : colors.textSecondary }]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputWrap}>
              <Text style={[typography.label, styles.inputLabel, { color: colors.textSecondary }]}>NOTES</Text>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Optional service notes"
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.notesInput, typography.body, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditingLog(null)} style={[styles.modalButton, { backgroundColor: colors.surface }]}>
                <Text style={[typography.button, { color: colors.text }]}>CANCEL</Text>
              </Pressable>
              <Pressable disabled={saving} onPress={() => void saveEdit()} style={[styles.modalButton, { backgroundColor: colors.primary }]}>
                <Text style={[typography.button, { color: colors.primaryText }]}>{saving ? "SAVING..." : "SAVE CHANGE"}</Text>
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
    borderRadius: radius.medium,
    padding: spacing.md,
    gap: spacing.sm,
  },
  entryMain: { flex: 1, minWidth: 0, gap: spacing.xs },
  entryDate: { fontSize: 16 },
  badgesAndNotes: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  serviceBadges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  serviceBadge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.small, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  serviceBadgeText: { fontWeight: "700" },
  notes: { flex: 1, textAlign: "right" },
  actions: { flexDirection: "column", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  actionButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  editScreen: { flex: 1 },
  editContent: { flexGrow: 1, paddingTop: 58, paddingHorizontal: spacing.screen, paddingBottom: 140 },
  editBackButton: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  editTitle: { marginBottom: spacing.xs },
  editHint: { marginTop: spacing.sm, marginBottom: spacing.lg },
  inputWrap: { marginBottom: spacing.md },
  inputLabel: { marginBottom: spacing.xs },
  input: { minHeight: 46, borderWidth: 1, borderRadius: radius.medium, paddingHorizontal: spacing.md },
  notesInput: { minHeight: 88, paddingTop: spacing.md, textAlignVertical: "top" },
  serviceOptions: { flexDirection: "row", gap: spacing.xs },
  serviceOption: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: radius.medium, paddingHorizontal: spacing.xs },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.xs },
  modalButton: { minWidth: 92, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.medium, paddingHorizontal: spacing.md },
});
