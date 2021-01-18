const { resolve } = require("path");
const { readFileSync, writeFileSync } = require("fs");
const { promisify } = require("util");

const chalk = require("chalk");
const cheerio = require("cheerio");
const mapKeys = require("lodash/mapKeys");
const request = require("request");
const postAsync = promisify(request.post);

const loadSpecs = () => {
  const specsPath = resolve(__dirname, "specs.txt");
  return readFileSync(specsPath)
    .toString()
    .replace(/\r\n/g, "\n")
    .trim()
    .split("\n")
    .map((spec) => spec.trim());
};

const extractBySpec = async (spec) => {
  const response = await postAsync({
    url:
      "http://crors.org.br/wp-content/themes/crors/controler/post-servicos-busca-por-especialidade.php",
    headers: {
      "Content-Type": "multipart/form-data",
    },
    formData: {
      txtAcao: "busca1",
      frmBusca1txtEspecialidades: spec,
    },
  });

  return response.body;
};

const parseRow = (row) => {
  const splitted = row.split("\n");

  // CRO and name
  const firstLine = splitted[0].split(" - ");
  const cro = parseInt(firstLine[1]);
  const name = firstLine[2];

  // UF and City
  const lastLine = splitted[splitted.length - 1];
  const [state, ...city] = lastLine.split(":")[1].trim().split(" ");

  // Specs
  const specs = [];
  for (let idx = 1; idx < splitted.filter(Boolean).length - 1; idx++) {
    const element = splitted[idx];
    const parts = element.split(":");

    if (parts.length > 1) {
      const spec = parts[1].trim();
      if (spec) {
        specs.push(spec);
      }
    }
  }

  return { cro, name, state, city: city.join(" "), specs };
};

const extractRows = (data) => {
  const $ = cheerio.load(data);
  const rows = $("table tbody tr td")
    .toArray()
    .map((row) => $(row).text().trim());

  return rows.map(parseRow);
};

const storeResults = (results) => {
  const resultsContent = JSON.stringify(results);
  const resultsPath = resolve(__dirname, "results.json");
  writeFileSync(resultsPath, resultsContent, "utf8");
};

async function execute() {
  const specs = loadSpecs();
  const results = [];

  for (const spec of specs) {
    console.log(`Extracting ${chalk.green(spec)}`);
    const extraction = await extractBySpec(spec);
    const extractedRows = extractRows(extraction);
    results.push(...extractedRows);
  }

  const filteredValues = Object.values(mapKeys(results, "cro"));
  storeResults(filteredValues);
}

execute();
