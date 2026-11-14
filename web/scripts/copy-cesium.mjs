// copies the cesium bundle and assets to public/cesium, runs on npm install
import { copyFileSync, cpSync, rmSync } from "node:fs";

const src = "node_modules/cesium/Build/Cesium";
const dest = "public/cesium";
rmSync(dest, { recursive: true, force: true });
for (const dir of ["Workers", "Assets", "ThirdParty", "Widgets"]) {
  cpSync(`${src}/${dir}`, `${dest}/${dir}`, { recursive: true });
}
copyFileSync(`${src}/Cesium.js`, `${dest}/Cesium.js`); // minified build
console.log("cesium assets copied to", dest);
