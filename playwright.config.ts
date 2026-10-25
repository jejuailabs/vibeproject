import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testIgnore:'**/vote-latency.spec.ts',fullyParallel:false,workers:1,timeout:30000,
 use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:3000',channel:process.platform==='win32'?'msedge':undefined,headless:true,viewport:{width:1440,height:1000},trace:'retain-on-failure'},
 reporter:'list',outputDir:'work/browser-tests',
});
