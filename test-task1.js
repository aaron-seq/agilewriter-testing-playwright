const http = require('http');

http.get('http://localhost:3000/list-tests', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const tests = JSON.parse(data);
      let failed = false;

      if (tests.includes('accuracy.spec.ts')) {
        console.error('FAIL: accuracy.spec.ts is present');
        failed = true;
      }
      if (tests.some(t => t.startsWith('AW_11_to_20'))) {
        console.error('FAIL: AW_11_to_20 variants are present');
        failed = true;
      }
      
      const required = [
        'AW_00_10_consolidated_flow.spec.ts',
        'health_CSR.spec.ts',
        'health_Ideaya.spec.ts',
        'health_M264.spec.ts',
        'health_ICF_full.spec.ts',
        'health_ICF_trimmed.spec.ts'
      ];
      
      for (const req of required) {
        if (!tests.includes(req)) {
          console.error(`FAIL: ${req} is missing`);
          failed = true;
        }
      }

      if (failed) process.exit(1);
      console.log('PASS: list-tests returns correct filtered array');
    } catch (e) {
      console.error('Error parsing JSON:', e);
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
  process.exit(1);
});
