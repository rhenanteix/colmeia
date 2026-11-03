import { IsInt, Min, IsObject } from 'class-validator';
export class DraftDto {
  @IsInt()
  @Min(0)
  revision!: number;
  @IsObject()
  config!: Record<string, unknown>;
}
