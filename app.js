const express = require('express')
const { spawn } = require('child_process');

const app = express()
app.use(express.static('public'))

app.set('port', '5000')

var server = app.listen(5000, () => {
    var host = server.address().address;
    var port = server.address().port;
    console.log('App listening at ' + host + ':' + port);
});


// Handle API route: run python program and send data to api endpoint
app.get('/data', (req, res) => {
    const { spawn } = require('child_process');
    const python = spawn('python', ['twitter_lda.py']);
    console.log('Handling request:');

    let collected_data = [];
    python.stdout.on('data', function (data) {
        console.log('Piping data...');
        collected_data.push(data);
        // res.write(data);
        // res.end();
    });
    python.stderr.on('data', (data) => {
        res.write('ERROR:')
        res.write(data);
    });
    python.on('close', (code) => {
        console.log(`DONE: child process close all stdio with code ${code}`);
        res.send(decodeURIComponent(collected_data.join('')));
        res.end();
    })
});