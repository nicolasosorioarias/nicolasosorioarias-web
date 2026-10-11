// Lists every [PENDING] marker left in the site copy.
import { readFile } from 'node:fs/promises';

const files = ['src/content/en.json', 'src/content/es.json'];
let total = 0;
for (const file of files) {
  const lines = (await readFile(file, 'utf8')).split('\n');
  lines.forEach((line, index) => {
    const matches = line.match(/\[PENDING[^\]]*\]/g);
    if (matches) {
      total += matches.length;
      console.log(`${file}:${index + 1}  ${matches.join(' ')}`);
    }
  });
}
console.log(total ? `\n${total} pending item(s).` : 'No pending items.');
