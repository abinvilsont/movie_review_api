import fs from "fs";
import csv from "csv-parser";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const file = "movies.csv";

async function main() {
  if (!fs.existsSync(file)) {
    console.error("movies.csv not found");
    return;
  }

  const rows: any[] = [];
  fs.createReadStream(file)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      for (const r of rows) {
        try {
          await prisma.movie.create({
            data: {
              title: r.Title,
              year: parseInt(r.Year) || null,
              genres: r.Genre,
            },
          });
        } catch (e) {
          console.log(`Skipping duplicate: ${r.Title}`);
        }
      }
      console.log("Sample data loaded.");
    });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
