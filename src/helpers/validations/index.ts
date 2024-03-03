/**
 * Supported distance units to use when searching routes and stops
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

export const lngRegex = /[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)/;
export const latRegex = /[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)/;
