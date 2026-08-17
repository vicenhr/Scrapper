# Scrapper

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Cheerio](https://img.shields.io/badge/Cheerio-E88C1F?style=for-the-badge&logo=cheerio&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white)
![JSON](https://img.shields.io/badge/JSON-000000?style=for-the-badge&logo=json&logoColor=white)

Descarga tres páginas de catálogo de un entorno de pruebas, visita las 60 páginas del libro y convierte el HTML desordenado en JSON limpio y verificado.

---

## Tecnologías
- Node.js — entorno de ejecución
- Cheerio — para analizar HTML
- Zod — para validar y transformar datos

---

## Target classification

- Sitio: https://books.toscrape.com/
- Por qué: toscrape.com se presenta como un sandbox construido 
  específicamente para que la gente practique web scraping.
- Alcance: solo las primeras 3 páginas del catálogo (60 libros)
- Datos a recopilar: título, precio, disponibilidad, rating, 
  descripción y URL de cada libro
- Resultado de robots.txt: archivo no encontrado (404) — 
  no hay reglas explícitas, pero eso no es un permiso, 
  solo significa que no hay archivo.

No reutilizaré este código en otro sitio sin revisar sus reglas y términos primero.

---

## Instalación y ejecución
1. Clonar el repositorio

```bash
   git clone https://github.com/vicenhr/Scrapper
```
2. Instalar dependencias

```bash
   npm install
```

3. Ejecutar el scrapper

```bash
   node src/index.js
```

---

## Esquema de los registros

| Campo | Tipo | Descripción |
|---|---|---|
| `title` | string | Título del libro |
| `product_url` | string | URL absoluta de la página del libro (identidad única) |
| `price_text` | string | Precio tal como aparece en el HTML (ej. "£51.77") |
| `price_gbp` | number | Precio normalizado como número (ej. 51.77) |
| `availability_text` | string | Texto de disponibilidad (ej. "In stock (22 available)") |
| `rating_text` | string | Calificación en palabras (ej. "Three") |
| `description` | string \| null | Descripción del libro, o `null` si no existe |
| `source_page` | string | URL de la página de catálogo donde se encontró el link |
| `fetched_at` | string | Fecha y hora ISO en que se extrajo el registro |

Validado con este schema de Zod:

```typescript
const bookSchema = z.object({
    title: z.string(),
    product_url: z.string().url().startsWith('https://'),
    price_text: z.string(),
    price_gbp: z.number(),
    availability_text: z.string(),
    rating_text: z.string(),
    description: z.string().nullable(),
    source_page: z.string().url(),
    fetched_at: z.string()
});
```

---

## Normas de cortesía
- User-Agent personalizado que identifica al scraper y enlaza al repositorio.
- Timeout de 5 segundos por solicitud — si el servidor no responde a tiempo, se aborta.
- Espera de 500ms entre solicitudes reales al sitio (no aplica a lecturas desde cache).
- Caché local de páginas descargadas para no repetir solicitudes innecesarias.

---

## Limitaciones
- El scraper reintenta una sola vez ante fallos de red; si el error persiste, la página se marca como fallida y no se reintenta más en esa misma corrida.

---

## Ejemplo de salida

```json
{
  "start_time": "2026-08-17T02:40:12.941Z",
  "duration": 2.62,
  "catalogue_pages": 3,
  "cache_hits": 60,
  "pages_fetched": 3,
  "valid_records": 60,
  "invalid_records": 0,
  "fail_pages": 0
}
```

---

## ¿Por qué esta tarea no requiere navegador?

Los datos ya están presentes en el HTML de la página, por lo que el navegador solo añadiría una carga innecesaria.

---

## Ética

Este scraper solo se usó contra un sandbox público diseñado para practicar scraping. Como regla general: usar una API oficial cuando exista, nunca saltarse logins, paywalls o bloqueos del sitio, y recolectar únicamente los datos necesarios para la tarea.

---

## Autor

**Vicente Hernández Ramos** — [@vicenhr](https://github.com/vicenhr)