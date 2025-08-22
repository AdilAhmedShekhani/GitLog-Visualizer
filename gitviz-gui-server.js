const http = require("http");
const { exec } = require("child_process");

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }

    if (req.method === "POST" && req.url === "/run") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            try {
                const { command } = JSON.parse(body);
                console.log("Received command:", command);

                exec(command, (err, stdout, stderr) => {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    if (err) {
                        return res.end(JSON.stringify({ error: stderr || err.message }));
                    }

                    try {
                        // If stdout is valid JSON, return as-is
                        const parsed = JSON.parse(stdout);
                        res.end(JSON.stringify(parsed));
                    } catch {
                        // Not JSON → wrap it
                        res.end(JSON.stringify({ output: stdout }));
                    }
                });
            } catch {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid request" }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(3000, () => console.log(`GitViz Web GUI server running at: http://localhost:3000\nSystem: ${process.platform} ${process.arch}`));
