const express = require('express');
const http = require('http');
const net = require('net');
const config = require('./config');
const app = express();
const expressWs = require('express-ws')(app);
const path = require('path');
const fs = require('fs');



console.log(config.hostname, ",", config.port);


// +===============================================+
// ||                  TCP Server                 ||
// +===============================================+

var tcpClients = [];
function identityVerification(socket) {
    if (findTcpClient(socket, false).verified) {
        return;
    }
    else {
        tcpClients.splice(findTcpClient(socket, true), 1);
        socket.destroy();
    }
}

function findTcpClient(socket, returnIndex) {
    for (let i=0; i<tcpClients.length; i++) {
        if (tcpClients[i].socket === socket) {
            if (returnIndex) {
                return i;
            }
            else {
                return tcpClients[i];
            }
        }
    }
    return null;
}

var tcpServer = net.createServer(function(socket) {
    // Require Verification
    tcpClients.push({
        socket: socket,
        address: socket.address,
        port: socket.port,
        verified: false
    });

    setTimeout(function() {
        identityVerification(socket);
    }, 3000)


    socket.on('data', function(data) {
        data = readMessage(data);

        if (data.type === "verification") {
            if (data.verificationCode === "knotabug") {
                tcpClients[findTcpClient(socket, true)].verified = true;
            }
        }

        if (findTcpClient(socket, false).verified) {
            switch (data.type) {
                default:
                    console.log("Got unknown TCP message of type", type, data);
                    break;
            }
        }
    });


    socket.on('end', function() {
        console.log("Closed Socket");
    });


    socket.on('err', function() {
        console.log("Socket Error");
    });
});

tcpServer.listen(config.port+1, function() {
    console.log("TCP Server up on port", config.port+1);
});




// +===============================================+
// ||                 HTTP Server                 ||
// +===============================================+

var httpClients = []

app.use('/javascripts',express.static('public/javascripts'));
app.use('/stylesheets',express.static('public/stylesheets'));
app.use('/third_party',express.static('node_modules/three.ar.js/third_party'));
app.use('/dist',express.static('node_modules/three.ar.js/dist'));
app.use('/models',express.static(__dirname + '/public/models'));

/*
 * Root
 * Send 'hiya'
 */
app.get('/', function(req, res) {
    console.log("serving root");
    res.sendFile(__dirname+"/public/root.html");
});

/*
 * Pairing
 * add devices which access this url to the list of httpClients
 */
app.get('/pair', function(req, res) {
    console.log("Pairing request by", req, "\n\n", res);
    let data = {
        ip: req.address,
        port: req.port,
        id: httpClients.length
    }
    httpClients.push(data);
    console.log("Connected new client. Now have", httpClients.length, "clients.");
    res.end(JSON.stringify({
        connection: "successful",
        clientId: data.id,
        clientAddress: data.ip,
        clientPort: data.port
    }));
});


app.get('/sensor', function(req, res) {
    console.log("Serving sensor");
    res.sendFile(__dirname+"/public/sensor.html");
});

app.get('/vr', function(req, res) {
    console.log("Serving VR");
    res.sendFile(__dirname+"/public/webvr.html");
})

app.get('/anchor', function(req, res) {
    res.sendFile(__dirname+"/public/examples/anchors.html");
})

app.get('/x', function(req, res) {
    res.sendFile(__dirname+"/node_modules/three.ar.js/examples/spawn-at-camera.html");
})



/*
 * Start Server
 * Listening on port specified in ./config.js
 */
app.listen(config.port, function() { console.log("Listening on", config.port); });





// +===============================================+
// ||                 Web Socket                  ||
// +===============================================+

webClients = [];

app.ws('/', function(ws, req) {
    console.log("Websocket connected");
    webClients.push(ws);


    ws.on('message', function(msg) {
        msg = readMessage(msg);

        switch(msg.type) {
            case "verification":
                console.log("Verifying (does nothing)");
                break;
            case "getModelLocations":
                console.log("Sending Model Locations");
                sendModelLocations(ws);
                break;
            default:
                console.log("Got unknown message of", msg.type, "type.");
                break;
        }
    });
});




// +===============================================+
// ||                  Helper                     ||
// +===============================================+

/*
 * Reads a JSON message and returns the message
 * reads message length from the beginning of the line,
 * then parses message as a JSON.
 * if it isn't a JSON, returns {type: "Error"}
 * otherwise, returns an object created from the JSON.
 */
function readMessage(msg) {
    // Get length of message in first few bytes
    // TODO: implement

    // parse as JSON
    try {
        msg = JSON.parse(msg);
    } catch (e) {
        console.log("Got non-json message:", msg);
        msg = {type: "Error"};
    }

    return msg;
}

function sendWsMessage(msg, websocket) {
    websocket.send(JSON.stringify(msg));
}


/*
 * Reads models/locations.json and sends its contents to websocket
 */
function sendModelLocations(ws) {
    var filepath = "public/models/locations.json";

    fs.stat(filepath, function(err, stat) {
        // If the file exists, append to the list
        if (err == null) {
            fs.readFile(filepath, 'utf8', function(err, data) {
                if (err) {
                    console.error("\tError Reading", filepath, "\n\t\tFile not saved.");
                    return;
                }
                let locations = JSON.parse(data.toString());
                sendWsMessage({type:"modelLocations", locations:locations}, ws);
                console.log("Model Locations Sent.");
            });
        }
        // If the folder doesn't exist, create it.
        else if (err.code == 'ENOENT') {
            console.error("No locations.json file")
        }
        else {
            console.error("Error while reading locations.json", err.code)
        }
    })
}
