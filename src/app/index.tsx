import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import {
  ChevronRight,
  Droplet,
  Fuel,
  Gauge,
  Plus,
  Search,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { radius, spacing, typography, useTheme } from "../theme";

type Vehicle = {
  id: number;
  name: string;
  brand: string | null;
  model: string | null;
  fuel_type: string;
  tank_capacity_liters: number;
  latest_odometer_km: number | null;
  photo_uri: string | null;
};

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadVehicles = async () => {
        try {
          const rows = await db.getAllAsync<Vehicle>(
            `SELECT id, name, brand, model, fuel_type, tank_capacity_liters,
                    photo_uri,
                    (SELECT odometer_km FROM fuel_logs
                     WHERE vehicle_id = vehicles.id
                     ORDER BY odometer_km DESC, id DESC LIMIT 1) AS latest_odometer_km
             FROM vehicles ORDER BY created_at DESC, id DESC`,
          );
          if (active) setVehicles(rows);
        } catch (error) {
          console.error("Failed to load vehicles", error);
        }
      };
      void loadVehicles();
      return () => {
        active = false;
      };
    }, [db]),
  );

  const filteredVehicles = vehicles.filter((vehicle) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [vehicle.name, vehicle.brand, vehicle.model]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });

  const getVehicleSubtitle = (vehicle: Vehicle) =>
    [vehicle.brand, vehicle.model].filter(Boolean).join(" ");

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
        },
      ]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[
            typography.header,
            {
              color: colors.text,
            },
          ]}
        >
          FUELSENSE
        </Text>
      </View>

      {/* Search */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.search,
          },
        ]}
      >
        <Search size={18} color={colors.iconSecondary} strokeWidth={1.6} />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search Vehicle..."
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.searchInput,
            {
              color: colors.text,
            },
          ]}
        />
      </View>

      {/* Vehicles Header */}
      <View style={styles.sectionHeader}>
        <Text
          style={[
            typography.subHeader,
            {
              color: colors.text,
            },
          ]}
        >
          Vehicles
        </Text>

        <Text
          style={[
            typography.caption,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {vehicles.length}
        </Text>
      </View>

      {filteredVehicles.length === 0 ? (
        <View style={[styles.emptyState, { borderColor: colors.border }]}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            {vehicles.length === 0
              ? "No vehicles added yet. Add a vehicle to get started."
              : "No vehicles match your search."}
          </Text>
        </View>
      ) : (
        filteredVehicles.map((vehicle) => (
          <Pressable
            key={vehicle.id}
            onPress={() =>
              router.push({ pathname: "/vehicle", params: { id: vehicle.id } })
            }
            style={[
              styles.vehicleCard,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Image
              source={
                vehicle.photo_uri
                  ? { uri: vehicle.photo_uri }
                  : require("../../assets/images/placeholder.png")
              }
              resizeMode="cover"
              style={styles.vehicleImage}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.92)"]}
              locations={[0, 0.45, 1]}
              style={styles.bottomGradient}
            />
            <View style={styles.vehicleText}>
              <Text numberOfLines={1} style={styles.vehicleName}>
                {vehicle.name}
              </Text>
              {getVehicleSubtitle(vehicle) ? (
                <Text numberOfLines={1} style={styles.vehicleSubtitle}>
                  {getVehicleSubtitle(vehicle)}
                </Text>
              ) : null}
            </View>
            <View style={styles.vehicleInfo}>
              <View style={styles.infoRow}>
                <Fuel size={16} color={colors.primary} strokeWidth={1.5} />
                <Text style={[typography.label, styles.vehicleInfoText]}>
                  {vehicle.fuel_type.toUpperCase()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Droplet size={16} color={colors.primary} strokeWidth={1.5} />
                <Text style={[typography.label, styles.vehicleInfoText]}>
                  {vehicle.tank_capacity_liters} LITERS
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Gauge size={16} color={colors.primary} strokeWidth={1.5} />
                <Text
                  numberOfLines={1}
                  style={[typography.label, styles.vehicleInfoText]}
                >
                  {vehicle.latest_odometer_km === null
                    ? "ODO NOT SET"
                    : `${vehicle.latest_odometer_km.toLocaleString()} KM`}
                </Text>
              </View>
            </View>
          </Pressable>
        ))
      )}

      {/* Add Vehicle */}
      <Pressable
        onPress={() => router.push("/add_vehicle")}
        style={({ pressed }) => [
          styles.addVehicle,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.addIcon,
            {
              backgroundColor: isDark ? "#292929" : "#D5D5D5",
            },
          ]}
        >
          <Plus size={23} color={colors.icon} strokeWidth={1.5} />
        </View>

        <View style={styles.addText}>
          <Text
            style={[
              typography.label,
              {
                color: colors.text,
              },
            ]}
          >
            ADD VEHICLE
          </Text>

          <Text
            style={[
              typography.caption,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            Register another vehicle
          </Text>
        </View>

        <ChevronRight
          size={21}
          color={colors.iconSecondary}
          strokeWidth={1.5}
        />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingTop: 75,
    paddingHorizontal: spacing.screen,
    paddingBottom: 130,
  },

  header: {
    marginBottom: 25,
  },

  searchContainer: {
    height: 46,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 20,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontFamily: typography.search.fontFamily,
    fontSize: typography.search.fontSize,
    lineHeight: typography.search.lineHeight,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  vehicleCard: {
    height: 170,
    borderRadius: radius.large,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 12,
  },

  emptyState: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: radius.large,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    marginBottom: spacing.md,
  },

  vehicleImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: -12,
    bottom: 0,
    width: "100%",
    height: "100%",
  },

  vehicleText: {
    position: "absolute",
    left: 18,
    bottom: 17,
    maxWidth: "50%",
  },

  vehicleName: {
    fontFamily: typography.subHeader.fontFamily,
    fontSize: 25,
    lineHeight: 30,
    color: "#FFFFFF",
  },

  vehicleSubtitle: {
    marginTop: 2,
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    color: "rgba(255,255,255,0.82)",
  },

  vehicleInfo: {
    position: "absolute",
    right: -30,
    bottom: 17,
    gap: 5,
    width: 128,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 5,
  },

  vehicleInfoText: {
    color: "#FFFFFF",
  },

  addVehicle: {
    height: 67,
    borderRadius: radius.large,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  addIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  addText: {
    flex: 1,
    marginLeft: 12,
  },

  pressed: {
    opacity: 0.65,
  },

  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "75%",
  },
});
