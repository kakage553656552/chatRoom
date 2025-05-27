require('dotenv').config();
const { Pool } = require('pg');

// 数据库连接配置
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chatroom',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: false
});

async function queryAllTables() {
  try {
    console.log('=== 数据库连接信息 ===');
    console.log(`数据库: ${process.env.DB_NAME || 'chatroom'}`);
    console.log(`主机: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`端口: ${process.env.DB_PORT || 5432}`);
    console.log(`用户: ${process.env.DB_USER || 'postgres'}`);
    console.log('');

    // 1. 查看当前连接的数据库和模式
    console.log('=== 当前连接信息 ===');
    const currentDb = await pool.query('SELECT current_database()');
    console.log('当前数据库:', currentDb.rows[0].current_database);
    
    const currentSchema = await pool.query('SELECT current_schema()');
    console.log('当前模式:', currentSchema.rows[0].current_schema);
    console.log('');

    // 2. 查看所有可用的模式
    console.log('=== 所有模式 ===');
    const schemas = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name
    `);
    console.log('可用模式:');
    schemas.rows.forEach(row => {
      console.log(`  - ${row.schema_name}`);
    });
    console.log('');

    // 3. 查看所有模式中的表
    console.log('=== 所有模式中的表 ===');
    const allTables = await pool.query(`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `);
    
    if (allTables.rows.length === 0) {
      console.log('❌ 没有找到任何用户表');
    } else {
      console.log(`找到 ${allTables.rows.length} 个表:`);
      allTables.rows.forEach(row => {
        console.log(`  📋 ${row.table_schema}.${row.table_name} (${row.table_type})`);
      });
    }
    console.log('');

    // 4. 专门查看public模式中的表
    console.log('=== public模式中的表 ===');
    const publicTables = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    if (publicTables.rows.length === 0) {
      console.log('❌ public模式中没有找到任何表');
    } else {
      console.log(`public模式中有 ${publicTables.rows.length} 个表:`);
      publicTables.rows.forEach(row => {
        console.log(`  📋 ${row.table_name}`);
      });
    }
    console.log('');

    // 5. 查看表的详细信息（如果有表的话）
    if (publicTables.rows.length > 0) {
      console.log('=== 表结构详情 ===');
      for (const table of publicTables.rows) {
        console.log(`\n📋 表: ${table.table_name}`);
        const columns = await pool.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = $1
          ORDER BY ordinal_position
        `, [table.table_name]);
        
        console.log('  列信息:');
        columns.rows.forEach(col => {
          console.log(`    - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });

        // 查看表中的数据行数
        const count = await pool.query(`SELECT COUNT(*) FROM public.${table.table_name}`);
        console.log(`  数据行数: ${count.rows[0].count}`);
      }
    }

    // 6. 使用pg_tables系统表查询（备用方法）
    console.log('\n=== 使用pg_tables查询 ===');
    const pgTables = await pool.query(`
      SELECT schemaname, tablename, tableowner, hasindexes, hasrules, hastriggers
      FROM pg_tables 
      WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
      ORDER BY schemaname, tablename
    `);
    
    if (pgTables.rows.length === 0) {
      console.log('❌ pg_tables中没有找到任何用户表');
    } else {
      console.log(`pg_tables中找到 ${pgTables.rows.length} 个表:`);
      pgTables.rows.forEach(row => {
        console.log(`  📋 ${row.schemaname}.${row.tablename} (所有者: ${row.tableowner})`);
      });
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error('详细错误:', error);
  } finally {
    await pool.end();
    console.log('\n数据库连接已关闭');
  }
}

// 运行查询
queryAllTables(); 