
const { Pool } = require('pg');

const client = new Pool({
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false }        
});

client.connect()
  .then(() => console.log('Postgres DB connected!'))
  .catch(err => console.error('Postgres connection error', err));

module.exports = client;
