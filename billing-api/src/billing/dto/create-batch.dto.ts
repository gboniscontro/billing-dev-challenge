import { ArrayMinSize, IsArray, IsDateString, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBatchDto {
  @ApiProperty({ example: '0001', description: 'Identificador del talonario' })
  @IsString()
  @IsNotEmpty()
  receiptBook: string;

  @ApiProperty({ example: '2026-08-22', description: 'Fecha de emisión para todas las facturas' })
  @IsDateString()
  @IsNotEmpty()
  issueDate: string;

  @ApiProperty({ example: [1, 2, 3], description: 'Listado de IDs de BillingPending a facturar' })
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  pendingIds: number[];
}