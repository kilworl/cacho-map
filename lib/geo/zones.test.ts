import { describe, expect, it } from "vitest";
import { assignZones, cleanNeighborhood, compassZone } from "./zones";
import type { Place } from "../types";

const bogota = { name: "Bogotá", lat: 4.65, lon: -74.06 };
const p = (id: string, lat: number, lon: number, neighborhood?: string): Place => ({ id, name: id, lat, lon, affinity: 1, neighborhood });

describe("cleanNeighborhood", () => {
  it("strips administrative prefixes", () => {
    expect(cleanNeighborhood("UPZ Jardín Botánico")).toBe("Jardín Botánico");
    expect(cleanNeighborhood("UPZs Localidad Chapinero")).toBe("Chapinero");
    expect(cleanNeighborhood("Colonia Condesa")).toBe("Condesa");
    expect(cleanNeighborhood("Bogotá", "Bogotá")).toBeUndefined();
  });
});

describe("assignZones", () => {
  it("uses Qloo neighborhoods, then nearest named place, then a compass sector", () => {
    const zoned = assignZones([p("a", 4.65, -74.06, "UPZ Chicó Lago"), p("b", 4.6505, -74.0605), p("c", 4.75, -74.06)], bogota, "es");
    expect(zoned.map((z) => z.zone)).toEqual(["Chicó Lago", "Chicó Lago", "Sector norte"]);
  });
  it("refines Cartagena places with the neighborhood list", () => {
    const [z] = assignZones([p("a", 10.4206, -75.5466)], { name: "Cartagena", lat: 10.42, lon: -75.54 }, "es");
    expect(z.zone).toBe("Getsemaní");
  });
  it("localizes compass sectors", () => {
    expect(compassZone({ lat: 4.55, lon: -74.06 }, bogota, "en")).toBe("South side");
  });
});
