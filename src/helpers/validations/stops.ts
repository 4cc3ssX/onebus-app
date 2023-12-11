import { ResponseFormat } from "@/typescript/response";
import { z } from "zod";
import { lngRegex, latRegex } from ".";

/**
 * Supported distance units to use when searching for nearest stops
 */
export enum DistanceUnits {
  METERS = "meters",
  MILLIMETERS = "millimeters",
  CENTIMETERS = "centimeters",
  KILOMETERS = "kilometers",
  ACRES = "acres",
  MILES = "miles",
  NAUTICALMILES = "nauticalmiles",
  INCHES = "inches",
  YARDS = "yards",
  FEET = "feet",
  RADIANS = "radians",
  DEGREES = "degrees",
  HECTARES = "hectares",
}

export const stopsRequestSchema = z.object({
  name: z.string().optional(),
  road: z.string().optional(),
  township: z.string().optional(),
  format: z.nativeEnum(ResponseFormat).optional(),
});

export const stopIdSchema = z.object({
  id: z
    .number({ invalid_type_error: '"id" must be a number' })
    .min(1, { message: '"id" must be greater than or equal to 1' }),
  format: z.nativeEnum(ResponseFormat).optional(),
});

export const nearestRequestSchema = z.object({
  lng: z.string().regex(lngRegex, "Invalid longitude"),
  lat: z.string().regex(latRegex, "Invalid latitude"),
  format: z.nativeEnum(ResponseFormat).optional(),
  count: z
    .number({ invalid_type_error: '"count" must be a number' })
    .min(1, { message: '"count" must be greater than or equal to 1' })
    .max(100, { message: '"count" must be less than or equal to 100' })
    .optional(),
  distance_unit: z.nativeEnum(DistanceUnits).optional(),
});
