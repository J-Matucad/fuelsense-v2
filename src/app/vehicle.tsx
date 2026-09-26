import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  ArrowLeft,
  Edit3,
  Fuel,
  Menu,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, typography, useTheme } from "../theme";
import { refreshHomeScreenWidgets } from "../utils/refreshWidgets";

type VehicleDetails = {
  id: number;
  name: string;
  brand: string | null;
  model: string | null;
  fuel_type: string;
  tank_capacity_liters: number;
  oil_change_interval_km: number | null;
  photo_uri: string | null;
  created_at: string;
};

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

type OilLog = {
  id: number;
  odometer_km: number;
  oil_type: string | null;
  notes: string | null;
  created_at: string;
};

const OIL_SERVICE_OPTIONS = ["Engine oil", "Gear oil"] as const;
type OilService = (typeof OIL_SERVICE_OPTIONS)[number];

export default function VehicleScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [monitorTab, setMonitorTab] = useState<"fuel" | "oil">("fuel");
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [oilLogs, setOilLogs] = useState<OilLog[]>([]);
  const [fuelEntryVisible, setFuelEntryVisible] = useState(false);
  const [fuelOdometer, setFuelOdometer] = useState("");
  const [fuelLiters, setFuelLiters] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");
  const [fuelStation, setFuelStation] = useState("");
  const [tankIsFull, setTankIsFull] = useState(false);
  const [savingFuel, setSavingFuel] = useState(false);
  const [oilEntryVisible, setOilEntryVisible] = useState(false);
  const [oilOdometer, setOilOdometer] = useState("");
  const [oilServices, setOilServices] = useState<OilService[]>(["Engine oil"]);
  const [oilNotes, setOilNotes] = useState("");
  const [savingOil, setSavingOil] = useState(false);
  const fuelFormScrollRef = useRef<ScrollView | null>(null);
  const oilFormScrollRef = useRef<ScrollView | null>(null);
  const oilNotesInputRef = useRef<TextInput | null>(null);
  const focusedFormInput = useRef<TextInput | null>(null);
  const fuelScrollOffset = useRef(0);
  const oilScrollOffset = useRef(0);

  const keepInputVisible = useCallback(
    (input: TextInput, scrollRef: typeof fuelFormScrollRef, offset: typeof fuelScrollOffset) => {
      focusedFormInput.current = input;
      const adjustScroll = () => {
        const keyboard = Keyboard.metrics();
        if (!keyboard) return;
        input.measureInWindow((_x, top, _width, height) => {
          const keyboardTop = keyboard.screenY ?? Dimensions.get("screen").height - keyboard.height;
          const coveredBy = top + height + spacing.md - keyboardTop;
          if (coveredBy > 0) scrollRef.current?.scrollTo({ y: offset.current + coveredBy, animated: true });
        });
      };
      requestAnimationFrame(() => setTimeout(adjustScroll, 80));
    },
    [],
  );

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      const input = focusedFormInput.current;
      if (!input) return;
      if (fuelEntryVisible) keepInputVisible(input, fuelFormScrollRef, fuelScrollOffset);
      else if (oilEntryVisible) keepInputVisible(input, oilFormScrollRef, oilScrollOffset);
    });
    return () => subscription.remove();
  }, [fuelEntryVisible, oilEntryVisible, keepInputVisible]);
  const heroHeight = windowHeight * 0.44;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadVehicle = async () => {
        const vehicleId = Number(id);
        if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
          setVehicle(null);
          setLoading(false);
          return;
        }

        setLoading(true);
        try {
          const result = await db.getFirstAsync<VehicleDetails>(
            `SELECT id, name, brand, model, fuel_type, tank_capacity_liters,
                    oil_change_interval_km, photo_uri, created_at
             FROM vehicles WHERE id = ?`,
            vehicleId,
          );
          if (active) {
            setVehicle(result ?? null);
            if (result) {
              const logs = await db.getAllAsync<FuelLog>(
                `SELECT id, odometer_km, fuel_liters, price_per_liter, station,
                        is_full, is_baseline, created_at
                 FROM fuel_logs WHERE vehicle_id = ?
                 ORDER BY odometer_km ASC, id ASC`,
                vehicleId,
              );
              if (active) setFuelLogs(logs);
              const changes = await db.getAllAsync<OilLog>(
                `SELECT id, odometer_km, oil_type, notes, created_at
                 FROM oil_logs WHERE vehicle_id = ?
                 ORDER BY odometer_km DESC, id DESC`,
                vehicleId,
              );
              if (active) setOilLogs(changes);
            }
          }
        } catch (error) {
          console.error("Failed to load vehicle details", error);
          if (active) setVehicle(null);
        } finally {
          if (active) setLoading(false);
        }
      };
      void loadVehicle();
      return () => {
        active = false;
      };
    }, [db, id]),
  );

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const deleteVehicle = () => {
    setOptionsVisible(false);
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = async () => {
    if (!vehicle) return;
    try {
      await db.runAsync("DELETE FROM vehicles WHERE id = ?", vehicle.id);
      refreshHomeScreenWidgets();
      setDeleteConfirmVisible(false);
      router.replace("/");
    } catch (error) {
      console.error("Failed to delete vehicle", error);
      setDeleteConfirmVisible(false);
      Alert.alert("Could not delete vehicle", "Please try again.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.state, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={[styles.state, { backgroundColor: colors.background }]}>
        <Text style={[typography.subHeader, { color: colors.text }]}>
          Vehicle not found
        </Text>
        <Pressable onPress={back} style={styles.backToVehicles}>
          <Text style={[typography.button, { color: colors.primary }]}>
            Back to vehicles
          </Text>
        </Pressable>
      </View>
    );
  }

  const subtitle = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const baseline = fuelLogs.find((log) => log.is_baseline === 1);
  const latestOilLog = oilLogs[0];
  const currentOdometer = Math.max(
    fuelLogs[fuelLogs.length - 1]?.odometer_km ?? 0,
    latestOilLog?.odometer_km ?? 0,
  );
  const nextOilDue =
    latestOilLog && vehicle.oil_change_interval_km
      ? latestOilLog.odometer_km + vehicle.oil_change_interval_km
      : null;
  const oilDistanceRemaining =
    nextOilDue === null ? null : nextOilDue - currentOdometer;
  const fullLogs = fuelLogs.filter((log) => log.is_full === 1);
  const completedIntervals = (() => {
    const intervals: { distance: number; liters: number }[] = [];
    let previousFull: FuelLog | undefined;
    for (const full of fullLogs) {
      if (full.is_baseline === 1) {
        previousFull = full;
        continue;
      }
      if (!previousFull) continue;
      const intervalLogs = fuelLogs.filter(
        (log) =>
          log.odometer_km > previousFull!.odometer_km &&
          log.odometer_km <= full.odometer_km,
      );
      const liters = intervalLogs.reduce(
        (sum, log) => sum + log.fuel_liters,
        0,
      );
      const distance = full.odometer_km - previousFull.odometer_km;
      if (distance > 0 && liters > 0) intervals.push({ distance, liters });
      previousFull = full;
    }
    return intervals;
  })();
  const latestInterval = completedIntervals[completedIntervals.length - 1];
  const resultsReady = fuelLogs.length >= 2 && latestInterval !== undefined;
  const economy = resultsReady
    ? latestInterval.distance / latestInterval.liters
    : null;
  const totalDistance = resultsReady ? latestInterval.distance : 0;

  const openFuelEntry = (isBaseline: boolean) => {
    setFuelOdometer(
      isBaseline
        ? ""
        : String(fuelLogs[fuelLogs.length - 1]?.odometer_km ?? ""),
    );
    setFuelLiters("");
    setFuelPrice("");
    setFuelStation("");
    setTankIsFull(isBaseline);
    setFuelEntryVisible(true);
  };

  const saveFuelEntry = async () => {
    const odometer = Number(fuelOdometer);
    const liters = Number(fuelLiters);
    const price = fuelPrice.trim() ? Number(fuelPrice) : null;
    const isBaseline = !baseline;
    const lastLog = fuelLogs[fuelLogs.length - 1];
    if (
      !Number.isFinite(odometer) ||
      odometer < 0 ||
      (lastLog && odometer < lastLog.odometer_km)
    ) {
      Alert.alert(
        "Check odometer",
        "The reading must be at least as high as the previous fuel log.",
      );
      return;
    }
    if (!Number.isFinite(liters) || liters <= 0) {
      Alert.alert(
        "Fuel amount required",
        "Enter the liters shown on the pump receipt.",
      );
      return;
    }
    if (liters > vehicle.tank_capacity_liters) {
      Alert.alert(
        "Check fuel amount",
        "A single purchase cannot exceed this vehicle's tank capacity.",
      );
      return;
    }
    if (
      !fuelPrice.trim() ||
      price === null ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      Alert.alert(
        "Fuel price required",
        "Enter the price per liter shown on the receipt.",
      );
      return;
    }
    setSavingFuel(true);
    try {
      await db.runAsync(
        `INSERT INTO fuel_logs (
          vehicle_id, odometer_km, fuel_liters, price_per_liter, station, is_full, is_baseline
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        vehicle.id,
        odometer,
        liters,
        price,
        fuelStation.trim() || null,
        tankIsFull ? 1 : 0,
        isBaseline ? 1 : 0,
      );
      refreshHomeScreenWidgets();
      setFuelEntryVisible(false);
      const logs = await db.getAllAsync<FuelLog>(
        `SELECT id, odometer_km, fuel_liters, price_per_liter, station,
                is_full, is_baseline, created_at
         FROM fuel_logs WHERE vehicle_id = ? ORDER BY odometer_km ASC, id ASC`,
        vehicle.id,
      );
      setFuelLogs(logs);
    } catch (error) {
      console.error("Failed to save fuel log", error);
      Alert.alert("Could not save fuel log", "Please try again.");
    } finally {
      setSavingFuel(false);
    }
  };

  const openOilEntry = () => {
    const latestOdometer = Math.max(
      fuelLogs[fuelLogs.length - 1]?.odometer_km ?? 0,
      oilLogs[0]?.odometer_km ?? 0,
    );
    setOilOdometer(String(latestOdometer || ""));
    setOilServices(["Engine oil"]);
    setOilNotes("");
    setOilEntryVisible(true);
  };

  const saveOilEntry = async () => {
    const odometer = Number(oilOdometer);
    const latestOdometer = Math.max(
      fuelLogs[fuelLogs.length - 1]?.odometer_km ?? 0,
      oilLogs[0]?.odometer_km ?? 0,
    );
    if (oilServices.length === 0) {
      Alert.alert(
        "Select oil changed",
        "Choose Engine oil, Gear oil, or both before saving.",
      );
      return;
    }
    if (
      !oilOdometer.trim() ||
      !Number.isFinite(odometer) ||
      odometer < latestOdometer
    ) {
      Alert.alert(
        "Check odometer",
        `Enter a reading at least as high as ${latestOdometer.toLocaleString()} km.`,
      );
      return;
    }
    setSavingOil(true);
    try {
      await db.runAsync(
        `INSERT INTO oil_logs (vehicle_id, odometer_km, oil_type, notes)
         VALUES (?, ?, ?, ?)`,
        vehicle.id,
        odometer,
        oilServices.join(", "),
        oilNotes.trim() || null,
      );
      refreshHomeScreenWidgets();
      const changes = await db.getAllAsync<OilLog>(
        `SELECT id, odometer_km, oil_type, notes, created_at
         FROM oil_logs WHERE vehicle_id = ?
         ORDER BY odometer_km DESC, id DESC`,
        vehicle.id,
      );
      setOilLogs(changes);
      setOilEntryVisible(false);
    } catch (error) {
      console.error("Failed to save oil change", error);
      Alert.alert("Could not save oil change", "Please try again.");
    } finally {
      setSavingOil(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.hero, { height: heroHeight }]}>
        <Image
          source={
            vehicle.photo_uri
              ? { uri: vehicle.photo_uri }
              : require("../../assets/images/placeholder.png")
          }
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[
            isDark ? "rgba(0,0,0,0.58)" : "rgba(0,0,0,0.42)",
            "rgba(0,0,0,0.08)",
            "transparent",
          ]}
          locations={[0, 0.45, 1]}
          style={styles.topGradient}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.52)", colors.background]}
          locations={[0, 0.62, 1]}
          style={styles.bottomGradient}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: heroHeight - spacing.xxxl,
            paddingBottom: insets.bottom + 110,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            typography.header,
            styles.vehicleTitle,
            { color: colors.text },
          ]}
        >
          {vehicle.name}
        </Text>
        {subtitle ? (
          <Text
            style={[
              typography.body,
              styles.subtitle,
              { color: colors.textSecondary },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}

        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <InfoRow
            label="Fuel type"
            value={vehicle.fuel_type}
            colors={colors}
          />
          <InfoRow
            label="Tank capacity"
            value={`${vehicle.tank_capacity_liters} L`}
            colors={colors}
          />
          <InfoRow
            label="Oil change interval"
            value={
              vehicle.oil_change_interval_km
                ? `${vehicle.oil_change_interval_km.toLocaleString()} km`
                : "Not set"
            }
            colors={colors}
            last
          />
        </View>

        <Text
          style={[
            typography.label,
            styles.sectionLabel,
            { color: colors.textSecondary },
          ]}
        >
          MONITORING
        </Text>
        <View
          style={[
            styles.monitorCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.tabBar, { backgroundColor: colors.background }]}>
            {(["fuel", "oil"] as const).map((tab) => {
              const selected = monitorTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setMonitorTab(tab)}
                  style={[
                    styles.tab,
                    selected && { backgroundColor: colors.surface },
                  ]}
                >
                  <Text
                    style={[
                      typography.button,
                      { color: selected ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {tab === "fuel" ? "Fuel Monitoring" : "Oil Monitoring"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {monitorTab === "fuel" ? (
            <View style={styles.fuelMonitorContent}>
              <View style={styles.fuelActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openFuelEntry(!baseline)}
                  style={({ pressed }) => [
                    styles.addFuelButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Plus size={15} color={colors.primaryText} />
                  <Text
                    style={[
                      typography.caption,
                      styles.addFuelButtonText,
                      { color: colors.primaryText },
                    ]}
                  >
                    {baseline ? "ADD FUEL" : "SET BASELINE"}
                  </Text>
                </Pressable>
              </View>
              {!baseline ? (
                <>
                  <Fuel size={22} color={colors.primary} />
                  <Text
                    style={[
                      typography.subHeader,
                      styles.monitorTitle,
                      { color: colors.text },
                    ]}
                  >
                    Set your full-tank baseline
                  </Text>
                  <Text
                    style={[
                      typography.bodySmall,
                      styles.monitorDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Fill the tank completely, then record the odometer and pump
                    receipt. Consumption tracking starts from this point.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.metricRow}>
                    <View style={styles.metric}>
                      <Text
                        style={[
                          typography.label,
                          { color: colors.textSecondary },
                        ]}
                      >
                        AVERAGE ECONOMY
                      </Text>
                      <Text
                        style={[typography.subHeader, { color: colors.text }]}
                      >
                        {economy === null ? "—" : `${economy.toFixed(2)} km/L`}
                      </Text>
                    </View>
                    <View style={styles.metric}>
                      <Text
                        style={[
                          typography.label,
                          { color: colors.textSecondary },
                        ]}
                      >
                        DISTANCE TRAVELED
                      </Text>
                      <Text
                        style={[typography.subHeader, { color: colors.text }]}
                      >
                        {totalDistance > 0
                          ? `${totalDistance.toLocaleString()} km`
                          : "—"}
                      </Text>
                    </View>
                  </View>
                  {!resultsReady ? (
                    <Text
                      style={[
                        typography.bodySmall,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {fuelLogs.length < 2
                        ? "Log your next refill and mark it full to calculate fuel economy."
                        : "Mark a refill as full to complete a consumption interval."}
                    </Text>
                  ) : null}
                </>
              )}
              <View style={styles.fuelHistoryHeader}>
                <Text
                  style={[typography.label, { color: colors.textSecondary }]}
                >
                  REFUEL HISTORY
                </Text>
                {fuelLogs.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/fuel_history",
                        params: { id: vehicle.id },
                      })
                    }
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        typography.caption,
                        styles.viewAllText,
                        { color: colors.primary },
                      ]}
                    >
                      {`VIEW ALL (${fuelLogs.length})`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.recentFuelLogs}>
                {fuelLogs.length === 0 ? (
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary },
                    ]}
                  >
                    No refuel history yet.
                  </Text>
                ) : (
                  fuelLogs
                    .slice(-3)
                    .reverse()
                    .map((log) => (
                      <View
                        key={log.id}
                        style={[
                          styles.fuelHistoryRow,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <View style={styles.fuelHistoryDetails}>
                          <Text
                            style={[typography.button, { color: colors.text }]}
                          >
                            {log.station ||
                              (log.is_baseline
                                ? "Starting baseline"
                                : "Refuel")}
                          </Text>
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {new Date(log.created_at).toLocaleDateString()} ·{" "}
                            {log.odometer_km.toLocaleString()} km ·{" "}
                            {log.fuel_liters.toFixed(2)} L
                            {log.is_full ? " · FULL" : " · PARTIAL"}
                          </Text>
                        </View>
                        <View style={styles.fuelHistoryCost}>
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSecondary },
                            ]}
                          >
                            TOTAL
                          </Text>
                          <Text
                            style={[typography.button, { color: colors.text }]}
                          >
                            {log.price_per_liter === null
                              ? "—"
                              : (log.fuel_liters * log.price_per_liter).toFixed(
                                  2,
                                )}
                          </Text>
                        </View>
                      </View>
                    ))
                )}
              </View>
            </View>
          ) : (
            <View style={styles.oilMonitorContent}>
              <View style={styles.fuelActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={openOilEntry}
                  style={({ pressed }) => [
                    styles.addFuelButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Plus size={15} color={colors.primaryText} />
                  <Text
                    style={[
                      typography.caption,
                      styles.addFuelButtonText,
                      { color: colors.primaryText },
                    ]}
                  >
                    LOG OIL CHANGE
                  </Text>
                </Pressable>
              </View>
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text
                    style={[
                      typography.label,
                      { color: colors.textSecondary },
                    ]}
                  >
                    LAST OIL CHANGE
                  </Text>
                  <Text style={[typography.subHeader, { color: colors.text }]}>
                    {latestOilLog
                      ? `${latestOilLog.odometer_km.toLocaleString()} km`
                      : "—"}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text
                    style={[
                      typography.label,
                      { color: colors.textSecondary },
                    ]}
                  >
                    NEXT OIL CHANGE
                  </Text>
                  <Text
                    style={[
                      typography.subHeader,
                      {
                        color:
                          oilDistanceRemaining !== null &&
                          oilDistanceRemaining < 0
                            ? colors.danger
                            : colors.text,
                      },
                    ]}
                  >
                    {nextOilDue === null
                      ? "—"
                      : oilDistanceRemaining! < 0
                        ? `${Math.abs(oilDistanceRemaining!).toLocaleString()} km overdue`
                        : `${nextOilDue.toLocaleString()} km`}
                  </Text>
                </View>
              </View>
              <View style={styles.fuelHistoryHeader}>
                <Text
                  style={[typography.label, { color: colors.textSecondary }]}
                >
                  OIL CHANGE HISTORY
                </Text>
                {oilLogs.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/oil_history",
                        params: { id: vehicle.id },
                      })
                    }
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        typography.caption,
                        styles.viewAllText,
                        { color: colors.primary },
                      ]}
                    >
                      {`VIEW ALL (${oilLogs.length})`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.recentFuelLogs}>
                {oilLogs.length === 0 ? (
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary },
                    ]}
                  >
                    No oil changes recorded yet.
                  </Text>
                ) : (
                  oilLogs.slice(0, 3).map((log) => (
                    <View
                      key={log.id}
                      style={[
                        styles.fuelHistoryRow,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={styles.fuelHistoryDetails}>
                        <Text
                          style={[typography.button, { color: colors.text }]}
                        >
                          {log.oil_type || "Oil change"}
                        </Text>
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {new Date(log.created_at).toLocaleDateString()} ·{" "}
                          {log.odometer_km.toLocaleString()} km
                        </Text>
                        {log.notes ? (
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {log.notes}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </View>

        <Text
          style={[
            typography.label,
            styles.sectionLabel,
            { color: colors.textSecondary },
          ]}
        >
          ADDED
        </Text>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
          {new Date(vehicle.created_at).toLocaleDateString()}
        </Text>
      </ScrollView>

      <View style={[styles.headerButtons, { top: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={back}
          style={styles.headerButton}
        >
          <ArrowLeft size={22} color="#FFFFFF" strokeWidth={1.9} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More vehicle options"
          onPress={() => setOptionsVisible(true)}
          style={styles.headerButton}
        >
          <Menu size={23} color="#FFFFFF" strokeWidth={1.8} />
        </Pressable>
      </View>

      <Modal
        transparent
        visible={optionsVisible}
        animationType="fade"
        onRequestClose={() => setOptionsVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setOptionsVisible(false)}
        >
          <View
            style={[
              styles.optionsMenu,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: spacing.xl + insets.bottom,
              },
            ]}
          >
            <View
              style={[styles.optionsHandle, { backgroundColor: colors.border }]}
            />
            <Pressable
              onPress={() => {
                setOptionsVisible(false);
                router.push({
                  pathname: "/edit_vehicle",
                  params: { id: vehicle.id },
                });
              }}
              style={styles.optionRow}
            >
              <Edit3 size={18} color={colors.icon} />
              <Text style={[typography.body, { color: colors.text }]}>
                Edit vehicle
              </Text>
            </Pressable>
            <Pressable onPress={deleteVehicle} style={styles.optionRow}>
              <Trash2 size={18} color={colors.danger} />
              <Text style={[typography.body, { color: colors.danger }]}>
                Delete vehicle
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={fuelEntryVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFuelEntryVisible(false)}
      >
        <KeyboardAvoidingView
          style={[styles.entryFormScreen, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
              ref={fuelFormScrollRef}
              onScroll={(event) => { fuelScrollOffset.current = event.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
              contentContainerStyle={styles.entryFormContent}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
            >
              <Pressable onPress={() => setFuelEntryVisible(false)} style={styles.entryBackButton}>
                <ArrowLeft size={21} color={colors.icon} />
                <Text style={[typography.body, { color: colors.text }]}>Back</Text>
              </Pressable>
              <Text style={[typography.header, styles.entryTitle, { color: colors.text }]}>
                {!baseline ? "FULL-TANK BASELINE" : "ADD FUEL ENTRY"}
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  styles.fuelModalHint,
                  { color: colors.textSecondary },
                ]}
              >
                {!baseline
                  ? "Fill the tank to the pump's automatic stop. The liters here are saved as the baseline purchase and excluded from consumption."
                  : "Log every purchase. Mark the tank full only when you have filled it to the same automatic stop point."}
              </Text>
              <FuelInput
                label="ODOMETER (KM) *"
                value={fuelOdometer}
                onChangeText={setFuelOdometer}
                placeholder="Current odometer"
                colors={colors}
                onFocusInput={(input) => keepInputVisible(input, fuelFormScrollRef, fuelScrollOffset)}
              />
              <FuelInput
                label="FUEL ADDED (L) *"
                value={fuelLiters}
                onChangeText={setFuelLiters}
                placeholder="Liters on receipt"
                keyboardType="decimal-pad"
                colors={colors}
                onFocusInput={(input) => keepInputVisible(input, fuelFormScrollRef, fuelScrollOffset)}
              />
              <FuelInput
                label="PRICE PER LITER *"
                value={fuelPrice}
                onChangeText={setFuelPrice}
                placeholder="e.g. 64.50"
                keyboardType="decimal-pad"
                colors={colors}
                onFocusInput={(input) => keepInputVisible(input, fuelFormScrollRef, fuelScrollOffset)}
              />
              <FuelInput
                label="GAS STATION"
                value={fuelStation}
                onChangeText={setFuelStation}
                placeholder="Station name"
                colors={colors}
                onFocusInput={(input) => keepInputVisible(input, fuelFormScrollRef, fuelScrollOffset)}
              />
              {baseline ? (
                <Pressable
                  onPress={() => setTankIsFull((full) => !full)}
                  style={[
                    styles.fullTankToggle,
                    {
                      borderColor: tankIsFull ? colors.primary : colors.border,
                      backgroundColor: tankIsFull
                        ? colors.background
                        : colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.button,
                      {
                        color: tankIsFull
                          ? colors.primary
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {tankIsFull
                      ? "✓  TANK FILLED COMPLETELY"
                      : "TAP IF THIS FILL COMPLETED THE TANK"}
                  </Text>
                </Pressable>
              ) : null}
              <View style={styles.fuelModalActions}>
                <Pressable
                  onPress={() => setFuelEntryVisible(false)}
                  style={[
                    styles.fuelAction,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Text style={[typography.button, { color: colors.text }]}>
                    CANCEL
                  </Text>
                </Pressable>
                <Pressable
                  onPress={saveFuelEntry}
                  disabled={savingFuel}
                  style={[
                    styles.fuelAction,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[typography.button, { color: colors.primaryText }]}
                  >
                    {savingFuel ? "SAVING..." : "SAVE ENTRY"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={oilEntryVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setOilEntryVisible(false)}
      >
        <KeyboardAvoidingView
          style={[styles.entryFormScreen, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
              ref={oilFormScrollRef}
              onScroll={(event) => { oilScrollOffset.current = event.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
              contentContainerStyle={styles.entryFormContent}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
            >
              <Pressable onPress={() => setOilEntryVisible(false)} style={styles.entryBackButton}>
                <ArrowLeft size={21} color={colors.icon} />
                <Text style={[typography.body, { color: colors.text }]}>Back</Text>
              </Pressable>
              <Text style={[typography.header, styles.entryTitle, { color: colors.text }]}>
                LOG OIL CHANGE
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  styles.fuelModalHint,
                  { color: colors.textSecondary },
                ]}
              >
                Record the odometer reading when the oil was changed.
              </Text>
              <FuelInput
                label="ODOMETER (KM) *"
                value={oilOdometer}
                onChangeText={setOilOdometer}
                placeholder="Current odometer"
                keyboardType="decimal-pad"
                colors={colors}
                onFocusInput={(input) => keepInputVisible(input, oilFormScrollRef, oilScrollOffset)}
              />
              <View style={styles.fuelInputWrap}>
                <Text
                  style={[
                    typography.label,
                    styles.fuelInputLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  OIL CHANGED
                </Text>
                <View style={styles.oilServiceOptions}>
                  {OIL_SERVICE_OPTIONS.map((option) => {
                    const selected = oilServices.includes(option);
                    return (
                      <Pressable
                        key={option}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        onPress={() =>
                          setOilServices((selectedServices) =>
                            selected
                              ? selectedServices.filter(
                                  (item) => item !== option,
                                )
                              : [...selectedServices, option],
                          )
                        }
                        style={[
                          styles.oilServiceOption,
                          {
                            borderColor: selected
                              ? colors.primary
                              : colors.border,
                            backgroundColor: selected
                              ? colors.background
                              : colors.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            typography.caption,
                            {
                              color: selected
                                ? colors.primary
                                : colors.textSecondary,
                            },
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.fuelInputWrap}>
                <Text
                  style={[
                    typography.label,
                    styles.fuelInputLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  NOTES
                </Text>
                <TextInput
                  ref={oilNotesInputRef}
                  value={oilNotes}
                  onChangeText={setOilNotes}
                  placeholder="Optional service notes"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  textAlignVertical="top"
                  onFocus={() => {
                    if (oilNotesInputRef.current) keepInputVisible(oilNotesInputRef.current, oilFormScrollRef, oilScrollOffset);
                  }}
                  style={[
                    styles.fuelInput,
                    styles.oilNotesInput,
                    typography.body,
                    {
                      color: colors.text,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                />
              </View>
              <View style={styles.fuelModalActions}>
                <Pressable
                  onPress={() => setOilEntryVisible(false)}
                  style={[
                    styles.fuelAction,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Text style={[typography.button, { color: colors.text }]}>
                    CANCEL
                  </Text>
                </Pressable>
                <Pressable
                  onPress={saveOilEntry}
                  disabled={savingOil}
                  style={[
                    styles.fuelAction,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[typography.button, { color: colors.primaryText }]}
                  >
                    {savingOil ? "SAVING..." : "SAVE CHANGE"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        transparent
        visible={deleteConfirmVisible}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View
            style={[
              styles.confirmDialog,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                typography.subHeader,
                styles.confirmTitle,
                { color: colors.text },
              ]}
            >
              Delete vehicle?
            </Text>
            <Text
              style={[
                typography.bodySmall,
                styles.confirmMessage,
                { color: colors.textSecondary },
              ]}
            >
              {`“${vehicle.name}” and its saved details will be removed.`}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setDeleteConfirmVisible(false)}
                style={[
                  styles.confirmButton,
                  { backgroundColor: colors.background },
                ]}
              >
                <Text style={[typography.button, { color: colors.text }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                style={[
                  styles.confirmButton,
                  { backgroundColor: colors.danger },
                ]}
              >
                <Text style={[typography.button, { color: "#FFFFFF" }]}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FuelInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  colors,
  onFocusInput,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "decimal-pad";
  colors: ReturnType<typeof useTheme>["colors"];
  onFocusInput: (input: TextInput) => void;
}) {
  const inputRef = useRef<TextInput | null>(null);
  return (
    <View style={styles.fuelInputWrap}>
      <Text
        style={[
          typography.label,
          styles.fuelInputLabel,
          { color: colors.textSecondary },
        ]}
      >
        {label}
      </Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          if (keyboardType !== "decimal-pad") onChangeText(text);
          else {
            const cleaned = text.replace(/[^0-9.]/g, "");
            const [whole, ...fraction] = cleaned.split(".");
            onChangeText(
              fraction.length ? `${whole}.${fraction.join("")}` : whole,
            );
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        onFocus={() => {
          if (inputRef.current) onFocusInput(inputRef.current);
        }}
        style={[
          styles.fuelInput,
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
  last = false,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>["colors"];
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && {
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[typography.body, styles.infoValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  hero: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  topGradient: { ...StyleSheet.absoluteFill },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "66%",
  },
  content: { paddingHorizontal: spacing.screen },
  vehicleTitle: { marginBottom: spacing.xs },
  subtitle: { marginBottom: spacing.xl },
  sectionLabel: { marginBottom: spacing.sm, marginTop: spacing.lg },
  infoCard: {
    borderRadius: radius.large,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  monitorCard: {
    borderRadius: radius.large,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: radius.medium,
    padding: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.small,
  },
  monitorContent: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
  },
  fuelMonitorContent: {
    width: "100%",
    alignItems: "stretch",
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  oilMonitorContent: {
    width: "100%",
    alignItems: "stretch",
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  fuelActionRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  fuelHistoryHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
  },
  metricRow: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, gap: spacing.xs },
  viewAllText: { fontSize: 11, letterSpacing: 0.35 },
  recentFuelLogs: { gap: spacing.xs },
  fuelHistoryRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fuelHistoryDetails: { flex: 1, gap: spacing.xs },
  fuelHistoryCost: { minWidth: 58, alignItems: "flex-end", gap: spacing.xs },
  addFuelButton: {
    minHeight: 32,
    borderRadius: radius.small,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  addFuelButtonText: { fontSize: 11, letterSpacing: 0.35 },
  entryFormScreen: { flex: 1 },
  entryFormContent: {
    paddingTop: 58,
    paddingHorizontal: spacing.screen,
    paddingBottom: 140,
  },
  entryBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  entryTitle: { marginBottom: spacing.xs },
  fuelModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  fuelModalKeyboard: { flex: 1 },
  fuelSheet: {
    width: "100%",
    height: "72%",
    maxHeight: "82%",
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    borderWidth: 1,
    paddingTop: spacing.md,
  },
  fuelSheetScroll: { flex: 1 },
  fuelModal: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  fuelModalGrow: { flexGrow: 1 },
  fuelModalHint: { marginTop: spacing.sm, marginBottom: spacing.lg },
  fuelInputWrap: { marginBottom: spacing.md },
  fuelInputLabel: { marginBottom: spacing.xs },
  fuelInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  oilNotesInput: { minHeight: 88, paddingTop: spacing.md },
  oilServiceOptions: { flexDirection: "row", gap: spacing.xs },
  oilServiceOption: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.medium,
    paddingHorizontal: spacing.xs,
  },
  fullTankToggle: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.medium,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  fuelModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  fuelAction: {
    minHeight: 46,
    minWidth: 112,
    borderRadius: radius.medium,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  monitorTitle: { marginTop: spacing.md, textAlign: "center" },
  monitorDescription: { marginTop: spacing.xs, textAlign: "center" },
  infoRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoValue: { flexShrink: 1, textAlign: "right" },
  headerButtons: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backToVehicles: { padding: spacing.md },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  optionsMenu: {
    width: "100%",
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  optionsHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  optionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  confirmBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    padding: spacing.xl,
  },
  confirmDialog: {
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: radius.large,
    padding: spacing.xl,
  },
  confirmTitle: { marginBottom: spacing.sm },
  confirmMessage: { marginBottom: spacing.xl },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  confirmButton: {
    minWidth: 92,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
  },
});
