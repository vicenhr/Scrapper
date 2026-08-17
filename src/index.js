const fs = require('fs');
const zod = require('zod');
const fsPromises = require('fs').promises;
const cheerio = require('cheerio');
const { z } = require('zod');
const ms = 5000; // 5 seconds
const baseUrl = 'https://books.toscrape.com/catalogue/page-';

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

const allBookLinks = new Array(); // NUEVO: acumulador compartido entre todas las llamadas
let cacheHitCount = 0;
let fetchCount = 0;
let cataloguePagesCount = 0;

function sleep(delayMs) { // NUEVO: función de espera
    return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function asyncCall(page) {
    const fileName = `cache/catalogue-page-${page}.html`;
    let wasFetch = false; // NUEVO: para saber si hacemos sleep o no
    try {
        if (fs.existsSync(fileName)) {
            cacheHitCount++;
            const data = await fsPromises.readFile(fileName, 'utf8');
            console.log(`CACHE HIT page ${page} (size: ${data.length} bytes)`);
        } else {
            const response = await fetch(`${baseUrl}${page}.html`, {
                signal: AbortSignal.timeout(ms),
                headers: {
                    'User-Agent': 'FlyRankInternshipA9/1.0 (https://github.com/vicenhr/Scrapper.git)',
                }
            });
            if (response.ok) {
                await fsPromises.mkdir('./cache', { recursive: true });
                const html = await response.text();
                await fsPromises.writeFile(fileName, html)
                fetchCount++;
                wasFetch = true;
                console.log(`FETCH page ${page} (size: ${html.length} bytes)`);
            } else {
                console.error(`HTTP error! status: ${response.status} for page ${page}`);
                return;
            }
        }
    } catch (err) {
        if (err.name === "TimeoutError") {
            console.error("Timeout: It took more than 5 seconds to get the result!");
        } else if (err.name === "AbortError") {
            console.error("Fetch aborted by user action (browser stop button, closing tab, etc.");
        } else if (err.name === "TypeError") {
            console.error("AbortSignal.timeout() method is not supported");
        } else {
            console.error(`Error: type: ${err.name}, message: ${err.message}`);
        }
        return;
    }

    if (wasFetch) {
        await sleep(500); // NUEVO: 500ms solo si de verdad pegamos al sitio
    }

    // Cargar el HTML guardado
    const $ = cheerio.load(fs.readFileSync(fileName, 'utf8'));

    // Encontrar el link de cada libro en la pagina
    const pageUrl = `${baseUrl}${page}.html`; // CAMBIO: URL real de ESTA página, no la raíz de baseUrl
    $('article.product_pod h3 a').each((index, element) => {
        const link = $(element).attr('href');
        const bookUrl = new URL(link, pageUrl).href; // CAMBIO: se construye la URL absoluta usando la URL de la página actual
        if (allBookLinks.some(book => book.url === bookUrl)) {
            console.log(`Duplicate found: ${bookUrl} (source page: ${pageUrl})`);
        } else {
            allBookLinks.push({ url: bookUrl, sourcePage: pageUrl });
        }
    });

    // Verificar si hay boton next
    const nextHref = $('li.next a').attr('href');
    if (nextHref && page < 3) { // CAMBIO: además de que exista "next", checa que no hayamos llegado al límite de 3
        await asyncCall(page + 1);
    } else {
        cataloguePagesCount = page;
        console.log(`catalogue_pages=${page}, discovered=${allBookLinks.length}, unique_urls=${new Set(allBookLinks.map(link => link.url)).size}`);
    }
}

async function extractRecord(bookUrl, sourcePage, attempt = 0) {
    // CAMBIO 1: usamos el penúltimo segmento de la URL (el slug único), no el último (siempre "index.html")
    const urlParts = bookUrl.split('/');
    const slug = urlParts[urlParts.length - 2];
    const fileName = 'cache/book-' + slug + '.html';

    let html;
    let wasFetch = false;

    try {
        if (fs.existsSync(fileName)) {
            html = await fsPromises.readFile(fileName, 'utf8'); // CAMBIO 2: guardamos el html en variable, no solo lo logueamos
            console.log(`CACHE HIT book ${bookUrl} (size: ${html.length} bytes)`);
        } else {
            const response = await fetch(bookUrl, {
                signal: AbortSignal.timeout(ms),
                headers: {
                    'User-Agent': 'FlyRankInternshipA9/1.0 (https://github.com/vicenhr/Scrapper.git)',
                }
            });
            if (response.ok) {
                html = await response.text();
                await fsPromises.mkdir('./cache', { recursive: true }); // CAMBIO 3: ahora sí se guarda en disco
                await fsPromises.writeFile(fileName, html);
                wasFetch = true;
                console.log(`FETCH book ${bookUrl} (size: ${html.length} bytes)`);
            } else {
                console.error(`HTTP error! status: ${response.status} for URL ${bookUrl}`);
                return null;
            }
        }
    } catch (err) {
        if (attempt == 0) {
            return extractRecord(bookUrl, sourcePage, attempt + 1);
        } else {
            console.error(`Error fetching ${bookUrl}: ${err.message}`);
            return null;
        }
    }

    if (wasFetch) {
        await sleep(500);
    }

    // CAMBIO 4: parseo y construcción del record viven UNA sola vez, fuera del if/else, usando la variable html
    const $ = cheerio.load(html);
    const title = $('div.product_main h1').text().trim();
    const priceText = $('div.product_main p.price_color').text().trim();
    const availabilityText = $('div.product_main p.availability').text().trim();
    const ratingText = $('div.product_main p.star-rating').attr('class').split(' ')[1];
    const descEl = $('#product_description + p');
    const description = descEl.length > 0 ? descEl.text().trim() : null;

    const record = {
        title: title,
        product_url: bookUrl,
        price_text: priceText,
        price_gbp: cleanData(priceText),
        availability_text: availabilityText,
        rating_text: ratingText,
        description: description,
        source_page: sourcePage,
        fetched_at: new Date().toISOString(),
    };

    return record; // CAMBIO 5: ahora sí regresa el objeto, no solo lo imprime
}

function cleanData(priceText) {
    const numericString = priceText.replace(/[^0-9.]/g, '');
    return parseFloat(numericString);
}

async function main() {
    const startTime = new Date();

    // Recopilar los enlances de todas las N paginas
    await asyncCall(1);

    allBookLinks.push({ url: 'https://books.toscrape.com/catalogue/no-existe-este-libro/index.html', sourcePage: 'test' }); //prueba

    const validRecords = [];
    const errorRecords = [];
    const processedUrls = new Set();
    const failPages = new Set();
    for (const book of allBookLinks) {
        if (processedUrls.has(book.url)) {
            continue;
        }
        processedUrls.add(book.url);

        const record = await extractRecord(book.url, book.sourcePage);
        const validationResult = bookSchema.safeParse(record);
        if (record) {
            if (validationResult.success) {
                // Si es válido, lo guardamos en la lista buena
                validRecords.push(validationResult.data);
            } else {
                // Si falla, guardamos el registro y el motivo del error
                errorRecords.push({
                    url: book.url,
                    record: record,
                    reason: validationResult.error.errors
                });
            }
        } else {
            failPages.add({
                url: book.url,
                reason: 'fetch failed after retry'
            });
        }
    }

    await fsPromises.mkdir('./output', { recursive: true });
    await fsPromises.writeFile('./output/books.json', JSON.stringify(validRecords, null, 2))

    if (errorRecords.length > 0) {
        await fsPromises.writeFile('./output/errors.json', JSON.stringify(errorRecords, null, 2));
    } else {
        if (fs.existsSync('./output/errors.json')) {
            await fsPromises.unlink('./output/errors.json');
        }
    }

    console.log(`Registros válidos procesados: ${validRecords.length}`);
    if (validRecords.length > 0) {
        console.log(`Ejemplo de precio limpio: ${validRecords[0].price_text} -> ${validRecords[0].price_gbp}`);
    }

    const endTime = new Date(); // AGREGAR justo antes de armar el report
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

    const report = {
        start_time: startTime.toISOString(),
        duration: parseFloat(durationSeconds),
        catalogue_pages: cataloguePagesCount,
        cache_hits: cacheHitCount,
        pages: fetchCount,
        valid_records: validRecords.length,
        invalid_records: errorRecords.length,
        fail_pages: failPages.size
    };

    await fsPromises.writeFile('./output/run-report.json', JSON.stringify(report, null, 2));
}

main();