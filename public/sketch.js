let json_data;

// Number of topics
let num_topics;

//Current tweet
let current_step = 0;
let current_topic = 0;

// Master volume in decior audio
let synth;

// Whether the audio sequence is playing
let playing = false;

// The current Tone.Sequence
let sequence;

// The currently playing column
let currentColumn = 0;

// Here is the fixed scale we will use
// const notes = ["A3", "C4", "D4", "E3", "G4", "D2", "E2", "G2"];
const notes = ["G2", "A2", "B2", "C3","D3", "E3", "F3", "G3"];
const root_note_midi = Tone.Frequency('G2').toMidi();

// Also can try other scales/notes
// const notes = ["F#4", "E4", "C#4", "A4"];
// const notes = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4'];
// const notes = [ "A4", "D3", "E3", "G4", 'F#4' ];

// Number of rows is the number of different notes
const numRows = notes.length;

// Number of columns is depending on how many notes to play in a measure
const numCols = 16;
const noteInterval = `${numCols}n`;

// Setup audio config
Tone.Transport.bpm.value = 120;

// Array to store sequences
const sequence_data = [];

// canvas size
let dim = 0;

var p5_text_sketch = function (p) {

    let scl = 26;
    let cols, rows, chars_in_screen;

    let all_tweets_text = [];
    let all_tweets_coords = [];
    let all_tweets_topics = [];
    let text_input;

    p.setup = async () => {

        p.frameRate(10);
        var canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        dim = p.min(p.windowWidth, p.windowHeight);
        p.pixelDensity(window.devicePixelRatio);

        cols = p.floor(p.width / scl);
        rows = p.floor(p.height / scl);
        console.log(`dimension: ${cols}x${rows}`)
        chars_in_screen = cols * rows;
        p.noStroke();
        p.textSize(scl / 1.5);
        p.fill(127);

        json_data.forEach((tweet, idx) => {
            let coords = tweet.tsne_coords;
            let tweet_text = tweet.text.replace(/[^\x00-\xFF]/g, "");
            all_tweets_text.push(tweet_text);
            // all_tweets_coords.push(coords);
            // all_tweets_topics.push(tweet.topic);
        });


        text_input = all_tweets_text.join('\t');

        // let max_x = all_tweets_coords.reduce((max, current) =>
        //     Math.max(max, current[0]),
        //     -Infinity
        // );

        // all_tweets_coords = all_tweets_coords.map((coord, idx) => {
        //     let coord_in_screen_x = p.map(coord[0] / max_x, -1, 1, 0, p.windowWidth);
        //     return coord_in_screen_x;
        // });

        // console.log(all_tweets_coords);

        // Setup a reverb with ToneJS
        const reverb = new Tone.Reverb({
            decay: 4,
            wet: 0.2,
            preDelay: 0.25
        });

        // Load the reverb
        await reverb.generate();

        // Create an effect node that creates a feedback delay
        const effect = new Tone.FeedbackDelay(`${Math.floor(numCols / 2)}n`, 1 / 3);
        effect.wet.value = 0.2;

        // Setup a synth with ToneJS
        // We use a poly synth which can hold up to numRows voices
        // Then we will play each note on a different voice
        synth = new Tone.PolySynth(numRows, Tone.DuoSynth);

        // Setup the synths a little bit
        synth.set({
            voice0: {
                oscillator: {
                    type: "square4"
                },
                volume: -15,
                envelope: {
                    attack: 0.005,
                    release: 0.05,
                    sustain: 1
                }
            },
            voice1: {
                volume: -10,
                envelope: {
                    attack: 0.005,
                    release: 0.05,
                    sustain: 1
                }
            }
        });
        synth.volume.value = -15;

        // Wire up our nodes:
        synth.connect(effect);
        synth.connect(Tone.Master);
        effect.connect(reverb);
        reverb.connect(Tone.Master);

        // Every two measures, we randomize the notes
        // We use Transport to schedule timer since it has
        // to be exactly in sync with the audio
        Tone.Transport.scheduleRepeat(() => {
            randomizeSequencer();
        }, "8m");

    }

    let texthead = 0;

    let color_palette = [
        [201, 26.9, 89.0],
        [204, 82.8, 70.6],
        [92, 38.1, 87.5],
        [116, 72.5, 62.7],
        [1, 39.0, 98.4],
        [359, 88.5, 89.0],
        [34, 56.1, 99.2],
        [30, 100, 100],
        [280, 16.8, 83.9],
        [269, 60.4, 60.4]
    ]

    p.draw = () => {

        // Our synth isn't loaded yet, don't draw anything
        if (!synth) return;

        if (playing) {

            p.clear();
            // p.background(`rgba(255,255,255)`);
            var texthead_speed = (p.mouseX - p.windowWidth / 2) / (p.windowWidth / 2);
            texthead += texthead_speed * 5;

            if (texthead > text_input.length - chars_in_screen) {
                texthead = 0;
            } else if (texthead < 0) {
                texthead = 0;
            }

            // all_tweets_coords.forEach((coord, idx) => {
            //     p.push();
            //     p.fill(color_palette[all_tweets_topics[idx]]);
            //     p.ellipse(coord,p.windowHeight/2+all_tweets_topics[idx]*30, 5, 5);
            //     p.pop();
            // });


            for (var x = 0; x < cols; x++) {

                for (var y = 0; y < rows; y++) {

                    var index = (x + y * cols) + texthead;
                    var random_value = 0;
                    var mouse_change = p.abs(p.mouseY - p.windowHeight / 2) / p.windowHeight;

                    if (p.random() < mouse_change) {
                        random_value = p.floor(p.random() * 1000);
                    }


                    var character = p.int(p.unchar(text_input.charAt(index))) + random_value;


                    p.push();
                    p.translate(x * scl + (scl / 2), y * scl + (scl / 2));
                    p.fill(200);
                    p.text(p.char(character), 0, 0, scl, scl);
                    p.pop();

                }
            }


            if (p.frameCount > 200) {
                const margin = dim * 0.2;
                const innerSize = dim - margin * 2;
                const cellSize = innerSize / numCols;

                // Loop through the nested data structure, drawing each note
                sequence_data.forEach((data,idx) => {
                    p.push();
                    for (let y = 0; y < data.length; y++) {
                        let color;
                        if (idx !== current_topic) {
                            color = p.color(color_palette[idx][0],color_palette[idx][1],color_palette[idx][2],20);
                        } else {
                            color = p.color(color_palette[idx][0],color_palette[idx][1],color_palette[idx][2], 255);
                        }

                        const row = data[y];
                        for (let x = 0; x < row.length; x++) {
                            const u = x / (numCols - 1);
                            const v = y / (numRows - 1);
                            let px = p.lerp(margin, p.windowWidth - margin, u);
                            let py = p.lerp(margin, p.windowHeight - margin, v);

                            // draw a rectangle around the currently playing column
                            if (x === currentColumn) {
                                p.rectMode(p.CENTER);
                                // p.fill(color);
                                p.noFill();
                                p.rect(px, py, cellSize, cellSize);
                            }

                            p.noStroke();
                            p.noFill();

                            // note on=fill, note off=stroke
                            if (row[x] === 1) {
                                p.fill(color);
                            } else {
                                p.stroke(0);
                            }

                            // draw note
                            p.circle(px, py, cellSize / 2);

                        }

                    }
                    p.pop();
                });

            }

        } else {
            // Draw a 'play' button
            p.clear();
            p.noStroke();
            p.fill(0);
            polygon(p.width / 2, p.height / 2, dim * 0.1, 3);
        }
    }

    // When the mouse is pressed, turn on the sequencer
    p.mousePressed = () => {
        // No synth loaded yet, just skip mouse click
        if (!synth) {
            return;
        }

        if (playing) {
            // If we are currently playing, we stop the sequencer
            playing = false;
            sequence.stop();
            Tone.Transport.stop();
        } else {
            // If we aren't currently playing, we can start the sequence

            // We do this by creating an array of indices [ 0, 1, 2 ... 15 ]
            const noteIndices = newArray(numCols);
            // create the sequence, passing onSequenceStep function
            sequence = new Tone.Sequence(onSequenceStep, noteIndices, noteInterval);

            // Start the sequence and Transport loop
            playing = true;
            sequence.start();
            Tone.Transport.start();
        }
    }

    // Here is where we actually play the audio
    function onSequenceStep(time, column) {
        // We build up a list of notes, which will equal
        // the numRows. This gets passed into our PolySynth
        let notesToPlay = [];
        let notesToTranspose = [];

        // sequence_data[current_topic].forEach( (row, rowIndex)  => {
        //     // See if the note is "on"
        //     const isOn = row[column] == 1;
        //     // If its on, add it to the list of notes to play
        //     if (isOn) {
        //         const note = notes[rowIndex];
        //         notesToPlay.push(note);
        //     }
        // });

        // Go through each row
        sequence_data.forEach((data,idx) => {
            data.forEach((row, rowIndex) => {
                // See if the note is "on"
                const isOn = row[column] == 1;
                // If its on, add it to the list of notes to play
                if (isOn && (idx === current_topic)) {
                    const note = notes[rowIndex];
                    notesToPlay.push(note);
                } else if (isOn) {
                    const note = notes[rowIndex];
                    notesToTranspose.push(note)
                }
            });
        });

        if ((notesToTranspose.length > 0) && (notesToPlay.length > 0)) {
            notesToPlay = notesToPlay.map((note) => {
                return  p.random() > 0.5 ? p.random(notesToTranspose) : note;
            })
        }

        // console.log(Tone.Frequency(note).toMidi());


        // // If we're actually playing something then transpose
        // if ((notesToTranspose.length > 0) && (notesToPlay.length > 0)) {
        //     const transpose_note = p.random(notesToTranspose);
        //     const tranpose_value = Tone.Frequency(transpose_note).toMidi() - root_note_midi;
        //     console.log(tranpose_value);
        //     notesToPlay = notesToPlay.map((nnote) => {
        //         const new_note = Tone.Frequency(nnote).toMidi()+tranpose_value;
        //         return Tone.Midi(new_note).toNote();
        //     })
        // }


        // Trigger a note
        const velocity = p.random(0.5, 1);
        synth.triggerAttackRelease(notesToPlay, noteInterval, time, velocity);
        Tone.Draw.schedule(function () {
            currentColumn = column;
            if (current_step < json_data.length) {
                current_step++;    // increment step counter
                current_topic = json_data[current_step].topic;
            } else {
                current_step = 0;
            }
        }, time);
    }

    // Here we randomize the sequencer with some data
    function randomizeSequencer() {
        // Choose a % chance so that sometimes it is more busy, other times more sparse
        const chance = p.random(0.5, 1.5);
        sequence_data.forEach(data => {
            for (let y = 0; y < data.length; y++) {
                // Loop through and create some random on/off values
                const row = data[y];
                for (let x = 0; x < row.length; x++) {
                    row[x] = p.randomGaussian() > chance ? 1 : 0;
                }
                // Loop through again and make sure we don't have two
                // consectutive on values (it sounds bad)
                for (let x = 0; x < row.length - 1; x++) {
                    if (row[x] === 1 && row[x + 1] === 1) {
                        row[x + 1] = 0;
                        x++;
                    }
                }
            }
        });
    }

    // Draw a basic polygon, handles triangles, squares, pentagons, etc
    function polygon(x, y, radius, sides = 3, angle = 0) {
        p.beginShape();
        for (let i = 0; i < sides; i++) {
            const a = angle + p.TWO_PI * (i / sides);
            let sx = x + p.cos(a) * radius;
            let sy = y + p.sin(a) * radius;
            p.vertex(sx, sy);
        }
        p.endShape(p.CLOSE);
    }

    // A utility function to create a new array
    // full of indices [ 0, 1, 2, ... (N - 1) ]
    function newArray(n) {
        const array = [];
        for (let i = 0; i < n; i++) {
            array.push(i);
        }
        return array;
    }

}


async function loadJSON(url) {
    const res = await fetch(url);
    return await res.json();
}

loadJSON('tweets.json')
    .then(data => {
        json_data = data;
        // console.log(json_data[0]);
        num_topics = json_data[0].weigths.length;
        console.log(`num of topics: ${num_topics}`)

        // Create a Topics*(Row*Col) data structure that has nested arrays
        // [ [ [ 0, 0, 0 ], [ 0, 0, 0 ], ... ], ... ]
        // The data can be 0 (off) or 1 (on)
        for (let t = 0; t < num_topics; t++) {
            const matrix = []
            for (let y = 0; y < numRows; y++) {
                const row = [];
                for (let x = 0; x < numCols; x++) {
                    row.push(0);
                }
                matrix.push(row);
            }
            sequence_data.push(matrix);
        }
        // console.log(sequence_data);
    })
    .then(data => {
        // var p5_3d = new p5(p5_3d_sketch, '3d_sketch');
        var p5_text = new p5(p5_text_sketch, 'sketch');
    });
