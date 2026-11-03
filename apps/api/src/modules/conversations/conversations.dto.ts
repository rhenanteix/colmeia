import { IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
export class CreateConversationDto {
  @IsUUID() agentId!: string;
}
export class RenameConversationDto {
  @IsString() @MinLength(1) @MaxLength(100) title!: string;
}
export class SendConversationDto {
  @IsString() @MinLength(1) @MaxLength(16000) text!: string;
  @IsUUID() requestId!: string;
}
