require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { ensureDataLayer } = require('./.next/server/app/api/v1/admin/data-layer/setup/route.js'); // Not easy due to compilation. Let's just run import script instead to see if it doesn't break.
