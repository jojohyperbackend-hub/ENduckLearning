// Jalanin backend FastAPI dari folder root.
// Pakai Python dari virtualenv backend kalau ada (backend/venv atau backend/.venv),
// kalau gak ada pakai "python" global. Jadi jalan di laptop yang pakai venv maupun yang enggak.
//
//   node scripts/run-backend.cjs            -> uvicorn app.main:app --reload (port 8000)
//   node scripts/run-backend.cjs --install  -> pip install -r requirements.txt
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const backendDir = path.resolve(__dirname, "..", "backend");
const isWindows = process.platform === "win32";

const findPython = () => {
  for (const venv of ["venv", ".venv"]) {
    const candidate = isWindows
      ? path.join(backendDir, venv, "Scripts", "python.exe")
      : path.join(backendDir, venv, "bin", "python");
    if (fs.existsSync(candidate)) return candidate;
  }
  return isWindows ? "python" : "python3";
};

if (!fs.existsSync(path.join(backendDir, "app", "main.py"))) {
  console.error(`Folder backend gak ketemu di ${backendDir} (butuh backend/app/main.py).`);
  process.exit(1);
}
if (!fs.existsSync(path.join(backendDir, ".env.local"))) {
  console.warn("Peringatan: backend/.env.local belum ada, backend bakal gagal start.");
}

const python = findPython();
const install = process.argv.includes("--install");
const args = install
  ? ["-m", "pip", "install", "-r", "requirements.txt"]
  : ["-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"];

console.log(`[backend] ${python} ${args.join(" ")}`);
const child = spawn(python, args, { cwd: backendDir, stdio: "inherit" });

child.on("error", (error) => {
  console.error(
    error.code === "ENOENT"
      ? `Python gak ketemu ("${python}"). Install Python atau bikin venv di folder backend.`
      : `Gagal jalanin backend: ${error.message}`,
  );
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 0));
for (const event of ["SIGINT", "SIGTERM"]) {
  process.on(event, () => child.kill(event));
}
