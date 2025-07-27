// Test GCP imports to understand the correct usage
import Compute from '@google-cloud/compute';
import { Storage } from '@google-cloud/storage';

console.log('Compute:', typeof Compute);
console.log('Compute keys:', Object.keys(Compute));
console.log('Storage:', typeof Storage);

// Try to create instances
try {
    const compute = new Compute.Compute();
    console.log('Compute.Compute works');
} catch (e) {
    console.log('Compute.Compute failed:', e.message);
}

try {
    const compute = new Compute();
    console.log('Compute() works');
} catch (e) {
    console.log('Compute() failed:', e.message);
}