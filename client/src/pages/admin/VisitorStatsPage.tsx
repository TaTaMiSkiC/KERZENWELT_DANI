import React, { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker as SimpleMarker,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { interpolateBlues } from "d3-scale-chromatic";
import { useLanguage } from "@/hooks/use-language";
import { Loader2 } from "lucide-react";

const geoUrl = "/data/world-110m.json";

// ✅ KORREKTUR: Passe das CountryVisit Interface an die tatsächliche Struktur vom Backend an
interface CountryVisit {
  id: string; // Die ID, die das Backend liefert (z.B. 'AT')
  iso_a2: string; // Der ISO_A2-Code, den das Backend zusätzlich liefert
  totalVisits: number;
  // country?: string; // Das 'country'-Feld ist jetzt irrelevant/undefiniert, da Backend id/iso_a2 sendet
}

// ✅ KORREKTUR: Interface anpassen, um 'country-code' statt 'numeric' zu verwenden
interface CountryMapping {
  "country-code": string; // <-- HIER IST DIE KORREKTUR
  "alpha-2": string;
  "alpha-3": string;
  name: string;
}

let countryAlpha2ToNumericIdMapGlobal: Record<string, string> | null = null;
let countryNumericIdToAlpha2MapGlobal: Record<string, string> | null = null;
let countryAlpha2ToNameMapGlobal: Record<string, string> | null = null;

async function loadCountryMappingsGlobal(): Promise<void> {
  if (
    countryAlpha2ToNumericIdMapGlobal &&
    countryNumericIdToAlpha2MapGlobal &&
    countryAlpha2ToNameMapGlobal
  ) {
    return;
  }

  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json",
    );
    if (!response.ok) {
      throw new Error("Failed to load country mapping data from GitHub.");
    }
    const data: CountryMapping[] = await response.json();

    console.log("DEBUG MAPPING GLOBAL: Raw data from all.json:", data);
    console.log(
      "DEBUG MAPPING GLOBAL: Number of countries in raw data:",
      data.length,
    );

    countryAlpha2ToNumericIdMapGlobal = {};
    countryNumericIdToAlpha2MapGlobal = {};
    countryAlpha2ToNameMapGlobal = {};

    data.forEach((country) => {
      // ✅ KORREKTUR: Zugriff auf 'country-code' statt 'numeric'
      if (country["alpha-2"] && country["country-code"] && country.name) {
        countryAlpha2ToNumericIdMapGlobal[country["alpha-2"]] =
          country["country-code"];
        countryNumericIdToAlpha2MapGlobal[country["country-code"]] =
          country["alpha-2"];
        countryAlpha2ToNameMapGlobal[country["alpha-2"]] = country.name;
      } else {
        console.warn(
          "DEBUG MAPPING GLOBAL: Skipping country due to missing 'alpha-2', 'country-code' or 'name' (values were:",
          `alpha-2: ${country["alpha-2"]}, country-code: ${country["country-code"]}, name: ${country.name})`,
          country,
        );
      }
    });

    countryAlpha2ToNumericIdMapGlobal["Localhost"] = "Localhost";
    countryNumericIdToAlpha2MapGlobal["Localhost"] = "Localhost";
    countryAlpha2ToNameMapGlobal["Localhost"] = "Localhost";

    console.log("Country mappings loaded successfully (global).");
    console.log(
      "DEBUG MAPPING GLOBAL: countryAlpha2ToNumericIdMapGlobal['AT'] (after load):",
      countryAlpha2ToNumericIdMapGlobal["AT"],
    );
    console.log(
      "DEBUG MAPPING GLOBAL: countryAlpha2ToNumericIdMapGlobal (full object after load):",
      countryAlpha2ToNumericIdMapGlobal,
    );
  } catch (error) {
    console.error("Error loading country mappings (global):", error);
    countryAlpha2ToNumericIdMapGlobal = {};
    countryNumericIdToAlpha2MapGlobal = {};
    countryAlpha2ToNameMapGlobal = {};
  }
}

const getCountryName = (alpha2Code: string): string => {
  if (alpha2Code === "Localhost") {
    return "Localhost";
  }
  if (
    countryAlpha2ToNameMapGlobal &&
    countryAlpha2ToNameMapGlobal[alpha2Code]
  ) {
    return countryAlpha2ToNameMapGlobal[alpha2Code];
  }
  return alpha2Code;
};

export default function VisitorStatsPage() {
  const { t } = useLanguage();
  const [mappingsLoaded, setMappingsLoaded] = useState(false);

  useEffect(() => {
    loadCountryMappingsGlobal().then(() => {
      setMappingsLoaded(true);
    });
  }, []);

  const {
    data: countryVisits,
    isLoading: isLoadingVisits,
    error,
  } = useQuery<CountryVisit[]>({
    queryKey: ["admin/page-visits/countries"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/api/admin/page-visits/countries",
      );
      if (!response.ok) {
        throw new Error("Fehler beim Abrufen der Länderbesuchsdaten.");
      }
      return await response.json();
    },
    refetchInterval: 1000 * 60 * 5,
    enabled: mappingsLoaded,
  });

  const maxVisits = useMemo(() => {
    return Math.max(...(countryVisits || []).map((d) => d.totalVisits), 1);
  }, [countryVisits]);

  const colorScale = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, maxVisits])
      .range(["#818cf8", "#4f46e5"]);
  }, [maxVisits]);

  useEffect(() => {
    console.log("Country Visits Data (from Backend):", countryVisits);
    if (countryVisits && countryVisits.length > 0) {
      console.log("Max Visits:", maxVisits);
      console.log("Color Scale Domain:", colorScale.domain());
      console.log("Color Scale Range:", colorScale.range());
      console.log("Color for 1 visit:", colorScale(1));
      console.log("Color for maxVisits:", colorScale(maxVisits));
    }
  }, [countryVisits, maxVisits, colorScale]);

  // Im useMemo für countryVisitMapById:
  const countryVisitMapById: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    if (countryVisits && countryAlpha2ToNumericIdMapGlobal) {
      countryVisits.forEach((cv) => {
        // ✅ KORREKTUR: Verwende cv.iso_a2 für den Lookup im Mapping
        // cv.iso_a2 ist jetzt der korrekte ISO_A2-Code vom Backend
        const numericId = countryAlpha2ToNumericIdMapGlobal[cv.iso_a2];
        console.log(
          `DEBUG useMemo (forEach): Mapping '${cv.iso_a2}' (ISO_A2 from backend) -> Numeric ID: '${numericId}'. Total Visits: ${cv.totalVisits}`,
        );

        if (numericId) {
          map[numericId] = cv.totalVisits;
        } else {
          console.warn(
            `DEBUG useMemo (forEach): No numeric ID found for ISO_A2: '${cv.iso_a2}'. This country will not be mapped.`,
          );
        }
      });
    }
    console.log(
      "Country Visit Map by Numeric ID (computed with useMemo):",
      map,
    );
    return map;
  }, [countryVisits, mappingsLoaded]); // Abhängigkeiten unverändert

  if (isLoadingVisits || !mappingsLoaded) {
    return (
      <AdminLayout title={t("admin.visitorStats")}>
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title={t("admin.visitorStats")}>
        <div className="text-red-500 p-8">
          {t("admin.visitorStats.error")}: {error.message}
        </div>
      </AdminLayout>
    );
  }

  const hasDataToShow = countryVisits && countryVisits.length > 0;

  return (
    <AdminLayout title={t("admin.visitorStats")}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">
            {t("admin.visitorStats.title")}
          </CardTitle>
          <CardDescription>
            {t("admin.visitorStats.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasDataToShow ? (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left: Map */}
              <div className="w-full lg:w-2/3 bg-gray-800 rounded-lg p-4 h-[500px] flex items-center justify-center overflow-hidden">
                <ComposableMap
                  projection="geoMercator"
                  style={{ width: "100%", height: "auto" }}
                >
                  <ZoomableGroup
                    center={[10, 50]}
                    zoom={1}
                    maxZoom={5}
                    minZoom={0.5}
                  >
                    <Geographies geography={geoUrl}>
                      {({ geographies }) => {
                        if (geographies.length === 0) {
                          console.warn(
                            "Geographies loaded from TopoJSON is empty!",
                          );
                          return null;
                        } else {
                          console.log(
                            "Geographies loaded:",
                            geographies.length,
                            "countries.",
                          );
                          if (geographies.length > 0) {
                            console.log(
                              "Example geo.id for first 3:",
                              geographies.slice(0, 3).map((g) => g.id),
                            );
                            console.log(
                              "Example geo.properties.name for first 3:",
                              geographies
                                .slice(0, 3)
                                .map((g) => g.properties.name),
                            );
                          }
                        }

                        return geographies.map((geo) => {
                          const geoId = String(geo.id);
                          const visits = countryVisitMapById[geoId] || 0;

                          if (visits > 0) {
                            console.log(
                              `[MAP DEBUG] Matched Geo ID: ${geoId} (${geo.properties.name}), Visits: ${visits}`,
                            );
                          }

                          const fillValue =
                            visits > 0 ? colorScale(visits) : "#374151";

                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={fillValue}
                              stroke="#262b37"
                              style={{
                                default: { outline: "none" },
                                hover: { fill: "#a0aec0", outline: "none" },
                                pressed: { outline: "none" },
                              }}
                            >
                              <title>
                                {geo.properties.name || geoId}: {visits}{" "}
                                {t("admin.visitorStats.visits")}
                              </title>
                            </Geography>
                          );
                        });
                      }}
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>
              </div>

              {/* Right: Table */}
              <div className="w-full lg:w-1/3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {t("admin.visitorStats.topCountries")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            {t("admin.visitorStats.country")}
                          </TableHead>
                          <TableHead className="text-right">
                            {t("admin.visitorStats.visits")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {countryVisits
                          .filter(
                            (cv) =>
                              cv.iso_a2 !== null && cv.iso_a2 !== "Unknown",
                          )
                          .map((cv) => (
                            <TableRow key={cv.iso_a2}>
                              <TableCell>
                                {getCountryName(cv.iso_a2)}{" "}
                              </TableCell>
                              <TableCell className="text-right">
                                {cv.totalVisits}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center p-10 text-muted-foreground">
              {t("admin.visitorStats.noData")}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
