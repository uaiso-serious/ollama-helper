const DB_NAME = 'OllamaHelperDB';
const DB_VERSION = 1;
const STORE_NAME = 'models';

const minSizeInput = document.getElementById('min-size');
const maxSizeInput = document.getElementById('max-size');
const resultsContainer = document.getElementById('results');
const statusMsg = document.getElementById('status-msg');

let db;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await loadCSVandPopulateDB();
        // Initial load: show all or filter by default inputs
        filterAndRender();
    } catch (e) {
        console.error(e);
        statusMsg.innerText = "Error initializing application: " + e.message;
    }
});

minSizeInput.addEventListener('input', debounce(filterAndRender, 300));
maxSizeInput.addEventListener('input', debounce(filterAndRender, 300));

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => reject("IndexedDB error: " + event.target.errorCode);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                objectStore.createIndex('size', 'size', { unique: false });
                objectStore.createIndex('model', 'model', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
    });
}

async function loadCSVandPopulateDB() {
    statusMsg.innerText = "Downloading and processing data...";
    const response = await fetch('models.csv');
    const text = await response.text();
    const models = parseCSV(text);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        // Clear existing data to ensure freshness from CSV
        const clearRequest = objectStore.clear();

        clearRequest.onsuccess = () => {
            models.forEach(model => {
                objectStore.add(model);
            });
        };

        transaction.oncomplete = () => {
            statusMsg.innerText = `Ready! ${models.length} variants loaded.`;
            resolve();
        };

        transaction.onerror = (event) => {
            reject("Transaction error: " + event.target.error);
        };
    });
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    // Header: model,name,size,context
    const models = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        if (cols.length < 4) continue;

        models.push({
            model: cols[0],
            name: cols[1],
            size: parseInt(cols[2], 10), // bytes
            context: parseInt(cols[3], 10)
        });
    }
    return models;
}

function filterAndRender() {
    const minValGB = parseFloat(minSizeInput.value);
    const maxValGB = parseFloat(maxSizeInput.value);

    // Default range if inputs are empty
    // IndexedDB keys are in bytes. 1 GB = 1024^3 bytes
    const lowerBound = !isNaN(minValGB) ? minValGB * (1024 ** 3) : 0;
    const upperBound = !isNaN(maxValGB) ? maxValGB * (1024 ** 3) : Number.MAX_SAFE_INTEGER;

    const range = IDBKeyRange.bound(lowerBound, upperBound);

    const results = [];

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const index = objectStore.index('size');

    const request = index.openCursor(range);

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            results.push(cursor.value);
            cursor.continue();
        } else {
            // All filtered results collected
            renderGroupedResults(results);
        }
    };
}

function renderGroupedResults(data) {
    resultsContainer.innerHTML = '';

    if (data.length === 0) {
        resultsContainer.innerHTML = '<p>No models found for this filter.</p>';
        return;
    }

    // Group by 'model' (family name)
    const grouped = data.reduce((acc, curr) => {
        if (!acc[curr.model]) acc[curr.model] = [];
        acc[curr.model].push(curr);
        return acc;
    }, {});

    // Sort model families alphabetically
    const sortedFamilies = Object.keys(grouped).sort();

    sortedFamilies.forEach(family => {
        const variants = grouped[family];
        // Sort variants by size descending within family
        variants.sort((a, b) => b.size - a.size);

        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = `${family} (${variants.length} variants)`;

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th><a href="https://ollama.com/library/${family}" target="_blank">${family}</a></th>
                    <th>Size</th>
                    <th>Context</th>
                </tr>
            </thead>
            <tbody>
                ${variants.map(v => `
                    <tr>
                        <td><a href="https://ollama.com/library/${v.name}" target="_blank">${v.name}</a></td>
                        <td>${formatBytes(v.size)}</td>
                        <td>${formatContext(v.context)}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        details.appendChild(summary);
        details.appendChild(table);
        resultsContainer.appendChild(details);
    });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatContext(ctx) {
    return (ctx / 1000).toLocaleString() + 'K';
}
