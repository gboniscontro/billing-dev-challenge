# Entidades del dominio

## Service

Representa un servicio logístico. Contiene la fecha en que se realizó, el cliente, el importe y un estado exclusivamente logístico:

```text
PENDING -> IN_TRANSIT -> DELIVERED
                         \-> CANCELLED
```

No contiene estados de facturación ni datos de factura.

## BillingPending

Representa un servicio listo para ser incluido en un lote. Se crea cuando un `Service` `DELIVERED` se envía a facturación.

Estados:

- `PENDING`: disponible para facturar.
- `INVOICED`: ya fue incluido en una factura.

## BillingBatch

Representa una ejecución manual de facturación. Define la fecha de emisión, el talonario y el estado del lote. También registra el estado de sincronización simulada con el ERP.

## Invoice

Representa la factura generada a partir de un pendiente. Contiene número correlativo, CAE simulado, fecha, importe y referencias al lote y al pendiente.

## BillingSequence

Mantiene el último número utilizado por cada talonario. Se bloquea durante la creación de un lote para evitar números duplicados cuando existen operaciones concurrentes.

## Relaciones

```text
Service 1 -> 0..1 BillingPending
BillingPending 1 -> 0..1 Invoice
BillingBatch 1 -> N Invoice
```

La base de datos refuerza las relaciones uno a uno mediante índices únicos sobre `serviceId` y `pendingId`.
