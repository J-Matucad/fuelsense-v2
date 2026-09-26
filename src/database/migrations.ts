import type { SQLiteDatabase } from "expo-sqlite";

/** Create or upgrade the on-device FuelSense database without dropping vehicle data. */
export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA foreign_keys = ON");
  const result = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        make TEXT,
        model TEXT,
        year INTEGER,
        vehicle_type TEXT NOT NULL DEFAULT 'motorcycle',
        fuel_type TEXT NOT NULL DEFAULT 'gasoline',
        tank_capacity_liters REAL NOT NULL CHECK (tank_capacity_liters > 0),
        current_odometer_km REAL CHECK (current_odometer_km IS NULL OR current_odometer_km >= 0),
        oil_change_interval_km REAL CHECK (oil_change_interval_km IS NULL OR oil_change_interval_km > 0),
        last_oil_change_odometer_km REAL CHECK (last_oil_change_odometer_km IS NULL OR last_oil_change_odometer_km >= 0),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
    currentVersion = 1;
  }

  if (currentVersion < 2) {
    let columns = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(vehicles)",
    );

    // A database may have been created by an earlier prototype with a different
    // vehicle shape. Create the v1 shape only when the table does not exist.
    if (columns.length === 0) {
      await db.execAsync(`
        CREATE TABLE vehicles (
          id INTEGER PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          make TEXT,
          model TEXT,
          year INTEGER,
          vehicle_type TEXT NOT NULL DEFAULT 'motorcycle',
          fuel_type TEXT NOT NULL DEFAULT 'gasoline',
          tank_capacity_liters REAL NOT NULL DEFAULT 1,
          current_odometer_km REAL,
          oil_change_interval_km REAL,
          last_oil_change_odometer_km REAL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
      `);
      columns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(vehicles)",
      );
    }

    const existing = new Set(columns.map((column) => column.name));
    const sourceColumn = (...candidates: string[]) => {
      const match = candidates.find((candidate) => existing.has(candidate));
      return match ? `"${match}"` : null;
    };
    const nameColumn = sourceColumn("name", "vehicle_name", "nickname");
    const brandColumn = sourceColumn("brand", "make", "manufacturer");
    const modelColumn = sourceColumn("model");
    const fuelColumn = sourceColumn("fuel_type", "fuel");
    const capacityColumn = sourceColumn(
      "tank_capacity_liters",
      "tank_capacity",
      "fuel_capacity_liters",
      "fuel_capacity",
    );
    const odometerColumn = sourceColumn(
      "current_odometer_km",
      "odometer_km",
      "current_odometer",
      "odometer",
    );
    const intervalColumn = sourceColumn(
      "oil_change_interval_km",
      "oil_interval_km",
    );
    const idColumn = sourceColumn("id");
    const createdColumn = sourceColumn("created_at");
    const updatedColumn = sourceColumn("updated_at");
    const nameExpression = nameColumn
      ? `COALESCE(NULLIF(TRIM(CAST(${nameColumn} AS TEXT)), ''), 'My Vehicle')`
      : "'My Vehicle'";
    const fuelExpression = fuelColumn
      ? `CASE lower(trim(CAST(${fuelColumn} AS TEXT)))
          WHEN 'diesel' THEN 'Diesel'
          WHEN 'premium' THEN 'Premium'
          ELSE 'Unleaded'
        END`
      : "'Unleaded'";
    const capacityExpression = capacityColumn
      ? `CASE WHEN CAST(COALESCE(${capacityColumn}, 0) AS REAL) > 0
          THEN CAST(${capacityColumn} AS REAL) ELSE 1.0 END`
      : "1.0";
    const odometerExpression = odometerColumn
      ? `CASE WHEN CAST(COALESCE(${odometerColumn}, 0) AS REAL) >= 0
          THEN CAST(${odometerColumn} AS REAL) ELSE 0 END`
      : "0";
    const intervalExpression = intervalColumn
      ? `CASE WHEN CAST(${intervalColumn} AS REAL) > 0
          THEN CAST(${intervalColumn} AS REAL) ELSE NULL END`
      : "NULL";

    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DROP TABLE IF EXISTS vehicles_v2;
        CREATE TABLE vehicles_v2 (
          id INTEGER PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          brand TEXT,
          model TEXT,
          fuel_type TEXT NOT NULL CHECK (fuel_type IN ('Diesel', 'Unleaded', 'Premium')),
          tank_capacity_liters REAL NOT NULL CHECK (tank_capacity_liters > 0),
          current_odometer_km REAL NOT NULL CHECK (current_odometer_km >= 0),
          oil_change_interval_km REAL CHECK (oil_change_interval_km IS NULL OR oil_change_interval_km > 0),
          photo_uri TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );

        INSERT INTO vehicles_v2 (
          id, name, brand, model, fuel_type, tank_capacity_liters,
          current_odometer_km, oil_change_interval_km, created_at, updated_at
        )
        SELECT
          ${idColumn ?? "rowid"},
          ${nameExpression},
          ${brandColumn ?? "NULL"},
          ${modelColumn ?? "NULL"},
          ${fuelExpression},
          ${capacityExpression},
          ${odometerExpression},
          ${intervalExpression},
          ${createdColumn ?? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"},
          ${updatedColumn ?? "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"}
        FROM vehicles;

        DROP TABLE vehicles;
        ALTER TABLE vehicles_v2 RENAME TO vehicles;
      `);
      await db.execAsync("PRAGMA user_version = 2");
    });
  }

  if (currentVersion < 3) {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(vehicles)");
    if (!columns.some((column) => column.name === "initial_odometer_km")) {
      await db.execAsync("ALTER TABLE vehicles ADD COLUMN initial_odometer_km REAL NOT NULL DEFAULT 0");
      await db.execAsync("UPDATE vehicles SET initial_odometer_km = current_odometer_km");
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS fuel_logs (
        id INTEGER PRIMARY KEY NOT NULL,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        odometer_km REAL NOT NULL CHECK (odometer_km >= 0),
        fuel_liters REAL NOT NULL CHECK (fuel_liters >= 0),
        price_per_liter REAL CHECK (price_per_liter IS NULL OR price_per_liter >= 0),
        station TEXT,
        is_full INTEGER NOT NULL DEFAULT 0 CHECK (is_full IN (0, 1)),
        is_baseline INTEGER NOT NULL DEFAULT 0 CHECK (is_baseline IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_odometer
        ON fuel_logs(vehicle_id, odometer_km, id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fuel_logs_one_baseline
        ON fuel_logs(vehicle_id) WHERE is_baseline = 1;
      PRAGMA user_version = 3;
    `);
    currentVersion = 3;
  }

  if (currentVersion < 4) {
    await db.execAsync("PRAGMA foreign_keys = OFF");
    try {
      await db.withTransactionAsync(async () => {
        await db.execAsync(`
          CREATE TABLE vehicles_v4 (
            id INTEGER PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            brand TEXT,
            model TEXT,
            fuel_type TEXT NOT NULL CHECK (fuel_type IN ('Diesel', 'Unleaded', 'Premium')),
            tank_capacity_liters REAL NOT NULL CHECK (tank_capacity_liters > 0),
            oil_change_interval_km REAL CHECK (oil_change_interval_km IS NULL OR oil_change_interval_km > 0),
            photo_uri TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          );
          INSERT INTO vehicles_v4 (
            id, name, brand, model, fuel_type, tank_capacity_liters,
            oil_change_interval_km, photo_uri, created_at, updated_at
          )
          SELECT id, name, brand, model, fuel_type, tank_capacity_liters,
                 oil_change_interval_km, photo_uri, created_at, updated_at
          FROM vehicles;
          DROP TABLE vehicles;
          ALTER TABLE vehicles_v4 RENAME TO vehicles;
          PRAGMA user_version = 4;
        `);
      });
    } finally {
      await db.execAsync("PRAGMA foreign_keys = ON");
    }
    currentVersion = 4;
  }

  if (currentVersion < 5) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS oil_logs (
        id INTEGER PRIMARY KEY NOT NULL,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        odometer_km REAL NOT NULL CHECK (odometer_km >= 0),
        oil_type TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE INDEX IF NOT EXISTS idx_oil_logs_vehicle_odometer
        ON oil_logs(vehicle_id, odometer_km DESC, id DESC);
      PRAGMA user_version = 5;
    `);
    currentVersion = 5;
  }
}
