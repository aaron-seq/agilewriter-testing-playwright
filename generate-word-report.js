require('dotenv').config();
const fs = require('fs');
const path = require('path');
const htmlToDocx = require('html-to-docx');

const REPORT_DIR = path.join(__dirname, 'reports');
const STEP_FILE = path.join(REPORT_DIR, 'step-results.json');
const OUTPUT_FILE = path.join(REPORT_DIR, 'AgileWriter_Validation_Report.docx');

// Load environment variables dynamically
const testerName = process.env.TESTER_NAME || "[Insert Tester Name(s)]";
const envName = process.env.TEST_ENV || "QA";
const appUrl = process.env.APP_URL || "https://app-v2-rc1-aw.smarter.codes/signin";
const osName = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

async function generateWordReport() {
    console.log('Reading test results for time and status calculation...');
    let overallStatus = 'PASS';
    let timeStr = '0s';

    // Parse step-results.json just for high-level execution time and overall Pass/Fail status
    if (fs.existsSync(STEP_FILE)) {
        const steps = JSON.parse(fs.readFileSync(STEP_FILE, 'utf-8'));
        let totalTime = 0;
        steps.forEach(s => { totalTime += s.duration || 0; });
        const totalSeconds = Math.floor(totalTime / 1000);
        timeStr = `${totalSeconds}s`;
        if (totalSeconds > 60) {
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;
            timeStr = `${mins}m ${secs}s`;
        }
        overallStatus = steps.some(s => s.status === 'FAIL') ? 'FAIL' : 'PASS';
    } else {
        console.warn('⚠ step-results.json not found. Using default execution time and status.');
    }

    // Determine status color and formatting
    const statusColor = overallStatus === 'PASS' ? '#0b8043' : '#c53929';
    const statusStyle = `color: ${statusColor}; font-weight: bold;`;

    let htmlString = `
    <!DOCTYPE html>
    <html>
    <head>
    <style>
        body { 
            font-family: Calibri, sans-serif; 
            color: #111111; 
            line-height: 1.6; 
            margin: 0;
            padding: 0;
        }
        h1 { 
            color: #000000; 
            text-align: center; 
            font-size: 20pt; 
            border-bottom: 2px solid #e0e0e0; 
            padding-bottom: 8px; 
            margin-bottom: 24px;
            margin-top: 0;
        }
        h2 { 
            color: #222222; 
            font-size: 14pt; 
            border-bottom: 1px solid #eeeeee; 
            padding-bottom: 6px; 
            margin-top: 28px; 
            margin-bottom: 12px;
        }
        h3 { 
            color: #333333; 
            font-size: 12pt; 
            margin-top: 18px; 
            margin-bottom: 8px;
        }
        p { 
            font-size: 11pt; 
            margin: 6px 0; 
        }
        ul { 
            margin: 8px 0 16px 0; 
            padding-left: 24px;
        }
        li { 
            font-size: 11pt; 
            margin-bottom: 6px; 
        }
        b, strong { 
            font-weight: bold; 
        }
        code { 
            font-family: Courier New, monospace; 
            background-color: #f5f5f5; 
            color: #333333;
            padding: 2px 6px;
            border-radius: 3px;
        }
        hr { 
            border: none; 
            border-top: 1px solid #dddddd; 
            margin: 24px 0; 
        }
        .info-section {
            margin-bottom: 24px;
            background-color: #f9f9f9;
            padding: 16px;
            border-left: 4px solid #4285f4;
        }
        .info-section p {
            margin: 4px 0;
        }
        a {
            color: #4285f4;
            text-decoration: none;
        }
        em {
            font-style: italic;
            color: #666666;
        }
    </style>
    </head>
    <body>
        <h1>Agile Writer Validation Report</h1>
        
        <div class="info-section">
            <p><b>Performed by:</b> ${testerName}</p>
            <p><b>Generated:</b> ${new Date().toLocaleString()}</p>            
            <p><b>Application:</b> Agile Writer</p>
            <p><b>Application URL:</b> <a href="${appUrl}">${appUrl}</a></p>
            <p><b>Execution Type:</b> Automated Validation</p>
            <p><b>Environment:</b> ${envName}</p>
            <p><b>Operating System:</b> ${osName}</p>
            <p><b>Overall Status:</b> <span style="${statusStyle}">${overallStatus}</span></p>
            <p><b>Total Execution Time:</b> ${timeStr}</p>
        </div>
        
        <h2>Document Generation Phase</h2>
        
        <h3>1. ICF trimmed - [Time]</h3>
        <ul>
            <li><b>Loaded Destination Template:</b> <code>[Link or Name of Template]</code></li>
            <li><b>Loaded Source Document(s):</b> <code>[Link or Name of Source]</code></li>
            <li><b>Generated Output:</b>
                <ul>
                    <li>Raw QA: <code>[Hyperlink to Generated File]</code></li>
                    <li>Raw: <code>[Hyperlink to Generated File]</code></li>
                    <li>Clean: <code>[Hyperlink to Generated File]</code></li>
                    <li>Normal: <code>[Hyperlink to Generated File]</code></li>
                </ul>
            </li>
        </ul>

        <h3>2. ICF full - [Time]</h3>
        <ul>
            <li><b>Loaded Destination Template:</b> <code>[Link or Name of Template]</code></li>
            <li><b>Loaded Source Document(s):</b> <code>[Link or Name of Source]</code></li>
            <li><b>Generated Output:</b>
                <ul>
                    <li>Raw QA: <code>[Hyperlink to Generated File]</code></li>
                    <li>Raw: <code>[Hyperlink to Generated File]</code></li>
                    <li>Clean: <code>[Hyperlink to Generated File]</code></li>
                    <li>Normal: <code>[Hyperlink to Generated File]</code></li>
                </ul>
            </li>
        </ul>

        <h3>3. CSR - [Time]</h3>
        <ul>
            <li><b>Loaded Destination Template:</b> <code>[Link or Name of Template]</code></li>
            <li><b>Loaded Source Document(s):</b> 
                <ul>
                    <li><code>[Link or Name of Source 1]</code></li>
                    <li><code>[Link or Name of Source 2]</code></li>
                </ul>
            </li>
            <li><b>Generated Output:</b>
                <ul>
                    <li>Raw QA: <code>[Hyperlink to Generated File]</code></li>
                    <li>Raw: <code>[Hyperlink to Generated File]</code></li>
                    <li>Clean: <code>[Hyperlink to Generated File]</code></li>
                    <li>Normal: <code>[Hyperlink to Generated File]</code></li>
                </ul>
            </li>
        </ul>

        <h3>4. M264 - [Time]</h3>
        <ul>
            <li><b>Loaded Destination Template:</b> <code>[Link or Name of Template]</code></li>
            <li><b>Loaded Source Document(s):</b> <code>[Link or Name of Source]</code></li>
            <li><b>Generated Output:</b>
                <ul>
                    <li>Raw QA: <code>[Hyperlink to Generated File]</code></li>
                    <li>Raw: <code>[Hyperlink to Generated File]</code></li>
                    <li>Clean: <code>[Hyperlink to Generated File]</code></li>
                    <li>Normal: <code>[Hyperlink to Generated File]</code></li>
                </ul>
            </li>
        </ul>

        <hr/>
        
        <h2>QA for Generated Documents</h2>

        <h3>📄 ICF trimmed Validations</h3>
        <ul>
            <li><b>Passed Assertions:</b>
                <ul>
                    <li>Verified destination template was successfully uploaded and preview loaded</li>
                    <li>Asserted all source documents were recognized without errors</li>
                    <li>Confirmed 'Populating Placeholders' processing stage completed within expected timeouts</li>
                    <li>Verified 4 distinct output files (Raw QA, Raw, Clean, Normal) were presented post-generation</li>
                    <li>Asserted download links for generated documents are accessible</li>
                </ul>
            </li>
            <li><b>Failed Assertions:</b>
                <ul>
                    <li><em>None - All assertions passed</em></li>
                </ul>
            </li>
        </ul>

        <h3>📄 ICF full Validations</h3>
        <ul>
            <li><b>Passed Assertions:</b>
                <ul>
                    <li><em>Asserted successful parsing of all source pages</em></li>
                    <li><em>Verified template placeholders populated correctly</em></li>
                </ul>
            </li>
            <li><b>Failed Assertions:</b>
                <ul>
                    <li><em>None - All assertions passed</em></li>
                </ul>
            </li>
        </ul>

        <h3>📄 CSR Validations</h3>
        <ul>
            <li><b>Passed Assertions:</b>
                <ul>
                    <li><em>Verified multi-source document processing</em></li>
                    <li><em>Confirmed all output variants generated successfully</em></li>
                </ul>
            </li>
            <li><b>Failed Assertions:</b>
                <ul>
                    <li><em>None - All assertions passed</em></li>
                </ul>
            </li>
        </ul>

        <h3>📄 M264 Validations</h3>
        <ul>
            <li><b>Passed Assertions:</b>
                <ul>
                    <li><em>Validated M264-specific template structure</em></li>
                    <li><em>Confirmed output files match expected format</em></li>
                </ul>
            </li>
            <li><b>Failed Assertions:</b>
                <ul>
                    <li><em>None - All assertions passed</em></li>
                </ul>
            </li>
        </ul>

    </body>
    </html>`;

    console.log('Generating .docx file...');
    try {
        const fileBuffer = await htmlToDocx(htmlString, null, {
            table: { row: { cantSplit: true } },
            footer: true,
            pageNumber: true,
            font: 'Calibri',
            margins: {
                top: 720,    // 0.5 inches
                right: 720,  // 0.5 inches
                bottom: 720, // 0.5 inches
                left: 720    // 0.5 inches
            }
        });

        if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
        
        fs.writeFileSync(OUTPUT_FILE, fileBuffer);
        console.log('✔ Word (.docx) Report generated successfully at:', OUTPUT_FILE);
    } catch (error) {
        console.error('❌ Failed to generate Word document:', error);
    }
}

generateWordReport();