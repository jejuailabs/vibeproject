import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('Firebase server modules load when require(ESM) is disabled',()=>{
 execFileSync(process.execPath,['--no-experimental-require-module','-e',"require('firebase-admin/auth'); require('firebase-admin/firestore');"],{stdio:'pipe'});
});
