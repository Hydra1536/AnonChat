import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'name must contain only letters, numbers, and hyphens',
  })
  name!: string;
}
