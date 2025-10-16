// Helper function to parse data URLs
function parseDataUrl(url) {
  if (!url.startsWith('data:')) {
    throw new Error('Invalid data URL');
  }
  
  const commaIndex = url.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Invalid data URL format');
  }
  
  const header = url.substring(5, commaIndex);
  const payload = url.substring(commaIndex + 1);
  
  const parts = header.split(';');
  const mime = parts[0] || 'text/plain';
  const isBase64 = parts.includes('base64');
  
  return { mime, isBase64, payload };
}

// Helper function to decode base64 to text
function decodeBase64ToText(b64) {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    throw new Error('Failed to decode base64 data');
  }
}

// Helper function to parse CSV text
function parseCsv(text) {
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split into lines
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  
  // Detect delimiter
  const delimiters = [',', ';', '\t'];
  let delimiter = ',';
  let maxCount = 0;
  
  for (const delim of delimiters) {
    const count = (lines[0].match(new RegExp(delim, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      delimiter = delim;
    }
  }
  
  // Parse lines
  const rows = lines.map(line => {
    // Simple CSV parsing (doesn't handle all edge cases)
    return line.split(delimiter).map(field => {
      // Remove quotes if present
      if (field.startsWith('"') && field.endsWith('"')) {
        return field.substring(1, field.length - 1).replace(/""/g, '"');
      }
      return field;
    });
  });
  
  // Infer headers
  const firstRow = rows[0];
  const hasHeader = firstRow.every(cell => isNaN(parseFloat(cell)));
  
  if (hasHeader) {
    const headers = rows.shift();
    return { headers, rows };
  } else {
    return { rows };
  }
}

// Main application logic
async function init() {
  const totalSalesElement = document.getElementById('total-sales');
  
  try {
    // Get the CSV attachment URL
    const attachments = [
      {
        "name": "data.csv",
        "url": "data:text/csv;base64,UHJvZHVjdHMsU2FsZXMKUGhvbmVzLDEwMDAKQm9va3MsMTIzLjQ1Ck5vdGVib29rcywxMTEuMTEK"
      }
    ];
    
    const csvAttachment = attachments.find(att => att.name === 'data.csv');
    
    if (!csvAttachment) {
      throw new Error('CSV attachment not found');
    }
    
    const url = csvAttachment.url;
    
    // Process the data based on URL type
    let csvText;
    
    if (url.startsWith('data:')) {
      const { mime, isBase64, payload } = parseDataUrl(url);
      
      if (!mime.includes('csv') && !mime.includes('text')) {
        throw new Error('Invalid MIME type for CSV data');
      }
      
      if (isBase64) {
        csvText = decodeBase64ToText(payload);
      } else {
        csvText = decodeURIComponent(payload);
      }
    } else {
      // Handle HTTP URLs
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
      }
      csvText = await response.text();
    }
    
    // Parse CSV data
    const { headers, rows } = parseCsv(csvText);
    
    // Find sales column
    let salesColumnIndex = -1;
    
    if (headers) {
      salesColumnIndex = headers.findIndex(header => 
        header.toLowerCase().includes('sales') || header.toLowerCase().includes('sale')
      );
    }
    
    // If we couldn't find by header name, try to infer
    if (salesColumnIndex === -1) {
      // Try to find a numeric column
      if (rows.length > 0) {
        for (let i = 0; i < rows[0].length; i++) {
          if (rows.every(row => !isNaN(parseFloat(row[i])))) {
            salesColumnIndex = i;
            break;
          }
        }
      }
    }
    
    if (salesColumnIndex === -1) {
      throw new Error('Could not identify sales column');
    }
    
    // Calculate total sales
    let totalSales = 0;
    for (const row of rows) {
      const value = parseFloat(row[salesColumnIndex]);
      if (!isNaN(value)) {
        totalSales += value;
      }
    }
    
    // Display result
    totalSalesElement.textContent = totalSales.toFixed(2);
    totalSalesElement.classList.remove('loading', 'error');
    totalSalesElement.classList.add('success');
    
  } catch (error) {
    console.error('Error processing sales data:', error);
    totalSalesElement.textContent = 'Error loading data';
    totalSalesElement.classList.remove('loading', 'success');
    totalSalesElement.classList.add('error');
  }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}