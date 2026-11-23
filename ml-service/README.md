# Savvy Background Engine v3 BETA

Motor BETA independiente para generar recortes PNG con transparencia real.

## Decisiones

- BiRefNet HR Matting es el motor predeterminado.
- Se ejecuta a 1024x1024 y restaura el alfa al tamano original.
- La imagen conserva su resolución y orientación originales.
- El modo `refine` se conserva solamente por compatibilidad con el cliente.
- Una sola inferencia se ejecuta a la vez para evitar picos de memoria.
- La página de producción no se modifica durante las pruebas.

## API

- `GET /health`
- `POST /remove-bg?refine=false`, multipart field `file`

La respuesta es un PNG RGBA e incluye cabeceras con motor, tiempo y tamaño de
la fotografía original.

