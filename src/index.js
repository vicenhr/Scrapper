const fs = require('fs');
const fsPromises = require('fs').promises;
const cheerio = require('cheerio');
const ms = 5000; // 5 seconds
const baseUrl = 'https://books.toscrape.com/catalogue/page-';

const allBookLinks = new Set(); // NUEVO: acumulador compartido entre todas las llamadas

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
        allBookLinks.add(new URL(link, pageUrl).href); // CAMBIO: se agrega al Set compartido, no a un array local
    });

    // Verificar si hay boton next
    const nextHref = $('li.next a').attr('href');
    if (nextHref && page < 3) { // CAMBIO: además de que exista "next", checa que no hayamos llegado al límite de 3
        await asyncCall(page + 1);
    } else {
        console.log(`catalogue_pages=${page}, discovered=${allBookLinks.size}, unique_urls=${allBookLinks.size}`);
    }
}

asyncCall(1);