import { IsEmail, IsString, MinLength, MaxLength, IsIn } from 'class-validator';
export class RegisterDto {
  @IsEmail()
  email!: string;
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  organizationName!: string;
}
export class LoginDto {
  @IsEmail()
  email!: string;
  @IsString()
  password!: string;
}
export class InviteDto {
  @IsEmail()
  email!: string;
  @IsIn(['ADMIN', 'MEMBER', 'VIEWER'])
  role!: 'ADMIN' | 'MEMBER' | 'VIEWER';
}
export class AcceptDto {
  @IsString()
  token!: string;
}
export class ResetRequestDto {
  @IsEmail()
  email!: string;
}
export class ResetConfirmDto {
  @IsString()
  token!: string;
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
export class SwitchDto {
  @IsString()
  organizationId!: string;
}
