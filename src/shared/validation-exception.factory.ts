import { HttpException, ValidationError } from '@nestjs/common';
import { AppException } from './app-exception';
import { ERROR_CODES } from './error-codes';

export function validationExceptionFactory(errors: ValidationError[]): HttpException {
  const first = errors[0];
  const constraints = first?.constraints ? Object.values(first.constraints) : [];
  const message = constraints[0] ?? 'Validation failed';

  return new AppException(400, ERROR_CODES.VALIDATION_ERROR, message);
}
