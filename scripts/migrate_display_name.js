const fs = require('fs');
const readline = require('readline');
const mysql = require('mysql2/promise');
const path = require('path');

// Configuration
const dbConfig = {
    host: 'localhost',
    user: 'zrismpsz_cny',
    password: 'zrismpsz_cny',
    database: 'zrismpsz_cny',
    multipleStatements: true
};

const backupFilePath = path.join(__dirname, '../../zrismpsz_cny (4).sql');

async function migrate() {
    console.log('Starting migration (Node.js)...');
    console.log(`Backup file: ${backupFilePath}`);

    if (!fs.existsSync(backupFilePath)) {
        console.error('Error: Backup file not found!');
        process.exit(1);
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        // 1. Create Temporary Table
        console.log("Creating temporary table 'users_import_temp'...");
        await connection.query("DROP TABLE IF EXISTS users_import_temp");
        await connection.query(`
            CREATE TABLE users_import_temp (
                line_user_id VARCHAR(50) NOT NULL PRIMARY KEY,
                display_name VARCHAR(255) DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 2. Process File
        console.log("Reading SQL file and importing data...");

        const fileStream = fs.createReadStream(backupFilePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let count = 0;
        const batchSize = 1000;
        let batchParams = [];
        let batchQuery = "INSERT IGNORE INTO users_import_temp (line_user_id, display_name) VALUES ";

        for await (const line of rl) {
            if (line.includes("INSERT INTO `users`")) {
                const valuesPart = line.substring(line.indexOf("VALUES") + 6).trim().replace(/;$/, '');

                // Matches (...) groups
                // This regex handles basic quoted strings but might fail on complex nested escaped quotes within content
                // Given the dump format is standard mysql dump, it usually escapes ' as \'
                const matches = valuesPart.match(/\((.*?)\)(?=,|$)/g);

                // If regex split fails, we might need a more robust parser or just rely on the specific format
                // The simple regex above is risky for content containing `),( ` inside strings.
                // Let's use a simpler heuristic for split if possible, or a proper CSV parser on the content.
                // Since this is a specific task, we will try to parse manually.

                // Better approach: regex capture based on known column positions
                // users table schema has line_user_id at index 2 (3rd column) and display_name at index 3 (4th column)
                // VALUES (id, line_account_id, 'line_user_id', 'display_name', ...)

                // Let's parse the string iteratively
                let buffer = "";
                let inQuote = false;
                let rows = [];
                // remove leading ( and trailing ) of the whole block if needed, but here we have (row), (row)

                // We will use a regex designed for SQL values extraction if possible
                // OR since we are in Node, we can just split by `),(` carefully?
                // No, existing libraries are better but we can't assume them.

                // Fallback: Use the same regex logic as PHP script but in JS
                const rowMatches = valuesPart.match(/\((?:[^)(]+|'[^']*')+\)/g);

                if (rowMatches) {
                    for (const rowStr of rowMatches) {
                        // Remove outer parens
                        const inner = rowStr.slice(1, -1);

                        // Split by comma, respecting quotes
                        // A simple split won't work for 'text, with, comma'
                        // We need a small parser
                        const parts = [];
                        let current = '';
                        let inQ = false;
                        for (let i = 0; i < inner.length; i++) {
                            const char = inner[i];
                            if (char === "'" && (i === 0 || inner[i - 1] !== '\\')) {
                                inQ = !inQ;
                            }
                            if (char === ',' && !inQ) {
                                parts.push(current);
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        parts.push(current); // Last part

                        if (parts.length > 3) {
                            // Trim quotes
                            let lineUserId = parts[2].trim();
                            if (lineUserId.startsWith("'") && lineUserId.endsWith("'")) lineUserId = lineUserId.slice(1, -1);

                            let displayName = parts[3].trim();
                            if (displayName.startsWith("'") && displayName.endsWith("'")) displayName = displayName.slice(1, -1);

                            // Unescape SQL
                            lineUserId = lineUserId.replace(/\\'/g, "'");
                            displayName = displayName.replace(/\\'/g, "'");

                            if (lineUserId && displayName && displayName !== 'NULL') {
                                // Add to batch
                                await connection.execute(
                                    "INSERT IGNORE INTO users_import_temp (line_user_id, display_name) VALUES (?, ?)",
                                    [lineUserId, displayName]
                                );
                                count++;
                                if (count % 100 === 0) process.stdout.write(`Imported ${count} users...\r`);
                            }
                        }
                    }
                }
            }
        }

        console.log(`\nFinished importing ${count} users.`);

        // 3. Update Real Table
        console.log("Updating 'users' table...");
        const [updateResult] = await connection.query(`
            UPDATE users u
            INNER JOIN users_import_temp t ON u.line_user_id = t.line_user_id
            SET u.custom_display_name = t.display_name
            WHERE t.display_name IS NOT NULL AND t.display_name != ''
        `);

        console.log(`Update completed. Changed rows: ${updateResult.changedRows}`);

        // 4. Cleanup
        await connection.query("DROP TABLE users_import_temp");
        console.log("Temporary table dropped.");
        console.log("Migration Successful!");

    } catch (err) {
        console.error("Migration Error:", err);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
