const fs = require('fs');
const readline = require('readline');

const filePath = 'c:\\Users\\Administrator\\Downloads\\v1 (4)\\cny - Copy\\zrismpsz_cny (4).sql';
const searchTerm = 'CREATE TABLE `users`';

const stream = fs.createReadStream(filePath);
const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
});

let lineNum = 0;
rl.on('line', (line) => {
    lineNum++;
    if (line.includes(searchTerm)) {
        console.log(`Found "${searchTerm}" at line ${lineNum}`);
        process.exit(0);
    }
});
