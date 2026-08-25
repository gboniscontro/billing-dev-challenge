import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('billing')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('pendings')
  @ApiOperation({ summary: 'Obtener pendientes de facturación' })
  @ApiQuery({ name: 'customerId', required: false, type: Number, description: 'ID de cliente para filtrar (opcional)' })
  getPendings(@Query('customerId') customerId?: number) {
    return this.billingService.getPendings(customerId ? Number(customerId) : undefined);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Obtener facturas generadas' })
  @ApiQuery({ name: 'batchId', required: false, type: Number, description: 'Filtrar por lote' })
  getInvoices(@Query('batchId') batchId?: number) {
    return this.billingService.getInvoices(batchId ? Number(batchId) : undefined);
  }

  @Post('services/:id/send-to-billing')
  @ApiOperation({ summary: 'Enviar un servicio entregado a facturación' })
  sendServiceToBilling(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.sendServiceToBilling(id);
  }

  @Post('batches')
  @ApiOperation({ summary: 'Ejecutar facturación manual por lote' })
  createBatch(@Body() createBatchDto: CreateBatchDto) {
    return this.billingService.createBatch(createBatchDto);
  }

  @Get('batches/:id/export')
  @ApiOperation({ summary: 'Obtener payload de datos transformados para ERP contable' })
  getExportData(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.getBatchExportFormat(id);
  }

  @Post('batches/:id/sync')
  @ApiOperation({ summary: 'Simular sincronización de un lote con el ERP' })
  syncBatch(@Param('id', ParseIntPipe) id: number) {
    return this.billingService.syncBatch(id);
  }
}