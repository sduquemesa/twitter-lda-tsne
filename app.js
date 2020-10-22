const express = require('express')
const { spawn } = require('child_process');

const app = express()
app.use(express.static('public'))

app.set('port', '3000')

var server = app.listen(3000, () => {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://' + host + ':' + port);
});


// Handle API route: run python program and send data to api endpoint
let run_python = new Promise(function(success, nosuccess) {
    const { spawn } = require('child_process');
    const pyprog = spawn('python', ['twitter_lda.py']);

    pyprog.stdout.on('data', (data) => {
        success(data);
    });
    
    pyprog.stderr.on('data', (data) => {
        nosuccess(data);
    });
});

app.get('/data', (req, res) => {
    run_python.then(function(data) {
        // console.log(data.toString());
        res.end(data);
    });
})