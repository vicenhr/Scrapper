const fs = require('fs');
const fsPromises = require('fs').promises;
const cheerio = require('cheerio');
const ms = 5000; // 5 seconds
const baseUrl = 'https://books.toscrape.com/catalogue/page-';

const allBookLinks = new Array(); // NUEVO: acumulador compartido entre todas las llamadas

function sleep(delayMs) { // NUEVO: función de espera
    return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function asyncCall(page) {
    const fileName = `cache/catalogue-page-${page}.html`;
    let wasFetch = false; // NUEVO: para saber si hacemos sleep o no
    try {
        if (fs.existsSync(fileName)) {
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
                console.log(`FETCH page ${page} (size: ${html.length} bytes)`);
                wasFetch = true; // NUEVO
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
        console.log(`catalogue_pages=${page}, discovered=${allBookLinks.length}, unique_urls=${new Set(allBookLinks.map(link => link.url)).size}`);
    }
}

async function extractRecord(bookUrl, sourcePage) {
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
        console.error(`Error fetching ${bookUrl}: ${err.message}`);
        return null;
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
        availability_text: availabilityText,
        rating_text: ratingText,
        description: description,
        source_page: sourcePage,
        fetched_at: new Date().toISOString(),
    };

    return record; // CAMBIO 5: ahora sí regresa el objeto, no solo lo imprime
}

async function main() {
    // Recopilar los enlances de todas las N paginas
    await asyncCall(1);
    
    // Guardar la información de todos los libros
    const allRecords = [];
    for(const book of allBookLinks){
        const record = await extractRecord(book.url, book.sourcePage);
        if(record){
            allRecords.push(record);
        }
    }

    // Mostrar un registro
    if (allRecords.length > 0) {
        console.log("Muestra de un registro en bruto:");
        console.log(allRecords[0]); 
    }

    // Imprimir el resumen final
    console.log(`detail_pages=${allRecords.length}`);
}

main();