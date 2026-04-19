const http = require("http");
const fs = require("fs");

const server = http.createServer((req, res) => {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
    }

    req.url = req.url.split("?")[0];

    if (req.method === "GET") {
        if (req.url === "/") {
            let data = "<h1>File has not yet been created</h1>";

            if (fs.existsSync("./index.html"))
                data = fs.readFileSync("./index.html");

            res.writeHead(200, { 'Content-Type': "text/html" });
            res.end(data)
            return;
        } else {


            if (!req.url.includes(".")) {
                req.url += ".ts";
                //return;
            }

            if (!fs.existsSync("." + req.url)) {
                console.error(`Request for non existing file - ${req.url}`);
                return;
            }

            const mimetypes = {
                '.html': "text/html",
                '.css': "text/css",
                '.js': "application/javascript",
                '.json': "application/json",
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml'
            }

            const data = fs.readFileSync("." + req.url);
            const mimeType = "." + req.url.split(".").at(-1);
            res.writeHead(200, { 'Content-Type': mimetypes[mimeType] });
            res.end(data)
        }
    }
})

server.listen(3000, () => {
    console.log("http://localhost:3000")
})