const fs = require('fs');
const fsPromises = require('fs').promises;
const url = 'https://books.toscrape.com/';
const ms = 5000; // 5 seconds
async function asyncCall() {
    try {
        if (fs.existsSync('cache/catalogue-page-1.html')) {
            const data = await fs.promises.readFile('cache/catalogue-page-1.html', 'utf8');
            console.log('CACHE HIT (size: ' + data.length + ' bytes)');
        } else {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(ms),
                headers: {
                    'User-Agent': 'FlyRankInternshipA9/1.0 (https://github.com/vicenhr/Scrapper.git)',
                }
            });
            if (response.ok) {
                await fsPromises.mkdir('./cache', { recursive: true });
                const html = await response.text();
                await fsPromises.writeFile('cache/catalogue-page-1.html', html)
                console.log('File saved successfully!');
                console.log('FETCH (size: ' + html.length + ' bytes)');
            } else {
                console.error(`HTTP error! status: ${response.status}`);
            }
        }
    } catch (err) {
        if (err.name === "TimeoutError") {
            // This exception is from the abort signal
            console.error("Timeout: It took more than 5 seconds to get the result!");
        } else if (err.name === "AbortError") {
            // This exception is from the fetch itself
            console.error(
                "Fetch aborted by user action (browser stop button, closing tab, etc.",
            );
        } else if (err.name === "TypeError") {
            console.error("AbortSignal.timeout() method is not supported");
        } else {
            // A network error, or some other problem.
            console.error(`Error: type: ${err.name}, message: ${err.message}`);
        }
    }
}
asyncCall();