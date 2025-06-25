/**
 * Build-time script to auto-generate demo index page
 */

import * as fs from "fs";
import * as path from "path";

interface DemoInfo {
  name: string;
  title: string;
  description?: string;
  fileName: string;
}

async function generateIndex() {
  const demoDir = path.join(__dirname);
  const files = await fs.promises.readdir(demoDir);

  // Find all .demo.ts files
  const demoFiles = files.filter((file) => file.endsWith(".demo.ts"));

  const demos: DemoInfo[] = [];

  for (const file of demoFiles) {
    const componentName = file.replace(".demo.ts", "");
    const filePath = path.join(demoDir, file);

    try {
      // Read the file content to extract title and description
      const content = await fs.promises.readFile(filePath, "utf-8");

      // Extract title from the demo module
      const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
      const descriptionMatch = content.match(/description:\s*['"]([^'"]+)['"]/);

      demos.push({
        name: componentName,
        title: titleMatch ? titleMatch[1] : formatComponentName(componentName),
        description: descriptionMatch ? descriptionMatch[1] : undefined,
        fileName: file,
      });
    } catch (error) {
      console.warn(`Failed to process demo file ${file}:`, error);
    }
  }

  // Sort demos alphabetically
  demos.sort((a, b) => a.title.localeCompare(b.title));

  // Generate HTML index
  const html = generateIndexHTML(demos);

  // Write the generated index
  const indexPath = path.join(demoDir, "index-generated.html");
  await fs.promises.writeFile(indexPath, html, "utf-8");

  console.log(`Generated demo index with ${demos.length} components`);
  console.log("Available demos:", demos.map((d) => d.name).join(", "));
}

function formatComponentName(name: string): string {
  return name
    .replace(/^sketch-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function generateIndexHTML(demos: DemoInfo[]): string {
  const demoLinks = demos
    .map((demo) => {
      const href = `demo-runner.html#${demo.name}`;
      const description = demo.description ? ` - ${demo.description}` : "";

      return `      <li>
        <a href="${href}">
          <strong>${demo.title}</strong>${description}
        </a>
      </li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sketch Web Components - Demo Index</title>
    <link rel="stylesheet" href="demo.css" />
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 800px;
        margin: 40px auto;
        padding: 20px;
        line-height: 1.6;
      }
      
      h1 {
        color: #24292f;
        border-bottom: 1px solid #d1d9e0;
        padding-bottom: 10px;
      }
      
      .demo-list {
        list-style: none;
        padding: 0;
      }
      
      .demo-list li {
        margin: 15px 0;
        padding: 15px;
        border: 1px solid #d1d9e0;
        border-radius: 6px;
        background: #f6f8fa;
        transition: background-color 0.2s;
      }
      
      .demo-list li:hover {
        background: #ffffff;
      }
      
      .demo-list a {
        text-decoration: none;
        color: #0969da;
        display: block;
      }
      
      .demo-list a:hover {
        text-decoration: underline;
      }
      
      .demo-list strong {
        font-size: 16px;
        display: block;
        margin-bottom: 5px;
      }
      
      .stats {
        background: #fff8dc;
        padding: 15px;
        border-radius: 6px;
        margin: 20px 0;
        border-left: 4px solid #f9c23c;
      }
      
      .runner-link {
        display: inline-block;
        padding: 10px 20px;
        background: #0969da;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        margin-top: 20px;
      }
      
      .runner-link:hover {
        background: #0860ca;
      }
    </style>
  </head>
  <body>
    <h1>Sketch Web Components Demo Index</h1>
    
    <div class="stats">
      <strong>Auto-generated index</strong><br>
      Found ${demos.length} demo component${demos.length === 1 ? "" : "s"} • Last updated: ${new Date().toLocaleString()}
    </div>
    
    <p>
      This page provides an overview of all available component demos.
      Click on any component below to view its interactive demo.
    </p>
    
    <a href="demo-runner.html" class="runner-link">🚀 Launch Demo Runner</a>
    
    <h2>Available Component Demos</h2>
    
    <ul class="demo-list">
${demoLinks}
    </ul>
    
    <hr style="margin: 40px 0; border: none; border-top: 1px solid #d1d9e0;">
    
    <p>
      <em>This index is automatically generated from available <code>*.demo.ts</code> files.</em><br>
      To add a new demo, create a <code>component-name.demo.ts</code> file in this directory.
    </p>
  </body>
</html>
`;
}

// Run the generator if this script is executed directly
if (require.main === module) {
  generateIndex().catch(console.error);
}

export { generateIndex };
