const fs = require('fs-extra');
const marked = require('marked');
const path = require('path');

/**
 * Parse a Markdown file and extract its content, title, tags, and HTML representation.
 * @param {string} filePath - Path to the Markdown file.
 * @returns {Promise<Object>} - Parsed content including title, body, tags, and HTML content.
 */
async function parseMarkdownFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const htmlContent = marked.parse(content);

    const fileName = path.basename(filePath, '.md'); // Extract file name without .md extension
    let title = null;
    let body = content;
    let tags = [];

    const lines = content.split('\n');
    if (lines[0].startsWith('# ')) {
      title = lines[0].slice(2).trim(); // Use the first line as the title if it's a Markdown header
      body = lines.slice(1).join('\n');
    }

    // If no title is defined in the file, use the file name
    if (!title) {
      title = fileName;
    }

    // Extract tags from lines starting with '- ' or inline hashtags
    for (const line of lines) {
      if (line.startsWith('- ')) {
        tags.push(...line.slice(2).split('-').map(tag => tag.trim()));
      }
    }

    // Include inline tags starting with '#'
    const inlineTags = [...content.matchAll(/#(\w+)/g)].map(match => match[1]);
    tags.push(...inlineTags);

    // Ensure tags are unique and normalized
    tags = Array.from(new Set(tags.map(tag => tag.trim())));

    return { title, body, tags, htmlContent };
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    throw err;
  }
}

/**
 * Generate a JSON file containing facts from Markdown files in a directory.
 * @param {string} markdownDir - Directory containing Markdown files.
 * @param {string} outputFile - Path to the output JSON file.
 */
async function generateFactsJSON(markdownDir, outputFile) {
  try {
    const files = await fs.readdir(markdownDir);
    const facts = [];

    for (const file of files) {
      if (path.extname(file) === '.md') {
        const filePath = path.join(markdownDir, file);
        const fact = await parseMarkdownFile(filePath);

        // Exclude files tagged as #UNFINISHED
        if (!fact.tags.includes('UNFINISHED')) {
          facts.push(fact);
        }
      }
    }

    await fs.writeFile(outputFile, JSON.stringify(facts, null, 2));
    console.log(`Facts JSON generated at ${outputFile}`);
  } catch (err) {
    console.error(`Error generating facts JSON:`, err);
  }
}

/**
 * Generate a JSON file containing rules for json-logic-js based on Markdown files in a directory.
 * @param {string} markdownDir - Directory containing Markdown files.
 * @param {string} outputFile - Path to the output JSON file.
 */
async function generateRulesJSON(markdownDir, outputFile) {
  try {
    const files = await fs.readdir(markdownDir);
    const rules = new Set(); // Use a set to prevent duplicate rules

    for (const file of files) {
      if (path.extname(file) === '.md') {
        const filePath = path.join(markdownDir, file);
        const fact = await parseMarkdownFile(filePath);

        // Exclude files tagged as #UNFINISHED
        if (!fact.tags.includes('UNFINISHED')) {
          // Create rules for json-logic-js based on tags
          fact.tags.forEach(tag => {
            const ruleKey = JSON.stringify({
              conditions: { "in": [tag, { var: "tags" }] },
              event: {
                type: "tagMatch",
                params: {
                  message: `Matched tag: ${tag}`,
                  title: fact.title,
                  body: fact.body
                }
              }
            });

            if (!rules.has(ruleKey)) {
              rules.add(ruleKey);
            }
          });

          // Create rules for json-logic-js based on body content
          const bodyRuleKey = JSON.stringify({
            conditions: { "==": [{ var: "body" }, fact.body] },
            event: {
              type: "bodyMatch",
              params: {
                message: `Matched body content`,
                title: fact.title,
                body: fact.body
              }
            }
          });

          if (!rules.has(bodyRuleKey)) {
            rules.add(bodyRuleKey);
          }
        }
      }
    }

    // Write unique rules to output file
    await fs.writeFile(outputFile, JSON.stringify([...rules].map(rule => JSON.parse(rule)), null, 2));
    console.log(`Rules JSON generated at ${outputFile}`);
  } catch (err) {
    console.error(`Error generating rules JSON:`, err);
  }
}

// Configuration
const markdownDir = './markdown';
const factsOutputFile = './facts.json';
const rulesOutputFile = './rules.json';

// Main script execution
(async () => {
  try {
    await generateFactsJSON(markdownDir, factsOutputFile);
    await generateRulesJSON(markdownDir, rulesOutputFile);
  } catch (err) {
    console.error('Error in script execution:', err);
  }
})();
