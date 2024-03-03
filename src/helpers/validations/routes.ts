import { ResponseFormat } from "@/typescript/response";
import { z } from "zod";

export const routesRequestSchema = z.object({
  id: z.string().regex(/\w{1}/, "Invalid route ID").optional(),
  format: z.nativeEnum(ResponseFormat).optional(),
});

export const findRoutesRequestSchema = z.object({
  from: z.object({
    preferId: z.number({ required_error: '"from.preferId" is required' }),
    name: z.string({ required_error: '"from.name" is required' }),
    road: z.string({ required_error: '"from.road" is required' }),
    township: z.string({ required_error: '"from.township" is required' }),
  }),
  to: z.object({
    preferId: z.number({ required_error: '"from.preferId" is required' }),
    name: z.string({ required_error: '"to.name" is required' }),
    road: z.string({ required_error: '"to.road" is required' }),
    township: z.string({ required_error: '"to.township" is required' }),
  }),
  count: z.number().min(10).optional(),
  format: z.nativeEnum(ResponseFormat).optional(),
});

export const routeIdSchema = z.object({
  id: z.string({ invalid_type_error: '"id" must be a string' }),
  format: z.nativeEnum(ResponseFormat).optional(),
});
