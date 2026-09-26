import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useSQLiteContext } from "expo-sqlite";
import { ArrowLeft, Camera, X } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
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

const FUEL_TYPES = ["Diesel", "Unleaded", "Premium"] as const;
type FuelType = (typeof FUEL_TYPES)[number];

export default function AddVehicleScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editingId = id ? Number(id) : null;
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [fuelType, setFuelType] = useState<FuelType>("Unleaded");
  const [tankCapacity, setTankCapacity] = useState("");
  const [oilInterval, setOilInterval] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(Boolean(editingId));
  const scrollRef = useRef<ScrollView | null>(null);
  const focusedInputRef = useRef<TextInput | null>(null);
  const scrollOffset = useRef(0);

  useEffect(() => {
    if (!editingId) return;
    let active = true;

    const loadVehicle = async () => {
      try {
        const vehicle = await db.getFirstAsync<{
          name: string;
          brand: string | null;
          model: string | null;
          fuel_type: string;
          tank_capacity_liters: number;
          oil_change_interval_km: number | null;
          photo_uri: string | null;
        }>("SELECT * FROM vehicles WHERE id = ?", editingId);
        if (!active) return;
        if (!vehicle) {
          Alert.alert("Vehicle not found", "This vehicle may have been deleted.");
          router.back();
          return;
        }

        setName(vehicle.name);
        setBrand(vehicle.brand ?? "");
        setModel(vehicle.model ?? "");
        setFuelType(
          FUEL_TYPES.includes(vehicle.fuel_type as FuelType)
            ? (vehicle.fuel_type as FuelType)
            : "Unleaded",
        );
        setTankCapacity(String(vehicle.tank_capacity_liters));
        setOilInterval(vehicle.oil_change_interval_km?.toString() ?? "");
        setPhotoUri(vehicle.photo_uri);
      } catch (error) {
        console.error("Failed to load vehicle for editing", error);
        Alert.alert("Could not load vehicle", "Please try again.");
        router.back();
      } finally {
        if (active) setLoadingExisting(false);
      }
    };

    void loadVehicle();
    return () => {
      active = false;
    };
  }, [db, editingId, router]);

  const keepFocusedInputVisible = useCallback((input: TextInput) => {
    focusedInputRef.current = input;
    const adjustScroll = () => {
      const keyboard = Keyboard.metrics();
      if (!keyboard) return;

      input.measureInWindow((_x, top, _width, height) => {
        const keyboardTop =
          keyboard.screenY ?? Dimensions.get("screen").height - keyboard.height;
        const coveredBy = top + height + spacing.md - keyboardTop;
        if (coveredBy > 0) {
          scrollRef.current?.scrollTo({
            y: scrollOffset.current + coveredBy,
            animated: true,
          });
        }
      });
    };

    requestAnimationFrame(() => setTimeout(adjustScroll, 80));
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      const focusedInput = focusedInputRef.current;
      if (focusedInput) keepFocusedInputVisible(focusedInput);
    });
    return () => subscription.remove();
  }, [keepFocusedInputVisible]);

  const choosePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setPhotoChanged(true);
      }
    } catch (error) {
      console.error("Failed to select vehicle photo", error);
      Alert.alert("Could not open photos", "Please try again.");
    }
  };

  const saveVehicle = async () => {
    const trimmedName = name.trim();
    const capacity = Number(tankCapacity);
    const interval = oilInterval.trim() ? Number(oilInterval) : null;

    if (!trimmedName) {
      Alert.alert("Vehicle name required", "Enter a name for this vehicle.");
      return;
    }
    if (!tankCapacity || !Number.isFinite(capacity) || capacity <= 0) {
      Alert.alert("Check tank capacity", "Enter a capacity greater than 0 liters.");
      return;
    }
    if (interval !== null && (!Number.isFinite(interval) || interval <= 0)) {
      Alert.alert("Check oil change interval", "Enter a distance greater than 0 kilometers.");
      return;
    }

    setSaving(true);
    try {
      let savedPhotoUri = photoUri;
      if (photoUri && photoChanged) {
        const extension = photoUri.split(".").pop()?.split(/[?#]/)[0] || "jpg";
        const safeExtension = /^[a-zA-Z0-9]+$/.test(extension) ? extension : "jpg";
        const destination = new File(Paths.document, `vehicle-${Date.now()}.${safeExtension}`);
        await new File(photoUri).copy(destination);
        savedPhotoUri = destination.uri;
      }

      if (editingId) {
        await db.runAsync(
          `UPDATE vehicles SET
            name = ?, brand = ?, model = ?, fuel_type = ?, tank_capacity_liters = ?,
            oil_change_interval_km = ?, photo_uri = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE id = ?`,
          trimmedName,
          brand.trim() || null,
          model.trim() || null,
          fuelType,
          capacity,
          interval,
          savedPhotoUri,
          editingId,
        );
      } else {
        await db.runAsync(
          `INSERT INTO vehicles (
            name, brand, model, fuel_type, tank_capacity_liters,
            oil_change_interval_km, photo_uri
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          trimmedName,
          brand.trim() || null,
          model.trim() || null,
          fuelType,
          capacity,
          interval,
          savedPhotoUri,
        );
      }
      refreshHomeScreenWidgets();
      if (editingId) {
        router.replace({ pathname: "/vehicle", params: { id: editingId } });
      } else {
        router.replace("/");
      }
    } catch (error) {
      console.error("Failed to save vehicle", error);
      Alert.alert("Could not save vehicle", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingExisting) {
    return (
      <View style={[styles.flex, styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        onScroll={(event) => {
          scrollOffset.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        scrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={21} color={colors.icon} />
          <Text style={[typography.body, { color: colors.text }]}>Back</Text>
        </Pressable>

        <Text style={[typography.header, styles.title, { color: colors.text }]}>
          {editingId ? "EDIT VEHICLE" : "ADD VEHICLE"}
        </Text>
        <Text style={[typography.bodySmall, styles.subtitle, { color: colors.textSecondary }]}>
          {editingId
            ? "Update your vehicle details."
            : "Add your vehicle details to start tracking fuel and maintenance."}
        </Text>

        <Pressable
          onPress={choosePhoto}
          style={[styles.photoPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          ) : (
            <>
              <Camera size={27} color={colors.iconSecondary} />
              <Text style={[typography.button, { color: colors.text, marginTop: spacing.sm }]}>ADD VEHICLE PHOTO</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Choose a photo from your library</Text>
            </>
          )}
          {photoUri && (
            <Pressable
              accessibilityLabel="Remove vehicle photo"
              onPress={(event) => {
                event.stopPropagation();
                setPhotoUri(null);
                setPhotoChanged(true);
              }}
              style={styles.removePhoto}
            >
              <X size={18} color="#FFFFFF" />
            </Pressable>
          )}
        </Pressable>

        <FormField label="VEHICLE NAME *" value={name} onChangeText={setName} placeholder="e.g. Kuroichi" colors={colors} onFocusInput={keepFocusedInputVisible} />
        <View style={styles.fieldRow}>
          <FormField label="BRAND" value={brand} onChangeText={setBrand} placeholder="Honda" colors={colors} onFocusInput={keepFocusedInputVisible} />
          <FormField label="MODEL" value={model} onChangeText={setModel} placeholder="Click 160" colors={colors} onFocusInput={keepFocusedInputVisible} />
        </View>

        <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>FUEL TYPE *</Text>
        <View style={styles.fuelOptions}>
          {FUEL_TYPES.map((type) => {
            const selected = fuelType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setFuelType(type)}
                style={[
                  styles.fuelOption,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[typography.button, { color: selected ? colors.primaryText : colors.text }]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>

        <FormField label="TANK CAPACITY (L) *" value={tankCapacity} onChangeText={setTankCapacity} placeholder="4.2" keyboardType="decimal-pad" colors={colors} onFocusInput={keepFocusedInputVisible} />
        <FormField label="OIL CHANGE INTERVAL (KM)" value={oilInterval} onChangeText={setOilInterval} placeholder="e.g. 2000" keyboardType="decimal-pad" colors={colors} onFocusInput={keepFocusedInputVisible} />

        <Pressable
          disabled={saving}
          onPress={saveVehicle}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: pressed || saving ? 0.7 : 1 },
          ]}
        >
          <Text style={[typography.button, styles.saveText, { color: colors.primaryText }]}>
            {saving ? "SAVING..." : editingId ? "SAVE CHANGES" : "SAVE VEHICLE"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormField({
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
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  colors: ReturnType<typeof useTheme>["colors"];
  onFocusInput: (input: TextInput) => void;
}) {
  const inputRef = useRef<TextInput | null>(null);
  const handleChangeText = (text: string) => {
    if (keyboardType !== "decimal-pad") {
      onChangeText(text);
      return;
    }

    const numericText = text.replace(/[^0-9.]/g, "");
    const [whole, ...fractionParts] = numericText.split(".");
    onChangeText(
      fractionParts.length > 0
        ? `${whole}.${fractionParts.join("")}`
        : whole,
    );
  };

  return (
    <View style={styles.field}>
      <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        onFocus={() => {
          if (inputRef.current) onFocusInput(inputRef.current);
        }}
        autoCapitalize="words"
        style={[styles.input, typography.body, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { alignItems: "center", justifyContent: "center" },
  content: { paddingTop: 58, paddingHorizontal: spacing.screen, paddingBottom: 140 },
  backButton: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  title: { marginBottom: spacing.xs },
  subtitle: { marginBottom: spacing.xl },
  photoPicker: { height: 170, borderWidth: 1, borderRadius: radius.large, marginBottom: spacing.xl, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoPreview: { width: "100%", height: "100%", resizeMode: "cover" },
  removePhoto: { position: "absolute", top: spacing.sm, right: spacing.sm, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  fieldRow: { flexDirection: "row", gap: spacing.md },
  field: { flex: 1, marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs },
  fuelOptions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  fuelOption: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: radius.medium, borderWidth: 1, paddingHorizontal: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.medium, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  saveButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: radius.medium, marginTop: spacing.sm },
  saveText: { letterSpacing: 0.5 },
});
