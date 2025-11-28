import { z } from 'zod';

// Zod schema para validación de variables de entorno
export const envValidationSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().default(3000),

  // CORS Configuration
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Database Configuration
  DB_SYNCHRONIZE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
  DB_LOGGING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
});

// Tipo inferido automáticamente del schema
export type EnvironmentVariables = z.infer<typeof envValidationSchema>;
