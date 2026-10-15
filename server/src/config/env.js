import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Compute directory of this file in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly resolve server/.env relative to this file
// Ensures server/.env is loaded consistently whether launched from server/, project root, or anywhere else
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

export default process.env;
