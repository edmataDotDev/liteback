import { IsInt, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DepositDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6' })
  @IsString()
  accountPublicId: string;

  @ApiProperty({ example: 2500, description: 'Amount in minor units' })
  @IsInt()
  @Min(1)
  amountMinor: number;
}

export class WithdrawDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6' })
  @IsString()
  accountPublicId: string;

  @ApiProperty({ example: 1000, description: 'Amount in minor units' })
  @IsInt()
  @Min(1)
  amountMinor: number;
}

export class TransferDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6' })
  @IsString()
  fromAccountPublicId: string;

  @ApiProperty({ example: 'f6e5d4c3b2a1' })
  @IsString()
  toAccountPublicId: string;

  @ApiProperty({ example: 1500, description: 'Amount in minor units' })
  @IsInt()
  @Min(1)
  amountMinor: number;
}
