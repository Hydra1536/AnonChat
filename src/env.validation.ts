import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUrl, Max, Min, validateSync } from 'class-validator';

class EnvVars {
  @IsOptional()
  @IsString()
  APP_ORIGIN?: string;

  @IsUrl({
    require_tld: false,
    protocols: ['postgres', 'postgresql'],
  })
  DATABASE_URL!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsUrl({
    require_tld: false,
    protocols: ['redis', 'rediss'],
  })
  REDIS_URL!: string;

  @IsInt()
  @Min(60)
  @Max(172800)
  SESSION_TTL_SECONDS!: number;
}

export function envValidation(config: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.toString()}`);
  }

  return validated;
}
