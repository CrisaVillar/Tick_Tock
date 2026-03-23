const { Pool } = require('pg');

const pool = new Pool({
  user: 'tick_tock1_user',                
  host: 'tick-tock-db.onrender.com',
  database: 'tick_tock1',      
  password: 'nOIbhJL0aHPohahg43swCU12L6JT2nbo',                  
  port: 5432                    
});

module.exports = pool;
