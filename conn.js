const { Pool } = require('pg');

const pool = new Pool({
  user: 'CrisaVillar',                
  host: 'tick-tock-db.onrender.com',
  database: 'tick_tock1',      
  password: '',                  
  port: 5432                    
});

module.exports = pool;
