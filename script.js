document.addEventListener('DOMContentLoaded', () => {
    const minSizeInput = document.getElementById('min-size');
    const maxSizeInput = document.getElementById('max-size');
    const filterBtn = document.getElementById('filter-btn');
    const tableBody = document.querySelector('#models-table tbody');

    let allModels = [];

    // Fetch and parse CSV
    fetch('models.csv')
        .then(response => response.text())
        .then(csvText => {
            allModels = parseCSV(csvText);
            renderTable(allModels);
        })
        .catch(error => console.error('Error fetching CSV:', error));

    // Filter button event
    filterBtn.addEventListener('click', () => {
        filterAndRender();
    });

    // Also filter on Enter key in inputs
    minSizeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') filterAndRender();
    });
    maxSizeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') filterAndRender();
    });

    function parseCSV(text) {
        const lines = text.trim().split('\n');
        // Assume first line is header: model,name,size,context
        // We start from line 1
        const models = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.split(',');
            // Map columns: 0: model, 1: name, 2: size, 3: context
            // Note: Handle potential empty columns or extra commas
            if (cols.length < 4) continue;

            const model = {
                model: cols[0],
                name: cols[1],
                size: parseInt(cols[2], 10),
                context: parseInt(cols[3], 10)
            };
            
            if (!isNaN(model.size)) {
                models.push(model);
            }
        }

        // Sort by size descending by default
        models.sort((a, b) => b.size - a.size);

        return models;
    }

    function renderTable(models) {
        tableBody.innerHTML = '';
        models.forEach(model => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><a href="https://ollama.com/library/${model.model}" target="_blank">${model.model}</a></td>
                <td><a href="https://ollama.com/library/${model.name}" target="_blank">${model.name}</a></td>
                <td>${(model.size / (1024 ** 3)).toLocaleString()}</td>
                <td>${(model.context / 1000).toLocaleString()}K</td>
            `;
            tableBody.appendChild(row);
        });
    }

    function filterAndRender() {
        const minValGB = parseFloat(minSizeInput.value);
        const maxValGB = parseFloat(maxSizeInput.value);
        const bytesPerGB = 1024 ** 3;

        const filtered = allModels.filter(model => {
            let pass = true;
            // Convert model size to GB for comparison, or input to bytes. 
            // Comparing in bytes is safer for precision, but inputs are float GB.
            // Let's compare in GB to match the UI logic directly.
            const sizeGB = model.size / bytesPerGB;

            if (!isNaN(minValGB) && sizeGB < minValGB) pass = false;
            if (!isNaN(maxValGB) && sizeGB > maxValGB) pass = false;
            return pass;
        });

        renderTable(filtered);
    }
});
