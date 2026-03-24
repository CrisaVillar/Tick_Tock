const { Pool } = require('pg');

const pool = new Pool({
  user: 'tick_tock1_user',                
  host: 'dpg-d70jv0vgi27c73fjvutg-a.oregon-postgres.render.com',
  database: 'tick_tock1',      
  password: 'nOIbhJL0aHPohahg43swCU12L6JT2nbo',                  
  port: 5432                    
});

module.exports = pool;
