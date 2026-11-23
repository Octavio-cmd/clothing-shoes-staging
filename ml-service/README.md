# Savvy Background Engine v2

Motor BETA independiente para generar recortes PNG con transparencia real.

## Decisiones

- BEN2 Base es el motor predeterminado.
- La imagen conserva su resolución y orientación originales.
- El modo `refine` es opcional; no se aplica automáticamente porque modifica
  los píxeles RGB además del alfa.
- Una sola inferencia se ejecuta a la vez para evitar picos de memoria.
- La página de producción no se modifica durante las pruebas.

## API

- `GET /health`
- `POST /remove-bg?refine=false`, multipart field `file`

La respuesta es un PNG RGBA e incluye cabeceras con motor, tiempo y tamaño de
la fotografía original.

