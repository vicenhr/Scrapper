# Scrapper
Descarga tres páginas de catálogo de un entorno de pruebas, visita las 60 páginas del libro y convierte el HTML desordenado en JSON limpio y verificado.

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

No reutilizaré este código en otro sitio sin revisar sus reglas 
y términos primero.