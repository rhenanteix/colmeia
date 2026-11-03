import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
  IsISO8601,
  IsIn,
} from 'class-validator';
export class CreateApprovalDto {
  @IsString() @MinLength(2) @MaxLength(200) operation!: string;
  @IsUUID() approverId!: string;
  @IsISO8601() expiresAt!: string;
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsUUID() taskId?: string;
  @IsOptional() @IsUUID() targetColumnId?: string;
  @IsOptional() @IsIn(['todo', 'doing', 'done']) targetStatus?: string;
}
export class ApprovalDto {
  @IsIn(['approved', 'rejected']) decision!: string;
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
}
export class CancelApprovalDto {
  @IsString() @MinLength(2) @MaxLength(2000) reason!: string;
}
