import AdmZip from "adm-zip";
import fs from "fs";

fs.writeFileSync("backup_file_123.sqlite", "BACKUP CONTENT");
const zip = new AdmZip();
zip.addLocalFile("backup_file_123.sqlite", "", "dsdst_panel.db");
zip.writeZip("test-backup.zip");

fs.writeFileSync("dsdst_panel.db", "OLD CONTENT");
const zipRead = new AdmZip("test-backup.zip");
zipRead.extractAllTo(".", true);

console.log("Restored:", fs.readFileSync("dsdst_panel.db", "utf-8"));
console.log("Backup file exists:", fs.existsSync("backup_file_123.sqlite"));
